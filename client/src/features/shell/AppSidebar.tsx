import { useLayoutEffect, useRef, useState } from "react";
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
  { id: "checklist", label: "Checklist", icon: "list-checks" },
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
  onWidthChange,
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
  onWidthChange: (width: number) => void;
}) {
  const sidebarRef = useRef<HTMLElement>(null);
  const drag = useRef<{ x: number; width: number; scale: number } | null>(null);
  const [autoWidth, setAutoWidth] = useState(240);
  const [manualWidth, setManualWidth] = useState<number | null>(() => {
    try {
      const saved = Number(localStorage.getItem("gradeboss:sidebar-width"));
      return Number.isFinite(saved) && saved >= 180 ? saved : null;
    } catch { return null; }
  });
  const [viewportWidth, setViewportWidth] = useState(window.innerWidth);
  const maximumWidth = Math.max(180, Math.floor(viewportWidth * 0.6));
  const width = Math.min(maximumWidth, Math.max(180, manualWidth ?? autoWidth));

  useLayoutEffect(() => {
    onWidthChange(width);
  }, [width, onWidthChange]);

  useLayoutEffect(() => {
    const sidebar = sidebarRef.current;
    if (!sidebar || collapsed) return;
    const measure = () => {
      if (!sidebar.getClientRects().length) return;
      const shell = getComputedStyle(sidebar);
      const outer = parseFloat(shell.paddingLeft) + parseFloat(shell.paddingRight) + 2;
      let longest = 180;
      sidebar.querySelectorAll<HTMLElement>(".nav-item, .install-btn, .sidebar-brand").forEach((row) => {
        const style = getComputedStyle(row);
        const text = row.querySelector<HTMLElement>(".sidebar-brand-text") || row.querySelector<HTMLElement>("span");
        const icon = row.querySelector<HTMLElement>(".brand-mark, .icon");
        if (!text) return;
        const textWidth = Math.max(text.scrollWidth, ...Array.from(text.children).map((child) => child.scrollWidth));
        longest = Math.max(longest, outer + textWidth + (icon ? parseFloat(getComputedStyle(icon).width) || 0 : 0)
          + (parseFloat(style.columnGap) || 0) + parseFloat(style.paddingLeft) + parseFloat(style.paddingRight) + 2);
      });
      setAutoWidth(Math.ceil(longest));
    };
    measure();
    window.addEventListener("resize", measure);
    const observer = new ResizeObserver(measure);
    sidebar.querySelectorAll<HTMLElement>(".nav-item span, .install-btn span, .sidebar-brand-text").forEach((text) => observer.observe(text));
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [collapsed, user.name, view]);

  useLayoutEffect(() => {
    const resize = () => setViewportWidth(window.innerWidth);
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  const resizeTo = (next: number | null) => {
    const value = next === null ? null : Math.round(Math.min(maximumWidth, Math.max(180, next)));
    setManualWidth(value);
    try {
      if (value === null) localStorage.removeItem("gradeboss:sidebar-width");
      else localStorage.setItem("gradeboss:sidebar-width", String(value));
    } catch { /* Resizing remains available when storage is unavailable. */ }
  };

  return (
    <aside ref={sidebarRef} className={`sidebar ${collapsed ? "is-collapsed" : ""}`}>
      <div className="sidebar-brand">
        <div className="brand-mark" aria-hidden="true">
          <Icon name="book" />
        </div>
        <div className="sidebar-brand-text">
          <h1>GradeBoss v1.0.0</h1>
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
              aria-label={item.label}
            >
              <Icon name={item.icon} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
      </div>

      <div className="sidebar-footer">
        <button type="button" className="nav-item sidebar-toggle" onClick={onToggleCollapsed} aria-expanded={!collapsed} aria-label={collapsed ? "Expand Sidebar" : "Collapse Sidebar"} title={collapsed ? "Expand Sidebar" : "Collapse Sidebar"}>
          <Icon name="chevron-left" />
          <span>{collapsed ? "Expand Sidebar" : "Collapse Sidebar"}</span>
        </button>
        <button type="button" className="nav-item" onClick={onOpenHelp} title="Help & Tutorials" aria-label="Help & Tutorials">
          <Icon name="help" />
          <span>Help &amp; Tutorials</span>
        </button>
        <button type="button" className="nav-item" onClick={onOpenFeedback} title="Feedback" aria-label="Feedback">
          <Icon name="message" />
          <span>Feedback</span>
        </button>
        <button type="button" className="nav-item" onClick={onSignOut} title="Logout" aria-label="Logout">
          <Icon name="logout" />
          <span>Logout</span>
        </button>
        <div className="sidebar-end">
          <button type="button" className="install-btn" onClick={onInstall} title="Install App" aria-label="Install App">
            <Icon name="download" />
            <span>Install App</span>
          </button>
          <button
            type="button"
            className={view === "profile" ? "nav-item sidebar-profile active" : "nav-item sidebar-profile"}
            onClick={() => onNavigate("profile")}
            title="Profile" aria-label="Profile"
          >
            <Icon name="user" />
            <span>Profile</span>
          </button>
        </div>
      </div>
      {!collapsed && (
        <div
          className="sidebar-resizer"
          role="separator"
          aria-label="Resize sidebar"
          aria-orientation="vertical"
          aria-valuemin={180}
          aria-valuemax={maximumWidth}
          aria-valuenow={width}
          tabIndex={0}
          title="Drag to resize. Double-click to fit labels."
          onDoubleClick={() => resizeTo(null)}
          onPointerDown={(event) => {
            if (event.button !== 0) return;
            const sidebar = sidebarRef.current!;
            drag.current = { x: event.clientX, width, scale: sidebar.getBoundingClientRect().width / sidebar.offsetWidth || 1 };
            event.currentTarget.setPointerCapture(event.pointerId);
            event.preventDefault();
          }}
          onPointerMove={(event) => {
            if (drag.current) resizeTo(drag.current.width + (event.clientX - drag.current.x) / drag.current.scale);
          }}
          onPointerUp={(event) => {
            drag.current = null;
            event.currentTarget.releasePointerCapture(event.pointerId);
          }}
          onPointerCancel={() => { drag.current = null; }}
          onLostPointerCapture={() => { drag.current = null; }}
          onKeyDown={(event) => {
            if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
              event.preventDefault();
              resizeTo(width + (event.key === "ArrowLeft" ? -10 : 10));
            } else if (event.key === "Home") {
              event.preventDefault();
              resizeTo(null);
            }
          }}
        />
      )}
    </aside>
  );
}
