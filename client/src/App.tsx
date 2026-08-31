import { useCallback, useEffect, useMemo, useState } from "react";
import {
  api,
  type Course,
  type Grade,
  type Stats,
  type Student,
} from "./api";

type View = "dashboard" | "students" | "courses" | "gradebook";

const NAV: Array<{ id: View; label: string; icon: string }> = [
  { id: "dashboard", label: "Dashboard", icon: "chart" },
  { id: "students", label: "Students", icon: "users" },
  { id: "courses", label: "Courses", icon: "book" },
  { id: "gradebook", label: "Gradebook", icon: "pencil" },
];

function gradeColor(pct: number): string {
  if (pct >= 90) return "var(--green)";
  if (pct >= 80) return "var(--blue)";
  if (pct >= 70) return "var(--amber)";
  if (pct >= 60) return "var(--orange)";
  return "var(--red)";
}

export default function App() {
  const [view, setView] = useState<View>("dashboard");
  const [students, setStudents] = useState<Student[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [s, c, g, st] = await Promise.all([
        api.getStudents(),
        api.getCourses(),
        api.getGrades(),
        api.getStats(),
      ]);
      setStudents(s);
      setCourses(c);
      setGrades(g);
      setStats(st);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">GB</div>
          <div>
            <h1>GradeBoss</h1>
            <span>School command center</span>
          </div>
        </div>
        <nav>
          {NAV.map((item) => (
            <button
              key={item.id}
              className={view === item.id ? "nav-item active" : "nav-item"}
              onClick={() => setView(item.id)}
            >
              <Icon name={item.icon} />
              {item.label}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="pill">Admin mode</div>
          <p>All teacher &amp; admin tools in one place.</p>
        </div>
      </aside>

      <main className="content">
        {error && <div className="banner error">{error}</div>}

        {view === "dashboard" && stats && <Dashboard stats={stats} />}
        {view === "students" && (
          <Students students={students} onChange={refresh} />
        )}
        {view === "courses" && <Courses courses={courses} onChange={refresh} />}
        {view === "gradebook" && (
          <Gradebook
            students={students}
            courses={courses}
            grades={grades}
            onChange={refresh}
          />
        )}
      </main>
    </div>
  );
}

function Dashboard({ stats }: { stats: Stats }) {
  const { totals, studentAverages, courseAverages } = stats;
  const cards = [
    { label: "Students", value: totals.students, hint: "enrolled" },
    { label: "Courses", value: totals.courses, hint: "active" },
    { label: "Grades recorded", value: totals.grades, hint: "entries" },
    {
      label: "Overall average",
      value: `${totals.overallAverage}%`,
      hint: "across all grades",
      accent: gradeColor(totals.overallAverage),
    },
  ];

  return (
    <section>
      <Header title="Dashboard" subtitle="A live snapshot of school performance." />
      <div className="cards">
        {cards.map((card) => (
          <div className="card stat" key={card.label}>
            <span className="stat-label">{card.label}</span>
            <span className="stat-value" style={{ color: card.accent }}>
              {card.value}
            </span>
            <span className="stat-hint">{card.hint}</span>
          </div>
        ))}
      </div>

      <div className="grid-2">
        <div className="card">
          <h3>Student standings</h3>
          <table>
            <thead>
              <tr>
                <th>Student</th>
                <th>Grade</th>
                <th>Average</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {studentAverages.map((s) => (
                <tr key={s.id}>
                  <td>{s.name}</td>
                  <td>G{s.gradeLevel}</td>
                  <td>{s.gradeCount ? `${s.average}%` : "—"}</td>
                  <td>
                    <span
                      className="badge"
                      style={{ background: gradeColor(s.average) }}
                    >
                      {s.letter}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card">
          <h3>Course performance</h3>
          {courseAverages.map((c) => (
            <div className="bar-row" key={c.id}>
              <div className="bar-meta">
                <span>{c.name}</span>
                <span className="muted">{c.gradeCount ? `${c.average}%` : "no grades"}</span>
              </div>
              <div className="bar-track">
                <div
                  className="bar-fill"
                  style={{ width: `${c.average}%`, background: gradeColor(c.average) }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Students({
  students,
  onChange,
}: {
  students: Student[];
  onChange: () => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [gradeLevel, setGradeLevel] = useState(9);
  const [email, setEmail] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    await api.addStudent({ name, gradeLevel, email });
    setName("");
    setEmail("");
    setGradeLevel(9);
    await onChange();
  };

  const remove = async (id: string) => {
    await api.deleteStudent(id);
    await onChange();
  };

  return (
    <section>
      <Header title="Students" subtitle="Manage enrollment across every grade level." />
      <div className="card">
        <form className="form-row" onSubmit={submit}>
          <input
            placeholder="Full name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <select
            value={gradeLevel}
            onChange={(e) => setGradeLevel(Number(e.target.value))}
          >
            {[9, 10, 11, 12].map((g) => (
              <option key={g} value={g}>
                Grade {g}
              </option>
            ))}
          </select>
          <input
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button type="submit" className="primary">
            Add student
          </button>
        </form>
      </div>

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Grade</th>
              <th>Email</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {students.map((s) => (
              <tr key={s.id}>
                <td>{s.name}</td>
                <td>G{s.gradeLevel}</td>
                <td className="muted">{s.email || "—"}</td>
                <td>
                  <button className="ghost danger" onClick={() => remove(s.id)}>
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Courses({
  courses,
  onChange,
}: {
  courses: Course[];
  onChange: () => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [teacher, setTeacher] = useState("");
  const [period, setPeriod] = useState(1);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    await api.addCourse({ name, teacher, period });
    setName("");
    setTeacher("");
    setPeriod(1);
    await onChange();
  };

  return (
    <section>
      <Header title="Courses" subtitle="Track every class and the teacher who runs it." />
      <div className="card">
        <form className="form-row" onSubmit={submit}>
          <input
            placeholder="Course name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            placeholder="Teacher"
            value={teacher}
            onChange={(e) => setTeacher(e.target.value)}
          />
          <select value={period} onChange={(e) => setPeriod(Number(e.target.value))}>
            {[1, 2, 3, 4, 5, 6].map((p) => (
              <option key={p} value={p}>
                Period {p}
              </option>
            ))}
          </select>
          <button type="submit" className="primary">
            Add course
          </button>
        </form>
      </div>

      <div className="cards">
        {courses.map((c) => (
          <div className="card course" key={c.id}>
            <div className="course-period">P{c.period}</div>
            <h3>{c.name}</h3>
            <p className="muted">{c.teacher}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function Gradebook({
  students,
  courses,
  grades,
  onChange,
}: {
  students: Student[];
  courses: Course[];
  grades: Grade[];
  onChange: () => Promise<void>;
}) {
  const [courseId, setCourseId] = useState("");
  const [studentId, setStudentId] = useState("");
  const [assignment, setAssignment] = useState("");
  const [score, setScore] = useState(90);
  const [maxScore, setMaxScore] = useState(100);

  useEffect(() => {
    if (!courseId && courses.length) setCourseId(courses[0].id);
  }, [courses, courseId]);
  useEffect(() => {
    if (!studentId && students.length) setStudentId(students[0].id);
  }, [students, studentId]);

  const visibleGrades = useMemo(
    () => grades.filter((g) => g.courseId === courseId),
    [grades, courseId],
  );
  const studentName = (id: string) =>
    students.find((s) => s.id === id)?.name ?? "Unknown";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentId || !courseId) return;
    await api.addGrade({ studentId, courseId, assignment, score, maxScore });
    setAssignment("");
    setScore(90);
    setMaxScore(100);
    await onChange();
  };

  return (
    <section>
      <Header title="Gradebook" subtitle="Enter and review grades course by course." />
      <div className="card">
        <form className="form-row wrap" onSubmit={submit}>
          <select value={courseId} onChange={(e) => setCourseId(e.target.value)}>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select value={studentId} onChange={(e) => setStudentId(e.target.value)}>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <input
            placeholder="Assignment"
            value={assignment}
            onChange={(e) => setAssignment(e.target.value)}
          />
          <input
            type="number"
            className="narrow"
            value={score}
            min={0}
            onChange={(e) => setScore(Number(e.target.value))}
          />
          <span className="slash">/</span>
          <input
            type="number"
            className="narrow"
            value={maxScore}
            min={1}
            onChange={(e) => setMaxScore(Number(e.target.value))}
          />
          <button type="submit" className="primary">
            Record grade
          </button>
        </form>
      </div>

      <div className="card">
        <h3>{courses.find((c) => c.id === courseId)?.name ?? "Grades"}</h3>
        <table>
          <thead>
            <tr>
              <th>Student</th>
              <th>Assignment</th>
              <th>Score</th>
              <th>%</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {visibleGrades.map((g) => {
              const pct = Math.round((g.score / g.maxScore) * 100);
              return (
                <tr key={g.id}>
                  <td>{studentName(g.studentId)}</td>
                  <td>{g.assignment}</td>
                  <td>
                    {g.score}/{g.maxScore}
                  </td>
                  <td>
                    <span className="badge" style={{ background: gradeColor(pct) }}>
                      {pct}%
                    </span>
                  </td>
                  <td className="muted">{g.date}</td>
                </tr>
              );
            })}
            {visibleGrades.length === 0 && (
              <tr>
                <td colSpan={5} className="muted center">
                  No grades yet for this course.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Header({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="page-header">
      <h2>{title}</h2>
      <p>{subtitle}</p>
    </div>
  );
}

function Icon({ name }: { name: string }) {
  const paths: Record<string, string> = {
    chart: "M4 19V5m5 14V9m5 10V3m5 16v-7",
    users: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 7a4 4 0 1 0 0 .01M23 21v-2a4 4 0 0 0-3-3.87",
    book: "M4 19.5A2.5 2.5 0 0 1 6.5 17H20V2H6.5A2.5 2.5 0 0 0 4 4.5v15z",
    pencil: "M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z",
  };
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={paths[name]} />
    </svg>
  );
}
