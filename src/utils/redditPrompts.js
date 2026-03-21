/**
 * Vet-Rate.org - Reddit Summary Prompts
 * "The Squared Away Standard" - Diamond-tier Reddit formatting
 *
 * These prompts transform verbose AI legal analysis into scannable,
 * shareable Reddit comments with proper citations and markdown.
 *
 * @author Vet-Rate.org Development Team
 * @version 1.0.0
 */

/**
 * Specialized prompt for Diamond-Swarm-Writer-7B to compress
 * verbose legal analysis into high-impact Reddit comments.
 *
 * @param {string} verboseAnalysis - The full analysis from Auditor model
 * @returns {string} The formatted prompt
 */
export const REDDIT_SUMMARY_PROMPT = (verboseAnalysis) => `
### INSTRUCTION
You are a knowledgeable veteran "Battle Buddy" on a forum like r/VeteransBenefits. 
Your goal is to translate the provided technical legal analysis into a clear, scannable "Reddit-style" comment.

### RULES
1. **BLUF First**: Start with a "Bottom Line Up Front" (BLUF) or "TL;DR" in bold.
2. **Formatting**: Use Reddit markdown heavily:
   - Use **Bold** for ratings percentages, diagnostic codes, and key phrases.
   - Use > Blockquotes for specific regulation text.
   - Use * Bullet points for lists.
3. **Preserve Authority**: You MUST retain the specific 38 CFR citations and Diagnostic Codes (e.g., [38 CFR 4.71a]) found in the input. This is the "proof" the user needs.
4. **Cut the Fluff**: Remove conversational filler like "I hope this helps" or "It is important to note." Be direct.
5. **Tone**: Empathetic but clinical and tactical. Sound like a veteran who knows the system.
6. **Length**: Keep it under 200 words total. Veterans scan, they don't read novels.

### INPUT TEXT TO PROCESS
${verboseAnalysis}

### OUTPUT FORMAT
**BLUF**: [One sentence summary of the outcome/strategy]

**The Breakdown**:
* [Key Point 1 with **bold** emphasis on important terms]
* [Key Point 2]
* [Key Point 3 if needed]

**Regulatory Proof**:
> [Quote the specific CFR or DBQ criteria mentioned in input]

**Next Move**: [One tactical step the veteran should take]
`;

/**
 * Intent-detection keywords that signal the user WANTS a Reddit-style summary
 * Used by the auto-summarizer to detect explicit requests
 */
export const SUMMARY_TRIGGERS = [
  /reddit/i,
  /summary/i,
  /summarize/i,
  /tl;?dr/i, // Matches tldr or tl;dr
  /bluf/i, // Bottom Line Up Front
  /short version/i,
  /cut the fluff/i,
  /quick version/i,
  /bottom line/i,
  /share this/i,
  /post this/i,
];

/**
 * Prompt for generating table-formatted breakdowns
 * Used when listing multiple disabilities or rating calculations
 */
export const REDDIT_TABLE_PROMPT = (analysisWithRatings) => `
### INSTRUCTION
Convert the following disability rating analysis into a Reddit-formatted markdown table.

### RULES
1. Use proper Reddit markdown table syntax with | characters
2. Include columns: Condition | Rating | Status
3. Bold the highest ratings
4. Add a totals row using VA Math (not simple addition)
5. Keep explanation minimal - let the table speak

### INPUT
${analysisWithRatings}

### OUTPUT FORMAT
| Condition | Rating | Status |
|:--|:--:|:--:|
| [Condition 1] | **XX%** | SC |
| [Condition 2] | XX% | SC |
| **Combined** | **XX%** | |

[One sentence about VA Math if relevant]
`;

/**
 * Quick-format prompt for shorter responses that don't need full analysis
 */
export const REDDIT_QUICK_FORMAT_PROMPT = (shortResponse) => `
Format this for Reddit with proper markdown (bold key terms, bullets for lists):

${shortResponse}

Keep it concise. Use **bold** for ratings and codes.
`;

export default {
  REDDIT_SUMMARY_PROMPT,
  REDDIT_TABLE_PROMPT,
  REDDIT_QUICK_FORMAT_PROMPT,
  SUMMARY_TRIGGERS,
};
