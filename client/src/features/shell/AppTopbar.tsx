import { useEffect, useState } from "react";
import type { TeacherProfile } from "../../models/teacher-profile";
import { Icon } from "../../Icon";
import { DATA_SAVED } from "../../storage/change-events";
import { ZOOM_MAX, ZOOM_MIN, ZOOM_STEP } from "./chrome";

export function AppTopbar({
  title, profile, schoolYears, zoom, onSchoolYearChange, onZoomChange,
}: {
  title: string;
  profile: TeacherProfile | null;
  schoolYears: string[];
  zoom: number;
  onSchoolYearChange: (year: string) => void;
  onZoomChange: (zoom: number) => void;
}) {
  const [savePulse, setSavePulse] = useState(false);
  const [lastSaved, setLastSaved] = useState("");
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const saved = () => {
      setLastSaved(new Date().toLocaleTimeString());
      setSavePulse(true);
      clearTimeout(timer);
      timer = setTimeout(() => setSavePulse(false), 1200);
    };
    window.addEventListener(DATA_SAVED, saved);
    return () => { window.removeEventListener(DATA_SAVED, saved); clearTimeout(timer); };
  }, []);
  const schoolYear = profile?.schoolYear || schoolYears[0] || "2026-2027";
  const schoolName = profile?.schoolName || "Your school";
  const saveLabel = lastSaved ? "Saved on this device at " + lastSaved : "Automatic saving on this device";
  return (
    <header className="topbar ecr-topbar">
      <strong className="ecr-topbar-title" title={title}>{title}</strong>
      <label className="ecr-year-label">
        <span className="sr-only">School year</span>
        <select value={schoolYear} onChange={(event) => onSchoolYearChange(event.target.value)}>
          {schoolYears.map((year) => <option key={year} value={year}>{year}</option>)}
        </select>
      </label>
      <span className="ecr-topbar-school" title={schoolName + " • Compliant with DepEd Order No. 15 s. 2026"}>
        {schoolName} • Compliant with DepEd Order No. 15 s. 2026
      </span>
      <span className={"ecr-cloud-save" + (savePulse ? " is-saving" : "")} role="status" aria-label={saveLabel} title={saveLabel}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 18a4 4 0 0 1-1-7.87A7 7 0 0 1 18.5 9a4.5 4.5 0 0 1-.5 9" />
          <path className="cloud-save-arrow" d="M12 20V11m-3 3 3-3 3 3" />
        </svg>
      </span>
      <div className="ecr-topbar-actions">
        <button type="button" className="ghost ecr-backup-btn" onClick={() => window.dispatchEvent(new Event("gradeboss:open-changelog"))}>Activity Log</button>
        <div className="ecr-zoom" role="group" aria-label="Zoom">
          <button type="button" className="ghost ecr-zoom-btn" aria-label="Zoom out" onClick={() => onZoomChange(zoom - ZOOM_STEP)}><Icon name="minus" /></button>
          <input type="range" min={ZOOM_MIN} max={ZOOM_MAX} step={ZOOM_STEP} value={zoom} aria-label="Zoom" onChange={(event) => onZoomChange(Number(event.target.value))} />
          <button type="button" className="ghost ecr-zoom-btn" aria-label="Zoom in" onClick={() => onZoomChange(zoom + ZOOM_STEP)}><Icon name="plus" /></button>
          <span className="ecr-zoom-value">{zoom}%</span>
        </div>
      </div>
    </header>
  );
}
