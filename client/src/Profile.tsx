import { useState } from "react";
import { roleLabel, type User } from "./auth";

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
}: {
  user: User;
  onSignOut: () => void;
}) {
  const signedIn = new Date(user.signedInAt).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return (
    <section>
      <div className="page-header">
        <h2>Profile</h2>
        <p>Your Google account on this device.</p>
      </div>

      <div className="card profile-card">
        <div className="profile-identity">
          <Avatar user={user} size={72} />
          <div>
            <h3>{user.name}</h3>
            <p className="muted">{user.email}</p>
            <span className={user.role === "superAdmin" ? "role-badge super" : "role-badge"}>
              {roleLabel(user.role)}
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
            <dd>{roleLabel(user.role)}</dd>
          </div>
          <div>
            <dt>Signed in</dt>
            <dd>{signedIn}</dd>
          </div>
        </dl>

        {user.role === "superAdmin" && (
          <p className="muted small">
            Super admin can sign in without a @deped.gov.ph address.
          </p>
        )}

        <button type="button" className="ghost danger profile-signout" onClick={onSignOut}>
          Sign out
        </button>
      </div>
    </section>
  );
}
