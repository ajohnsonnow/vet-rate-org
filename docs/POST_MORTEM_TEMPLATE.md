# Post-mortem template

> Blameless. Honest. Specific. Closes finding #40 in [AUDIT_FINDINGS.md](./AUDIT_FINDINGS.md).
>
> Copy this file to `docs/post-mortems/YYYY-MM-DD-short-title.md`, fill it in, link from [RISK_REGISTER.md](./RISK_REGISTER.md) if the incident closes or modifies an open risk row.

---

## Header

| Field | Value |
|---|---|
| **Incident date(s)** | YYYY-MM-DD (or range) |
| **Severity** | SEV-1 (user data exposed / production unusable) · SEV-2 (feature broken / partial outage) · SEV-3 (degraded UX / cosmetic regression) |
| **Detected by** | user report · monitoring · CI · manual QA · routine audit · external researcher |
| **Detected at** | YYYY-MM-DD HH:MM TZ |
| **Mitigated at** | YYYY-MM-DD HH:MM TZ |
| **Resolved at** | YYYY-MM-DD HH:MM TZ |
| **Time-to-detect** | hh:mm |
| **Time-to-mitigate** | hh:mm |
| **Time-to-resolve** | hh:mm |
| **Author** | Name |
| **Reviewed by** | Name(s) |

---

## Summary

One paragraph. What happened, who was affected, how it was resolved. Written so a reader who's never seen this project can understand the shape of the incident in 60 seconds. No jargon, no acronyms without expansion.

---

## Impact

Specific. Not "some users affected" — say *how many*, *which surface*, *what they experienced*.

- Users affected: N (estimate range + how the number was sourced)
- Surfaces affected: route / component / utility / cron / etc.
- Data affected: none / metadata only / pseudo-anonymous / PII / PHI — be exact
- Data loss: yes/no, and if yes, recovery status
- Workaround during incident: what users could do, if anything

If this involved an AI/LLM surface, also state:

- Was the lethal trifecta breached (private data + untrusted content + external comms)? yes/no
- Did the dual-LLM controller act on injected instructions? yes/no
- Was the URL allow-list bypassed? yes/no

---

## Timeline

Use absolute UTC timestamps. One line per event. Include detection signals, even silent ones in retrospect.

```
2026-MM-DD HH:MM  Event description (link to commit / PR / log / dashboard)
2026-MM-DD HH:MM  ...
```

Don't sanitize. If we missed an alert, write that. If we went to lunch, write that. The timeline is for learning, not optics.

---

## Root cause

**Not** "the bug was X". Root cause is *why X was possible*.

Walk the five-whys until you reach a structural answer:

1. The bug was that **X** happened.
2. **X** was possible because **Y**.
3. **Y** was possible because **Z**.
4. ...
5. The structural answer is **W** (a missing test, a missing guardrail, a documented-but-not-enforced policy, an implicit assumption).

Cite files and line numbers. Treat memory and intuition with suspicion — read the code.

---

## What worked

Often skipped. Don't skip it. The things that worked are the things we want to do *more* of, and they're invisible if we only write down failures.

- Detection: how did we find out?
- Response: what limited blast radius?
- Rollback / mitigation: was it fast? smooth? why?
- Communication: did the right people know in time?

---

## What didn't work

- What slowed detection?
- What slowed mitigation?
- What surprised the responders?
- What documentation was wrong, missing, or stale?
- What tooling failed silently?

---

## Action items

Each action item is **specific, owned, and dated**. Vague items ("improve monitoring") rot. Concrete items ("Add `audit_log_chain_break` red-team test case by 2026-MM-DD, owner @user") ship.

| ID | Action | Owner | Due | Status |
|---|---|---|---|---|
| AI-1 | Concrete action | name | YYYY-MM-DD | open / done / dropped |
| AI-2 | ... | | | |

**Categorize:**

- **Prevent**: stop this class of incident from recurring (test, guardrail, type system, policy).
- **Detect**: catch it sooner next time (CI gate, dashboard, alert).
- **Mitigate**: shorten the blast radius if it recurs (feature flag, kill switch, rollback path).
- **Document**: update [THREAT_MODEL.md](./THREAT_MODEL.md), [RISK_REGISTER.md](./RISK_REGISTER.md), [COMPLIANCE_STRATEGY.md](./COMPLIANCE_STRATEGY.md), or [CRYPTO_AUDIT.md](./CRYPTO_AUDIT.md) if the incident invalidates an assumption in any of them.

Resist the temptation to file 30 action items. Pick 3–7. The first one is *prevent*, and it ships before the next sprint close.

---

## Blameless analysis

Some prompts to keep this honest:

- Was the failing decision reasonable *given the information available at the time*?
- What signals would have made the right call obvious? (Those are the action items.)
- Did the system permit a single person to cause this? (If yes, the system is the bug.)
- Did the system require heroics to mitigate? (If yes, the system is the bug.)
- Was there a known risk in [RISK_REGISTER.md](./RISK_REGISTER.md) that should have caught this? (If yes, what changed in the threat landscape?)

We are not interested in identifying a person to fault. We are interested in identifying the *next* incident this analysis prevents.

---

## Communications

If the incident was user-visible:

- Was an in-app banner shown? When? What did it say?
- Was a status page updated?
- Was an email sent?
- Was a public post-incident write-up published?

Attach the actual text used (don't paraphrase) so future incidents can crib from what worked.

If the incident involved veteran data (R-04 trigger, PHI/PII exposure), additional steps are required:

- Engage legal counsel before publishing anything externally.
- Document the disclosure decision in this file.
- File the incident with the relevant authority if any law in §[COMPLIANCE_STRATEGY.md](./COMPLIANCE_STRATEGY.md) requires it.

---

## Lessons (one-paragraph distillation)

Write the sentence you would give a new engineer in their first week so they avoid this incident. If you can't compress it to a sentence, keep editing.

---

## Cross-references

- Related incidents (link to other post-mortems in `docs/post-mortems/`)
- [RISK_REGISTER.md](./RISK_REGISTER.md) rows opened or closed by this incident
- [THREAT_MODEL.md](./THREAT_MODEL.md) sections invalidated
- [AUDIT_FINDINGS.md](./AUDIT_FINDINGS.md) rows reopened
- External advisories (GHSA / CVE / OWASP LLM Top 10 IDs)

---

*Template owner: Anthony Johnson. Last revised 2026-05-15. Filed post-mortems live under `docs/post-mortems/` (create the directory on first incident).*
