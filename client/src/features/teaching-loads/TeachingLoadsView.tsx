import { useEffect, useMemo, useState } from "react";
import { api } from "../../api";
import {
  determinePolicy,
  determineSubjectGroup,
  SENIOR_HIGH_SUBJECT_GROUPS,
} from "../../domain/grading";
import { Icon } from "../../Icon";
import type { TeachingLoad } from "../../models/teaching-load";
import { SCHOOL_YEARS, subjectsForGrade } from "./catalog";
import { createTeachingLoad, formatWeights, policyLabel } from "./create-load";

export function TeachingLoadsView({
  onOpenSheet,
}: {
  onOpenSheet: (loadId: string) => void;
}) {
  const [loads, setLoads] = useState<TeachingLoad[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [gradeLevel, setGradeLevel] = useState("10");
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
      setLoads(await api.getTeachingLoads());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load teaching loads");
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    if (!subjects.includes(subject)) setSubject(subjects[0] || "");
  }, [subjects, subject]);

  const submit = async (event: React.FormEvent) => {
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
    await refresh();
    onOpenSheet(load.id);
  };

  const remove = async (id: string) => {
    if (!window.confirm("Delete this teaching load and its scores?")) return;
    await api.deleteTeachingLoad(id);
    await refresh();
  };

  return (
    <section>
      <div className="page-header">
        <h2>Teaching loads</h2>
        <p>Create a class + subject, then open the grading sheet to enter scores.</p>
      </div>

      {error && <div className="banner error">{error}</div>}

      <div className="card">
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
            <input
              placeholder="e.g. Rizal"
              value={section}
              onChange={(e) => setSection(e.target.value)}
              required
            />
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
            Add teaching load
          </button>
        </form>
      </div>

      {loads.length === 0 ? (
        <div className="empty-state">
          <Icon name="book" />
          <p>No teaching loads yet. Add one above to start grading.</p>
        </div>
      ) : (
        <div className="cards">
          {loads.map((load) => (
            <article className="card course load-card" key={load.id}>
              <div className="course-period">G{load.gradeLevel}</div>
              <h3>
                {load.subject}
              </h3>
              <p className="muted">
                {load.section} · SY {load.schoolYear}
              </p>
              <p className="muted">
                {policyLabel(load.policy)} · {formatWeights(load.subjectGroup)} · {load.learners.length}{" "}
                learners
              </p>
              <div className="load-actions">
                <button type="button" className="primary" onClick={() => onOpenSheet(load.id)}>
                  Open sheet
                </button>
                <button type="button" className="ghost danger" onClick={() => void remove(load.id)}>
                  Delete
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
