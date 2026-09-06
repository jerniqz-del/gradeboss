import { useState } from "react";
import type { User } from "../../auth";
import {
  getSchoolDirectory,
  isCloudflareReady,
  schoolIsSetUp,
  syncLocalProfileToSchoolAccount,
  syncStatusForLocalProfile,
} from "../../storage/school-accounts";
import { currentLocalProfileId } from "../../storage/local-profile";

export function SchoolSyncPanel({
  user,
  onUserChange,
}: {
  user: User;
  onUserChange: (user: User) => void;
}) {
  const directory = getSchoolDirectory();
  const status = syncStatusForLocalProfile(currentLocalProfileId() || user.id, user);
  const [email, setEmail] = useState(user.schoolEmail || "");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const sync = async () => {
    setBusy(true);
    setError(null);
    try {
      const next = await syncLocalProfileToSchoolAccount({
        email,
        pin,
        localProfileId: currentLocalProfileId() || user.id,
        localName: user.name,
      });
      onUserChange({ ...user, ...next, id: user.id, authKind: "local" });
      setNotice("This local profile is now synced to your school-issued Cloudflare account.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sync this local profile.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card school-sync-card">
      <h3>Sync to school Cloudflare</h3>
      <p className="muted">
        Keep working in your local profile. When the school admin has issued your
        DepEd email and marked Cloudflare ready, sync this device into that account.
      </p>
      {!schoolIsSetUp() ? (
        <p className="muted small">The school admin has not set up Cloudflare on this device yet.</p>
      ) : null}
      {schoolIsSetUp() && !isCloudflareReady() ? (
        <p className="muted small">
          {directory.schoolName || "The school"} Cloudflare account is not ready yet.
        </p>
      ) : null}
      {status === "linked" ? (
        <p className="banner ok">
          Synced as {user.schoolEmail || email} ({user.schoolAccountKind === "nonTeaching" ? "non-teaching" : user.role === "schoolAdmin" ? "school admin" : "teaching"}).
        </p>
      ) : null}
      {error ? <div className="banner error">{error}</div> : null}
      {notice ? <div className="banner ok">{notice}</div> : null}

      <form
        className="local-profile-form"
        onSubmit={(event) => {
          event.preventDefault();
          void sync();
        }}
      >
        <label>
          School-issued DepEd email
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            placeholder="you@school.deped.gov.ph"
          />
        </label>
        <label>
          PIN from the school admin
          <input
            type="password"
            inputMode="numeric"
            value={pin}
            onChange={(event) => setPin(event.target.value)}
            placeholder="If they set one"
          />
        </label>
        <button type="submit" className="primary" disabled={busy || !email.trim()}>
          Sync local profile
        </button>
      </form>
    </div>
  );
}
