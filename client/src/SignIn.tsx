import { LocalProfileSignIn } from "./features/local-profile/LocalProfileSignIn";
import type { User } from "./auth";
import type { ThemePreference } from "./theme";

export function SignIn({
  onSignedIn,
}: {
  online: boolean;
  onSignedIn: (user: User) => void;
  themePreference: ThemePreference;
  onThemeChange: (next: ThemePreference) => void;
}) {
  return (
    <div className="profile-gate">
      <div className="profile-gate-card">
        <LocalProfileSignIn onSignedIn={onSignedIn} />
      </div>
    </div>
  );
}
