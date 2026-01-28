# Response to AI Safety Concerns

**Original Concern**: "VA claims aren't a 'feel-good' problem. If an LLM tells someone the wrong thing, that vet can lose months or years. Most of these tools generate persuasive text that sounds right but isn't anchored to CFR/M21-1, actual VBA processes, and real evidence standards."

**Valid. Here's what changed:**

## New Safeguards Implemented

### 1. Hard Response Blocking
AI responses are now REJECTED (not just flagged) if they contain:
- Medical/legal roleplay ("As a doctor..." or "As a lawyer...")
- Outcome guarantees ("Your claim will definitely be approved")
- Probability claims ("You have a 75% chance of approval")
- VA rater impersonation ("The VA must approve this")
- Citations to regulations that weren't loaded into the AI's context

### 2. Mandatory Citation Enforcement
When the AI discusses service connection, presumptive conditions, secondary conditions, effective dates, or appeals timelines, it must cite the specific 38 CFR section. Responses without citations get flagged as warnings.

### 3. Required "I Don't Know" Responses
The system prompt explicitly requires the AI to say "I don't have that information" or "That regulation is not in my loaded knowledge base" when it lacks data, rather than generating plausible-sounding guesses.

### 4. Mandatory Disclaimers
Every AI response area shows context-aware disclaimers:
- Medical topics: "I am not a doctor and cannot diagnose conditions"
- Legal topics: "I am not a lawyer and cannot provide legal advice"
- Rating predictions: "I cannot predict claim outcomes. Only VA raters make decisions"
- All responses: "Verify AI-generated information against official VA sources"

### 5. Three-Layer Validation
- Layer 1 (Pre-generation): System prompt defines strict boundaries on what AI IS NOT
- Layer 2 (Post-generation): Programmatic checks block unsafe responses before display
- Layer 3 (UI): Visible warnings that this is educational information, not professional advice

## What This Prevents

BEFORE: AI could say "As a doctor, you clearly have PTSD. You have an 85% chance of approval under 38 CFR 3.304."

AFTER: Response BLOCKED. User sees: "The AI attempted to provide unsafe guidance. Please rephrase your question."

BEFORE: AI could cite fake regulations or paraphrase them incorrectly without consequence.

AFTER: Unverified citations are blocked. Regulatory claims without citations are flagged.

BEFORE: AI could confidently guess when it didn't know something.

AFTER: Prompt explicitly requires honest "I don't know" responses.

## Is This Perfect?

No. LLMs are fundamentally probabilistic text generators. They can still paraphrase regulations incorrectly, sound confident about edge cases, or miss nuances that a human VSO would catch.

But the tool is no longer a "confidence machine with a veteran-facing skin." It has explicit boundaries, enforced guardrails, and visible warnings that it is NOT a substitute for medical opinions, legal advice, C&P exams, nexus letters, or VA raters.

## Accountability

If the AI gets through all three validation layers and still gives bad advice, the veteran has been warned multiple times that:
- This is educational information only
- AI is not a medical/legal professional
- All information must be verified against official VA sources (38 CFR)
- No tool can predict claim outcomes

The goal shifted from "make AI seem authoritative" to "make AI transparently educational with clear limits."

---

## January 2026 Update: Additional Fixes Based on r/VAClaims Feedback

Following a critical technical audit by the community, we implemented additional engineering controls:

### 6. Form Validator (Anti-Hallucination)
**Problem:** AI could invent fake form numbers (like using "27-0820" incorrectly).
**Fix:** Hard-coded allowlist of 90+ official VA forms. If the AI cites a form NOT in `src/data/validVAForms.json`, the response is **programmatically blocked**.

### 7. "No Document, No Strategy" Gatekeeper  
**Problem:** AI was providing "individualized" strategy without reading the actual denial letter.
**Fix:** The AI now detects whether the user has provided actual "Reasons for Decision" text. If they ask for strategy without the document, the AI **refuses and asks for the denial text**.

### New Files Created
- `src/data/validVAForms.json` - Official VA forms allowlist
- `src/utils/formValidator.js` - Form validation logic
- `SECURITY_UPDATE.md` - Full transparency report

### Updated Files
- `src/utils/aiSystemPrompts.js` - Added Strategy Gatekeeper + detection logic
- `src/utils/hallucinationTrap.js` - Now includes form validation

---

Implementation details: `docs/AI_SAFETY_GUARDRAILS.md`, `SECURITY_UPDATE.md`
Code: `src/utils/aiSystemPrompts.js` (FORBIDDEN_PHRASES, validateAIResponse, STRATEGY_GATEKEEPER_PROMPT)
Form Validation: `src/utils/formValidator.js`, `src/data/validVAForms.json`
UI: `src/components/AIDisclaimerBanner.jsx`

