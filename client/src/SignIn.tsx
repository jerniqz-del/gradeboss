import { useEffect, useRef, useState } from "react";
import {
  googleClientId,
  loadGoogleIdentity,
  userFromGoogleCredential,
  type User,
} from "./auth";
import { Icon } from "./Icon";

export function SignIn({
  online,
  onSignedIn,
}: {
  online: boolean;
  onSignedIn: (user: User) => void;
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
      <div className="auth-card">
        <div className="brand">
          <div className="brand-mark">GB</div>
          <div>
            <h1>GradeBoss</h1>
            <span>School command center</span>
          </div>
        </div>
        <h2>Sign in with your DepEd account</h2>
        <p className="muted">
          Use a Google account ending in @deped.gov.ph. Your grades stay on this
          device.
        </p>

        {!online && (
          <div className="banner warn">
            <Icon name="cloud-off" />
            Connect to the internet to sign in with Google.
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
          <li>Teachers and admins: @deped.gov.ph only</li>
          <li>Works offline after the first sign-in</li>
        </ul>
      </div>
    </div>
  );
}
