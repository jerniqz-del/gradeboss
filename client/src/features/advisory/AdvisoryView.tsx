import { useCallback, useEffect, useRef, useState } from "react";
import {
  activeAdvisoryClass,
  applyConflictDecisionToAll,
  applyGradeTransferImport,
  assignUnmatchedLearner,
  copyLearnersFromLoad,
  createAdvisoryClass,
  matchingLoadsForAdvisory,
  officialFullName,
  planGradeTransferImport,
  resetAdvisoryClass,
  setConflictDecision,
  setSubjectSource,
  syncGradesFromLoad,
  undoLatestImport,
  updateSpecialSubjects,
  upsertAdvisoryLearner,
  type ImportPlan,
} from "../../domain/advisory";
import type { AdvisoryClass, AdvisoryLearner, AdvisoryStore } from "../../models/advisory";
import { advisoryLearnerAsLearner, createEmptyAdvisoryStore, createRecordId, nowIso } from "../../models/advisory";
import type { TeachingLoad } from "../../models/teaching-load";
import { createDefaultProfile } from "../../models/teacher-profile";
import { getAdvisoryStore, listTeachingLoads, saveAdvisoryStore } from "../../storage";
import { ensureStorageReady, getTeacherProfile } from "../../storage/init";
import { SCHOOL_YEARS } from "../teaching-loads/catalog";
import { LearnerForm } from "../roster/LearnerForm";
import { GradeMatrix } from "./GradeMatrix";
import { downloadAdvisoryGradePdf } from "../exports/pdf-advisory";

type Tab = "grades" | "import" | "roster" | "sources" | "settings";

export function AdvisoryView() {
  const [store, setStore] = useState<AdvisoryStore>(createEmptyAdvisoryStore);
  const [loads, setLoads] = useState<TeachingLoad[]>([]);
  const [schoolYear, setSchoolYear] = useState("2026-2027");
  const [tab, setTab] = useState<Tab>("grades");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const [nextStore, nextLoads, db] = await Promise.all([
      getAdvisoryStore(),
      listTeachingLoads(),
      ensureStorageReady(),
    ]);
    const profile = (await getTeacherProfile(db)) || createDefaultProfile();
    setStore(nextStore);
    setLoads(nextLoads);
    setSchoolYear(profile.schoolYear || "2026-2027");
  }, []);

  useEffect(() => {
    void refresh().catch((err: unknown) => {
      setError(err instanceof Error ? err.message : "Failed to load Advisory Class");
    });
  }, [refresh]);

  const persist = async (next: AdvisoryStore) => {
    setStore(await saveAdvisoryStore(next));
  };

  const advisoryClass = activeAdvisoryClass(store, schoolYear);

  return (
    <section>
      <div className="page-header">
        <h2>Advisory Class</h2>
        <p>Consolidate subject finals and exchange Grade Transfer Files offline.</p>
      </div>
      {error && <div className="banner error">{error}</div>}
      {notice && <div className="banner warn">{notice}</div>}
      {!advisoryClass ? (
        <SetupCard
          schoolYear={schoolYear}
          loads={loads}
          busy={busy}
          onCreate={async (input) => {
            setBusy(true);
            setError(null);
            try {
              await persist(createAdvisoryClass(store, input));
              setTab("roster");
            } catch (err) {
              setError(err instanceof Error ? err.message : "Could not create Advisory Class");
            } finally {
              setBusy(false);
            }
          }}
        />
      ) : (
        <>
          <div className="form-preview">
            <span className="pill">SY {advisoryClass.schoolYear}</span>
            <span className="pill">
              G{advisoryClass.gradeLevel} {advisoryClass.section}
            </span>
            <span className="pill">{advisoryClass.adviserName}</span>
            {advisoryClass.isSpecialClass && <span className="pill">{advisoryClass.specialProgramName}</span>}
          </div>
          <div className="sheet-tabs" role="tablist" aria-label="Advisory">
            {(
              [
                ["grades", "Grades"],
                ["import", "Import"],
                ["roster", "Roster"],
                ["sources", "Sources"],
                ["settings", "Settings"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={tab === id ? "sheet-tab active" : "sheet-tab"}
                onClick={() => setTab(id)}
              >
                {label}
              </button>
            ))}
          </div>
          {tab === "grades" && (
            <>
              <div className="sheet-export no-print">
                <button
                  type="button"
                  className="ghost"
                  onClick={() => downloadAdvisoryGradePdf(store, advisoryClass, "finals")}
                >
                  PDF — final grades
                </button>
                <button
                  type="button"
                  className="ghost"
                  onClick={() => downloadAdvisoryGradePdf(store, advisoryClass, "terms")}
                >
                  PDF — terms 1–3
                </button>
              </div>
              <GradeMatrix
                advisoryClass={advisoryClass}
                learners={store.learners.filter((item) => item.advisoryClassId === advisoryClass.id)}
                subjects={store.subjects.filter((item) => item.advisoryClassId === advisoryClass.id)}
                grades={store.grades.filter((item) => item.advisoryClassId === advisoryClass.id)}
              />
            </>
          )}
          {tab === "import" && (
            <ImportTab
              store={store}
              advisoryClass={advisoryClass}
              onChange={persist}
              onError={setError}
              onNotice={setNotice}
            />
          )}
          {tab === "roster" && (
            <RosterTab store={store} advisoryClass={advisoryClass} loads={loads} onChange={persist} onError={setError} />
          )}
          {tab === "sources" && (
            <SourcesTab store={store} advisoryClass={advisoryClass} loads={loads} onChange={persist} onError={setError} />
          )}
          {tab === "settings" && (
            <SettingsTab
              store={store}
              advisoryClass={advisoryClass}
              onChange={persist}
              onError={setError}
            />
          )}
        </>
      )}
    </section>
  );
}

function SetupCard({
  schoolYear,
  loads,
  busy,
  onCreate,
}: {
  schoolYear: string;
  loads: TeachingLoad[];
  busy: boolean;
  onCreate: (input: {
    schoolYear: string;
    gradeLevel: string;
    section: string;
    adviserName: string;
    schoolName?: string;
    isSpecialClass?: boolean;
    specialProgramName?: string;
    specialSubjects?: Array<{ name: string; includeInGeneralAverage: boolean }>;
  }) => Promise<void>;
}) {
  const sections = [...new Set(loads.filter((item) => item.schoolYear === schoolYear).map((item) => item.section))];
  const [gradeLevel, setGradeLevel] = useState(loads[0]?.gradeLevel || "7");
  const [section, setSection] = useState(sections[0] || "");
  const [adviserName, setAdviserName] = useState("");
  const [special, setSpecial] = useState(false);
  const [program, setProgram] = useState("");
  const [special1, setSpecial1] = useState("");
  const [special1Ga, setSpecial1Ga] = useState(true);
  const [special2, setSpecial2] = useState("");
  const [special2Ga, setSpecial2Ga] = useState(true);

  return (
    <div className="card">
      <h3>Create Advisory Class</h3>
      <p className="muted">One active class per school year. Standard subjects are added from the grade level.</p>
      <form
        className="form-grid"
        onSubmit={(event) => {
          event.preventDefault();
          void onCreate({
            schoolYear,
            gradeLevel,
            section,
            adviserName,
            isSpecialClass: special,
            specialProgramName: program,
            specialSubjects: special
              ? [
                  { name: special1, includeInGeneralAverage: special1Ga },
                  { name: special2, includeInGeneralAverage: special2Ga },
                ]
              : [],
          });
        }}
      >
        <label>
          Grade level
          <select value={gradeLevel} onChange={(e) => setGradeLevel(e.target.value)}>
            {Array.from({ length: 12 }, (_, i) => String(i + 1)).map((grade) => (
              <option key={grade} value={grade}>
                Grade {grade}
              </option>
            ))}
          </select>
        </label>
        <label>
          Section
          <input list="advisory-sections" value={section} onChange={(e) => setSection(e.target.value)} required />
          <datalist id="advisory-sections">
            {sections.map((item) => (
              <option key={item} value={item} />
            ))}
          </datalist>
        </label>
        <label>
          Adviser
          <input value={adviserName} onChange={(e) => setAdviserName(e.target.value)} required />
        </label>
        <label>
          School year
          <select value={schoolYear} disabled>
            {SCHOOL_YEARS.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </label>
        <label className="checkbox-row">
          <input type="checkbox" checked={special} onChange={(e) => setSpecial(e.target.checked)} />
          This is a Special Class
        </label>
        {special && (
          <>
            <label>
              Program name
              <input value={program} onChange={(e) => setProgram(e.target.value)} placeholder="Journalism" required />
            </label>
            <label>
              Special subject 1
              <input value={special1} onChange={(e) => setSpecial1(e.target.value)} required />
            </label>
            <label className="checkbox-row">
              <input type="checkbox" checked={special1Ga} onChange={(e) => setSpecial1Ga(e.target.checked)} />
              Include in General Average
            </label>
            <label>
              Special subject 2 (optional)
              <input value={special2} onChange={(e) => setSpecial2(e.target.value)} />
            </label>
            <label className="checkbox-row">
              <input type="checkbox" checked={special2Ga} onChange={(e) => setSpecial2Ga(e.target.checked)} />
              Include in General Average
            </label>
          </>
        )}
        <button type="submit" className="primary" disabled={busy}>
          Save Advisory Class
        </button>
      </form>
    </div>
  );
}

function ImportTab({
  store,
  advisoryClass,
  onChange,
  onError,
  onNotice,
}: {
  store: AdvisoryStore;
  advisoryClass: AdvisoryClass;
  onChange: (store: AdvisoryStore) => Promise<void>;
  onError: (message: string | null) => void;
  onNotice: (message: string | null) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const batches = store.importBatches
    .filter((item) => item.advisoryClassId === advisoryClass.id)
    .slice()
    .sort((a, b) => b.importedAt.localeCompare(a.importedAt));

  const onFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    onError(null);
    try {
      const raw = JSON.parse(await file.text()) as unknown;
      setPlan(planGradeTransferImport(store, advisoryClass, raw, file.name));
    } catch (err) {
      onError(err instanceof Error ? err.message : "Could not read that Grade Transfer File.");
    }
  };

  return (
    <div className="card">
      <h3>Import Grade Transfer File</h3>
      <p className="muted">Preview never changes stored grades. Conflicts need an explicit keep or replace.</p>
      <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => void onFile(e)} />
      <button type="button" className="primary" onClick={() => fileRef.current?.click()}>
        Choose JSON file
      </button>
      {plan && (
        <div className="advisory-import-plan">
          {plan.errors.map((item) => (
            <div key={item} className="banner error">
              {item}
            </div>
          ))}
          {plan.warnings.map((item) => (
            <div key={item} className="banner warn">
              {item}
            </div>
          ))}
          <p>
            {plan.payload.subject.name} · Term {plan.payload.term.number} · {plan.importableCount} ready · {plan.conflictCount}{" "}
            conflicts · {plan.unmatchedCount} unmatched
          </p>
          {plan.conflictCount > 0 && (
            <div className="load-actions">
              <button type="button" className="ghost" onClick={() => setPlan(applyConflictDecisionToAll(plan, "keep"))}>
                Keep all existing
              </button>
              <button type="button" className="ghost" onClick={() => setPlan(applyConflictDecisionToAll(plan, "replace"))}>
                Replace all
              </button>
            </div>
          )}
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Incoming</th>
                  <th>Match</th>
                  <th>Decision</th>
                </tr>
              </thead>
              <tbody>
                {plan.rows.map((row) => (
                  <tr key={row.index}>
                    <td>
                      {officialFullName(row.incoming)}
                      <small>
                        {" "}
                        {row.incoming.lrn || "No LRN"} · {row.incoming.finalGrade}
                      </small>
                    </td>
                    <td>
                      {row.matchedLearner ? officialFullName(row.matchedLearner) : row.status}
                      {row.warning && <small> {row.warning}</small>}
                    </td>
                    <td>
                      {row.status === "conflict" && (
                        <div className="load-actions">
                          <button type="button" className="ghost" onClick={() => setPlan(setConflictDecision(plan, row.index, "keep"))}>
                            Keep {row.existingGrade?.finalGrade}
                          </button>
                          <button type="button" className="ghost" onClick={() => setPlan(setConflictDecision(plan, row.index, "replace"))}>
                            Replace {row.incoming.finalGrade}
                          </button>
                        </div>
                      )}
                      {(row.status === "unmatched" || row.status === "ambiguous") && (
                        <select
                          value=""
                          onChange={(e) => {
                            if (!e.target.value) return;
                            try {
                              setPlan(assignUnmatchedLearner(store, plan, row.index, e.target.value));
                            } catch (err) {
                              onError(err instanceof Error ? err.message : "Could not map that learner");
                            }
                          }}
                        >
                          <option value="">Map to advisory learner</option>
                          {store.learners
                            .filter((item) => item.advisoryClassId === advisoryClass.id)
                            .map((item) => (
                              <option key={item.id} value={item.id}>
                                {officialFullName(item)}
                              </option>
                            ))}
                        </select>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            type="button"
            className="primary"
            disabled={!plan.canImport}
            onClick={async () => {
              try {
                await onChange(applyGradeTransferImport(store, plan));
                setPlan(null);
                onNotice(`Imported ${plan.importableCount} grade${plan.importableCount === 1 ? "" : "s"} from ${plan.filename}.`);
              } catch (err) {
                onError(err instanceof Error ? err.message : "Import failed");
              }
            }}
          >
            Confirm import
          </button>
        </div>
      )}
      <h3>Import history</h3>
      <button
        type="button"
        className="ghost"
        disabled={!batches.some((item) => item.status !== "undone")}
        onClick={async () => {
          try {
            await onChange(undoLatestImport(store, advisoryClass.id));
            onNotice("Latest import undone.");
          } catch (err) {
            onError(err instanceof Error ? err.message : "Undo failed");
          }
        }}
      >
        Undo latest import
      </button>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Imported</th>
              <th>File</th>
              <th>Subject</th>
              <th>Result</th>
            </tr>
          </thead>
          <tbody>
            {batches.length === 0 ? (
              <tr>
                <td colSpan={4} className="muted">
                  No imports yet.
                </td>
              </tr>
            ) : (
              batches.map((batch) => (
                <tr key={batch.id}>
                  <td>{batch.importedAt.slice(0, 10)}</td>
                  <td>{batch.filename}</td>
                  <td>
                    {batch.subject} · T{batch.term}
                  </td>
                  <td>
                    {batch.status} · {batch.importedCount} in · {batch.conflictCount} conflicts
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RosterTab({
  store,
  advisoryClass,
  loads,
  onChange,
  onError,
}: {
  store: AdvisoryStore;
  advisoryClass: AdvisoryClass;
  loads: TeachingLoad[];
  onChange: (store: AdvisoryStore) => Promise<void>;
  onError: (message: string | null) => void;
}) {
  const [adding, setAdding] = useState(false);
  const sources = matchingLoadsForAdvisory(loads, advisoryClass);
  const learners = store.learners.filter((item) => item.advisoryClassId === advisoryClass.id);

  return (
    <div className="card">
      <h3>Official roster</h3>
      <p className="muted">Copy from a matching teaching load or add a learner. LRN must be unique in this class.</p>
      {sources.length > 0 && (
        <div className="load-actions">
          {sources.map((load) => (
            <button
              key={load.id}
              type="button"
              className="ghost"
              onClick={async () => {
                const result = copyLearnersFromLoad(store, advisoryClass.id, load.learners);
                await onChange(result.store);
                onError(null);
              }}
            >
              Copy {load.subject} ({load.learners.length})
            </button>
          ))}
        </div>
      )}
      {adding ? (
        <LearnerForm
          roster={learners.map(advisoryLearnerAsLearner)}
          onCancel={() => setAdding(false)}
          onSave={async (learner) => {
            try {
              const createdAt = nowIso();
              const row: AdvisoryLearner = {
                id: createRecordId("advisory-learner"),
                advisoryClassId: advisoryClass.id,
                linkedLearnerId: learner.id,
                lrn: learner.lrn,
                lastName: learner.lastName,
                firstName: learner.firstName,
                middleName: learner.middleName,
                extensionName: learner.extensionName || "",
                sex: learner.sex,
                avatarPresetId: learner.avatarPresetId || "",
                avatarAssignment: learner.avatarAssignment || "auto",
                birthdate: learner.birthdate,
                enrollmentStatus: "active",
                source: "manual",
                createdAt,
                updatedAt: createdAt,
              };
              await onChange(upsertAdvisoryLearner(store, row));
              setAdding(false);
            } catch (err) {
              onError(err instanceof Error ? err.message : "Could not save learner");
            }
          }}
        />
      ) : (
        <button type="button" className="primary" onClick={() => setAdding(true)}>
          Add learner
        </button>
      )}
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Learner</th>
              <th>LRN</th>
              <th>Sex</th>
            </tr>
          </thead>
          <tbody>
            {learners.map((item) => (
              <tr key={item.id}>
                <td>{officialFullName(item)}</td>
                <td>{item.lrn || "—"}</td>
                <td>{item.sex || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SourcesTab({
  store,
  advisoryClass,
  loads,
  onChange,
  onError,
}: {
  store: AdvisoryStore;
  advisoryClass: AdvisoryClass;
  loads: TeachingLoad[];
  onChange: (store: AdvisoryStore) => Promise<void>;
  onError: (message: string | null) => void;
}) {
  const subjects = store.subjects
    .filter((item) => item.advisoryClassId === advisoryClass.id && !item.isArchived)
    .sort((a, b) => a.displayOrder - b.displayOrder);
  const matches = matchingLoadsForAdvisory(loads, advisoryClass);

  return (
    <div className="card">
      <h3>Grade sources</h3>
      <p className="muted">Grade Transfer File is the default. Link a matching load on this device to pull term finals.</p>
      {subjects.map((subject) => (
        <div key={subject.id} className="form-grid advisory-source-row">
          <strong>{subject.subjectName}</strong>
          <label>
            Source
            <select
              value={subject.sourceType}
              onChange={(e) =>
                void onChange(
                  setSubjectSource(store, subject.id, {
                    sourceType: e.target.value as typeof subject.sourceType,
                    expectedSourceClassId: subject.expectedSourceClassId,
                    expectedSourceClass: subject.expectedSourceClass,
                  }),
                )
              }
            >
              <option value="grade-transfer-file">Grade Transfer File</option>
              <option value="local-subject-class">Matching class in this app</option>
              <option value="manual">Manual</option>
            </select>
          </label>
          {subject.sourceType === "local-subject-class" && (
            <>
              <label>
                Teaching load
                <select
                  value={subject.expectedSourceClassId}
                  onChange={(e) => {
                    const load = matches.find((item) => item.id === e.target.value);
                    void onChange(
                      setSubjectSource(store, subject.id, {
                        sourceType: "local-subject-class",
                        expectedSourceClassId: e.target.value,
                        expectedSourceClass: load ? `${load.subject} ${load.gradeLevel} - ${load.section}` : "",
                      }),
                    );
                  }}
                >
                  <option value="">Select a class</option>
                  {matches.map((load) => (
                    <option key={load.id} value={load.id}>
                      {load.subject}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className="ghost"
                onClick={async () => {
                  const load = loads.find((item) => item.id === subject.expectedSourceClassId);
                  if (!load) {
                    onError("Choose a matching teaching load first.");
                    return;
                  }
                  await onChange(syncGradesFromLoad(store, advisoryClass, subject, load));
                  onError(null);
                }}
              >
                Sync grades now
              </button>
            </>
          )}
        </div>
      ))}
    </div>
  );
}

function SettingsTab({
  store,
  advisoryClass,
  onChange,
  onError,
}: {
  store: AdvisoryStore;
  advisoryClass: AdvisoryClass;
  onChange: (store: AdvisoryStore) => Promise<void>;
  onError: (message: string | null) => void;
}) {
  const specials = store.subjects.filter(
    (item) => item.advisoryClassId === advisoryClass.id && item.isSpecialProgramSubject && !item.isArchived,
  );
  const [program, setProgram] = useState(advisoryClass.specialProgramName);
  const [one, setOne] = useState(specials[0]?.subjectName || "");
  const [oneGa, setOneGa] = useState(specials[0]?.includeInGeneralAverage !== false);
  const [two, setTwo] = useState(specials[1]?.subjectName || "");
  const [twoGa, setTwoGa] = useState(specials[1]?.includeInGeneralAverage !== false);

  return (
    <div className="card">
      <h3>Advisory settings</h3>
      <form
        className="form-grid"
        onSubmit={async (event) => {
          event.preventDefault();
          try {
            await onChange(
              updateSpecialSubjects(store, advisoryClass.id, program, [
                { name: one, includeInGeneralAverage: oneGa },
                { name: two, includeInGeneralAverage: twoGa },
              ]),
            );
          } catch (err) {
            onError(err instanceof Error ? err.message : "Could not update settings");
          }
        }}
      >
        <label>
          Special program name
          <input value={program} onChange={(e) => setProgram(e.target.value)} />
        </label>
        <label>
          Special subject 1
          <input value={one} onChange={(e) => setOne(e.target.value)} />
        </label>
        <label className="checkbox-row">
          <input type="checkbox" checked={oneGa} onChange={(e) => setOneGa(e.target.checked)} />
          Include in General Average
        </label>
        <label>
          Special subject 2
          <input value={two} onChange={(e) => setTwo(e.target.value)} />
        </label>
        <label className="checkbox-row">
          <input type="checkbox" checked={twoGa} onChange={(e) => setTwoGa(e.target.checked)} />
          Include in General Average
        </label>
        <button type="submit" className="primary">
          Save special subjects
        </button>
      </form>
      <button
        type="button"
        className="ghost danger"
        onClick={async () => {
          if (!window.confirm("Reset this Advisory Class? Teaching loads are not changed.")) return;
          await onChange(resetAdvisoryClass(store, advisoryClass.id));
        }}
      >
        Reset Advisory Class
      </button>
    </div>
  );
}
