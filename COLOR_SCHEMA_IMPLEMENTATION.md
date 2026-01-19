# Color Schema Implementation Guide

## Overview
This guide documents the WCAG 2.1 Level AA compliant color system for Vet-Rate.org, ensuring accessibility for all veterans including those with color vision deficiencies.

## Files Created/Modified

### New Files
1. **`src/utils/colorSchemas.js`** - Centralized color configuration with:
   - BASE_COLORS (modals, sections, cards)
   - BORDER_COLORS (default, subtle, emphasis)
   - TEXT_COLORS (primary, secondary, tertiary, muted)
   - STATUS_COLORS (success, warning, error, info, neutral) with color-blind alternatives
   - HEADER_GRADIENTS (tactical, discover, evidence, quality, strategy, pact, shockAwe, resources)
   - BUTTON_COLORS (primary, secondary, danger)
   - DROPDOWN_COLORS (background, item, text, border)
   - Helper functions: `getColorClass`, `getModalClasses`, `getSectionClasses`, `getHeaderGradient`, `getDropdownClasses`

2. **`src/hooks/useColorSchemas.js`** - Custom hook for easy color access

### Modified Files
1. **`src/contexts/ThemeContext.jsx`** - Added color utility functions to context
2. **`src/components/FundingModal.jsx`** - Updated to use new color system
3. **`src/components/Header.jsx`** - Added useColorSchemas hook

## Color Modes Supported

### Theme Modes
- **Light Mode**: High contrast text on light backgrounds
- **Dark Mode**: High contrast text on dark backgrounds (default)

### Color Blind Modes
- **None**: Standard colors
- **Protanopia**: Red-blind friendly (reds → oranges/blues)
- **Deuteranopia**: Green-blind friendly (greens → blues)
- **Tritanopia**: Blue-blind friendly (blues → teals/cyans)
- **High Contrast**: Enhanced contrast for low vision

## WCAG Compliance

All color combinations meet or exceed:
- **Normal text**: 4.5:1 contrast ratio
- **Large text** (18pt+ or 14pt+ bold): 3:1 contrast ratio
- **UI components**: 3:1 contrast ratio

### Color Blind Considerations

Status colors use alternatives that maintain meaning:
```javascript
// Success (green)
- Normal: Emerald shades
- Protanopia: Blue shades (green not visible)
- Deuteranopia: Blue shades (green not visible)
- Tritanopia: Teal shades (blue not visible)

// Error (red)
- Normal: Red shades
- Protanopia: Orange shades (red not visible)
- Deuteranopia: Orange shades (red not visible)
- Tritanopia: Rose shades (maintains distinction)

// Warning (yellow/amber)
- Normal: Amber shades
- All modes: Yellow/amber (visible to all)
- Tritanopia: Pink shades (alternative)
```

## Usage Examples

### In a Component

```jsx
import { useColorSchemas } from '../hooks/useColorSchemas';

function MyComponent() {
  const { getModalClasses, getColorClass, colors } = useColorSchemas();
  const modalClasses = getModalClasses();
  
  return (
    <div className={modalClasses.backdrop}>
      <div className={modalClasses.content}>
        <h2 className={getColorClass(colors.text.primary)}>
          Title
        </h2>
        <p className={getColorClass(colors.text.secondary)}>
          Description
        </p>
        <div className={`p-4 rounded ${getColorClass(colors.status.success.bg)}`}>
          <p className={getColorClass(colors.status.success.text)}>
            Success message
          </p>
        </div>
      </div>
    </div>
  );
}
```

### Modal Pattern

```jsx
<div className={modalClasses.backdrop} onClick={onClose}>
  <div className={modalClasses.content} onClick={(e) => e.stopPropagation()}>
    {/* Modal header with gradient */}
    <div className={`sticky top-0 z-10 p-4 shadow-lg rounded-t-xl ${getHeaderGradient('tactical')}`}>
      <h2 className="text-xl font-bold text-white">Tool Name</h2>
    </div>
    
    {/* Modal body */}
    <div className="p-4">
      <div className={modalClasses.card}>
        <h3 className={getColorClass(colors.text.primary)}>Section</h3>
        <p className={getColorClass(colors.text.secondary)}>Content</p>
      </div>
    </div>
  </div>
</div>
```

### Section Pattern

```jsx
const { getSectionClasses, getColorClass, colors } = useColorSchemas();
const sectionClasses = getSectionClasses();

<div className={sectionClasses.container}>
  <h2 className={sectionClasses.title}>Section Title</h2>
  <div className={sectionClasses.card}>
    <h3 className={sectionClasses.subtitle}>Subsection</h3>
    <p className={sectionClasses.text}>Regular text</p>
    <p className={sectionClasses.mutedText}>Muted text</p>
  </div>
</div>
```

### Dropdown Menu Pattern

```jsx
const { getDropdownClasses } = useColorSchemas();
const dropdownClasses = getDropdownClasses();

<div className={dropdownClasses.menu}>
  <button className={dropdownClasses.item}>
    Menu Item 1
  </button>
  <button className={dropdownClasses.item}>
    Menu Item 2
  </button>
</div>
```

### Status/Alert Pattern

```jsx
// Success
<div className={`p-4 rounded border ${getColorClass(colors.status.success.bg)} ${getColorClass(colors.status.success.border)}`}>
  <p className={getColorClass(colors.status.success.text)}>✓ Success message</p>
</div>

// Warning
<div className={`p-4 rounded border ${getColorClass(colors.status.warning.bg)} ${getColorClass(colors.status.warning.border)}`}>
  <p className={getColorClass(colors.status.warning.text)}>⚠️ Warning message</p>
</div>

// Error
<div className={`p-4 rounded border ${getColorClass(colors.status.error.bg)} ${getColorClass(colors.status.error.border)}`}>
  <p className={getColorClass(colors.status.error.text)}>✗ Error message</p>
</div>

// Info
<div className={`p-4 rounded border ${getColorClass(colors.status.info.bg)} ${getColorClass(colors.status.info.border)}`}>
  <p className={getColorClass(colors.status.info.text)}>ℹ️ Info message</p>
</div>
```

### Button Pattern

```jsx
// Primary button
<button className={getColorClass(colors.button.primary)}>
  Primary Action
</button>

// Secondary button
<button className={getColorClass(colors.button.secondary)}>
  Secondary Action
</button>

// Danger button
<button className={getColorClass(colors.button.danger)}>
  Delete
</button>
```

## Components to Update

### High Priority (Public-facing modals)
1. ✅ **FundingModal.jsx** - COMPLETED
2. **AboutUs.jsx**
3. **ContactUs.jsx**
4. **PrivacyPolicy.jsx**
5. **DisclaimerSplash.jsx**
6. **TermsOfServiceModal.jsx**

### Tool Modals (All need updating)
1. **CAPSimulator.jsx**
2. **TacticalCalculator.jsx**
3. **SecondaryScout.jsx** / **SecondaryScoutLauncher.jsx**
4. **Pathfinder.jsx**
5. **CFileAnalyzer.jsx**
6. **BlueButtonXRay.jsx**
7. **WitnessBench.jsx**
8. **FormsHelper.jsx**
9. **SharkRadar.jsx**
10. **RedTeam.jsx**
11. **DecisionDecoder.jsx**
12. **DenialDecoder.jsx**
13. **TDIUBuilder.jsx**
14. **RiskAssessment.jsx**
15. **SymptomLogger.jsx**
16. **PACTActNavigator.jsx**
17. **FOIAGenerator.jsx**
18. **MillionDollarDashboard.jsx**
19. **MOSHazardMatcher.jsx**
20. **WebOfConditions.jsx**
21. **NexusBuilder.jsx**
22. **MyPacket.jsx**
23. **VAResources.jsx**
24. **VSOFinder.jsx**
25. **StateBenefitHunter.jsx**
26. **UserManual.jsx**
27. **LegislativeWatchdog.jsx**
28. **ExamPrepRoom.jsx**
29. **BugSquasher.jsx**

### Header/Navigation
1. 🔄 **Header.jsx** - IN PROGRESS
   - Update tools dropdown menu
   - Update resources dropdown menu
2. **AccessibilityMenu.jsx** - Should already work with context

## Dropdown Menu Update Pattern for Header.jsx

Replace current dropdown div:
```jsx
<div className="fixed sm:absolute left-2 right-2 sm:left-auto sm:right-0 mt-2 sm:w-96 bg-white dark:bg-emerald-900 rounded-lg shadow-xl border border-gray-200 dark:border-emerald-600 z-50">
```

With:
```jsx
<div className={`${dropdownClasses.menu} fixed sm:absolute left-2 right-2 sm:left-auto sm:right-0 sm:w-96 z-50`}>
```

Replace dropdown items from:
```jsx
<button className="w-full text-left block px-3 py-2 rounded-md transition-colors hover:bg-teal-100 dark:hover:bg-teal-800/40">
  <span className="font-medium text-gray-800 dark:text-gray-200">Tool Name</span>
  <p className="text-xs mt-0.5 text-gray-600 dark:text-gray-400">Description</p>
</button>
```

To:
```jsx
<button className={`w-full text-left block px-3 py-2 rounded-md transition-colors ${dropdownClasses.item.replace('px-4 py-2', '')}`}>
  <span className={`font-medium ${getColorClass(colors.text.primary)}`}>Tool Name</span>
  <p className={`text-xs mt-0.5 ${getColorClass(colors.text.tertiary)}`}>Description</p>
</button>
```

## Testing Checklist

For each updated component, verify:
- [ ] Light mode: Proper contrast, readable text
- [ ] Dark mode: Proper contrast, readable text
- [ ] Protanopia mode: Status colors distinguishable
- [ ] Deuteranopia mode: Status colors distinguishable
- [ ] Tritanopia mode: Status colors distinguishable
- [ ] High contrast mode: Maximum legibility
- [ ] Modal backdrop consistent across all modals
- [ ] Card backgrounds consistent
- [ ] Border colors consistent
- [ ] Text hierarchy clear (primary > secondary > tertiary > muted)
- [ ] Status messages use appropriate semantic colors
- [ ] Buttons have sufficient contrast
- [ ] Dropdowns match page theme

## Accessibility Features

### Visual Indicators Beyond Color
- Status messages use icons (✓, ⚠️, ✗, ℹ️)
- Important items use bold text
- Sections use borders and spacing
- Interactive elements have hover states

### Keyboard Navigation
- All interactive elements focusable
- Focus indicators visible
- Logical tab order maintained

### Screen Reader Support
- Semantic HTML maintained
- ARIA labels where appropriate
- Content structure preserved

## Future Enhancements

1. **User Preferences**: Allow veterans to select their preferred color mode
2. **Contrast Checker**: Tool to verify WCAG compliance in real-time
3. **Pattern Library**: Visual showcase of all color patterns
4. **Animation Considerations**: Respect prefers-reduced-motion
5. **Print Styles**: Optimize for black and white printing

## Resources

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [Color Contrast Checker](https://webaim.org/resources/contrastchecker/)
- [Color Blind Simulator](https://www.color-blindness.com/coblis-color-blindness-simulator/)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)

## Support

For questions or issues with the color system:
1. Check this guide first
2. Review the `colorSchemas.js` file
3. Test in browser dev tools with different color modes
4. File a bug if colors don't meet WCAG standards

---

**Remember**: This color system ensures that Vet-Rate.org is accessible to ALL veterans, regardless of their visual capabilities. Always test with multiple color modes enabled!
