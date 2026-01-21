# Token Limit Configuration Feature

## Overview

The Token Limit Configuration feature allows users to adjust the maximum response length for AI-generated content, providing fine-grained control over AI behavior, resource usage, and response quality.

## Location

Access this feature from:
- **Header AI Status Badge** → Opens AI Settings Modal
- **Token Limit Configuration Section** (in AI Settings Modal)

## Features

### 🎚️ Three Preset Modes

1. **Minimum (512 tokens)**
   - ~380 words per response
   - Quick, concise answers
   - Lowest resource usage
   - Best for: Simple questions, brief summaries

2. **Balanced (2,048 tokens)** ⭐ RECOMMENDED
   - ~1,500 words per response  
   - Detailed statements and analysis
   - Moderate resource usage
   - Best for: Personal statements, DBQs, nexus letters

3. **Maximum (4,096 tokens)**
   - ~3,000 words per response
   - Comprehensive reports
   - Higher resource usage
   - Best for: Complex analysis, research reports

### ⚙️ Custom Token Entry

Advanced users can set custom token limits between 128 and the model's maximum capacity.

## Smart Warnings

The system provides intelligent warnings based on:

### For Local AI:
- **VRAM Impact**: Shows additional VRAM required for each setting
- **Model Capacity**: Warns when approaching or exceeding model limits
- **Performance**: Alerts about potential slowdowns on lower-end devices

### For Cloud AI (Gemini):
- **API Cost**: Warns about increased API usage at higher limits
- **Response Time**: Notes slower responses with larger token limits

## Model-Specific Capabilities

Each AI model has different capacities and recommendations:

### Local AI Models

| Model | Context Window | Recommended Max | Absolute Max |
|-------|---------------|-----------------|--------------|
| **Llama 3.2 1B** | 8,192 tokens | 2,048 tokens | 4,096 tokens |
| **Llama 3.2 3B** | 8,192 tokens | 2,048 tokens | 4,096 tokens |
| **Phi 3.5 Mini** | 4,096 tokens | 2,048 tokens | 4,096 tokens |
| **Mistral 7B** | 32,768 tokens | 4,096 tokens | 8,192 tokens |

### Cloud AI

| Model | Context Window | Recommended Max | Absolute Max |
|-------|---------------|-----------------|--------------|
| **Gemini 1.5 Flash** | 1,000,000 tokens | 4,096 tokens | 8,192 tokens |

## VRAM Impact Guide

### Llama 3.2 1B (Fastest)
- **512 tokens**: +0.5 GB VRAM
- **2,048 tokens**: +1 GB VRAM
- **4,096 tokens**: +2 GB VRAM
- **8,192 tokens**: +3 GB VRAM ⚠️ Not recommended

### Llama 3.2 3B (Balanced) ⭐
- **512 tokens**: +1 GB VRAM
- **2,048 tokens**: +2 GB VRAM
- **4,096 tokens**: +3 GB VRAM
- **8,192 tokens**: +5 GB VRAM ⚠️ Requires high-end GPU

### Phi 3.5 Mini (Specialized)
- **512 tokens**: +1 GB VRAM
- **2,048 tokens**: +2 GB VRAM
- **4,096 tokens**: +3 GB VRAM (Model maximum)

### Mistral 7B (Powerful)
- **512 tokens**: +2 GB VRAM
- **2,048 tokens**: +3 GB VRAM
- **4,096 tokens**: +4 GB VRAM
- **8,192 tokens**: +6 GB VRAM ⚠️ Requires high-end GPU

## Usage Examples

### For Most Veterans
Use **Balanced (2,048 tokens)** for:
- Personal statements for claims
- DBQ questionnaires  
- Nexus letters
- Blue Button medical record analysis
- Most AI-assisted writing

### When to Use Minimum (512)
- Quick factual questions
- Simple yes/no clarifications
- Brief definitions or explanations

### When to Use Maximum (4,096)
- Comprehensive research analysis
- Detailed reports spanning multiple topics
- Complex multi-condition nexus documentation
- Processing very large medical records

## Technical Details

### Storage
- Settings stored in `localStorage` under key: `vetrate_token_limit_config`
- Persists across browser sessions
- JSON format: `{ value: number, timestamp: number }`

### Default Behavior
- **Default**: 2,048 tokens (Balanced preset)
- **Fallback**: If storage fails or no config exists, defaults to 2,048

### Integration Points
Token limits are automatically applied to:
- `unifiedAIService.js` - Cloud and Local AI calls
- `LocalAIPanel.jsx` - Local AI generation
- All AI-powered features throughout the application

### Override Capability
Components can still specify custom `maxTokens` in their options, which will override the user's default setting when needed for specific use cases.

## Best Practices

### For Local AI Users
1. **Start with Balanced**: Works for 90% of tasks
2. **Monitor Performance**: If responses are slow, reduce token limit
3. **Check VRAM**: Ensure your GPU has adequate VRAM for your chosen setting
4. **Adjust per Task**: Use custom limits for specialized needs

### For Cloud AI Users  
1. **Start with Balanced**: Good quality without excessive API usage
2. **Watch Quota**: Higher limits consume more of your free tier quota
3. **Consider Speed**: Larger responses take longer to generate
4. **Cost Awareness**: If using paid tier, higher limits = higher costs

## Troubleshooting

### Local AI Generation Fails or Timeout
**Solution**: Reduce token limit to 512 or 1,024. Your GPU may not have enough VRAM.

### Response Gets Cut Off Mid-Sentence
**Solution**: Increase token limit. The response hit the maximum before completing.

### Cloud AI Responses Are Slow
**Solution**: Reduce token limit to 1,024 or 2,048 for faster responses.

### Out of Memory Errors (Local AI)
**Solution**: Lower token limit and/or switch to a smaller model (Llama 1B).

## Privacy & Security

✅ **All settings stored locally** - Token configuration never leaves your device  
✅ **No tracking** - We don't monitor what token limits you use  
✅ **Your choice** - Full control over AI resource usage  

## Future Enhancements

Potential improvements planned:
- Per-tool token presets (different defaults for different features)
- Automatic token optimization based on prompt length
- Token usage analytics and recommendations
- Dynamic scaling based on device capabilities

## Support

If you have questions or need help configuring token limits:
1. Check the **Show Details** section in the Token Limit Config
2. Review model-specific recommendations  
3. Report issues via the 🐛 Report Bug button in AI Settings

---

**Last Updated**: January 2026  
**Feature Version**: 1.0  
**Compatibility**: All AI models (Local and Cloud)
