# GradeBoss Sync Bridge — Technical Spec (Encrypted Store‑and‑Forward)

Status: draft for review. Scope: the **paid** online sync feature that links a user's
2–3 devices. The single‑device app stays free, local, and offline (IndexedDB source of
truth). The bridge is a thin, **zero‑knowledge relay** — it never sees plaintext data.

## 1. Goals / non‑goals

Goals

- Let one user's devices exchange changes even when they are **not online at the same
  time** (store‑and‑forward).
- **End‑to‑end encrypted**: the server relays opaque ciphertext only. This keeps
  personal/student data off the server in readable form and minimises privacy‑law scope.
- **Enforce the paywall**: free = 1 device; each extra linked device requires an active
  subscription (₱50/device/yr or ₱5/device/mo).
- Cheap to run (Cloudflare free tier for a long time), simple to operate solo.

Non‑goals (for v1)

- No server‑side reading, search, or analytics of user data (impossible by design — it's
  encrypted).
- No real‑time collaboration/cursors (periodic sync is enough).
- No cross‑user sharing. Data is per owner only.

## 2. High‑level architecture

```
Device A (PWA)                 Cloudflare                    Device B (PWA)
 ┌──────────────┐   HTTPS/WSS   ┌──────────────────┐  HTTPS/WSS  ┌──────────────┐
 │ IndexedDB     │ ───────────▶ │  Worker (Hono)    │ ◀───────── │ IndexedDB     │
 │ (source of    │  push enc.   │  - auth           │  pull enc. │ (source of    │
 │  truth)       │  envelopes   │  - device limit   │  envelopes │  truth)       │
 │ E2EE encrypt  │ ◀─────────── │  - store&forward  │ ─────────▶ │ E2EE decrypt  │
 └──────────────┘   pull        │  D1 + KV outbox   │            └──────────────┘
                                │  Stripe/PayMongo  │
                                │  webhook          │
                                └──────────────────┘
```

- **Client**: existing React PWA. Adds a local change‑log (outbox), an encryption layer,
  and a sync client.
- **Bridge (Worker)**: authenticates devices, checks subscription + device count, accepts
  encrypted envelopes, stores them until every other registered device has acked, and
  serves pending envelopes on pull.
- **Storage**: **D1** for durable records (accounts, devices, subscriptions, envelope
  metadata) and **KV or D1** for the envelope blobs (with TTL).

## 3. Merge model

Client keeps the local DB authoritative and emits **change events** (create/update/delete
per record). Recommended merge: **CRDT (Yjs or Automerge)** so concurrent edits from
multiple devices merge without loss; the encrypted envelope carries CRDT updates. Simpler
fallback: **LWW** per record (`updatedAt` + tombstones). The bridge is agnostic — it only
moves opaque blobs; merge happens on‑device after decryption.

## 4. Encryption design (zero‑knowledge)

- On first setup the user creates a **sync passphrase** (or the app generates a recovery
  key). Derive a symmetric **account key** with Argon2id/PBKDF2 (WebCrypto). The key
  **never leaves the device**.
- Additional devices are enrolled by transferring the key during pairing (see §7), e.g.
  via a QR code shown on an already‑enrolled device.
- Every envelope payload is encrypted with AES‑GCM (per‑message random IV) under a key
  derived from the account key. The server stores only `{iv, ciphertext, authTag}`.
- The server therefore cannot read data, and cannot forge changes (GCM integrity). Losing
  the passphrase = unrecoverable data (document this; offer an on‑device recovery‑key
  export).

## 5. Data model (D1)

```sql
-- Billing/identity account (one per paying user)
CREATE TABLE accounts (
  id            TEXT PRIMARY KEY,        -- uuid
  handle        TEXT UNIQUE,             -- login/username or email
  pw_hash       TEXT NOT NULL,           -- argon2/scrypt (auth only; NOT the enc key)
  created_at    INTEGER NOT NULL
);

-- Subscription state, updated by payment webhook
CREATE TABLE subscriptions (
  account_id    TEXT PRIMARY KEY REFERENCES accounts(id),
  status        TEXT NOT NULL,           -- active | past_due | canceled | none
  paid_devices  INTEGER NOT NULL DEFAULT 0,  -- how many EXTRA devices are paid for
  plan          TEXT,                    -- annual | monthly
  current_period_end INTEGER,            -- epoch ms
  provider      TEXT,                    -- paymongo | xendit | stripe
  provider_ref  TEXT
);

-- Registered devices (device #1 is free; #2+ require paid_devices >= n-1)
CREATE TABLE devices (
  id            TEXT PRIMARY KEY,        -- uuid, client-generated
  account_id    TEXT NOT NULL REFERENCES accounts(id),
  label         TEXT,                    -- "Teacher phone"
  pubkey        TEXT,                    -- device auth public key (optional)
  created_at    INTEGER NOT NULL,
  last_seen_at  INTEGER,
  revoked       INTEGER NOT NULL DEFAULT 0
);

-- Store-and-forward outbox: one row per (envelope, target device) until acked
CREATE TABLE envelopes (
  id            TEXT PRIMARY KEY,        -- uuid
  account_id    TEXT NOT NULL,
  from_device   TEXT NOT NULL,
  seq           INTEGER NOT NULL,        -- per-account monotonic
  size_bytes    INTEGER NOT NULL,
  created_at    INTEGER NOT NULL,
  expires_at    INTEGER NOT NULL,        -- TTL cleanup
  blob_key      TEXT NOT NULL            -- KV key holding {iv,ciphertext}
);

CREATE TABLE envelope_acks (
  envelope_id   TEXT NOT NULL REFERENCES envelopes(id),
  device_id     TEXT NOT NULL,
  acked_at      INTEGER NOT NULL,
  PRIMARY KEY (envelope_id, device_id)
);

-- Indexes that keep D1 "rows read" tiny (bill saver)
CREATE INDEX idx_env_account_seq ON envelopes(account_id, seq);
CREATE INDEX idx_dev_account ON devices(account_id) WHERE revoked = 0;
```

Blob storage: put ciphertext in **KV** (`blob_key`) with TTL, or a D1 BLOB column if you
prefer one store. Delete once all non‑origin devices have acked (or on TTL).

## 6. Sync protocol

All requests authenticated (§8) and scoped to the caller's `account_id`.

- `POST /sync/push` — body: `[{seq, iv, ciphertext, authTag, size}]`. Server assigns
  storage, fans out one `envelopes` row per other active device, returns accepted seqs.
- `GET /sync/pull?since=<cursor>` — returns pending envelopes for the calling device
  (only rows without an ack from this device), plus a new cursor.
- `POST /sync/ack` — body: `[envelopeId...]`. Marks delivered; server garbage‑collects an
  envelope once every target device has acked.
- Cursors are per `(account, device)`; server tracks max acked `seq`.

Triggers on the client: on login, on `online` event, on app foreground
(`visibilitychange`), a periodic timer while online+subscribed, and a manual "Sync now".
(iOS has no reliable background sync — foreground/reconnect only.)

Retention: envelopes expire after e.g. 30 days even if undelivered (revoked/lost device),
bounding storage.

## 7. Device linking / pairing

1. User signs in on Device A (already enrolled, holds the account key).
2. Device A shows a **pairing QR** containing: a short‑lived pairing token (from the
   bridge) + the account key material (encrypted with a 6‑digit PIN shown to the user).
3. Device B scans it, prompts for the PIN, derives the account key, and calls
   `POST /devices/enroll` with the pairing token.
4. Bridge validates the token, checks the **device limit** (§9), registers Device B.
5. Device B does a full `pull` and reconstructs the local DB.

No plaintext key ever transits the bridge — only the PIN‑wrapped blob inside the QR, which
never touches the server.

## 8. Auth

- **Account auth**: username/handle + password (argon2/scrypt hash in `accounts`). Issues a
  short‑lived **JWT** (access) + refresh token. Tokens cached on device so brief offline
  periods don't force re‑login; refresh when online.
- **Device auth** (optional hardening): each device generates a keypair at enrollment;
  requests are signed, letting the server revoke a single lost device.
- All sync endpoints require a valid token whose `account_id` matches the data scope.

## 9. Paywall / device‑count enforcement

- Free: **1 device** per account, no subscription required (it can still use the bridge as
  a backup of a single device, or you can disable bridge entirely for free — your call).
- Enrolling device **N** requires `subscriptions.status = 'active'` AND
  `paid_devices >= N - 1`. Otherwise `402 Payment Required` with an upgrade link.
- If a subscription lapses (`past_due`/`canceled`): stop accepting new pushes/enrollments
  and (grace period) keep serving pulls so users can pull their data down locally. Local
  data is never held hostage — it already lives on each device.

## 10. Billing integration

- Provider: **PayMongo** or **Xendit** (GCash/Maya first; cards optional). Lead with
  **annual** billing to avoid per‑transaction fixed‑fee erosion (see the pricing
  calculator).
- Flow: client → checkout (provider hosted) → provider **webhook** → Worker verifies
  signature → upsert `subscriptions` (`status`, `paid_devices`, `current_period_end`).
- Never trust client‑reported subscription state; the webhook is the source of truth.

## 11. Privacy & security posture

- **Zero‑knowledge**: server stores ciphertext only → minimal data‑privacy scope (relayer
  of opaque blobs, not a processor of readable personal data). Pair with short retention.
- Rate limit push/pull/enroll per account + per IP; cap envelope size and per‑account
  storage; add Turnstile on signup to deter abuse.
- Revocation: mark a device `revoked`; it can no longer pull/push; its pending envelopes GC.
- Audit: log auth + enrollment + billing events (no payload contents).

## 12. Deployment modes

- **Hosted bridge (you run it, you bill)** — the ₱5/₱50 model. This is where subscription
  revenue comes from.
- **School self‑hosted bridge** — a school runs its own Worker+D1 on its own Cloudflare
  account; sync is free for that school (no per‑device fee). Same code, different owner.

## 13. Open decisions

1. Merge layer: **CRDT (Yjs/Automerge)** vs **LWW** — pick before building the outbox.
2. Is the free tier allowed to use the bridge for single‑device backup, or is the bridge
   strictly a paid feature?
3. Also ship **free LAN/P2P sync** (WebRTC over WiFi/hotspot) so free users get
   same‑network multi‑device, with the paid bridge reserved for remote/async sync?
4. Payment provider: PayMongo vs Xendit; annual‑only vs annual+monthly.
5. Blob store: KV (TTL‑friendly) vs D1 BLOB (single store).

## 14. Suggested build order

1. Local‑first refactor (IndexedDB store + outbox/change‑log) — no bridge yet.
2. Encryption layer (account key, envelope encrypt/decrypt) with local round‑trip tests.
3. Bridge Worker: auth + push/pull/ack + D1/KV, no billing (dev‑unlocked).
4. Device pairing (QR + PIN) and multi‑device pull.
5. Billing webhook + device‑count enforcement.
6. Hardening: rate limits, revocation, retention GC, update UX.
