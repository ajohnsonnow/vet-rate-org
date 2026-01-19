# Secondary Scout vs Pathfinder - Feature Differentiation

## Overview
These two tools serve complementary but distinct purposes in helping veterans discover secondary conditions.

## Secondary Scout 🔬

### Purpose
Medical logic-based secondary condition discovery using established causal relationships

### Technology
- **Rules-Based Engine**: Uses `secondaryClaimsEngine.js` with medical logic graph traversal
- **Knowledge Base**: Built on 38 CFR § 3.310 secondary service connection regulations
- **Deterministic**: Same inputs always produce same outputs

### Input Methods
1. **Manual Entry**: Type conditions
2. **Checkbox Selection**: Select from organized list by body system
3. **Example Profiles**: Pre-loaded veteran profiles (Combat Infantry, Motor Transport, etc.)
4. **Import from My Ratings**: Use saved ratings

### Analysis Features
- **Mechanism Types**:
  - Direct Causation
  - Medication-Related (NSAID use, etc.)
  - Biomechanical (Altered gait, compensatory movement)
  - Psychological Impact
  - Immune/Inflammatory Response

- **Probability Ratings**:
  - High Probability: Well-established medical connections
  - Moderate Probability: Documented but less common
  - Possible Connection: Plausible but requires more evidence

### Output
- Detailed secondary condition suggestions
- Medical mechanisms explained
- Triggers and pathways
- CFR citations
- Can generate Doctor's Packet with medical nexus research

### Best For
- **Comprehensive analysis** of all potential secondary conditions
- Understanding the **medical mechanism** linking conditions
- Veterans who want to see **all possible** secondary claims
- Building evidence packets for specific secondary claims

## Pathfinder 🧭

### Purpose
AI-powered strategic claims analysis to identify high-value secondary claims you may be missing

### Technology
- **AI-Powered**: Uses AI pattern recognition (likely Gemini API based on codebase)
- **Strategic Analysis**: Focuses on high-probability, strategic recommendations
- **Adaptive**: Can identify patterns and connections AI recognizes from training data

### Input Methods
1. **Manual Rating Entry**: Type condition names and ratings
2. **Import from My Ratings**: Use saved ratings from Tactical Calculator

### Analysis Features
- Strategic focus on **high-probability claims**
- AI identifies patterns across your rating profile
- Considers **combined rating impact**
- Provides strategic prioritization

### Output
- Curated list of high-probability secondary claims
- Strategic recommendations
- Focus on claims that will maximize rating increase
- Integration with other tools (can launch Doctor's Packet, etc.)

### Best For
- **Strategic planning** - what to file next
- Veterans with **complex rating profiles**
- Finding **high-value** secondary claims
- AI-powered **pattern recognition** across conditions
- When you need a **strategic roadmap** not just a comprehensive list

## Key Differences Summary

| Feature | Secondary Scout | Pathfinder |
|---------|----------------|------------|
| **Engine** | Rules-based medical logic | AI-powered analysis |
| **Approach** | Comprehensive & methodical | Strategic & prioritized |
| **Results** | All possible connections | High-probability recommendations |
| **Medical Detail** | Extensive mechanism explanations | Strategic insights |
| **Best For** | Complete discovery & research | Strategic planning |
| **Requires API** | No | Yes (AI functionality) |
| **Speed** | Instant | Depends on AI processing |

## Recommended Workflow

### Use Both for Maximum Benefit

1. **Start with Secondary Scout** for comprehensive discovery:
   - Input all your service-connected conditions
   - Review all possible secondary connections
   - Understand medical mechanisms
   - Save promising conditions to My Packet

2. **Then use Pathfinder** for strategic prioritization:
   - Import your ratings
   - Get AI-powered strategic recommendations
   - Identify which secondary claims to file first
   - Focus on highest-impact claims

### Use Case Examples

**Veteran with PTSD rated at 70%:**
- **Secondary Scout**: Shows all possible secondary conditions (IBS, sleep apnea, headaches, etc.) with medical mechanisms
- **Pathfinder**: Strategically recommends IBS and sleep apnea as high-priority claims based on pattern recognition across similar profiles

**Veteran with multiple joint conditions:**
- **Secondary Scout**: Comprehensive analysis of biomechanical secondary conditions (contralateral joints, back problems, etc.)
- **Pathfinder**: Strategic recommendation on which joint claims to pursue first for maximum rating impact

## No Duplication - Complementary Tools

These tools are designed to work together:
- **Secondary Scout** = "Show me everything possible"
- **Pathfinder** = "Show me what I should prioritize"

The overlap is intentional and beneficial:
- Cross-validation of findings
- Different analytical approaches provide confidence
- Users can choose their preferred method
- Both tools enhance claim discovery from different angles

## User Guidance Recommendation

Consider adding in-app guidance that explains:
1. Use Secondary Scout for **comprehensive research**
2. Use Pathfinder for **strategic planning**
3. Use both for **maximum benefit**

This differentiation should be clearer in the UI to help users understand which tool to use when.
