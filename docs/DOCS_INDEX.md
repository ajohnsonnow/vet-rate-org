# Engineering docs index — Diátaxis layout

Closes [AUDIT_FINDINGS](AUDIT_FINDINGS.md) **#37** (technical-writing).
The original audit row asked for a Diátaxis structure across the 100+
docs in `docs/`. A literal directory move would break every
`[path/to.md]` cross-link we built up over Sprints 2–8 and the S8.5
batches. Instead, this file is the **categorical index**: each
engineering doc is placed in one of the four Diátaxis quadrants, with
a one-line hook describing what the reader will get out of it.

The user-facing manual remains at [index.md](./index.md) — it is
written for veterans, not contributors, and has its own internal
structure under `docs/<feature>/*.md`. The chapters of that manual are
intentionally **not** re-categorized here; they sit outside the
engineering doc set.

> **What Diátaxis is, in one sentence:** docs split into four kinds —
> _Tutorials_ (learning by doing), _How-to_ (achieving a specific
> goal), _Reference_ (looking up facts), _Explanation_ (understanding
> why). Each kind has different rules; mixing them in one doc usually
> makes both halves worse. See <https://diataxis.fr/>.

---

## 1. Tutorials — learning by doing

Read these end-to-end the first time. They walk a new contributor
through a complete loop and leave them with running software.

| Doc                                                | What you'll be able to do after reading                     |
| -------------------------------------------------- | ----------------------------------------------------------- |
| [BUILD.md](./BUILD.md)                             | Run the app locally, build for production, deploy a release |
| [MULTI_BRAND_BUILD.md](./MULTI_BRAND_BUILD.md)     | Build the same codebase against a different brand profile   |
| [VA_AUTH_QUICK_START.md](./VA_AUTH_QUICK_START.md) | Get the VA OAuth flow working in a dev environment          |

## 2. How-to guides — getting a specific job done

Each of these answers a single "I want to X" question. They assume you
already have the app running.

| Doc                                                                | Job it gets done                                                  |
| ------------------------------------------------------------------ | ----------------------------------------------------------------- |
| [LEGAL_PAGES_SYNC.md](./LEGAL_PAGES_SYNC.md)                       | Re-sync the legal pages against eCFR                              |
| [COMPILE_CUSTOM_VISION_MODEL.md](./COMPILE_CUSTOM_VISION_MODEL.md) | Compile a custom vision model for OCR                             |
| [CUSTOM_VISION_MODEL_BUILD.md](./CUSTOM_VISION_MODEL_BUILD.md)     | Build + ship a custom vision model                                |
| [REDDIT_API_SETUP.md](./REDDIT_API_SETUP.md)                       | Wire the Reddit API for the bug-aware feedback channel            |
| [STATE_BENEFITS_SCHEMA.md](./STATE_BENEFITS_SCHEMA.md)             | Add or refresh a state-benefit feed (current pipeline, S36)       |
| [WEBGPU_EXPERIMENTAL_SETUP.md](./WEBGPU_EXPERIMENTAL_SETUP.md)     | Enable WebGPU for local-LLM acceleration                          |
| [PREFLIGHT_EXTRAS.md](./PREFLIGHT_EXTRAS.md)                       | Run the opt-in preflight (markdownlint / knip / license-checker)  |
| [POST_MORTEM_TEMPLATE.md](./POST_MORTEM_TEMPLATE.md)               | Write a post-mortem after an incident (template, fill-the-blanks) |

## 3. Reference — facts you look up

Information-oriented. Tables, scoreboards, baselines, configuration
matrices. Read by skimming, not by following start-to-end.

| Doc                                                                                    | What's in it                                                                                                                                                          |
| -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [AUDIT_FINDINGS.md](./AUDIT_FINDINGS.md)                                               | The 41-row best-practices scoreboard, evidence, severity, target sprint                                                                                               |
| [RED_TEAM_AUDIT_2026-06.md](./RED_TEAM_AUDIT_2026-06.md)                               | 58-agent red-team audit findings (2026-06-20)                                                                                                                         |
| [RED-TEAM-AUDIT-2026-06-21.md](./RED-TEAM-AUDIT-2026-06-21.md)                         | Ultra re-verify pass over the 2026-06-20 audit                                                                                                                        |
| [RED-TEAM-SPRINT-QUEUE.md](./RED-TEAM-SPRINT-QUEUE.md)                                 | Live machine-doable remediation queue from the red-team audits                                                                                                        |
| [RED-TEAM-HUMAN-TODOS.md](./RED-TEAM-HUMAN-TODOS.md)                                   | Live human-blocked remediation tracker from the red-team audits                                                                                                       |
| [SPRINT_PLAN.md](./SPRINT_PLAN.md)                                                     | Sprint-by-sprint plan + close dates                                                                                                                                   |
| [SPRINT_PLAN_S9-S17.md](./SPRINT_PLAN_S9-S17.md)                                       | Mobile + quality-audit remediation cycle (S9–S17, closed)                                                                                                             |
| [SPRINT_PLAN_S18-S26_KB_INGESTION.md](./SPRINT_PLAN_S18-S26_KB_INGESTION.md)           | Ingestion/chunking/KB cycle: 9 sprints with executing-model assignments                                                                                               |
| [SPRINT_PLAN_S27-S40_DKB_FULL_COVERAGE.md](./SPRINT_PLAN_S27-S40_DKB_FULL_COVERAGE.md) | DKB full-coverage cycle: 14 sprints, sharding + unified access layer (closed; see [DIAMOND_KNOWLEDGE_BASE.md](./DIAMOND_KNOWLEDGE_BASE.md) for current shipped state) |
| [STATE_BENEFITS_SCHEMA.md](./STATE_BENEFITS_SCHEMA.md)                                 | Canonical per-state benefit schema + ingestion pattern (S36)                                                                                                          |
| [MULTINATIONAL_SCHEMA.md](./MULTINATIONAL_SCHEMA.md)                                   | Canonical multinational/OCONUS-service schema + ingestion pattern (S38)                                                                                               |
| [DESIGN_TOKENS_REFERENCE.md](./DESIGN_TOKENS_REFERENCE.md)                             | Generated token table — colors / sizing / aliases                                                                                                                     |
| [RAG_EVAL.md](./RAG_EVAL.md)                                                           | Recall@k / MRR / NDCG@k baseline + known misses                                                                                                                       |
| [CRYPTO_AUDIT.md](./CRYPTO_AUDIT.md)                                                   | Web Crypto call-site inventory (PBKDF2 / AES-GCM / SHA-256)                                                                                                           |
| [RISK_REGISTER.md](./RISK_REGISTER.md)                                                 | Open + closed accepted-risk entries                                                                                                                                   |
| [TOKEN_LIMIT_CONFIGURATION.md](./TOKEN_LIMIT_CONFIGURATION.md)                         | Per-task token presets + user-override matrix                                                                                                                         |
| [VETRATE_LLM_MODELS.md](./VETRATE_LLM_MODELS.md)                                       | Which local + cloud models are supported, with quirks                                                                                                                 |
| [CHANGELOG_SYSTEM.md](./CHANGELOG_SYSTEM.md)                                           | How the changelog feed is generated + consumed                                                                                                                        |
| [DYNAMIC_STATS_INDEX.md](./DYNAMIC_STATS_INDEX.md)                                     | All dynamic stats with their data sources                                                                                                                             |
| [LEGAL_PAGES_README.md](./LEGAL_PAGES_README.md)                                       | Which CFR Parts + Subparts are mirrored locally                                                                                                                       |

## 4. Explanation — why things are this way

Understanding-oriented. Architecture decisions, threat models, trade-off
narratives. Read once when you join a new area, re-read when you're
about to challenge a constraint.

### Security + privacy posture

| Doc                                                  | What it explains                                                         |
| ---------------------------------------------------- | ------------------------------------------------------------------------ |
| [THREAT_MODEL.md](./THREAT_MODEL.md)                 | Trust boundaries, STRIDE, OWASP LLM Top 10 map                           |
| [SUPPLY_CHAIN.md](./SUPPLY_CHAIN.md)                 | Cosign keyless + SLSA-3 + verification recipes                           |
| [OBSERVABILITY.md](./OBSERVABILITY.md)               | Why no OTel/Sentry — local-only logger instead                           |
| [CONTEXT_VAULT.md](./CONTEXT_VAULT.md)               | The four durable memory layers + one ephemeral                           |
| [COMPLIANCE_STRATEGY.md](./COMPLIANCE_STRATEGY.md)   | NIST SSDF / OWASP ASVS scoping + re-eval triggers                        |
| [API_SECURITY.md](./API_SECURITY.md)                 | Per-user rate limiting, CORS, token handling                             |
| [EGRESS_INVENTORY.md](./EGRESS_INVENTORY.md)         | Every network destination the app can reach, mapped to the CSP allowlist |
| [AI_SAFETY_GUARDRAILS.md](./AI_SAFETY_GUARDRAILS.md) | Output safety rails for the LLM pipeline                                 |
| [SAFETY_ARCHITECTURE.md](./SAFETY_ARCHITECTURE.md)   | End-to-end safety architecture across surfaces                           |

### AI + RAG architecture

| Doc                                                                | What it explains                                  |
| ------------------------------------------------------------------ | ------------------------------------------------- |
| [RAG_DESIGN.md](./RAG_DESIGN.md)                                   | Retrieval design — chunking, embedding, Q8 cosine |
| [DIAMOND_KNOWLEDGE_BASE.md](./DIAMOND_KNOWLEDGE_BASE.md)           | Curated KB structure, sourcing, refresh cadence   |
| [DIAMOND_SWARM_BACKENDS.md](./DIAMOND_SWARM_BACKENDS.md)           | Auditor / Writer / Rater backend selection        |
| [KNOWLEDGE_BASE_ARCHITECTURE.md](./KNOWLEDGE_BASE_ARCHITECTURE.md) | KB layering + content-hash determinism            |
| [AI_ASSISTANT_NAVIGATOR.md](./AI_ASSISTANT_NAVIGATOR.md)           | The in-app AI navigator state machine             |
| [TOKEN_OPTIMIZATION.md](./TOKEN_OPTIMIZATION.md)                   | What we do + don't optimize, with rationale       |
| [COMPASSIONATE_VOICE_SYSTEM.md](./COMPASSIONATE_VOICE_SYSTEM.md)   | The tone-control layer for AI responses           |
| [STRESS_RELIEF_DIVISION.md](./STRESS_RELIEF_DIVISION.md)           | The crisis-aware UX surface                       |

### Vision / OCR pipeline

| Doc                                                | What it explains                              |
| -------------------------------------------------- | --------------------------------------------- |
| [ADVANCED_OCR_SYSTEM.md](./ADVANCED_OCR_SYSTEM.md) | The OCR layer end-to-end                      |
| [VISION_SIMULATOR.md](./VISION_SIMULATOR.md)       | The harness for testing vision models offline |
| [FLORENCE_VISION_OCR.md](./FLORENCE_VISION_OCR.md) | Florence-specific OCR notes                   |

### Design system + UX

| Doc                                                  | What it explains                                          |
| ---------------------------------------------------- | --------------------------------------------------------- |
| [DESIGN_TOKENS.md](./DESIGN_TOKENS.md)               | The token pipeline rationale (Style Dictionary)           |
| [AFFILIATION_PALETTES.md](./AFFILIATION_PALETTES.md) | Affiliation color palettes + accessible-accent derivation |

### Ops + admin + lifecycle

| Doc                                                                          | What it explains                                        |
| ---------------------------------------------------------------------------- | ------------------------------------------------------- |
| [ADMIN_SYSTEM.md](./ADMIN_SYSTEM.md)                                         | The admin layer — auth, scopes, audit                   |
| [VERSION_MANAGEMENT.md](./VERSION_MANAGEMENT.md)                             | Semver, tag flow, release.yml interaction               |
| [LIVE_OPS_README.md](./LIVE_OPS_README.md)                                   | Live-ops surface overview                               |
| [LIVE_OPS_ARCHITECTURE.md](./LIVE_OPS_ARCHITECTURE.md)                       | Live-ops internal architecture                          |
| [DYNAMIC_STATS_GUIDE.md](./DYNAMIC_STATS_GUIDE.md)                           | Where stats come from + how they refresh                |
| [BLUE_BUTTON_LARGE_DOCUMENTS.md](./BLUE_BUTTON_LARGE_DOCUMENTS.md)           | Large-doc handling in Blue Button                       |
| [PLATINUM_STANDARD_IMPLEMENTATION.md](./PLATINUM_STANDARD_IMPLEMENTATION.md) | "Platinum-standard" tier — what makes a feature qualify |
| [PLATINUM_STANDARD_TESTING.md](./PLATINUM_STANDARD_TESTING.md)               | How platinum-standard features are tested               |
| [VA_AUTH_INTEGRATION.md](./VA_AUTH_INTEGRATION.md)                           | VA OAuth integration shape                              |
| [VA_INTEGRATION_DEMO.md](./VA_INTEGRATION_DEMO.md)                           | Walk-through of the VA-integration demo flow            |

---

## When to add a new doc

- **Tutorial** — only if a new contributor would otherwise be stuck;
  ideally one tutorial per onboarding path, not per feature.
- **How-to** — when a task is repeated across the team and has a
  known correct sequence. Add to §2 above with a one-line job hook.
- **Reference** — when a table / matrix / scoreboard would be looked
  up under time pressure (incident, audit, release cut).
- **Explanation** — when a non-trivial constraint or trade-off isn't
  self-evident from the code. The rule of thumb: if a contributor
  would otherwise rewrite the constraint thinking it's a bug, you owe
  them an Explanation doc.

## When to NOT add a doc

- Tracking a one-off task → use the Sprint Plan or the audit
  scoreboard.
- Recording a decision → that's an ADR. ADRs live with the change
  that motivated them in PR descriptions or release notes; don't add
  them here unless they're load-bearing for future work.
- Logging "what I did today" → that belongs in commit messages and
  the changelog, not the docs tree.
