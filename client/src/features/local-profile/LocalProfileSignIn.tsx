import { useEffect, useState } from "react";
import { createLocalUser, type User } from "../../auth";
import { Icon } from "../../Icon";
import {
  connectLocalUsersFolder,
  createLocalProfile,
  getLocalFolderStatus,
  openLocalProfile,
  type LocalFolderStatus,
  type LocalProfileMeta,
} from "../../storage/local-profile";

export function LocalProfileSignIn({ onSignedIn }: { onSignedIn: (user: User) => void }) {
  const [status, setStatus] = useState<LocalFolderStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [school, setSchool] = useState("");
  const [pin, setPin] = useState("");
  const [copyDeviceData, setCopyDeviceData] = useState(false);
  const [unlockPin, setUnlockPin] = useState("");
  const [selectedId, setSelectedId] = useState("");

  const refresh = async () => {
    setStatus(await getLocalFolderStatus());
  };

  useEffect(() => {
    void refresh();
  }, []);

  const users: LocalProfileMeta[] = status?.users ?? [];

  const chooseFolder = async () => {
    setBusy(true);
    setError(null);
    try {
      await connectLocalUsersFolder();
      await refresh();
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Could not open the Documents folder.");
    } finally {
      setBusy(false);
    }
  };

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      const meta = await createLocalProfile({
        displayName: name,
        schoolName: school,
        pin,
        copyDeviceData,
      });
      onSignedIn(createLocalUser(meta.displayName, meta.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create a local profile.");
    } finally {
      setBusy(false);
    }
  };

  const open = async (id: string) => {
    setBusy(true);
    setError(null);
    try {
      const meta = await openLocalProfile(id, unlockPin);
      onSignedIn(createLocalUser(meta.displayName, meta.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open that local profile.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-local">
      <h3>Local profile</h3>
      <p className="muted">
        Stay fully offline. GradeBoss writes this device’s database under{" "}
        <code>{status?.pathHint || "Documents/ecrecord_users_local"}</code>.
      </p>

      {error ? <div className="banner error">{error}</div> : null}

      {!status?.supported ? (
        <div className="banner warn">
          <Icon name="cloud-off" />
          This browser cannot write to Documents. Use Chrome or Edge on a computer to create{" "}
          <code>ecrecord_users_local</code>, or continue after choosing a folder on a supported browser.
        </div>
      ) : null}

      <button type="button" className="primary auth-local-folder" onClick={() => void chooseFolder()} disabled={busy}>
        {status?.connected ? "Change Documents folder" : "Choose Documents folder"}
      </button>
      {status?.connected ? (
        <p className="muted small">
          Connected to <strong>{status.folderName}</strong> ({status.pathHint}).
        </p>
      ) : (
        <p className="muted small">Pick your Documents folder. GradeBoss will create ecrecord_users_local inside it.</p>
      )}

      {users.length > 0 ? (
        <div className="local-user-list">
          <h4>Open an existing profile</h4>
          <ul>
            {users.map((user) => (
              <li key={user.id}>
                <button
                  type="button"
                  className={selectedId === user.id ? "ghost local-user-btn active" : "ghost local-user-btn"}
                  onClick={() => setSelectedId(user.id)}
                >
                  <strong>{user.displayName}</strong>
                  <span className="muted small">{user.schoolName || user.id}</span>
                </button>
              </li>
            ))}
          </ul>
          {selectedId && users.find((user) => user.id === selectedId)?.pin ? (
            <label>
              PIN
              <input
                type="password"
                inputMode="numeric"
                autoComplete="current-password"
                value={unlockPin}
                onChange={(event) => setUnlockPin(event.target.value)}
                placeholder="4–8 digits"
              />
            </label>
          ) : null}
          <button
            type="button"
            className="primary"
            disabled={busy || !selectedId}
            onClick={() => void open(selectedId)}
          >
            Open local profile
          </button>
        </div>
      ) : null}

      <form
        className="local-profile-form"
        onSubmit={(event) => {
          event.preventDefault();
          void create();
        }}
      >
        <h4>Create a local profile</h4>
        <label>
          Your name
          <input value={name} onChange={(event) => setName(event.target.value)} required placeholder="Teacher name" />
        </label>
        <label>
          School (optional)
          <input value={school} onChange={(event) => setSchool(event.target.value)} placeholder="School name" />
        </label>
        <label>
          Optional PIN
          <input
            type="password"
            inputMode="numeric"
            autoComplete="new-password"
            value={pin}
            onChange={(event) => setPin(event.target.value)}
            placeholder="4–8 digits"
          />
        </label>
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={copyDeviceData}
            onChange={(event) => setCopyDeviceData(event.target.checked)}
          />
          Copy grade data already on this device
        </label>
        <button
          type="submit"
          className="primary"
          disabled={busy || !name.trim() || Boolean(status?.supported && !status.connected)}
        >
          Use local profile
        </button>
      </form>
    </div>
  );
}
