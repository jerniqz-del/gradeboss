import { useState } from "react";
import type { User } from "../../auth";
import { registerOrOpenSchoolAccount } from "../../storage/school-accounts";

export function SchoolAccountSignIn({ onSignedIn }: { onSignedIn: (user: User) => void }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const user = await registerOrOpenSchoolAccount({
        email,
        displayName: name,
        pin,
      });
      onSignedIn(user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open that school account.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      className="local-profile-form school-account-form"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <h3>School account</h3>
      <p className="muted">
        The school admin creates the first account with the official DepEd email
        (the same address used for the school’s Cloudflare account). Personnel then
        sign in with the DepEd emails the school issued.
      </p>
      {error ? <div className="banner error">{error}</div> : null}
      <label>
        Official DepEd email
        <input
          type="email"
          autoComplete="username"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
          placeholder="admin@school.deped.gov.ph"
        />
      </label>
      <label>
        Name
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Required when creating a new account"
        />
      </label>
      <label>
        Optional PIN
        <input
          type="password"
          inputMode="numeric"
          autoComplete="current-password"
          value={pin}
          onChange={(event) => setPin(event.target.value)}
          placeholder="4–8 digits"
        />
      </label>
      <button type="submit" className="primary" disabled={busy || !email.trim()}>
        Continue with school account
      </button>
    </form>
  );
}
