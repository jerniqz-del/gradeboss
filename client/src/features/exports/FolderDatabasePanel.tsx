import { useEffect, useState } from "react";
import { Icon } from "../../Icon";
import {
  disconnectFolderDatabase,
  folderDatabaseConnected,
  folderDatabaseName,
  folderDatabaseSupported,
  restoreRememberedFolderDatabase,
  selectFolderDatabase,
  syncFolderDatabase,
} from "../../storage/folder-db";

export function FolderDatabasePanel() {
  const [connected, setConnected] = useState(folderDatabaseConnected());
  const [name, setName] = useState(folderDatabaseName());
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void restoreRememberedFolderDatabase().then((restored) => {
      if (restored) {
        setConnected(true);
        setName(folderDatabaseName());
      }
    }).catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not reopen the folder database."));
  }, []);

  const select = async () => {
    setBusy(true); setError(null);
    try {
      const folder = await selectFolderDatabase();
      setConnected(true); setName(folder);
      setNotice("Folder database connected. GradeBoss will keep gradebook data, profile, and settings in gradeboss.json.");
    } catch (err) {
      if ((err as DOMException)?.name !== "AbortError") setError(err instanceof Error ? err.message : "Could not select that folder.");
    } finally { setBusy(false); }
  };

  const sync = async () => {
    setBusy(true); setError(null);
    try { await syncFolderDatabase(); setNotice("Saved the latest GradeBoss data to the folder."); }
    catch (err) { setError(err instanceof Error ? err.message : "Could not save the folder database."); }
    finally { setBusy(false); }
  };

  const disconnect = async () => {
    await disconnectFolderDatabase();
    setConnected(false); setName(null); setNotice("Folder database disconnected. Your browser copy is still available.");
  };

  return (
    <div className="card folder-db-card">
      <div className="folder-db-heading">
        <div>
          <h3>Local folder database</h3>
          <p className="muted">Keep one portable <code>gradeboss.json</code> file with your data, profile, and app settings.</p>
        </div>
        <span className={connected ? "status-badge ok" : "status-badge"}>{connected ? "Connected" : "Browser storage"}</span>
      </div>
      {error && <div className="banner error">{error}</div>}
      {notice && <div className="banner ok">{notice}</div>}
      {!folderDatabaseSupported() ? (
        <p className="muted">Folder access is unavailable in this browser. Use Download backup instead.</p>
      ) : connected ? (
        <div className="folder-db-actions">
          <span className="muted">Folder: <strong>{name}</strong></span>
          <button type="button" className="primary" disabled={busy} onClick={() => void sync()}><Icon name="download" /> Save now</button>
          <button type="button" className="ghost" disabled={busy} onClick={() => void select()}>Change folder</button>
          <button type="button" className="ghost danger" disabled={busy} onClick={() => void disconnect()}>Disconnect</button>
        </div>
      ) : (
        <button type="button" className="primary" disabled={busy} onClick={() => void select()}><Icon name="folder" /> Choose local folder</button>
      )}
    </div>
  );
}
