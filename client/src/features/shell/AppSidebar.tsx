import type { User } from "../../auth";
import { Icon } from "../../Icon";

export type AppView =
  | "dashboard"
  | "calendar"
  | "advisory"
  | "classes"
  | "students"
  | "loads"
  | "sheet"
  | "checklist"
  | "attendance"
  | "plans"
  | "tools"
  | "profile";

export const SIDE_NAV: Array<{ id: AppView; label: string; icon: string }> = [
  { id: "dashboard", label: "Dashboard", icon: "chart" },
  { id: "loads", label: "Teaching Load", icon: "book" },
  { id: "sheet", label: "Grading Sheet", icon: "pencil" },
  { id: "attendance", label: "Attendance", icon: "calendar" },
  { id: "checklist", label: "Performance Checklist", icon: "list-checks" },
  { id: "calendar", label: "Calendar", icon: "calendar-days" },
  { id: "tools", label: "Tools", icon: "tools" },
];

export const BOTTOM_NAV: Array<{ id: AppView; label: string; short: string; icon: string }> = [
  { id: "dashboard", label: "Dashboard", short: "Home", icon: "chart" },
  { id: "loads", label: "Teaching Load", short: "Loads", icon: "book" },
  { id: "sheet", label: "Grading Sheet", short: "Sheet", icon: "pencil" },
  { id: "attendance", label: "Attendance", short: "Attend", icon: "calendar" },
  { id: "profile", label: "Profile", short: "More", icon: "user" },
];

export function AppSidebar({
  user,
  view,
  collapsed,
  onNavigate,
  onToggleCollapsed,
  onOpenHelp,
  onOpenFeedback,
  onSignOut,
  onInstall,
}: {
  user: User;
  view: AppView;
  collapsed: boolean;
  onNavigate: (view: AppView) => void;
  onToggleCollapsed: () => void;
  onOpenHelp: () => void;
  onOpenFeedback: () => void;
  onSignOut: () => void;
  onInstall: () => void;
}) {
  return (
    <aside className={`sidebar ${collapsed ? "is-collapsed" : ""}`}>
      <div className="sidebar-brand">
        <div className="brand-mark" aria-hidden="true">
          <Icon name="book" />
        </div>
        <div className="sidebar-brand-text">
          <h1>E-Class Record App</h1>
          <span>{user.name}</span>
        </div>
      </div>

      <div className="sidebar-nav-wrap">
        <p className="sidebar-kicker">Navigation</p>
        <nav className="side-nav">
          {SIDE_NAV.map((item) => (
            <button
              key={item.id}
              type="button"
              className={view === item.id ? "nav-item active" : "nav-item"}
              onClick={() => onNavigate(item.id)}
              title={item.label}
            >
              <Icon name={item.icon} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
      </div>

      <div className="sidebar-footer">
        <button type="button" className="nav-item" onClick={onToggleCollapsed}>
          <Icon name="chevron-left" />
          <span>{collapsed ? "Expand Sidebar" : "Collapse Sidebar"}</span>
        </button>
        <button type="button" className="nav-item" onClick={onOpenHelp}>
          <Icon name="help" />
          <span>Help &amp; Tutorials</span>
        </button>
        <button type="button" className="nav-item" onClick={onOpenFeedback}>
          <Icon name="message" />
          <span>Feedback</span>
        </button>
        <button type="button" className="nav-item" onClick={onSignOut}>
          <Icon name="logout" />
          <span>Logout</span>
        </button>
        <div className="sidebar-end">
          <button type="button" className="install-btn" onClick={onInstall}>
            <Icon name="download" />
            <span>Install App</span>
          </button>
          <button
            type="button"
            className={view === "profile" ? "nav-item sidebar-profile active" : "nav-item sidebar-profile"}
            onClick={() => onNavigate("profile")}
            title="Profile"
          >
            <Icon name="user" />
            <span>Profile</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
