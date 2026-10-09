# Contributing to Vet-Rate.org

Thank you for considering contributing to this project! This guide explains how to contribute effectively.

## 🎯 Our Mission

Provide veterans with accurate, accessible information about disability ratings and benefits using official eCFR data from 38 CFR Parts 3 & 4.

## �- Ways to Contribute

### 1. Report Bugs

Found an issue? Open a GitHub issue with:

- Clear title
- Step-by-step reproduction
- Expected vs actual behavior
- Screenshots if relevant
- Browser/OS information

### 2. Suggest Enhancements

Have an idea? Open an issue with:

- Feature title
- Use case/benefit
- Proposed implementation (optional)
- Related issues/PRs

### 3. Write Code

- Bug fixes
- New features
- Performance improvements
- Code refactoring

### 4. Improve Documentation

- Fix typos
- Clarify instructions
- Add examples
- Update outdated content

### 5. Add Disabilities to Database

Help expand our database of disabilities. See the Database Contributions section below.

## 🚀 Getting Started

### Fork & Clone

```bash
# Fork on GitHub, then:
git clone https://github.com/YOUR_USERNAME/vet-rate-org.git
cd vet-rate-org
git remote add upstream https://github.com/ajohnsonnow/vet-rate-org.git
```

### Setup Development Environment

```bash
# Install dependencies
npm install

# Create feature branch
git checkout -b feature/your-feature-name

# Start development server (runs at http://localhost:3000)
npm run dev
```

## 📝 Code Style & Standards

### Naming Conventions

```javascript
// Variables and functions: camelCase
const searchTerm = 'PTSD';
function handleSearch(query) {}

// Components: PascalCase
function DisabilityDetails() {}
function SearchBar() {}

// Constants: UPPER_SNAKE_CASE
const MAX_SEARCH_LENGTH = 100;
const SEARCH_PATTERN = /^[a-zA-Z0-9\s\-\/]*$/;

// Files: kebab-case or PascalCase
// Components: PascalCase - DisabilityDetails.jsx
// Utilities: camelCase - searchUtils.js
```

### Code Formatting

```bash
# Format code
npm run format

# Check lint
npm run lint

# Fix lint issues
npm run lint -- --fix
```

### React Best Practices

```javascript
// Use functional components
function MyComponent() {
  const [state, setState] = useState('');
  
  // Use hooks for side effects
  useEffect(() => {
    // Do something
  }, [dependencies]);

  return (
    <div className="...">
      {/* JSX */}
    </div>
  );
}

// Destructure props
function CardComponent({ title, description, onClick }) {
  return (
    <div onClick={onClick}>
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}
```

### Comments

```javascript
// Single line comments for explanations
const SEARCH_DEBOUNCE = 300; // milliseconds

// Multi-line comments for complex logic
/*
 * This function performs fuzzy matching using Levenshtein distance
 * to find similar disability names even with typos
 */
function performFuzzyMatch(query, data) {
  // Implementation
}

// TODO: comments for future work
// TODO: Add more disabilities to database
```

## 🧪 Testing

### Manual Testing Checklist

- [ ] Search by condition name works
- [ ] Search by diagnostic code works
- [ ] Search by synonym works
- [ ] Results display correctly
- [ ] PDF generation works
- [ ] Links open correctly
- [ ] Responsive on mobile
- [ ] No console errors
- [ ] Keyboard navigation works
- [ ] No broken links

### Test Different Scenarios

```javascript
// Test exact match
Search: "PTSD" → Should find code 9411

// Test partial match
Search: "arth" → Should find arthritis

// Test code match
Search: "5240" → Should find Rheumatoid Arthritis

// Test synonym match
Search: "rheumatoid" → Should find RA

// Test with typo (fuzzy)
Search: "PSTD" → Should still find PTSD

// Test empty search
Search: "" → Should clear results
```

## 📊 Database Contributions

### Adding a New Disability

Edit `src/data/disabilityData.json`:

```json
{
  "id": 26,
  "diagnosticCode": "5099",
  "conditionName": "New Disability Condition",
  "aliases": [
    "Short Name",
    "Alternative Name"
  ],
  "searchTerms": [
    "searchable",
    "terms",
    "keywords"
  ],
  "ecfrUrl": "https://www.ecfr.gov/current/title-38/chapter-I/part-4/...",
  "ratingSchedule": "38 CFR §4.XX",
  "documentationRequirements": "Detailed documentation requirements for medical providers. Include specific tests, measurements, or observations needed.",
  "relatedSecondaryConditions": [
    "Related Condition 1",
    "Related Condition 2",
    "Related Condition 3"
  ]
}
```

### Requirements for New Entries

- [ ] Valid 4-digit diagnostic code from 38 CFR Part 4
- [ ] Accurate condition name from official sources
- [ ] At least 2 aliases or search terms
- [ ] Valid eCFR URL link
- [ ] Correct rating schedule reference
- [ ] Detailed documentation requirements
- [ ] At least 1 related secondary condition
- [ ] Entry added to end of array with sequential ID

### Where to Find Information

- **eCFR**: <https://www.ecfr.gov/current/title-38/chapter-I/part-4>
- **VA Ratings**: <https://www.va.gov/disability/>
- **Rating Schedule**: Appendix A of 38 CFR Part 4

## 🔄 Pull Request Process

### Before Submitting

```bash
# Update from upstream
git fetch upstream
git rebase upstream/main

# Run tests
npm run lint
npm run format

# Build
npm run build

# Test locally
npm run preview

# Check for console errors
```

### Commit Messages

```bash
# Follow conventional commits
git commit -m "feat: add new search filter"
git commit -m "fix: resolve PDF generation error"
git commit -m "docs: update README with new feature"
git commit -m "test: add unit tests for search"
git commit -m "refactor: improve component structure"

# Format: TYPE: DESCRIPTION
# Types: feat, fix, docs, style, refactor, test, chore
```

### Create Pull Request

1. Push to your fork: `git push origin feature/your-feature`
2. Open GitHub PR with:
   - Clear title
   - Description of changes
   - Related issue numbers (#123)
   - Screenshots if UI changes
   - Testing steps

### PR Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Documentation
- [ ] Database update

## Testing
Steps to test:
1. ...
2. ...

## Checklist
- [ ] Code follows style guide
- [ ] Comments added
- [ ] Documentation updated
- [ ] No new warnings
- [ ] Tests pass
- [ ] Tested on mobile
```

## 🐛 Bug Fix Process

1. **Create issue** if one doesn't exist
2. **Create branch**: `git checkout -b fix/issue-description`
3. **Fix the bug**:
   - Add comments explaining the fix
   - Run linter: `npm run lint`
   - Format code: `npm run format`
4. **Test thoroughly**
5. **Create PR** with bug details and fix explanation

## ✨ Feature Development

1. **Discuss first** - Open an issue describing the feature
2. **Get feedback** - Wait for maintainer approval
3. **Create branch**: `git checkout -b feature/feature-name`
4. **Develop**:
   - Write clean, documented code
   - Add comments for complex logic
   - Follow project conventions
5. **Test**:
   - Unit test if applicable
   - Manual testing on all browsers
   - Test on mobile
6. **Create PR** with feature description

## 📚 Documentation Guidelines

### Update README.md for

- New features
- API changes
- Configuration updates
- Breaking changes

### Update DEPLOYMENT.md for

- New deployment platforms
- Configuration changes
- Environment variables

### Update SECURITY.md for

- Security improvements
- New vulnerabilities fixed
- Security best practices

### Code Comments

```javascript
/**
 * Searches for disabilities matching user query
 * @param {string} query - The search query
 * @param {Array} data - Array of disability objects
 * @returns {Array} Matching disabilities sorted by relevance
 */
function searchDisabilityData(query, data) {
  // Implementation
}
```

## 🚨 Security Issues

**Do NOT open public issues for security vulnerabilities.**

Email security concerns to: <security@example.com>

Include:

- Vulnerability description
- Steps to reproduce
- Potential impact
- Suggested fix (optional)

Response time: 24-48 hours

## ⭐ Code Review Process

Maintainers will review your PR for:

- ✅ Code quality
- ✅ Style consistency
- ✅ Security
- ✅ Documentation
- ✅ Tests
- ✅ Performance

### Tips for Faster Review

- Small, focused PRs
- Clear commit messages
- Updated documentation
- All tests passing
- No console warnings

## 🎓 Learning Resources

- [React Documentation](https://react.dev/)
- [Vite Guide](https://vitejs.dev/)
- [Tailwind CSS](https://tailwindcss.com/)
- [JavaScript MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/)
- [38 CFR Part 4](https://www.ecfr.gov/current/title-38/chapter-I/part-4)

## 💬 Questions or Need Help?

- Ask in [GitHub Discussions](https://github.com/yourusername/vet-disability-search/discussions)
- Email: <support@example.com>
- Check existing issues for answers

## 🎉 Recognition

Contributors will be:

- Listed in README
- Thanked in release notes
- Credited in commit history

### 💜 Special Thanks to Our Community Testers

This project wouldn't be what it is without invaluable feedback from our veteran community testers:

**Reddit r/VAClaims**  
<https://www.reddit.com/r/VAClaims/>  
The veterans and advocates here have provided crucial real-world testing, bug reports, and feature suggestions that shaped many of our tools.

**Facebook: Veteran Claims Assistance Group**  
<https://www.facebook.com/groups/709883279032790/>  
Huge thanks for the detailed feedback on usability, mobile experience, and edge cases we never would have caught ourselves.

Your dedication to helping fellow veterans navigate the claims process inspires everything we build. 🇺🇸

## ❤️ Code of Conduct

This project is dedicated to providing a welcoming and inclusive environment:

- Be respectful of all contributors
- Welcome diverse perspectives
- Focus on the code, not the person
- Provide constructive feedback
- Report violations to: <conduct@example.com>

## 📋 Contributor Checklist

Before submitting PR:

- [ ] Followed coding standards
- [ ] Tested thoroughly
- [ ] Updated documentation
- [ ] Added comments for complex code
- [ ] Ran linter and formatter
- [ ] No console errors/warnings
- [ ] Tested on mobile
- [ ] Tested on multiple browsers
- [ ] Commit messages are clear
- [ ] PR description is detailed

---

## ⚖️ Legal & Licensing

By submitting a Pull Request (PR) to Vet-Rate.org, you certify the following:

1. **Originality**: The code you are submitting is your original work, or you have the necessary rights to contribute it (e.g., it is not proprietary code from your employer).
2. **Licensing**: You agree to license your contribution under the project's **GNU Affero General Public License v3.0 (AGPLv3)**.
3. **No Strings Attached**: You understand that your contribution is a donation to the open-source community and that Vet-Rate.org is distributed freely without warranty.

**Note**: All contributions must align with the mission of providing free, secure, and private tools for veterans. We reserve the right to reject PRs that compromise user privacy or introduce monetization features.

---

**Thank you for contributing! Your effort helps veterans! 🇺🇸**
