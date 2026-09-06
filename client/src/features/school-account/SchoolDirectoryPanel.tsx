import { useState } from "react";
import type { User } from "../../auth";
import {
  accountKindLabel,
  getSchoolDirectory,
  issueSchoolAccount,
  setCloudflareReady,
  setupSchoolCloudflare,
  type SchoolAccountRecord,
  type SchoolDirectory,
} from "../../storage/school-accounts";
import { currentLocalProfileId } from "../../storage/local-profile";

export function SchoolDirectoryPanel({
  user,
  onUserChange,
}: {
  user: User;
  onUserChange: (user: User) => void;
}) {
  const [directory, setDirectory] = useState<SchoolDirectory>(() => getSchoolDirectory());
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [schoolName, setSchoolName] = useState(directory.schoolName);
  const [adminEmail, setAdminEmail] = useState(directory.adminEmail || "");
  const [adminName, setAdminName] = useState(user.name);
  const [adminPin, setAdminPin] = useState("");
  const [issueName, setIssueName] = useState("");
  const [issueEmail, setIssueEmail] = useState("");
  const [issuePin, setIssuePin] = useState("");
  const [issueKind, setIssueKind] = useState<"teaching" | "nonTeaching">("teaching");

  const refresh = () => setDirectory(getSchoolDirectory());
  const isAdmin = user.role === "schoolAdmin" || user.role === "superAdmin" || !directory.adminEmail;

  const setup = async () => {
    setBusy(true);
    setError(null);
    try {
      const next = await setupSchoolCloudflare({
        adminEmail,
        schoolName,
        displayName: adminName,
        pin: adminPin,
        localProfileId: currentLocalProfileId() || user.id,
      });
      onUserChange({ ...user, ...next, id: user.id, authKind: "local", name: user.name || next.name });
      refresh();
      setNotice("School Cloudflare admin is set on this device.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not set up the school account.");
    } finally {
      setBusy(false);
    }
  };

  const toggleReady = () => {
    setError(null);
    try {
      const next = setCloudflareReady(!directory.cloudflareReady);
      setDirectory(next);
      setNotice(
        next.cloudflareReady
          ? "Cloudflare is marked ready. Local profiles can now sync."
          : "Cloudflare is marked not ready. Sync is paused.",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update Cloudflare status.");
    }
  };

  const issue = async () => {
    setBusy(true);
    setError(null);
    try {
      await issueSchoolAccount({
        email: issueEmail,
        displayName: issueName,
        kind: issueKind,
        pin: issuePin,
      });
      setIssueName("");
      setIssueEmail("");
      setIssuePin("");
      refresh();
      setNotice(`Issued a ${issueKind === "teaching" ? "teaching" : "non-teaching"} account.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not issue that account.");
    } finally {
      setBusy(false);
    }
  };

  const accounts: SchoolAccountRecord[] = directory.accounts;

  if (!isAdmin && directory.adminEmail) {
    return (
      <div className="card school-directory-card">
        <h3>School Cloudflare</h3>
        <p className="muted">
          Only the school admin can create teaching and non-teaching accounts.
        </p>
      </div>
    );
  }

  return (
    <div className="card school-directory-card">
      <h3>School Cloudflare</h3>
      <p className="muted">
        The school admin uses the official DepEd email on the school’s Cloudflare
        account, then issues teaching and non-teaching emails to personnel.
      </p>
      {error ? <div className="banner error">{error}</div> : null}
      {notice ? <div className="banner ok">{notice}</div> : null}

      <form
        className="local-profile-form"
        onSubmit={(event) => {
          event.preventDefault();
          void setup();
        }}
      >
        <h4>{directory.adminEmail ? "School admin" : "I am the school admin"}</h4>
        <label>
          School name
          <input value={schoolName} onChange={(event) => setSchoolName(event.target.value)} required />
        </label>
        <label>
          Official DepEd email
          <input
            type="email"
            value={adminEmail}
            onChange={(event) => setAdminEmail(event.target.value)}
            required
            placeholder="admin@school.deped.gov.ph"
          />
        </label>
        <label>
          Admin name
          <input value={adminName} onChange={(event) => setAdminName(event.target.value)} required />
        </label>
        <label>
          Optional admin PIN
          <input
            type="password"
            inputMode="numeric"
            value={adminPin}
            onChange={(event) => setAdminPin(event.target.value)}
            placeholder="4–8 digits"
          />
        </label>
        <button type="submit" className="primary" disabled={busy}>
          {directory.adminEmail ? "Update school admin" : "Set up school Cloudflare"}
        </button>
      </form>

      {directory.adminEmail ? (
        <>
          <div className="school-ready-row">
            <p className="muted small">
              {directory.cloudflareReady
                ? `${directory.schoolName || "School"} Cloudflare is ready. Personnel can sync local profiles.`
                : `${directory.schoolName || "School"} Cloudflare is not ready yet. Local profiles stay on-device.`}
            </p>
            <button type="button" className="ghost" onClick={toggleReady}>
              {directory.cloudflareReady ? "Mark not ready" : "Mark Cloudflare ready"}
            </button>
          </div>

          <form
            className="local-profile-form"
            onSubmit={(event) => {
              event.preventDefault();
              void issue();
            }}
          >
            <h4>Issue a school account</h4>
            <p className="muted small">
              Give this DepEd email to the person. They keep their local profile, then
              sync it here when Cloudflare is ready.
            </p>
            <label>
              Name
              <input value={issueName} onChange={(event) => setIssueName(event.target.value)} required />
            </label>
            <label>
              School-issued DepEd email
              <input
                type="email"
                value={issueEmail}
                onChange={(event) => setIssueEmail(event.target.value)}
                required
                placeholder="teacher@school.deped.gov.ph"
              />
            </label>
            <label>
              Account type
              <select
                value={issueKind}
                onChange={(event) => setIssueKind(event.target.value as "teaching" | "nonTeaching")}
              >
                <option value="teaching">Teaching</option>
                <option value="nonTeaching">Non-teaching</option>
              </select>
            </label>
            <label>
              Optional PIN for that person
              <input
                type="password"
                inputMode="numeric"
                value={issuePin}
                onChange={(event) => setIssuePin(event.target.value)}
                placeholder="4–8 digits"
              />
            </label>
            <button type="submit" className="primary" disabled={busy}>
              Create school account
            </button>
          </form>

          <div className="school-account-list">
            <h4>Issued accounts</h4>
            {accounts.length === 0 ? (
              <p className="muted">No accounts issued yet.</p>
            ) : (
              <ul>
                {accounts.map((account) => (
                  <li key={account.id}>
                    <strong>{account.displayName}</strong>
                    <span className="muted small">{account.email}</span>
                    <span className="role-badge">{accountKindLabel(account.kind)}</span>
                    <span className="muted small">
                      {account.linkedLocalProfileId ? "Synced to a local profile" : "Not synced yet"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
