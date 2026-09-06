import { SchoolAccountSignIn } from "./features/school-account/SchoolAccountSignIn";
import { LocalProfileSignIn } from "./features/local-profile/LocalProfileSignIn";
import { ThemeToggle } from "./ThemeToggle";
import type { User } from "./auth";
import type { ThemePreference } from "./theme";

export function SignIn({
  onSignedIn,
  themePreference,
  onThemeChange,
}: {
  online: boolean;
  onSignedIn: (user: User) => void;
  themePreference: ThemePreference;
  onThemeChange: (next: ThemePreference) => void;
}) {
  return (
    <div className="auth-screen">
      <div className="auth-theme-toggle">
        <ThemeToggle preference={themePreference} onChange={onThemeChange} compact />
      </div>
      <div className="auth-card">
        <div className="brand">
          <div className="brand-mark">GB</div>
          <div>
            <h1>GradeBoss</h1>
            <span>School command center</span>
          </div>
        </div>
        <h2>Sign in</h2>
        <p className="muted">
          No Google. The school issues DepEd emails through its Cloudflare account.
          Teachers who need a device-only copy can use a local profile.
        </p>

        <SchoolAccountSignIn onSignedIn={onSignedIn} />

        <div className="auth-divider" role="separator">
          <span>or local profile</span>
        </div>

        <LocalProfileSignIn onSignedIn={onSignedIn} />

        <ul className="auth-notes">
          <li>School admin: official @deped.gov.ph (Cloudflare / school-issued)</li>
          <li>Personnel: the DepEd email the school created for them</li>
          <li>Local profile: offline files in Documents/ecrecord_users_local</li>
        </ul>
      </div>
    </div>
  );
}
