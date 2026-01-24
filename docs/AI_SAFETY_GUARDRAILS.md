# AI Safety Guardrails - Implementation Guide

## Purpose

This document explains how to use VetRate's AI safety guardrails to prevent dangerous hallucinations, role-playing, and false confidence in AI-generated content.

## The Problem

LLMs can generate persuasive, confident-sounding text that is factually wrong. For veterans navigating VA claims, this is **dangerous**:

- **Medical roleplay**: AI claims to diagnose conditions → vet trusts it → submits wrong evidence
- **Legal guarantees**: AI says "you'll definitely get 70%" → vet doesn't prepare → claim denied
- **Invented regulations**: AI cites "38 CFR § 3.999" that doesn't exist → vet files wrong form
- **Missing "I don't know"**: AI guesses instead of admitting ignorance → vet acts on bad info

## The Solution: Three-Layer Defense

### Layer 1: Pre-Generation (Prevention)

Add `ANTI_HALLUCINATION_SUFFIX` to every AI prompt:

```javascript
import { ANTI_HALLUCINATION_SUFFIX } from '../utils/aiSystemPrompts';

const prompt = `
${userQuestion}

VETERAN'S DATA:
${veteranContext}

${ANTI_HALLUCINATION_SUFFIX}
`;
```

This tells the AI what it IS and ISN'T before it generates anything.

### Layer 2: Post-Generation (Detection)

Validate every AI response before showing it to the user:

```javascript
import { validateAIResponse } from '../utils/aiSystemPrompts';

const aiResponse = await callLLM(prompt);

const validation = validateAIResponse(aiResponse, {
  loadedRegulations: ['3.303', '3.310', '4.71a'], // CFR sections you loaded
  hasStatistics: false, // Did you load actual VA statistics?
});

if (!validation.isValid) {
  // BLOCKING ERRORS - Regenerate the response
  console.error('AI response blocked:', validation.errors);
  return {
    error: 'The AI generated an unsafe response. Please rephrase your question.',
    details: validation.errors,
  };
}

if (validation.warnings.length > 0) {
  // NON-BLOCKING WARNINGS - Show response but flag issues
  console.warn('AI response warnings:', validation.warnings);
  showWarningToUser(validation.warnings);
}
```

### Layer 3: User Interface (Transparency)

Show disclaimers wherever AI content appears:

```jsx
import AIDisclaimerBanner from '../components/AIDisclaimerBanner';

function MyAITool() {
  return (
    <div>
      {/* Medical content */}
      <AIDisclaimerBanner context="medical" />
      
      {/* Legal content */}
      <AIDisclaimerBanner context="legal" />
      
      {/* Predictions/ratings */}
      <AIDisclaimerBanner context="prediction" />
      
      {/* General AI content */}
      <AIDisclaimerBanner context="general" />
      
      <div>{aiGeneratedContent}</div>
    </div>
  );
}
```

## What Gets Blocked

### HARD BLOCKS (Response Rejected)

These violations **prevent** the response from being shown:

1. **Medical/Legal Roleplay**
   - ❌ "As a doctor, I can say..."
   - ❌ "I diagnose you with PTSD"
   - ❌ "As a lawyer, you should..."
   
2. **Outcome Guarantees**
   - ❌ "Your claim will definitely be approved"
   - ❌ "You are guaranteed 70%"
   - ❌ "The VA must grant service connection"

3. **Probability Claims**
   - ❌ "You have a 75% chance of approval"
   - ❌ "Your claim has 90% likelihood of success"

4. **Rater Impersonation**
   - ❌ "As a VA rater, I would approve this"
   - ❌ "The rater will definitely grant..."

5. **Unverified Citations**
   - ❌ Citing "38 CFR § 3.999" when § 3.999 wasn't loaded

### WARNINGS (Response Shown with Flag)

These issues are **flagged** but don't block the response:

1. **Missing Citations**
   - ⚠️ Discusses "secondary conditions" but doesn't cite 38 CFR § 3.310

2. **Missing Disclaimers**
   - ⚠️ Discusses medical topics without "⚠️ Not medical advice" disclaimer

3. **Overly Certain Language**
   - ⚠️ "Will definitely", "cannot deny", "guaranteed to"

4. **Unverified Statistics**
   - ⚠️ "70% of veterans get approved" (where's that stat from?)

## Examples: Good vs. Bad Responses

### ❌ BAD: Confident Hallucination
```
User: "Will I get approved for PTSD?"

AI: "Based on your service history, you have an 85% chance of approval. 
As a medical professional, I can see you clearly have combat-related PTSD. 
The VA must approve your claim under 38 CFR § 3.304."
```

**Problems:**
- Probability claim (85%)
- Medical roleplay ("as a medical professional")
- Guarantee ("must approve")

**Result:** ❌ BLOCKED

### ✅ GOOD: Grounded, Honest Response
```
User: "Will I get approved for PTSD?"

AI: "I cannot predict whether your claim will be approved. Only VA raters 
review evidence and make decisions. However, I can explain the requirements:

According to 38 CFR § 3.304(f), PTSD service connection requires:
1. Current diagnosis from a medical professional (C&P exam or private doctor)
2. In-service stressor event (combat, fear of hostile military activity, or verified trauma)
3. Medical nexus linking the stressor to current symptoms

⚠️ **Important**: I am not a doctor and cannot diagnose PTSD or predict outcomes. 
This is educational information only. Consult a mental health professional for 
diagnosis and a VA-accredited representative for claim-specific guidance."
```

**Why it's good:**
- ✅ Says "I cannot predict"
- ✅ Cites specific regulation (38 CFR § 3.304(f))
- ✅ Includes disclaimer
- ✅ Directs to professionals

**Result:** ✅ APPROVED (with disclaimer visible)

## Code Example: Full Implementation

```javascript
import { 
  validateAIResponse, 
  ANTI_HALLUCINATION_SUFFIX,
  REQUIRED_DISCLAIMERS,
} from '../utils/aiSystemPrompts';
import AIDisclaimerBanner from '../components/AIDisclaimerBanner';

async function askAI(userQuestion, veteranData, loadedRegulations) {
  // 1. Build prompt with guardrails
  const prompt = `
VETERAN'S QUESTION:
${userQuestion}

LOADED 38 CFR REGULATIONS:
${loadedRegulations.map(reg => `- 38 CFR § ${reg.section}: ${reg.title}`).join('\n')}

VETERAN'S DATA:
${JSON.stringify(veteranData, null, 2)}

${ANTI_HALLUCINATION_SUFFIX}
`;

  // 2. Call LLM
  const aiResponse = await callLLM(prompt);
  
  // 3. Validate response
  const validation = validateAIResponse(aiResponse, {
    loadedRegulations: loadedRegulations.map(r => r.section),
    hasStatistics: false,
  });
  
  // 4. Handle blocking errors
  if (!validation.isValid) {
    console.error('AI safety violation:', validation.errors);
    return {
      error: true,
      message: 'The AI attempted to provide unsafe guidance. Please rephrase your question or consult a VA-accredited representative.',
      technicalDetails: validation.errors, // For debugging
    };
  }
  
  // 5. Add required disclaimers
  let finalResponse = aiResponse;
  if (/medical|diagnos|symptom|C&P exam/i.test(aiResponse)) {
    finalResponse += REQUIRED_DISCLAIMERS.MEDICAL_TOPICS;
  }
  if (/legal|appeal|attorney|lawsuit/i.test(aiResponse)) {
    finalResponse += REQUIRED_DISCLAIMERS.LEGAL_TOPICS;
  }
  if (/approval|rating|percentage|will (receive|get)/i.test(aiResponse)) {
    finalResponse += REQUIRED_DISCLAIMERS.RATING_PREDICTIONS;
  }
  
  // 6. Return with warnings
  return {
    response: finalResponse,
    warnings: validation.warnings,
    requiresDisclaimer: true,
  };
}

// In your React component:
function AIChat({ onAskQuestion }) {
  const [response, setResponse] = useState(null);
  
  const handleSubmit = async (question) => {
    const result = await askAI(question, veteranData, regulations);
    
    if (result.error) {
      alert(result.message);
      return;
    }
    
    setResponse(result);
  };
  
  return (
    <div>
      <QuestionInput onSubmit={handleSubmit} />
      
      {response && (
        <>
          {/* Show disclaimer based on content */}
          <AIDisclaimerBanner 
            context={
              /medical/i.test(response.response) ? 'medical' :
              /legal/i.test(response.response) ? 'legal' :
              /rating|approval/i.test(response.response) ? 'prediction' :
              'general'
            } 
          />
          
          {/* Show warnings if present */}
          {response.warnings.length > 0 && (
            <div className="bg-orange-100 border border-orange-400 p-3 mb-3 rounded">
              <strong>⚠️ Response Quality Warnings:</strong>
              <ul className="list-disc list-inside text-sm mt-1">
                {response.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )}
          
          {/* Actual response */}
          <div className="ai-response">
            {response.response}
          </div>
        </>
      )}
    </div>
  );
}
```

## When to Use Which Disclaimer

| Content Type | Disclaimer Context | Why |
|-------------|-------------------|-----|
| Discusses symptoms, diagnoses, medical records | `context="medical"` | AI cannot diagnose or interpret medical evidence |
| Discusses appeals, litigation, representation | `context="legal"` | AI cannot provide legal advice |
| Discusses claim approval, rating percentages | `context="prediction"` | AI cannot predict VA decisions |
| General claim guidance | `context="general"` | Default disclaimer |

## Checklist for Adding AI Features

Before deploying ANY AI feature, verify:

- [ ] `ANTI_HALLUCINATION_SUFFIX` is in the prompt
- [ ] Response is validated with `validateAIResponse()`
- [ ] Blocking errors prevent unsafe responses from being shown
- [ ] `AIDisclaimerBanner` is visible in the UI
- [ ] User can see what regulations were loaded into the AI's context
- [ ] "I don't know" responses are allowed (not penalized)
- [ ] No probability-of-approval claims are generated
- [ ] Citations are linked to official eCFR sources

## What This Prevents

1. **Veterans trusting AI medical diagnoses** → Now blocked with medical roleplay detection
2. **Veterans expecting guaranteed outcomes** → Now blocked with outcome guarantee detection
3. **Veterans citing fake regulations** → Now blocked with citation verification
4. **Veterans missing deadlines from bad advice** → Now flagged with missing citation warnings
5. **Veterans paying for nexus letters from AI** → Now blocked with nexus impersonation detection

## The Accountability Question

> "If your tool gives a confident answer that's wrong, who eats the damage?"

**Answer**: The veteran. That's why every response is:

1. **Pre-filtered** (prompt engineering to prevent bad outputs)
2. **Post-validated** (programmatic checks that block unsafe content)
3. **Clearly labeled** (visual disclaimers that this is NOT professional advice)

If the AI still gets through all three layers and gives bad advice, the veteran has been warned multiple times that this is educational information only and must verify it independently.

## Testing Your Implementation

```javascript
// Test cases that should be BLOCKED
const badResponses = [
  "As a doctor, I diagnose you with PTSD.",
  "You have an 85% chance of approval.",
  "Your claim will definitely be approved.",
  "According to 38 CFR § 9999.99...", // Fake regulation
];

badResponses.forEach(response => {
  const result = validateAIResponse(response, { loadedRegulations: ['3.303'] });
  console.assert(!result.isValid, `Should block: "${response}"`);
});

// Test cases that should PASS with warnings
const warningResponses = [
  "Secondary conditions can increase your rating.", // Missing citation
  "PTSD symptoms include nightmares and anxiety.", // Medical topic, no disclaimer
];

warningResponses.forEach(response => {
  const result = validateAIResponse(response, { loadedRegulations: ['3.303'] });
  console.assert(result.isValid, `Should pass: "${response}"`);
  console.assert(result.warnings.length > 0, `Should warn: "${response}"`);
});
```

## Questions?

See [aiSystemPrompts.js](../utils/aiSystemPrompts.js) for the full implementation.
