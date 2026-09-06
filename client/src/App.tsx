import { useCallback, useEffect, useRef, useState } from "react";
import { api, type Student } from "./api";
import {
  clearUser,
  disableGoogleAutoSelect,
  loadUser,
  roleLabel,
  saveUser,
  type User,
} from "./auth";
import { fullName, parseSf1, type ParsedSf1, type Sf1Learner } from "./sf1";
import {
  countBySex,
  deleteClass,
  listClasses,
  saveClass,
  type SchoolClass,
} from "./classes";
import { Icon } from "./Icon";
import { Avatar, Profile } from "./Profile";
import { SignIn } from "./SignIn";
import { ThemeToggle } from "./ThemeToggle";
import { useTheme } from "./useTheme";
import { AdvisoryView } from "./features/advisory/AdvisoryView";
import { AttendanceView } from "./features/attendance/AttendanceView";
import { DashboardView } from "./features/dashboard/DashboardView";
import { BackupPanel } from "./features/exports/BackupPanel";
import { TeachingLoadsView } from "./features/teaching-loads/TeachingLoadsView";
import { GradingSheetView } from "./features/grading-sheet/GradingSheetView";

type View =
  | "dashboard"
  | "advisory"
  | "classes"
  | "students"
  | "loads"
  | "sheet"
  | "attendance"
  | "plans"
  | "profile";

const NAV: Array<{ id: View; label: string; icon: string }> = [
  { id: "dashboard", label: "Dashboard", icon: "chart" },
  { id: "advisory", label: "Advisory", icon: "clipboard" },
  { id: "classes", label: "Classes", icon: "board" },
  { id: "students", label: "Students", icon: "users" },
  { id: "loads", label: "Loads", icon: "book" },
  { id: "sheet", label: "Sheet", icon: "pencil" },
  { id: "attendance", label: "Attendance", icon: "calendar" },
  { id: "profile", label: "Profile", icon: "user" },
];

const SYNC_PRICE_ANNUAL = 50; // PHP per extra device per year
const SYNC_PRICE_MONTHLY = 5; // PHP per extra device per month

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function useInstallPrompt() {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setPromptEvent(null);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const install = useCallback(async () => {
    if (!promptEvent) return;
    await promptEvent.prompt();
    await promptEvent.userChoice;
    setPromptEvent(null);
  }, [promptEvent]);

  return { canInstall: !!promptEvent, installed, install };
}

function useOnline() {
  const [online, setOnline] = useState(
    typeof navigator === "undefined" ? true : navigator.onLine,
  );
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return online;
}

export default function App() {
  const [user, setUser] = useState<User | null>(() => loadUser());
  const [view, setView] = useState<View>("dashboard");
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedLoadId, setSelectedLoadId] = useState<string | null>(null);
  const [rosterLoadId, setRosterLoadId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { canInstall, installed, install } = useInstallPrompt();
  const online = useOnline();
  const { preference, setTheme } = useTheme();

  const refresh = useCallback(async () => {
    try {
      setStudents(await api.getStudents());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const onSignedIn = useCallback((next: User) => {
    saveUser(next);
    setUser(next);
  }, []);

  const signOut = useCallback(() => {
    disableGoogleAutoSelect();
    clearUser();
    setUser(null);
    setView("dashboard");
  }, []);

  if (!user) {
    return <SignIn online={online} onSignedIn={onSignedIn} themePreference={preference} onThemeChange={setTheme} />;
  }

  const showInstall = canInstall && !installed;

  return (
    <div className="app">
      {!online && (
        <div className="offline-bar">
          <Icon name="cloud-off" />
          Offline — showing your saved data
        </div>
      )}

      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">GB</div>
          <div>
            <h1>GradeBoss</h1>
            <span>School command center</span>
          </div>
        </div>
        <nav className="side-nav">
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
          {showInstall && <InstallButton onInstall={install} />}
          <ThemeToggle preference={preference} onChange={setTheme} compact />
          <button
            className={view === "plans" ? "nav-item active" : "nav-item"}
            onClick={() => setView("plans")}
          >
            <Icon name="spark" />
            Plans
          </button>
        </div>
      </aside>

      <header className="topbar">
        <div className="brand compact">
          <div className="brand-mark">GB</div>
          <h1>GradeBoss</h1>
        </div>
        <div className="topbar-actions">
          <ThemeToggle preference={preference} onChange={setTheme} compact />
          <button className="ghost small" onClick={() => setView("plans")}>
            Plans
          </button>
          {showInstall && <InstallButton onInstall={install} />}
          <button
            type="button"
            className={view === "profile" ? "profile-topbar-btn active" : "profile-topbar-btn"}
            aria-label="Profile"
            aria-current={view === "profile" ? "page" : undefined}
            onClick={() => setView("profile")}
          >
            <Avatar user={user} size={32} />
            <span className="profile-topbar-text">
              <span className="profile-topbar-name">{user.name}</span>
              <span className="profile-topbar-role">{roleLabel(user.role)}</span>
            </span>
          </button>
        </div>
      </header>

      <main className="content">
        {error && <div className="banner error">{error}</div>}

        {view === "dashboard" && (
          <DashboardView
            onOpenSheet={(id) => {
              setSelectedLoadId(id);
              setView("sheet");
            }}
            onOpenAdvisory={() => setView("advisory")}
          />
        )}
        {view === "advisory" && <AdvisoryView />}
        {view === "classes" && <Classes />}
        {view === "students" && (
          <Students students={students} onChange={refresh} />
        )}
        {view === "loads" && (
          <TeachingLoadsView
            initialRosterLoadId={rosterLoadId}
            onOpenSheet={(id) => {
              setSelectedLoadId(id);
              setView("sheet");
            }}
          />
        )}
        {view === "sheet" && (
          <GradingSheetView
            selectedLoadId={selectedLoadId}
            onSelectLoad={setSelectedLoadId}
            onManageRoster={(id) => {
              setRosterLoadId(id);
              setView("loads");
            }}
          />
        )}
        {view === "attendance" && (
          <AttendanceView selectedLoadId={selectedLoadId} onSelectLoad={setSelectedLoadId} />
        )}
        {view === "plans" && <Plans />}
        {view === "profile" && (
          <Profile
            user={user}
            onSignOut={signOut}
            themePreference={preference}
            onThemeChange={setTheme}
          />
        )}
      </main>

      <nav className="bottom-nav">
        {NAV.map((item) => (
          <button
            key={item.id}
            className={view === item.id ? "tab active" : "tab"}
            onClick={() => setView(item.id)}
            aria-label={item.label}
            aria-current={view === item.id ? "page" : undefined}
          >
            {item.id === "profile" ? (
              <Avatar user={user} size={22} />
            ) : (
              <Icon name={item.icon} />
            )}
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
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
  const [gradeLevel, setGradeLevel] = useState(1);
  const [email, setEmail] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    await api.addStudent({ name, gradeLevel, email });
    setName("");
    setEmail("");
    setGradeLevel(1);
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
            {Array.from({ length: 12 }, (_, i) => i + 1).map((g) => (
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
        <div className="table-scroll">
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
      </div>
    </section>
  );
}

function Classes() {
  const [classes, setClasses] = useState<SchoolClass[]>(() => listClasses());
  const [mode, setMode] = useState<"list" | "preview" | "detail">("list");
  const [preview, setPreview] = useState<{ parsed: ParsedSf1; source: string } | null>(
    null,
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [syncNote, setSyncNote] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const selected = classes.find((c) => c.id === selectedId) ?? null;

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const parsed = parseSf1(await file.arrayBuffer());
      if (parsed.learners.length === 0) {
        setError(parsed.warnings[0] ?? "No learners found in this file.");
      } else {
        setPreview({ parsed, source: file.name });
        setMode("preview");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to read the file.");
    } finally {
      setBusy(false);
    }
  };

  const confirmSave = async () => {
    if (!preview) return;
    setBusy(true);
    try {
      const result = await saveClass({
        id: crypto.randomUUID(),
        createdAt: Date.now(),
        source: preview.source,
        learners: preview.parsed.learners,
        ...preview.parsed.meta,
      });
      setClasses(listClasses());
      const applied = result?.updatedLoads.length ?? 0;
      setSyncNote(
        applied > 0
          ? `Roster saved and applied to ${applied} teaching load${applied === 1 ? "" : "s"} in this section.`
          : "Roster saved. Open Teaching loads → Roster to grade this class, or create a matching load first.",
      );
      setPreview(null);
      setMode("list");
    } finally {
      setBusy(false);
    }
  };

  const removeClass = (id: string) => {
    deleteClass(id);
    setClasses(listClasses());
    if (selectedId === id) {
      setSelectedId(null);
      setMode("list");
    }
  };

  if (mode === "preview" && preview) {
    const { meta, learners, warnings } = preview.parsed;
    const { male, female } = countBySex(learners);
    return (
      <section>
        <Header title="Review class" subtitle={`Extracted from ${preview.source}`} />
        {warnings.map((w, i) => (
          <div className="banner warn" key={i}>
            {w}
          </div>
        ))}
        <ClassMetaCard meta={meta} male={male} female={female} total={learners.length} />
        <div className="card">
          <div className="roster-head">
            <h3>Roster ({learners.length})</h3>
          </div>
          <RosterTable learners={learners} />
        </div>
        <div className="form-row">
          <button className="primary" disabled={busy} onClick={() => void confirmSave()}>
            {busy ? "Saving…" : "Save to teaching loads"}
          </button>
          <button
            className="ghost"
            onClick={() => {
              setPreview(null);
              setMode("list");
            }}
          >
            Discard
          </button>
        </div>
      </section>
    );
  }

  if (mode === "detail" && selected) {
    const { male, female } = countBySex(selected.learners);
    const q = query.trim().toLowerCase();
    const filtered = q
      ? selected.learners.filter((l) =>
          (fullName(l) + " " + l.lrn).toLowerCase().includes(q),
        )
      : selected.learners;
    return (
      <section>
        <button
          className="ghost back"
          onClick={() => {
            setMode("list");
            setSelectedId(null);
            setQuery("");
          }}
        >
          <Icon name="arrow-left" /> All classes
        </button>
        <Header
          title={`${selected.gradeLevel || "Class"} — ${selected.section}`}
          subtitle={selected.schoolName}
        />
        {syncNote && <div className="banner warn">{syncNote}</div>}
        <ClassMetaCard
          meta={selected}
          male={male}
          female={female}
          total={selected.learners.length}
        />
        <div className="card">
          <div className="roster-head">
            <h3>Roster ({selected.learners.length})</h3>
            <input
              className="roster-search"
              placeholder="Search name or LRN"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <RosterTable learners={filtered} />
        </div>
        <div className="form-row wrap">
          <button
            className="primary"
            disabled={busy}
            onClick={() => {
              void (async () => {
                setBusy(true);
                try {
                  const result = await saveClass(selected);
                  const applied = result?.updatedLoads.length ?? 0;
                  setSyncNote(
                    applied > 0
                      ? `Roster applied to ${applied} teaching load${applied === 1 ? "" : "s"}.`
                      : "No matching teaching load yet. Create one with this grade, section, and school year.",
                  );
                } finally {
                  setBusy(false);
                }
              })();
            }}
          >
            Apply roster to teaching loads
          </button>
          <button className="ghost danger" onClick={() => removeClass(selected.id)}>
            Delete class
          </button>
        </div>
      </section>
    );
  }

  return (
    <section>
      <Header
        title="Classes"
        subtitle="Upload a DepEd School Form 1 (SF1). The roster is linked to matching teaching loads."
      />
      {syncNote && <div className="banner warn">{syncNote}</div>}
      <div className="card upload-card">
        <input
          ref={fileRef}
          type="file"
          accept=".xls,.xlsx,.csv"
          hidden
          onChange={onFile}
        />
        <button
          className="primary"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
        >
          <Icon name="upload" /> {busy ? "Reading…" : "Upload SF1 file"}
        </button>
        <p className="muted">
          Accepts .xls / .xlsx exported from LIS. Your data stays on this device.
        </p>
        {error && <div className="banner error">{error}</div>}
      </div>

      {classes.length === 0 ? (
        <div className="card empty-state">
          <Icon name="board" />
          <p className="muted">No classes yet. Upload a School Form 1 to get started.</p>
        </div>
      ) : (
        <div className="cards">
          {classes.map((c) => {
            const { male, female } = countBySex(c.learners);
            return (
              <button
                className="card class-card"
                key={c.id}
                onClick={() => {
                  setSelectedId(c.id);
                  setMode("detail");
                }}
              >
                <div className="class-card-top">
                  <h3>
                    {c.gradeLevel || "Class"} — {c.section}
                  </h3>
                  <span className="class-count">{c.learners.length}</span>
                </div>
                <p className="muted">{c.schoolName}</p>
                <p className="muted small">{c.schoolYear}</p>
                <div className="sex-chips">
                  <span className="chip male">{male} M</span>
                  <span className="chip female">{female} F</span>
                </div>
                {c.adviser && <p className="muted small">Adviser: {c.adviser}</p>}
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}

function ClassMetaCard({
  meta,
  male,
  female,
  total,
}: {
  meta: ParsedSf1["meta"];
  male: number;
  female: number;
  total: number;
}) {
  const items: Array<[string, string]> = [
    ["School", meta.schoolName],
    ["School ID", meta.schoolId],
    ["Region", meta.region],
    ["Division", meta.division],
    ["District", meta.district],
    ["School Year", meta.schoolYear],
    ["Grade Level", meta.gradeLevel],
    ["Section", meta.section],
    ["Adviser", meta.adviser],
    ["School Head", meta.schoolHead],
  ];
  return (
    <div className="card">
      <div className="meta-grid">
        {items.map(([k, v]) => (
          <div className="meta-item" key={k}>
            <span className="meta-k">{k}</span>
            <span className="meta-v">{v || "—"}</span>
          </div>
        ))}
      </div>
      <div className="sex-chips">
        <span className="chip">{total} learners</span>
        <span className="chip male">{male} male</span>
        <span className="chip female">{female} female</span>
      </div>
    </div>
  );
}

function RosterTable({ learners }: { learners: Sf1Learner[] }) {
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>LRN</th>
            <th>Name</th>
            <th>Sex</th>
            <th>Birth Date</th>
            <th>Age</th>
            <th>Modality</th>
            <th>Remarks</th>
          </tr>
        </thead>
        <tbody>
          {learners.map((l, i) => (
            <tr key={l.lrn + i}>
              <td>{i + 1}</td>
              <td className="muted">{l.lrn}</td>
              <td>{fullName(l)}</td>
              <td>{l.sex}</td>
              <td className="muted">{l.birthdate}</td>
              <td>{l.age}</td>
              <td className="muted">{l.modality}</td>
              <td className="muted">{l.remarks}</td>
            </tr>
          ))}
          {learners.length === 0 && (
            <tr>
              <td colSpan={8} className="muted center">
                No learners.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function Plans() {
  const [devices, setDevices] = useState(2);
  const [billing, setBilling] = useState<"annual" | "monthly">("annual");
  const [notice, setNotice] = useState(false);

  const extra = Math.max(0, devices - 1);
  const perDevice = billing === "annual" ? SYNC_PRICE_ANNUAL : SYNC_PRICE_MONTHLY;
  const price = extra * perDevice;
  const suffix = billing === "annual" ? "/year" : "/month";

  return (
    <section>
      <Header title="Plans" subtitle="Simple pricing — your data always stays yours." />

      <div className="plans">
        <div className="card tier">
          <div className="tier-head">
            <h3>Free</h3>
            <span className="tier-price">
              ₱0<span>/forever</span>
            </span>
          </div>
          <p className="muted tier-tagline">
            Everything you need on a single device, fully offline.
          </p>
          <ul className="tier-feats">
            <Feat>Full gradebook — students, courses &amp; grades</Feat>
            <Feat>Works 100% offline</Feat>
            <Feat>Installable app (add to home screen)</Feat>
            <Feat>1 device</Feat>
            <Feat>Free nearby sync over Wi-Fi / hotspot</Feat>
            <Feat>Export &amp; import backup</Feat>
          </ul>
          <button className="ghost tier-cta" disabled>
            Current plan
          </button>
        </div>

        <div className="card tier featured">
          <div className="tier-badge">Most useful</div>
          <div className="tier-head">
            <h3>Sync</h3>
            <span className="tier-price">
              ₱50<span>/device/year</span>
            </span>
          </div>
          <p className="muted tier-tagline">
            Link 2–3 devices anywhere with end-to-end encrypted sync.
          </p>
          <ul className="tier-feats">
            <Feat>Everything in Free</Feat>
            <Feat>Encrypted online sync bridge (phone, tablet, laptop)</Feat>
            <Feat>Syncs across different networks, not just same Wi-Fi</Feat>
            <Feat>End-to-end encrypted — we can’t read your data</Feat>
            <Feat>Automatic periodic sync</Feat>
            <Feat>₱5/device/month or ₱50/device/year</Feat>
          </ul>
          <button className="primary tier-cta" onClick={() => setNotice(true)}>
            Subscribe via PayMongo
          </button>
          {notice && (
            <p className="tier-note info">
              Online sync is still in development — we’ll enable checkout soon.
            </p>
          )}
          <p className="tier-note">
            The online bridge is a paid feature; nearby Wi-Fi/hotspot sync stays free.
            Billed via PayMongo (GCash / Maya).
          </p>
        </div>
      </div>

      <div className="card estimator">
        <h3>Estimate your price</h3>
        <div className="estimator-row">
          <label className="estimator-field">
            <span>Devices you use</span>
            <select value={devices} onChange={(e) => setDevices(Number(e.target.value))}>
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n} device{n > 1 ? "s" : ""}
                </option>
              ))}
            </select>
          </label>
          <div className="billing-toggle" role="group" aria-label="Billing period">
            <button
              className={billing === "annual" ? "active" : ""}
              onClick={() => setBilling("annual")}
            >
              Annual
            </button>
            <button
              className={billing === "monthly" ? "active" : ""}
              onClick={() => setBilling("monthly")}
            >
              Monthly
            </button>
          </div>
        </div>
        <div className="estimator-out">
          {extra === 0 ? (
            <>Free — your first device is always free.</>
          ) : (
            <>
              {extra} extra device{extra > 1 ? "s" : ""} ={" "}
              <strong>
                ₱{price}
                {suffix}
              </strong>{" "}
              <span className="muted">(1 device stays free)</span>
            </>
          )}
        </div>
      </div>

      <BackupPanel />
    </section>
  );
}

function Feat({ children }: { children: React.ReactNode }) {
  return (
    <li>
      <Icon name="check" />
      <span>{children}</span>
    </li>
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

function InstallButton({ onInstall }: { onInstall: () => void }) {
  return (
    <button type="button" className="install-btn" onClick={onInstall}>
      <Icon name="download" />
      <span>Install app</span>
    </button>
  );
}
