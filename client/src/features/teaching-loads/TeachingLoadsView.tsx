import { useEffect, useMemo, useState, type FormEvent } from "react";
import { api } from "../../api";
import {
  determinePolicy,
  determineSubjectGroup,
  SENIOR_HIGH_SUBJECT_GROUPS,
} from "../../domain/grading";
import { Icon } from "../../Icon";
import type { TeachingLoad } from "../../models/teaching-load";
import { ActiveClassBar } from "../shell/ActiveClassBar";
import { notifyWorkspaceChanged } from "../shell/chrome";
import { RosterPanel } from "../roster/RosterPanel";
import { SCHOOL_YEARS, subjectsForGrade } from "./catalog";
import { createTeachingLoad, formatWeights, policyLabel } from "./create-load";

export function TeachingLoadsView({
  onOpenSheet,
  initialRosterLoadId,
}: {
  onOpenSheet: (loadId: string) => void;
  initialRosterLoadId?: string | null;
}) {
  const [loads, setLoads] = useState<TeachingLoad[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(initialRosterLoadId ?? null);
  const [gradeLevel, setGradeLevel] = useState("4");
  const [section, setSection] = useState("");
  const [subject, setSubject] = useState("Mathematics");
  const [schoolYear, setSchoolYear] = useState("2026-2027");
  const [shsGroup, setShsGroup] = useState("");

  const subjects = useMemo(() => subjectsForGrade(gradeLevel), [gradeLevel]);
  const isShs = Number(gradeLevel) >= 11;
  const previewPolicy = determinePolicy(gradeLevel, subject, schoolYear);
  const previewGroup = determineSubjectGroup(gradeLevel, subject, previewPolicy, shsGroup || undefined);

  const refresh = async () => {
    try {
      const next = await api.getTeachingLoads();
      setLoads(next);
      setSelectedId((current) => current || initialRosterLoadId || next[0]?.id || null);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load teaching loads");
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    if (initialRosterLoadId) setSelectedId(initialRosterLoadId);
  }, [initialRosterLoadId]);

  useEffect(() => {
    if (!subjects.includes(subject)) setSubject(subjects[0] || "");
  }, [subjects, subject]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!subject.trim() || !section.trim()) return;
    const load = createTeachingLoad({
      gradeLevel,
      section,
      subject,
      schoolYear,
      shsSubjectGroup: isShs && shsGroup ? shsGroup : undefined,
    });
    await api.saveTeachingLoad(load);
    setSection("");
    setCreating(false);
    await refresh();
    setSelectedId(load.id);
    notifyWorkspaceChanged();
  };

  const remove = async (id: string) => {
    if (!window.confirm("Delete this class and its scores?")) return;
    await api.deleteTeachingLoad(id);
    if (selectedId === id) setSelectedId(null);
    await refresh();
    notifyWorkspaceChanged();
  };

  const persistLoad = async (next: TeachingLoad) => {
    await api.saveTeachingLoad(next);
    await refresh();
  };

  const persistLoads = async (next: TeachingLoad[]) => {
    for (const load of next) await api.saveTeachingLoad(load);
    await refresh();
  };

  const selected = loads.find((item) => item.id === selectedId) ?? loads[0] ?? null;

  return (
    <section>
      {error && <div className="banner error">{error}</div>}

      {loads.length > 0 && selected && !creating ? (
        <>
          <ActiveClassBar loads={loads} selectedId={selected.id} onSelect={setSelectedId}>
            <button type="button" className="primary btn-cyan" onClick={() => onOpenSheet(selected.id)}>
              <Icon name="book" /> Proceed to Grading Sheet
            </button>
            <button type="button" className="ghost btn-danger" onClick={() => void remove(selected.id)}>
              Delete This Class
            </button>
            <button type="button" className="ghost" onClick={() => setCreating(true)}>
              Add Class
            </button>
          </ActiveClassBar>
          <RosterPanel
            load={selected}
            loads={loads}
            onChange={persistLoad}
            onChangeMany={persistLoads}
            onBack={() => setCreating(true)}
            onOpenSheet={() => onOpenSheet(selected.id)}
          />
        </>
      ) : (
        <>
          <div className="card">
            <h3>{loads.length ? "Add a class" : "Create your first class"}</h3>
            <form className="form-grid" onSubmit={submit}>
              <label>
                Grade
                <select value={gradeLevel} onChange={(e) => setGradeLevel(e.target.value)}>
                  {Array.from({ length: 12 }, (_, i) => String(i + 1)).map((g) => (
                    <option key={g} value={g}>
                      Grade {g}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Section
                <input placeholder="e.g. Mahogany" value={section} onChange={(e) => setSection(e.target.value)} required />
              </label>
              <label>
                Subject
                <select value={subject} onChange={(e) => setSubject(e.target.value)}>
                  {subjects.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                School year
                <select value={schoolYear} onChange={(e) => setSchoolYear(e.target.value)}>
                  {SCHOOL_YEARS.map((sy) => (
                    <option key={sy} value={sy}>
                      {sy}
                    </option>
                  ))}
                </select>
              </label>
              {isShs && (
                <label>
                  SHS group
                  <select value={shsGroup} onChange={(e) => setShsGroup(e.target.value)}>
                    <option value="">Auto from subject</option>
                    {Object.entries(SENIOR_HIGH_SUBJECT_GROUPS).map(([key, config]) => (
                      <option key={key} value={key}>
                        {config.label}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <div className="form-preview">
                <span className="pill">{policyLabel(previewPolicy)}</span>
                <span className="pill">Weights {formatWeights(previewGroup)}</span>
              </div>
              <button type="submit" className="primary">
                Save class
              </button>
              {loads.length > 0 && (
                <button type="button" className="ghost" onClick={() => setCreating(false)}>
                  Cancel
                </button>
              )}
            </form>
          </div>
        </>
      )}
    </section>
  );
}
