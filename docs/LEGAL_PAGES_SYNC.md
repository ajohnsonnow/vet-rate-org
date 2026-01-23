# Legal Pages Generation Instructions

## Overview
The Terms of Service and Privacy Policy exist in two formats:
1. **React Components** (src/components/) - Used in the app
2. **Standalone HTML** (public/) - Used for VA API registration and direct access

## Keeping Pages in Sync

### When you update React components:

1. **Edit the React component** (TermsOfServicePage.jsx or PrivacyPolicy.jsx)
   - Update content, dates, sections as needed
   - Update "Last Updated" date

2. **Check for sync issues**:
   ```bash
   npm run check-legal-pages
   ```

3. **Update the HTML version**:
   - Option A: Manually edit public/terms-of-service.html or public/privacy-policy.html
   - Option B: Copy content structure from React component to HTML
   - Option C: Use AI to convert JSX to HTML (ChatGPT, Claude, etc.)

4. **Verify changes**:
   - Open HTML files in browser to test
   - Check that dates, content match React components
   - Ensure styling is consistent

5. **Commit both files**:
   ```bash
   git add src/components/TermsOfServicePage.jsx public/terms-of-service.html
   git commit -m "Update Terms of Service - [describe changes]"
   git push origin main
   ```

## File Locations

- **React Components**:
  - `src/components/TermsOfServicePage.jsx`
  - `src/components/PrivacyPolicy.jsx`

- **HTML Pages**:
  - `public/terms-of-service.html`
  - `public/privacy-policy.html`

- **URLs (after deployment)**:
  - https://vet-rate.org/terms-of-service.html
  - https://vet-rate.org/privacy-policy.html

## Content Checklist

When updating, ensure these match between React and HTML:
- [ ] Effective/Last Updated date
- [ ] All section headings
- [ ] All disclaimer text
- [ ] All bullet points and lists
- [ ] Legal citations and references
- [ ] Contact information
- [ ] Version numbers (if applicable)

## Future Enhancement

For fully automated generation, consider:
- Using a JSX to HTML parser
- Creating a shared content JSON/JS file
- Building a more sophisticated generation script
- Adding to CI/CD pipeline

Generated: 2026-01-23T17:05:52.154Z
