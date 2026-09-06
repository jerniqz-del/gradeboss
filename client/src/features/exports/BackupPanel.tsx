import { useRef, useState } from "react";
import { Icon } from "../../Icon";
import { exportBackupBundle, importBackupBundle } from "../../storage";
import { backupFilename, downloadJson } from "./download";
import { isSealedBackup, sealBackup, unsealBackup } from "./pin";
import type { BackupMode } from "./types";

export function BackupPanel() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [pin, setPin] = useState("");
  const [importPin, setImportPin] = useState("");
  const [mode, setMode] = useState<BackupMode>("replace");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onExport = async () => {
    setBusy(true);
    setError(null);
    try {
      const bundle = await exportBackupBundle();
      const sealed = pin.trim() ? await sealBackup(bundle, pin) : bundle;
      downloadJson(backupFilename(Boolean(pin.trim())), sealed);
      setNotice(
        pin.trim()
          ? `Saved a PIN-protected backup of ${bundle.teachingLoads.length} teaching load${bundle.teachingLoads.length === 1 ? "" : "s"}.`
          : `Saved a backup of ${bundle.teachingLoads.length} teaching load${bundle.teachingLoads.length === 1 ? "" : "s"}.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not export backup.");
    } finally {
      setBusy(false);
    }
  };

  const onFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const parsed: unknown = JSON.parse(await file.text());
      const bundle = isSealedBackup(parsed) ? await unsealBackup(parsed, importPin) : parsed;
      if (mode === "replace" && !window.confirm("Replace all teaching loads, scores, and SF1 history on this device?")) {
        setBusy(false);
        return;
      }
      const applied = await importBackupBundle(bundle, mode);
      setNotice(
        mode === "replace"
          ? `Restored ${applied.teachingLoads.length} teaching load${applied.teachingLoads.length === 1 ? "" : "s"}.`
          : `Merged backup. This device now has ${applied.teachingLoads.length} teaching load${applied.teachingLoads.length === 1 ? "" : "s"}.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not import that file.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card backup-card">
      <h3>Export &amp; import backup</h3>
      <p className="muted">
        Download a JSON copy of teaching loads, scores, and SF1 history. Restore it on this device or another browser.
        Everything stays offline.
      </p>

      {error && <div className="banner error">{error}</div>}
      {notice && <div className="banner ok">{notice}</div>}

      <div className="backup-grid">
        <div>
          <h4>Export</h4>
          <label>
            Optional PIN
            <input
              type="password"
              autoComplete="new-password"
              placeholder="Leave blank for a plain file"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
            />
          </label>
          <button type="button" className="primary" disabled={busy} onClick={() => void onExport()}>
            <Icon name="download" /> Download backup
          </button>
        </div>

        <div>
          <h4>Import</h4>
          <fieldset className="backup-mode">
            <legend>Restore mode</legend>
            <label className="backup-radio">
              <input type="radio" name="backup-mode" checked={mode === "replace"} onChange={() => setMode("replace")} />
              Replace this device
            </label>
            <label className="backup-radio">
              <input type="radio" name="backup-mode" checked={mode === "merge"} onChange={() => setMode("merge")} />
              Merge (keep extra local loads)
            </label>
          </fieldset>
          <label>
            PIN (if the file is protected)
            <input
              type="password"
              autoComplete="current-password"
              placeholder="Required for sealed backups"
              value={importPin}
              onChange={(e) => setImportPin(e.target.value)}
            />
          </label>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => void onFile(e)} />
          <button type="button" className="ghost" disabled={busy} onClick={() => fileRef.current?.click()}>
            <Icon name="upload" /> Choose backup file
          </button>
        </div>
      </div>
    </div>
  );
}
