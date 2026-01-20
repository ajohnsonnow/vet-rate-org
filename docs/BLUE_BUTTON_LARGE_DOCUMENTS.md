# Blue Button X-Ray: Large Document Support

## Problem

Users with large Blue Button health records (VA medical records) were encountering errors when using smaller AI models like Phi 3.5 Mini:

```
Error: Prompt tokens exceed context window size: 
number of prompt tokens: 12404; context window size: 4096
```

This occurred because the entire document was being sent to the AI in a single prompt, which exceeded the model's maximum context window of 4,096 tokens.

## Solution

The Blue Button X-Ray component now includes intelligent document chunking that automatically handles files of any size, regardless of which AI model you're using.

### What We Built

1. **Estimates token usage** - Calculates approximate token count (1 token ≈ 4 characters)
2. **Smart section extraction** - Prioritizes extracting the "Problem List" or "Active Problems" section first, which contains the most relevant diagnosis information
3. **Automatic chunking** - If the document is too large, splits it into manageable chunks (~2,500 tokens each)
4. **Sequential processing** - Processes each chunk separately with the AI model
5. **Result deduplication** - Merges results from all chunks and removes duplicate conditions
6. **Progress tracking** - Shows users "Processing section X of Y..." during multi-chunk processing

### User-Friendly Messaging

We added clear, non-technical guidance throughout the app:

**In the Local AI Panel:**
- Info box explaining model choices in plain language
- Added "Best for" recommendations for each model
- Clarified that ALL models can handle large files (automatic chunking)

**In the Blue Button X-Ray:**
- "Large Files? No Problem!" info box
- Reassures veterans they don't need to do anything special
- Explains the system handles chunking automatically

**In the Cloud AI Settings:**
- Tip about Gemini's large context window (1M tokens)
- Explains it can process up to 2,000 pages in one pass

## Technical Details

### Token Budget
- **Context Window**: 4,096 tokens (Phi 3.5 Mini)
- **AI Prompt Overhead**: ~500 tokens
- **Output Tokens**: ~1,000 tokens
- **Available for Input**: ~2,500 tokens per chunk

### Chunking Strategy
The system attempts to split at natural boundaries:
1. Double newlines (paragraph breaks)
2. Single newlines (line breaks)
3. Character limits as fallback

### Problem List Priority
The algorithm first attempts to extract just the "Problem List" section using patterns:
- `Problem List`
- `Active Problems`
- `VA Diagnoses`
- `Health Issues`
- `Medical Conditions`

If this section fits within the token limit, only it is processed (saving time and improving accuracy).

## Benefits

✅ **Works with any AI model** - From Phi 3.5 Mini (4K) to Gemini (1M context)  
✅ **Handles any document size** - Can process documents of unlimited length  
✅ **Maintains accuracy** - Smart deduplication prevents duplicate conditions  
✅ **Better user feedback** - Clear progress indicators during processing  
✅ **Optimized for speed** - Prioritizes most relevant sections first  
✅ **User-friendly** - Simple, non-technical explanations for veterans

## Model Recommendations

| Model | Context Window | Document Support | Best For |
|-------|---------------|------------------|----------|
| Phi 3.5 Mini | 4,096 tokens | ✅ Auto-chunked | Detailed analysis of smaller files |
| Llama 3.2 3B | 8,192 tokens | ✅ Auto-chunked | Most tasks, medium files |
| Gemini 1.5 Flash | 1M tokens | ✅ Single pass | Large files, fastest processing |

## User Experience Improvements

### Before
- Error messages with technical jargon ("context window", "tokens")
- Users had to manually split files
- Confusion about which model to use
- No guidance on file size limitations

### After
- Clear, friendly messaging: "Large Files? No Problem!"
- Automatic handling - users don't need to do anything
- Simple model recommendations: "Best for: Most tasks"
- Reassurance that all models work with large files

## Testing

To test with a large document:
1. Upload a Blue Button .txt file larger than 50KB
2. Select any AI model (Local AI or Cloud)
3. Click "Process with AI"
4. Observe helpful info messages and chunking process

The system will automatically:
- Detect the large document
- Split it appropriately
- Process each section
- Combine results
- Show progress at each step
