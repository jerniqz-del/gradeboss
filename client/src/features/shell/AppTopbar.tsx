import { useRef } from "react";
import type { TeacherProfile } from "../../models/teacher-profile";
import { Icon } from "../../Icon";
import { ZOOM_MAX, ZOOM_MIN, ZOOM_STEP } from "./chrome";

export function AppTopbar({
  title,
  profile,
  schoolYears,
  folderReady,
  autoSaved,
  zoom,
  busy,
  onSchoolYearChange,
  onZoomChange,
  onDownloadBackup,
  onUploadBackup,
}: {
  title: string;
  profile: TeacherProfile | null;
  schoolYears: string[];
  folderReady: boolean;
  autoSaved: boolean;
  zoom: number;
  busy: boolean;
  onSchoolYearChange: (year: string) => void;
  onZoomChange: (zoom: number) => void;
  onDownloadBackup: () => void;
  onUploadBackup: (file: File) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const schoolYear = profile?.schoolYear || schoolYears[0] || "2026-2027";
  const schoolName = profile?.schoolName || "Your school";

  return (
    <header className="topbar ecr-topbar">
      <div className="ecr-topbar-context">
        <strong className="ecr-topbar-title">{title}</strong>
        <div className="ecr-topbar-meta">
          <label className="ecr-year-label">
            <span className="sr-only">School year</span>
            <select value={schoolYear} onChange={(event) => onSchoolYearChange(event.target.value)}>
              {schoolYears.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </label>
          <span className="ecr-topbar-school">
            {schoolName} • Compliant with DepEd Order No. 15 s. 2026
          </span>
        </div>
      </div>

      <div className="ecr-topbar-status">
        <span className={`ecr-status ${folderReady ? "is-ready" : "is-wait"}`}>
          <span className="ecr-status-dot" />
          {folderReady ? "Folder Up to Date" : "Folder not linked"}
        </span>
        <span className={`ecr-status ${autoSaved ? "is-ready" : "is-wait"}`}>
          <Icon name="floppy" />
          {autoSaved ? "Auto-saved" : "Local only"}
        </span>
      </div>

      <div className="ecr-topbar-actions">
        <button type="button" className="ghost ecr-backup-btn" disabled={busy} onClick={onDownloadBackup}>
          <Icon name="download" />
          <span>Download Backup</span>
        </button>
        <button type="button" className="ghost ecr-backup-btn" disabled={busy} onClick={() => fileRef.current?.click()}>
          <Icon name="upload" />
          <span>Upload Backup</span>
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) onUploadBackup(file);
          }}
        />
        <div className="ecr-zoom" role="group" aria-label="Zoom">
          <button type="button" className="ghost ecr-zoom-btn" aria-label="Zoom out" onClick={() => onZoomChange(zoom - ZOOM_STEP)}>
            <Icon name="minus" />
          </button>
          <input
            type="range"
            min={ZOOM_MIN}
            max={ZOOM_MAX}
            step={ZOOM_STEP}
            value={zoom}
            aria-label="Zoom"
            onChange={(event) => onZoomChange(Number(event.target.value))}
          />
          <button type="button" className="ghost ecr-zoom-btn" aria-label="Zoom in" onClick={() => onZoomChange(zoom + ZOOM_STEP)}>
            <Icon name="plus" />
          </button>
          <span className="ecr-zoom-value">{zoom}%</span>
        </div>
      </div>
    </header>
  );
}
