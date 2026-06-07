# Threat Model — Vet-Rate.org

> Closes the gap surfaced in [AUDIT_FINDINGS.md](./AUDIT_FINDINGS.md) row 17
> (threat-modeling-best-practices, gap/high → S3). Living document — update
> alongside any new external integration, new untrusted-input surface, or new
> AI capability. Last review: 2026-06-06.

---

## 1. Scope

In scope:

- The browser SPA that veterans run locally — React 18 + Vite build, served
  as static files.
- Local-LLM inference paths (web-llm / wllama / @huggingface/transformers
  vision models, plus Tesseract OCR).
- Cloud-LLM fallback (Google Gemini via API key the veteran supplies).
- Local data persistence (IndexedDB, sessionStorage, localStorage).
- The legal-knowledge RAG pipeline that lands in Sprint 6–7.
- The VA.gov OAuth + API surface (currently flag-disabled — re-audit when
  re-enabled).

Out of scope:

- Hosting infrastructure (no server, no backend; the SPA is served as
  static files from the user's chosen origin).
- Network security at the perimeter (TLS / HSTS / DDoS) — handled by the
  hosting provider and the upstream APIs (eCFR, VA.gov, Gemini).
- Physical compromise of the user's device.

---

## 2. Assets

What is worth protecting and why.

| Asset | Sensitivity | Primary risk |
|---|---|---|
| Veteran PII (SSN, DOB, VA file #, EDIPI, address, MRN, full name) | Critical | Identity theft, claim fraud, VA-system targeting |
| DD-214 / C-file contents | Critical | Discloses service-connected conditions, character of discharge |
| Medical records uploaded as evidence | Critical | HIPAA-class exposure |
| OAuth access + refresh tokens for VA.gov | High | Enables impersonation against VA.gov APIs |
| The veteran's claim drafts and statements | High | Strategic disclosure |
| Local AI model audit log | Medium | Reveals usage patterns, query content |
| Application source / build pipeline | Medium | Supply-chain leverage point |
| Knowledge base / static legal data | Low | Public information; integrity matters more than confidentiality |

---

## 3. Trust boundaries (where attacker-controlled bits meet sensitive bits)

The single most important framing for this app is the **lethal trifecta** from
[../best-practices-toolkit/docs/best-practices/ai-agent-security-best-practices.md](file:///E:/VS_Studio/best-practices-toolkit/docs/best-practices/ai-agent-security-best-practices.md):
never co-locate (1) private data + (2) untrusted content + (3) external
communication in a single agent context.

This app sits *near* the trifecta by design. The defenses:

| Boundary | Trusted side | Untrusted side | Defense |
|---|---|---|---|
| **OCR boundary** | App state, veteran PII | Raw PDF bytes → OCR-extracted text | `spotlight()` + `untrustedSection()` wrap OCR text before it reaches the LLM. `piiScrubber` runs first. Dual-LLM split (extractor sees raw OCR, synthesizer sees only structured fields). |
| **DKB boundary** | App state, veteran PII | Retrieved knowledge-base entries (curated but defense-in-depth) | `formatDKBEntry` wraps every retrieved chunk in spotlight delimiters. |
| **RAG boundary** *(Sprint 6–7)* | App state, veteran PII | Fetched eCFR / M21-1 / CAVC / Fed-Cir chunks | Same dual-LLM split; HTML stripped during ingestion; URL allow-list enforced on rendered output. |
| **User-paste boundary** | App state | Veteran-pasted text (decision letters, emails, etc.) | `constructSafePrompt` wraps in `untrustedSection`. PII scrubbed at boundary. |
| **LLM-output → DOM boundary** | App state | Model-generated text | `stripUntrustedUrls` replaces any non-allow-listed URL with `[link removed]`. `safeHtml` for markup. CSP for the perimeter. |
| **External LLM API boundary** | Veteran PII | Gemini / network | PII scrubbed before any prompt leaves the device. Cloud mode is opt-in. |
| **VA.gov OAuth boundary** *(currently disabled)* | App state | VA.gov API responses | `assertVaApiEnabled` gates every fetcher. PKCE on auth flow. State CSRF check. Tokens in sessionStorage (not localStorage). |

---

## 4. Data flow (high level)

```
                ┌──────────────────────────────────────┐
                │            VETERAN (BROWSER)         │
                │                                      │
   File upload  │   ┌────────────┐    ┌────────────┐   │
       ──────────►  │  PDF / OCR │ →  │ piiScrubber│   │
                │   └────────────┘    └────┬───────┘   │
                │                          │           │
                │                ┌─────────▼─────────┐ │
                │                │ dualLLM.extract   │ │  (untrusted side)
                │                └─────────┬─────────┘ │
                │                          │ structured fields only
                │                ┌─────────▼─────────┐ │
                │                │ dualLLM.synthesize│ │  (trusted side)
                │                └─────────┬─────────┘ │
                │                          │           │
                │              ┌───────────▼──────┐    │
                │              │ stripUntrustedUrls│   │
                │              └───────────┬──────┘    │
                │                          │           │
                │                ┌─────────▼─────────┐ │
                │                │ aiAuditLog (IDB)  │ │
                │                └─────────┬─────────┘ │
                │                          │           │
                │                          ▼  rendered │
                └──────────────────────────────────────┘

                Network (only when veteran opts in to cloud LLM)
                          ↑                    ↓
                          │  PII-scrubbed only │
                ┌─────────┴─────┐    ┌─────────┴──────┐
                │  Gemini API   │    │  VA.gov API*   │  *flag-disabled
                └───────────────┘    └────────────────┘
```

The browser is the trust root. PII never leaves it without explicit opt-in
and only after passing through `piiScrubber`. The trifecta-relevant work is
contained inside the browser.

---

## 5. STRIDE per surface

### 5.1 Local browser (file upload → OCR → LLM)

| Threat | Vector | Mitigation |
|---|---|---|
| **S**poofing | A malicious PDF claims to be a DD-214 | OCR is content-blind; downstream extraction returns whatever fields it finds. Schema-driven extractor refuses to invent fields. |
| **T**ampering | A poisoned PDF embeds prompt-injection text | Spotlight delimiters + dual-LLM split. Extractor refuses; synthesizer never sees the raw bytes. |
| **R**epudiation | Veteran disputes what the model saw | `aiAuditLog` hash-chains every call. `verifyLogChain()` proves no entry was silently mutated. |
| **I**nformation disclosure | PII leaks into Cloud LLM prompt | `piiScrubber` runs before any external network egress. Cloud is opt-in. |
| **D**enial of service | Adversarial PDF triggers OCR explosion / regex backtracking | OCR runs in a Worker. `piiScrubber` test suite includes a 100KB-payload-in-<1s test. Bundle has a 60s timeout on every `generateAI` call. |
| **E**levation of privilege | Prompt injection escapes to call a tool / exfiltrate | Dual-LLM split — extractor has no tool access; synthesizer has no untrusted text. URL allow-list on output. |

### 5.2 VA.gov OAuth (when re-enabled)

| Threat | Vector | Mitigation |
|---|---|---|
| CSRF on OAuth callback | Attacker-crafted /callback URL | `state` param verified; `code_verifier` PKCE check. |
| Token theft via XSS | Stored XSS extracts tokens from storage | Tokens kept in `sessionStorage` (cleared on tab close); CSP blocks inline script execution; no third-party origin can read sessionStorage. |
| Token theft via malicious extension | Browser extension reads sessionStorage | Out-of-scope — no client-side defense. Document for user awareness. |
| Stale-token reuse | Refresh token leaked from backups | sessionStorage by design; no backup of tokens. |
| Open redirect on callback | Attacker tampered `redirect_uri` | `VITE_VA_REDIRECT_URL` is the registered URL with developer.va.gov; mismatch fails at VA's side. |

### 5.3 RAG pipeline (Sprint 6–7 — pre-build threat model)

| Threat | Vector | Mitigation |
|---|---|---|
| Source-fetch tampering | MITM on eCFR/M21-1/CAVC fetch | HTTPS only; ETag / If-Modified-Since checks; content-hash diff per source |
| Index poisoning | Bad-faith PR adds a "court opinion" with injection | All HTML stripped at ingestion; URL replaced with text-only citation; PR review required for index updates |
| Stale-index attack | Attacker holds index back; old precedent applied | Each entry carries `fetched_at`; UI surfaces freshness; weekly CI re-ingestion produces diff-PRs |
| RAG hijack | Injected chunk embeds high enough to surface | Spotlight wrapping per chunk; dual-LLM split |

### 5.4 Supply chain

| Threat | Vector | Mitigation |
|---|---|---|
| Dependency RCE | Vulnerable transitive (e.g., protobufjs critical) | npm audit in preflight + CI; Renovate (S8) |
| Build-time injection | Malicious postinstall script | `--ignore-scripts` recommendation in CONTRIBUTING (S8) |
| Mirror-rule drift | AI assistants get inconsistent guidance | Toolkit propagator ensures CLAUDE.md / .cursor / .windsurfrules etc. are diff-clean (S1 verified) |

---

## 6. OWASP LLM Top 10 mapping

| OWASP LLM | Our exposure | Defense |
|---|---|---|
| LLM01 Prompt Injection | Direct (user paste) + Indirect (OCR / DKB / future RAG) | Dual-LLM split (`dualLLM.js`); spotlight delimiters (`piiScrubber.spotlight`, `aiSystemPrompts.untrustedSection`); strict extractor system prompt with `_injection_attempt` refusal output |
| LLM02 Insecure Output Handling | LLM output reaches DOM via `dangerouslySetInnerHTML` in 4 sites | `safeHtml` for developer-controlled markup; `stripUntrustedUrls` on AI-generated text; `escapeHtml` everywhere else; `nosemgrep` justifications documented per site |
| LLM03 Training Data Poisoning | DKB is curated; future RAG ingests external sources | DKB review process; RAG ingestion sanitizes HTML, version-locks every fetch, opens diff-PRs on change |
| LLM04 Model Denial of Service | Large input → long inference | 120s timeout in `generateAI`; OCR runs in Worker; PDF streaming via IDB batch storage |
| LLM05 Supply Chain | npm advisories (protobufjs critical, xmldom 5× high) | npm audit non-blocking now, blocking in S8 with Renovate auto-update |
| LLM06 Sensitive Info Disclosure | Veteran PII could leak into prompts that hit cloud | `piiScrubber` runs before any network egress; cloud is opt-in; `aiAuditLog` records digests not raw text |
| LLM07 Insecure Plugin Design | No plugin model | n/a |
| LLM08 Excessive Agency | Diamond Swarm has 3 agents | Worktree isolation TBD (S3 follow-up); tool allow-list per agent TBD |
| LLM09 Overreliance | Hallucination risk | `validateAIResponse` runs; `ANTI_HALLUCINATION_SUFFIX` on every prompt; explicit "I don't know" framing in BASE_SYSTEM_PROMPT |
| LLM10 Model Theft | Local models are public weights (Florence-2, etc.) | n/a — no proprietary model |

---

## 7. Known open issues (residual risk)

These are documented gaps that the current sprint did NOT close — listed
here so they're not lost.

1. **No signed audit log.** `aiAuditLog` detects mutation via hash chain but
   a malicious browser extension with IDB access can rewrite the chain
   end-to-end. Mitigation requires a signing key, which is out of scope
   without a server.

2. **No agent isolation between Diamond Swarm members.** Auditor / Writer /
   Rater currently share the same LLM context. Worktree-style isolation
   is a Sprint 8 follow-up.

3. **Cloud mode trusts the Gemini API operator with whatever passes the PII
   scrubber.** This is the user's choice; documented in the Cloud-mode
   activation surface.

4. **CSP allows `'unsafe-inline'` and `'unsafe-eval'`** in `script-src` —
   required for Vite's runtime and the Tesseract worker, but weakens the
   defense in depth. Tightening is a Sprint 5 / 8 concern as we move
   off in-page bundled scripts.

5. **No CSRF state verification audit yet on the VA OAuth callback path
   beyond `state` param matching.** Re-audit when the API is re-enabled.

6. **`piiScrubber` is regex-based and best-effort.** ~~Adversarial inputs
   that obfuscate (e.g., zero-width chars in SSNs) may slip past.~~
   **Hardened (S16):** inputs are normalized before scanning via
   `normalizeForScan` — invisible-char strip (zero-width / soft-hyphen) +
   NFKC fold — so zero-width-spliced, full-width, and NBSP-separated PII is
   folded to ASCII before the regexes run; 5 red-team `PII_TRAPS` guard the
   regression (`dcd2d5b`, `e21d876`). It remains regex-based and best-effort
   by design — novel obfuscation outside the normalization set can still
   slip past — so the dual-LLM extractor isolation (§5) stays the backstop.

7. **DKB integrity is trust-on-first-use.** Sprint 6's RAG manifest carries
   content hashes, but the initial bundle is shipped with the build — a
   poisoned bundle could land before the user could verify.

---

## 8. Update procedure

Update this document when:

- A new external data source is added (RAG source, third-party API, etc.).
- A new untrusted-input surface appears (file format, paste target, etc.).
- A new AI capability lands (different model, new agent role, tool calls).
- A penetration test or red-team exercise surfaces a new finding.
- An OWASP LLM Top 10 revision changes the threat catalog.

The update touches: (a) the boundary table in §3, (b) the relevant STRIDE
section in §5, (c) any new entries in §7. Bump "Last review" at the top.

---

*Companion documents:*

- [SPRINT_PLAN.md](./SPRINT_PLAN.md) — sprint roadmap, with §Sprint 3
  detailing the defenses implemented here.
- [AUDIT_FINDINGS.md](./AUDIT_FINDINGS.md) — best-practices audit scoreboard;
  row 17 (threat-modeling) now satisfied by this document.
- [packages/dompurify-noop/README.md](../packages/dompurify-noop/README.md) —
  rationale for not using DOMPurify.
- [src/utils/sanitize.js](../src/utils/sanitize.js) — sanitization helpers.
- [src/utils/piiScrubber.js](../src/utils/piiScrubber.js) — PII regex
  scrubber and `spotlight()` delimiter helper.
- [src/utils/dualLLM.js](../src/utils/dualLLM.js) — dual-LLM defense factory.
- [src/utils/aiAuditLog.js](../src/utils/aiAuditLog.js) — append-only,
  hash-chained AI audit log.
