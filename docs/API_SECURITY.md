# API security posture

> How vet-rate-org talks to external APIs, what controls are in place, and the key-rotation runbook. Closes finding #18 in [AUDIT_FINDINGS.md](./AUDIT_FINDINGS.md).
>
> Companion to [vaAuth.js](../src/config/vaAuth.js), [va.js](../src/api/va.js), [pkce.js](../src/utils/pkce.js), and [useVaAuth.js](../src/auth/useVaAuth.js).

**Last reviewed:** 2026-05-15

---

## TL;DR

vet-rate-org is a **browser SPA**. Every API call originates from the veteran's own browser, with the veteran's own OAuth tokens or own API keys. We do not proxy traffic through a server, and we do not aggregate calls across users.

This shapes everything else on this page:

- **Rate limiting is already per-user** — there is no "shared global" to throttle. Each user has their own browser, their own `rateLimiter` instance, their own VA quota.
- **CORS is enforced by the VA API platform**, not by us. Dev-only Vite proxy bypasses CORS for `localhost:5173`; production hits VA endpoints directly and inherits VA's published CORS posture.
- **Key rotation is per-user** — the user manages their own keys. We provide UX to update them; we never see them server-side because there is no server-side.

The entire VA-API surface is also **default-disabled** behind `VITE_VA_API_ENABLED=false`. Re-enabling is a deliberate code-reviewed change. See [vaAuth.js:24-30](../src/config/vaAuth.js#L24-L30) and [COMPLIANCE_STRATEGY.md re-evaluation triggers](./COMPLIANCE_STRATEGY.md).

---

## 1. The API surface (when enabled)

| API | Auth | Scope | Endpoint family |
|---|---|---|---|
| Veteran Service History | OAuth 2.0 + PKCE | `service_history.read` | `/services/veteran_verification/v2/*` |
| Disability Rating | OAuth 2.0 + PKCE | `disability_rating.read` | `/services/veteran_verification/v2/disability_rating` |
| Claims | OAuth 2.0 + PKCE | `claim.read`, claim upload | `/services/claims/v2/veterans/me/*` |
| Appealable Issues | OAuth 2.0 + PKCE | `appealable_issues.read` | `/services/appeals/appealable-issues/v0/*` |
| Appeals Status | OAuth 2.0 + PKCE | `appeals_status.read` | `/services/appeals/v0/appeals` |
| VA Facilities | API key | (open data) | `/services/va_facilities/v1/*` |
| VA Forms | API key | (open data) | `/services/va_forms/v0/*` |
| Benefits Reference Data | API key | (open data) | `/services/benefits-reference-data/v1/*` |

OAuth-protected endpoints flow through [authenticatedFetch](../src/api/va.js#L99) which:

1. Asserts the master switch (`assertVaApiEnabled`).
2. Calls `rateLimiter.checkLimit()` (see §2).
3. Sends `Authorization: Bearer ${accessToken}` and `Accept: application/json`.
4. Branches on 401 / 403 / non-OK with structured error codes (`UNAUTHORIZED` / `FORBIDDEN`).

API-key endpoints send `apikey: ${key}` directly without going through the rate-limiter — these are open-data endpoints and the per-user-browser-instance throttle would not change the per-user quota.

---

## 2. Rate limiting

[src/api/va.js:44-89](../src/api/va.js#L44-L89): client-side throttle, 30 requests / 60 s rolling window (half of VA sandbox's 60/min). Implementation is an array of `Date.now()` timestamps; old ones drop off the front of the window on each `checkLimit()`.

### Why "per-user" is already true

The original audit row flagged "rate limiter is global, not per-user." In a typical server-side context, a global JS variable would serve all users from one process — but here:

- `rateLimiter` is a JS module variable in the **user's own browser tab**.
- There is exactly one user per browser tab (or zero, when the tab is closed).
- Two veterans cannot share a `rateLimiter` instance unless they are sharing a literal browser window.

So the limiter **is per-user by construction.** What is *not* per-user is per-endpoint differentiation — every OAuth-protected call goes through the same limiter regardless of which VA endpoint it hits. That's deliberate: VA's published per-application quota is the bottleneck, not per-endpoint quota, so a single shared bucket matches the upstream behavior.

### What rate limiting does NOT defend against

- A malicious user who hand-edits the JS to bypass the limiter. They can. The limiter exists to prevent **accidental** runaway calls (e.g., a `useEffect` infinite loop) and to keep the user under VA's quota during normal use. It is not a security boundary.
- A multi-tab user. Each tab has its own limiter. A user with 5 tabs open could in theory issue 5× the per-tab limit. VA's server-side quota still caps the upstream.

### What rate limiting DOES defend against

- Hot-reload / dev-cycle runaway calls during development.
- A buggy retry loop after a 5xx surge.
- Component remount storms (e.g., StrictMode double-effects in dev).
- A user clicking a "Refresh" button rapidly during a slow upstream response.

---

## 3. CORS posture

### Development

Vite proxy at [vite.config.js](../vite.config.js) maps `/va-api/*` → `https://sandbox-api.va.gov/*`, allowing the local dev server (typically `http://localhost:5173`) to call VA endpoints without the browser's same-origin restrictions. The proxy is a Vite middleware — there is no production analog.

### Production

In production, the SPA calls VA endpoints **directly** (e.g., `https://api.va.gov/services/claims/v2/...`). The browser's CORS preflight is therefore enforced against VA's published CORS allow-list, which currently includes registered redirect URIs only.

**Implication:** to deploy this app at a new origin (`https://newhost.example.com`), the registered redirect URI on the VA sandbox-access form **must** be updated to match. CORS preflight failures during deployment usually trace back here.

### What we explicitly do NOT do

- We don't proxy through a server. Adding a server-side proxy would conflict with the zero-knowledge stance ([COMPLIANCE_STRATEGY.md](./COMPLIANCE_STRATEGY.md) re-evaluation triggers).
- We don't intercept CORS responses to "fix" them. If VA changes their CORS policy, the SPA breaks and we fix the registered origin, not the request.

---

## 4. Token handling

### OAuth tokens (VA OAuth API)

Per [PKCE.md / pkce.js](../src/utils/pkce.js), the SPA uses the Authorization Code Grant with PKCE (S256 challenge). Tokens are stored in `localStorage` under the storage keys at [vaAuth.js:114-135](../src/config/vaAuth.js#L114-L135):

- `va_access_token` — short-lived bearer token (≤1 hour typical for VA sandbox)
- `va_refresh_token` — long-lived (7-day sandbox, 42-day production) via `offline_access` scope
- `va_token_expiry` — unix epoch expiry for the access token
- `va_oauth_state` — CSRF state, single-use
- `va_code_verifier` — PKCE verifier, never sent to the authorization endpoint

**Storage choice:** `localStorage` over `sessionStorage` is a deliberate trade-off. `sessionStorage` would clear tokens on tab close — a worse UX. `localStorage` is durable, but accessible to any script that runs on our origin. We mitigate by (a) shipping a CSP that allow-lists script sources ([index.html](../index.html)), and (b) auditing every `dangerouslySetInnerHTML` site (4 total, all `nosemgrep`-justified — see [AUDIT_FINDINGS.md row 4](./AUDIT_FINDINGS.md)).

### API keys (open-data endpoints)

Three keys, sourced from Vite env vars at build time:

- `VITE_VA_API_KEY` → VA Facilities
- `VITE_VA_FORMS_API_KEY` → VA Forms
- `VITE_VA_BENEFITS_REF_API_KEY` → Benefits Reference Data

These are bundled into the production JS at build time. **They are not secrets** — they grant access to open-data endpoints (forms, facilities, reference data) that anyone can register for at `developer.va.gov`. Treat them as quota tokens, not credentials.

### Gemini API key (cloud fallback)

`vetrate_gemini_key` is stored in `localStorage` and **never sent to our origin** — the SPA calls Google's API directly from the user's browser. The user supplies their own key from `aistudio.google.com`.

---

## 5. Key-rotation runbook

### VA OAuth Client ID rotation

**When:** VA notifies us that a client ID is being rotated (rare), or we deliberately rotate to compartmentalize per-deploy.

**Steps:**

1. Submit a new sandbox-access form at `developer.va.gov`.
2. Receive new `clientId` + approved scopes.
3. Update `VITE_VA_AUTH_ID` in the deploy environment.
4. Verify `VITE_VA_REDIRECT_URL` still matches the new app's registered redirect URI.
5. Re-deploy. The next user login uses the new client ID; existing refresh tokens issued under the old ID will be invalidated when the old ID is revoked.

### VA API key rotation (Facilities / Forms / Benefits Reference)

**When:** Quarterly cadence or on suspicion of key leak. There is no automated rotation — `developer.va.gov` does not currently support programmatic rotation.

**Steps:**

1. Generate a new key on `developer.va.gov` for the affected API.
2. Update the corresponding `VITE_*_API_KEY` env var.
3. Re-deploy.
4. Revoke the old key on `developer.va.gov`.

There is no user-visible disruption: the user's browser fetches the new bundle on next page load and uses the new key transparently.

### Gemini API key rotation

User-managed. We expose a UI panel ([AICommandCenter.jsx](../src/components/AICommandCenter.jsx)) where the user can replace the key. The SPA never sees the old key after replacement.

### OAuth refresh-token rotation

VA OAuth refresh tokens rotate on every use (single-use refresh tokens) per VA's published spec. [useVaAuth.js](../src/auth/useVaAuth.js) handles the token-exchange and stores the rotated refresh token back to `localStorage`.

---

## 6. What we explicitly do not do

- **We do not log tokens or API keys.** `va.js` `console.log` calls log endpoint paths and counts only — never the bearer token or apikey. Grep confirms: zero `console.log` calls in `va.js` reference any of the storage keys. (Re-grep before adding new logging.)
- **We do not store tokens in cookies.** Cookies would attach to every request from the origin, including unintended ones (preview iframes, embedded help widgets if/when they're added). `localStorage` is opt-in per request via the `authenticatedFetch` wrapper.
- **We do not implement key wrapping for stored keys.** The keys are in `localStorage` in cleartext, behind the user's OS-level disk encryption. Adding a wrap layer would not raise the bar against the same threat (a malicious script on our origin can read either form), and it conflicts with the [CRYPTO_AUDIT.md §7](./CRYPTO_AUDIT.md) decision not to add key-wrap in general.
- **We do not auto-revoke refresh tokens on signout.** The VA `revoke` endpoint exists ([vaAuth.js:71](../src/config/vaAuth.js#L71)) but the current sign-out path clears `localStorage` only. A standalone follow-up could call `revoke` on signout to invalidate the refresh token server-side; the trade-off is that revoke is a network round-trip that can fail silently and leave the user in a "I signed out but my token is still valid" state. Tracked as a follow-up — low priority because the refresh token's offline risk window is ≤7 days in sandbox.

---

## 7. CSP and the SPA boundary

[index.html](../index.html) ships a CSP that allow-lists the origins this app talks to. Any new external endpoint added to the SPA needs a corresponding `connect-src` allow-list update. The CSP is the second line of defense against a compromised script attempting to exfiltrate tokens — the first being the same-origin policy and the third being the per-call `Authorization` header that has to be explicitly attached.

---

## 8. Re-audit triggers

Re-open this document if any of these happen:

- A new external API surface is added (anything beyond the 8 in §1).
- VA changes their CORS allow-list mechanism.
- VA starts supporting programmatic key rotation.
- A server-side proxy is introduced.
- A key leak is suspected (perform key-rotation runbook in §5 then re-audit).
- We get partner integration that requires a non-VA API.

---

*Owner: Anthony Johnson. Last updated 2026-05-15. Closes [AUDIT_FINDINGS.md](./AUDIT_FINDINGS.md) row 18 — promoted from partial to compliant. Severity was inflated by the "global rate-limiter" framing, which is a server-side concern that doesn't apply to a browser SPA.*
