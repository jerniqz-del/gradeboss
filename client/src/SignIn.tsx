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
        <h2>Create a local profile</h2>
        <p className="muted">
          Start on this device. When the school admin has your Cloudflare / DepEd
          email ready, you can sync this local profile from Profile.
        </p>
        <LocalProfileSignIn onSignedIn={onSignedIn} />
        <ul className="auth-notes">
          <li>Everyone starts with a local profile under Documents/ecrecord_users_local</li>
          <li>The school admin issues teaching and non-teaching Cloudflare accounts</li>
          <li>Sync later — only when the school marks Cloudflare ready</li>
        </ul>
      </div>
    </div>
  );
}
