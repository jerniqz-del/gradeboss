export const WORKSPACE_CHANGED = "gradeboss:workspace-changed";
export const ZOOM_KEY = "gradeboss:ui-zoom";
export const SIDEBAR_KEY = "gradeboss:sidebar-collapsed";

export const ZOOM_MIN = 90;
export const ZOOM_MAX = 130;
export const ZOOM_STEP = 5;

export function notifyWorkspaceChanged(): void {
  window.dispatchEvent(new Event(WORKSPACE_CHANGED));
}

export function loadZoom(): number {
  const raw = Number(localStorage.getItem(ZOOM_KEY));
  if (!Number.isFinite(raw)) return 100;
  if (raw < 90) {
    localStorage.setItem(ZOOM_KEY, "100");
    return 100;
  }
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(raw / ZOOM_STEP) * ZOOM_STEP));
}

export function saveZoom(value: number): number {
  const next = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(value / ZOOM_STEP) * ZOOM_STEP));
  localStorage.setItem(ZOOM_KEY, String(next));
  return next;
}

export function loadSidebarCollapsed(): boolean {
  return localStorage.getItem(SIDEBAR_KEY) === "1";
}

export function saveSidebarCollapsed(collapsed: boolean): void {
  localStorage.setItem(SIDEBAR_KEY, collapsed ? "1" : "0");
}
