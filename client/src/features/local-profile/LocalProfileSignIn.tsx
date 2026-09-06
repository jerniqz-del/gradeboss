import { useEffect, useState } from "react";
import { createLocalUser, type User } from "../../auth";
import { Icon } from "../../Icon";
import {
  createLocalProfile,
  getLocalFolderStatus,
  openLocalProfile,
  type LocalFolderStatus,
  type LocalProfileMeta,
} from "../../storage/local-profile";

function initial(name: string): string {
  const trimmed = name.trim();
  return trimmed ? trimmed[0].toUpperCase() : "?";
}

function shortName(name: string): string {
  return name.trim().length > 18 ? `${name.trim().slice(0, 17)}…` : name.trim();
}

export function LocalProfileSignIn({ onSignedIn }: { onSignedIn: (user: User) => void }) {
  const [status, setStatus] = useState<LocalFolderStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"pick" | "unlock" | "create">("pick");
  const [selected, setSelected] = useState<LocalProfileMeta | null>(null);
  const [unlockPin, setUnlockPin] = useState("");
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");

  const users = status?.users ?? [];

  useEffect(() => {
    void getLocalFolderStatus().then(setStatus);
  }, []);

  const open = async (profile: LocalProfileMeta, pinValue: string) => {
    setBusy(true);
    setError(null);
    try {
      const meta = await openLocalProfile(profile.id, pinValue);
      onSignedIn(createLocalUser(meta.displayName, meta.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open that profile.");
    } finally {
      setBusy(false);
    }
  };

  const selectProfile = (profile: LocalProfileMeta) => {
    setError(null);
    if (profile.pin) {
      setSelected(profile);
      setUnlockPin("");
      setMode("unlock");
      return;
    }
    void open(profile, "");
  };

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      const meta = await createLocalProfile({
        displayName: name,
        pin,
      });
      onSignedIn(createLocalUser(meta.displayName, meta.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create a profile.");
    } finally {
      setBusy(false);
    }
  };

  if (mode === "create") {
    return (
      <div className="profile-gate-body">
        <h2>Create New Profile</h2>
        <p className="profile-gate-sub">A local profile on this device. Sync to school Cloudflare later.</p>
        {error ? <div className="banner error">{error}</div> : null}
        <form
          className="profile-gate-form"
          onSubmit={(event) => {
            event.preventDefault();
            void create();
          }}
        >
          <label>
            Your name
            <input value={name} onChange={(event) => setName(event.target.value)} required placeholder="Teacher name" />
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
          <button type="submit" className="profile-gate-primary" disabled={busy || !name.trim()}>
            Create profile
          </button>
          <button type="button" className="profile-gate-text" onClick={() => setMode("pick")}>
            Back
          </button>
        </form>
      </div>
    );
  }

  if (mode === "unlock" && selected) {
    return (
      <div className="profile-gate-body">
        <h2>{selected.displayName}</h2>
        <p className="profile-gate-sub">Enter your PIN to unlock this profile.</p>
        {error ? <div className="banner error">{error}</div> : null}
        <form
          className="profile-gate-form"
          onSubmit={(event) => {
            event.preventDefault();
            void open(selected, unlockPin);
          }}
        >
          <label>
            PIN
            <input
              type="password"
              inputMode="numeric"
              autoComplete="current-password"
              value={unlockPin}
              onChange={(event) => setUnlockPin(event.target.value)}
              placeholder="4–8 digits"
              autoFocus
            />
          </label>
          <button type="submit" className="profile-gate-primary" disabled={busy || !unlockPin.trim()}>
            Unlock
          </button>
          <button type="button" className="profile-gate-text" onClick={() => setMode("pick")}>
            Back
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="profile-gate-body">
      <h2>Who is grading today?</h2>
      <p className="profile-gate-sub">Select your user profile to unlock your class loads and records.</p>
      {error ? <div className="banner error">{error}</div> : null}
      {users.length > 0 ? (
        <div className="profile-tile-grid">
          {users.map((profile) => (
            <button
              key={profile.id}
              type="button"
              className="profile-tile"
              onClick={() => selectProfile(profile)}
              disabled={busy}
            >
              <span className="profile-tile-avatar">{initial(profile.displayName)}</span>
              <span className="profile-tile-name">{shortName(profile.displayName)}</span>
              {profile.pin ? (
                <span className="profile-tile-lock">
                  <Icon name="lock" />
                  PIN Locked
                </span>
              ) : (
                <span className="profile-tile-lock">Open</span>
              )}
            </button>
          ))}
        </div>
      ) : (
        <p className="profile-gate-empty">No profiles on this device yet.</p>
      )}
      <button type="button" className="profile-create-btn" onClick={() => setMode("create")} disabled={busy}>
        Create New Profile
      </button>
    </div>
  );
}
