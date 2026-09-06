import { useEffect, useState } from "react";
import { isLocalUser, roleLabel, type User } from "./auth";
import { BackupPanel } from "./features/exports/BackupPanel";
import {
  connectLocalUsersFolder,
  documentsPathHint,
  getLocalFolderStatus,
  persistLocalDatabase,
  type LocalFolderStatus,
} from "./storage/local-profile";
import { ThemeToggle } from "./ThemeToggle";
import type { ThemePreference } from "./theme";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "GB";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function Avatar({ user, size = 40 }: { user: User; size?: number }) {
  const [broken, setBroken] = useState(false);
  const dim = { width: size, height: size };

  if (!user.picture || broken) {
    return (
      <span className="avatar fallback" style={dim} aria-hidden="true">
        {initials(user.name)}
      </span>
    );
  }

  return (
    <img
      className="avatar"
      src={user.picture}
      alt=""
      width={size}
      height={size}
      referrerPolicy="no-referrer"
      onError={() => setBroken(true)}
    />
  );
}

export function Profile({
  user,
  onSignOut,
  themePreference,
  onThemeChange,
}: {
  user: User;
  onSignOut: () => void;
  themePreference: ThemePreference;
  onThemeChange: (next: ThemePreference) => void;
}) {
  const signedIn = new Date(user.signedInAt).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  const local = isLocalUser(user);
  const [folder, setFolder] = useState<LocalFolderStatus | null>(null);
  const [folderError, setFolderError] = useState<string | null>(null);
  const [folderNotice, setFolderNotice] = useState<string | null>(null);
  const [folderBusy, setFolderBusy] = useState(false);

  useEffect(() => {
    if (!local) return;
    void getLocalFolderStatus().then(setFolder);
  }, [local]);

  return (
    <section>
      <div className="page-header">
        <h2>Profile</h2>
        <p>{local ? "Local profile on this device." : "Your Google account on this device."}</p>
      </div>

      <div className="card profile-card">
        <div className="appearance-section">
          <h4>Appearance</h4>
          <p className="muted">Choose light, dark, or match your device setting.</p>
          <ThemeToggle preference={themePreference} onChange={onThemeChange} />
        </div>

        <div className="profile-identity">
          <Avatar user={user} size={72} />
          <div>
            <h3>{user.name}</h3>
            <p className="muted">{user.email}</p>
            <span className={user.role === "superAdmin" ? "role-badge super" : "role-badge"}>
              {roleLabel(user.role, user.authKind)}
            </span>
          </div>
        </div>

        <dl className="profile-meta">
          <div>
            <dt>Account</dt>
            <dd>{user.email}</dd>
          </div>
          <div>
            <dt>Role</dt>
            <dd>{roleLabel(user.role, user.authKind)}</dd>
          </div>
          <div>
            <dt>Signed in</dt>
            <dd>{signedIn}</dd>
          </div>
        </dl>

        {user.role === "superAdmin" && !local && (
          <p className="muted small">
            Super admin can sign in without a @deped.gov.ph address.
          </p>
        )}

        {local ? (
          <div className="local-folder-card">
            <h4>Local database folder</h4>
            <p className="muted">
              Saves under <code>{folder?.pathHint || documentsPathHint()}</code> on this device.
            </p>
            {folderError ? <div className="banner error">{folderError}</div> : null}
            {folderNotice ? <div className="banner ok">{folderNotice}</div> : null}
            <p className="muted small">
              {folder?.connected
                ? `Connected to ${folder.folderName}.`
                : "Not connected. Choose your Documents folder so GradeBoss can write ecrecord_users_local."}
            </p>
            <div className="local-folder-actions">
              <button
                type="button"
                className="primary"
                disabled={folderBusy}
                onClick={async () => {
                  setFolderBusy(true);
                  setFolderError(null);
                  try {
                    await connectLocalUsersFolder();
                    setFolder(await getLocalFolderStatus());
                    setFolderNotice("Documents folder connected.");
                  } catch (err) {
                    if (!(err instanceof DOMException && err.name === "AbortError")) {
                      setFolderError(err instanceof Error ? err.message : "Could not connect that folder.");
                    }
                  } finally {
                    setFolderBusy(false);
                  }
                }}
              >
                {folder?.connected ? "Change folder" : "Choose Documents folder"}
              </button>
              <button
                type="button"
                className="ghost"
                disabled={folderBusy || !folder?.connected}
                onClick={async () => {
                  setFolderBusy(true);
                  setFolderError(null);
                  try {
                    await persistLocalDatabase();
                    setFolderNotice("Saved database.json to ecrecord_users_local.");
                  } catch (err) {
                    setFolderError(err instanceof Error ? err.message : "Could not save the local database.");
                  } finally {
                    setFolderBusy(false);
                  }
                }}
              >
                Save now
              </button>
            </div>
          </div>
        ) : null}

        <button type="button" className="ghost danger profile-signout" onClick={onSignOut}>
          Sign out
        </button>
      </div>

      <BackupPanel />
    </section>
  );
}
