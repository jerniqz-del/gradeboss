import { useEffect, useRef, useState } from "react";
import {
  googleClientId,
  loadGoogleIdentity,
  userFromGoogleCredential,
  type User,
} from "./auth";
import { LocalProfileSignIn } from "./features/local-profile/LocalProfileSignIn";
import { Icon } from "./Icon";
import { ThemeToggle } from "./ThemeToggle";
import type { ThemePreference } from "./theme";

export function SignIn({
  online,
  onSignedIn,
  themePreference,
  onThemeChange,
}: {
  online: boolean;
  onSignedIn: (user: User) => void;
  themePreference: ThemePreference;
  onThemeChange: (next: ThemePreference) => void;
}) {
  const slotRef = useRef<HTMLDivElement>(null);
  const onSignedInRef = useRef(onSignedIn);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const clientId = googleClientId();

  onSignedInRef.current = onSignedIn;

  useEffect(() => {
    if (!clientId || !online) {
      setReady(false);
      return;
    }

    let cancelled = false;

    const onCredential = (response: { credential: string }) => {
      try {
        const user = userFromGoogleCredential(response.credential);
        onSignedInRef.current(user);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Sign-in failed. Try again.");
      }
    };

    void (async () => {
      try {
        await loadGoogleIdentity();
        if (cancelled || !slotRef.current || !window.google?.accounts.id) return;
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: onCredential,
          auto_select: false,
          ux_mode: "popup",
          context: "signin",
          itp_support: true,
        });
        slotRef.current.innerHTML = "";
        const width = Math.min(Math.max(slotRef.current.clientWidth || 320, 240), 400);
        window.google.accounts.id.renderButton(slotRef.current, {
          type: "standard",
          theme: "filled_blue",
          size: "large",
          text: "signin_with",
          shape: "pill",
          width,
          logo_alignment: "left",
        });
        if (!cancelled) {
          setReady(true);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not load Google Sign-In.");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [clientId, online]);

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
          Use a DepEd Google account, or a local profile that stays on this device
          under Documents/ecrecord_users_local.
        </p>

        {!online && (
          <div className="banner warn">
            <Icon name="cloud-off" />
            Google Sign-In needs the internet. Local profiles work offline.
          </div>
        )}

        {online && !clientId && (
          <div className="banner warn">
            Google Sign-In is not configured. Set{" "}
            <code>VITE_GOOGLE_CLIENT_ID</code> in <code>client/.env.local</code>{" "}
            and restart the dev server.
          </div>
        )}

        {error && <div className="banner error">{error}</div>}

        <div
          ref={slotRef}
          className="gsi-slot"
          hidden={!online || !clientId}
          aria-busy={online && !!clientId && !ready}
        />

        {online && clientId && !ready && !error && (
          <p className="muted">Loading Google Sign-In…</p>
        )}

        <ul className="auth-notes">
          <li>DepEd Google: @deped.gov.ph</li>
          <li>Local profile: no Google, database in Documents/ecrecord_users_local</li>
          <li>Works offline after the first Google sign-in, or immediately with a local profile</li>
        </ul>

        <div className="auth-divider" role="separator">
          <span>or stay fully local</span>
        </div>

        <LocalProfileSignIn onSignedIn={onSignedIn} />
      </div>
    </div>
  );
}
