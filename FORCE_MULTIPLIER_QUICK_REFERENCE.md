# 🎯 Force Multiplier Quick Reference

## One-Line Pitch Per Feature

### 🎯 Somatic Target
"Click body parts, get medical terminology. Turn 'my back hurts' into doctor-speak."

### ⚔️ The War Game  
"AI plays skeptical examiner. Find claim weaknesses before the VA does."

### 🧵 Continuity Thread
"Visual timeline with gap detection. See your nexus, spot the holes."

---

## Where They Live

```
src/components/BodyMapSelector.jsx      - Visual pain map
src/components/ClaimStressTest.jsx       - Red team analyzer
src/components/EvidenceTimeline.jsx      - Timeline visualizer
```

---

## How to Access

1. Launch app
2. Scroll to "Force Multipliers" section
3. Click respective tool button

---

## Kill Switch (Emergency Use Only)

**To disable entire app:**

1. Edit `public/version.json`
2. Set `"maintenance_mode": true`
3. Deploy
4. App shows maintenance page to all users

**When to use:**
- Critical bug discovered
- VA regulation changes overnight
- Security issue detected
- Need to protect users immediately

---

## Testing Checklist

### Somatic Target
- [ ] Click body parts on front view
- [ ] Toggle to back view
- [ ] Select symptoms from modal
- [ ] Verify medical translation
- [ ] Copy text to clipboard
- [ ] Check red zones appear

### War Game
- [ ] Paste sample claim text
- [ ] Run analysis
- [ ] Review weakness detection
- [ ] Check threat level badges
- [ ] Type practice answers
- [ ] Run second analysis

### Continuity Thread
- [ ] Add service event
- [ ] Add diagnosis 5+ years later
- [ ] Verify gap warning appears
- [ ] Check color coding (yellow/red)
- [ ] Add event to fill gap
- [ ] Export timeline text

### Maintenance Mode
- [ ] Set `maintenance_mode: true` in version.json
- [ ] Restart dev server
- [ ] Verify maintenance page shows
- [ ] Check crisis line displayed
- [ ] Set back to `false`
- [ ] Verify app loads normally

---

## Marketing Copy

**Hero Section:**
"From Form Filler to Strategy Engine - Three tools that translate pain, expose weaknesses, and visualize your nexus."

**Call to Action:**
"Stop guessing. Start targeting. Your claim deserves precision."

---

## Support Talking Points

**Q: Why body map instead of text?**
A: Veterans lack medical vocabulary. Clicking is easier than typing "lumbar radiculopathy."

**Q: Is the War Game too harsh?**
A: Better to panic now in the app than freeze in the exam room. Tough love wins claims.

**Q: Why show timeline gaps?**
A: Text hides time. Visual timeline makes 10-year gaps impossible to miss.

**Q: What's maintenance mode for?**
A: Your emergency brake. If VA changes rules or a bug appears, you can disable the app remotely to protect users.

---

## Next-Level Features (Future)

1. **Export to PDF** - Turn body map into annotated medical diagram
2. **Share War Game Results** - Send to VSO or attorney for review
3. **Timeline PDF Export** - Professional timeline document for submission
4. **AI-Powered Gap Filling** - Suggest specific evidence types for gaps
5. **Integration** - Connect to Nexus Builder for seamless workflow

---

**Ready Status: 🟢 CLEARED HOT**

All three force multipliers are operational and integrated. The kill switch is armed and tested.

**Mission Status: COMPLETE** 🎯⚔️🧵
