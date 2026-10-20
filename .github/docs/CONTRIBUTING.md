# Contributing Guide

<p align="right">
  <a href="CONTRIBUTING.it.md">🇮🇹 Italiano</a> · <strong>🇺🇸 English</strong>
</p>

---

## Welcome Contributors! 👋

Thank you for your interest in contributing to Web Article Summarizer! This guide will help you get started with contributing to the project.

---

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Development Workflow](#development-workflow)
- [Coding Standards](#coding-standards)
- [Testing Guidelines](#testing-guidelines)
- [Commit Guidelines](#commit-guidelines)
- [Pull Request Process](#pull-request-process)
- [Areas for Contribution](#areas-for-contribution)
- [Getting Help](#getting-help)

---

## Code of Conduct

This project follows a simple code of conduct:

- Be respectful and inclusive
- Provide constructive feedback
- Focus on what is best for the community
- Show empathy towards other contributors

---

## Getting Started

### Prerequisites

- **Node.js**: Version 22 or higher
- **npm**: Comes with Node.js
- **Git**: For version control
- **Firefox**: 126 or later, for testing the extension
- **Code Editor**: VS Code recommended

### Fork and Clone

1. Fork the repository on GitHub
2. Clone your fork locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/web-article-summarizer.git
   cd web-article-summarizer
   ```
3. Add upstream remote:
   ```bash
   git remote add upstream https://github.com/AndreaBonn/web-article-summarizer.git
   ```

---

## Development Setup

### Install Dependencies

```bash
npm install
```

### Start Development Server

```bash
npm run dev
```

This starts Vite with hot module replacement (HMR).

### Load Extension in Firefox

1. Run `npm run build`
2. Open Firefox and navigate to `about:debugging#/runtime/this-firefox`
3. Click **Load Temporary Add-on**
4. Select `dist/manifest.json` from the project

Alternatively, `npm run start:firefox` launches Firefox with the extension loaded from `dist/` (via web-ext).

### Configure API Keys

1. Click the extension icon in the Firefox toolbar
2. Go to **Settings** (gear icon)
3. Enter at least one API key for testing

**Recommended for Development**:
- **Groq**: Free tier with generous limits ([Get API Key](https://console.groq.com))
- **Gemini**: Free tier available ([Get API Key](https://aistudio.google.com))

---

## Project Structure

```
web-article-summarizer/
├── .github/
│   └── docs/              # Documentation
│       ├── ARCHITECTURE.md
│       ├── API.md
│       └── CONTRIBUTING.md
├── public/
│   ├── icons/             # Extension icons
│   └── workers/           # Web workers (PDF.js)
├── src/
│   ├── background/        # Service worker
│   ├── content/           # Content script
│   ├── pages/             # UI pages
│   │   ├── popup/
│   │   ├── reading-mode/
│   │   ├── history/
│   │   ├── multi-analysis/
│   │   ├── pdf-analysis/
│   │   └── options/
│   ├── shared/            # Shared components
│   └── utils/             # Utility modules
│       ├── ai/            # AI integration
│       ├── core/          # Core utilities
│       ├── export/        # Export functionality
│       ├── i18n/          # Internationalization
│       ├── pdf/           # PDF processing
│       ├── security/      # Security utilities
│       ├── storage/       # Storage management
│       └── voice/         # Voice features
├── manifest.json          # Extension manifest
├── package.json
└── vite.config.js         # Build configuration
```

---

## Development Workflow

### 1. Create a Feature Branch

```bash
git checkout -b feature/my-new-feature
```

Branch naming conventions:
- `feature/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation updates
- `refactor/` - Code refactoring
- `test/` - Test additions/updates

### 2. Make Your Changes

- Write clean, readable code
- Follow existing code style
- Add comments for complex logic
- Update documentation if needed

### 3. Test Your Changes

```bash
# Run unit tests
npm run test

# Run linter
npm run lint

# Format code
npm run format
```

### 4. Commit Your Changes

```bash
git add .
git commit -m "feat: add new feature"
```

See [Commit Guidelines](#commit-guidelines) for commit message format.

### 5. Push and Create Pull Request

```bash
git push origin feature/my-new-feature
```

Then create a Pull Request on GitHub.

---

## Coding Standards

### JavaScript Style

- **ES6+ Syntax**: Use modern JavaScript features
- **Modules**: Use ES6 imports/exports
- **Async/Await**: Prefer over callbacks and raw promises
- **Arrow Functions**: Use for short functions and callbacks
- **Destructuring**: Use for cleaner code

**Example**:
```javascript
// Good ✅
export async function analyzeArticle(article, settings) {
  const { provider, language } = settings;
  try {
    const result = await APIOrchestrator.callAPI(provider, apiKey, article, settings);
    return result;
  } catch (error) {
    Logger.error('Analysis failed:', error);
    throw error;
  }
}

// Avoid ❌
function analyzeArticle(article, settings, callback) {
  var provider = settings.provider;
  APIOrchestrator.callAPI(provider, apiKey, article, settings)
    .then(function(result) {
      callback(null, result);
    })
    .catch(function(error) {
      callback(error);
    });
}
```

### Code Organization

- **Single Responsibility**: Each function/class should do one thing
- **DRY Principle**: Don't repeat yourself
- **Meaningful Names**: Use descriptive variable and function names
- **Small Functions**: Keep functions focused and concise

### Comments

- Use JSDoc for public APIs
- Add inline comments for complex logic
- Avoid obvious comments

**Example**:
```javascript
/**
 * Detect the content type of an article
 * @param {object} article - Article object with title and content
 * @returns {string} Content type (scientific, news, tutorial, business, opinion, general)
 */
export function detectContentType(article) {
  // Scoring-based detection: count matches per category
  const scores = { scientific: 0, news: 0, tutorial: 0 };
  
  // Scientific: high-confidence markers
  if (/\bp\s*=\s*0\.\d+/.test(article.content)) {
    scores.scientific += 3;
  }
  
  // ... more detection logic
}
```

### Security Best Practices

- **Never use `innerHTML` with untrusted content** - Use `HtmlSanitizer`
- **Always sanitize user input** - Use `InputSanitizer`
- **Validate all external data** - Check types and ranges
- **Use CSP-compliant code** - No inline scripts or eval()

**Example**:
```javascript
// Good ✅
HtmlSanitizer.renderText(aiResponse, element);

// Dangerous ❌
element.innerHTML = aiResponse;
```

### Error Handling

- Always handle errors appropriately
- Provide meaningful error messages
- Log errors for debugging
- Don't expose sensitive information in errors

**Example**:
```javascript
try {
  const result = await riskyOperation();
  return result;
} catch (error) {
  Logger.error('Operation failed:', error);
  throw new Error('Unable to complete operation. Please try again.');
}
```

---

## Testing Guidelines

### Unit Tests

We use **Vitest** for unit testing.

**Test File Location**: Place test files next to the code they test:
```
src/utils/ai/content-detector.js
src/utils/ai/content-detector.test.js
```

**Test Structure**:
```javascript
import { describe, it, expect } from 'vitest';
import { ContentDetector } from './content-detector.js';

describe('ContentDetector', () => {
  describe('detectContentType', () => {
    it('should detect scientific articles', () => {
      const article = {
        title: 'Research Study',
        content: 'methodology hypothesis p = 0.05'
      };
      
      const type = ContentDetector.detectContentType(article);
      expect(type).toBe('scientific');
    });
    
    it('should detect news articles', () => {
      const article = {
        title: 'Breaking News',
        content: 'reported today according to sources'
      };
      
      const type = ContentDetector.detectContentType(article);
      expect(type).toBe('news');
    });
  });
});
```

**Running Tests**:
```bash
npm run test          # Run once
npm run test:watch    # Watch mode
```

### Manual Testing Checklist

Before submitting a PR, test these scenarios:

- [ ] Article analysis on different content types
- [ ] PDF upload and analysis
- [ ] Multi-article comparison
- [ ] Translation feature
- [ ] Citation extraction
- [ ] Export to PDF/Markdown/Email
- [ ] Voice controls (if modified)
- [ ] History search and filtering
- [ ] Settings persistence
- [ ] Error handling and edge cases

---

## Commit Guidelines

We follow **Conventional Commits** specification.

### Commit Message Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, no logic change)
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `test`: Adding or updating tests
- `chore`: Maintenance tasks (dependencies, build, etc.)

### Examples

```bash
# Feature
git commit -m "feat(ai): add support for Gemini 2.0 Flash model"

# Bug fix
git commit -m "fix(cache): resolve cache expiration issue"

# Documentation
git commit -m "docs: update API reference for StorageManager"

# Refactoring
git commit -m "refactor(prompt): simplify prompt builder logic"

# Multiple changes
git commit -m "feat(export): add CSV export format

- Add CSVExporter class
- Update export modal UI
- Add tests for CSV generation"
```

### Commit Best Practices

- Use present tense ("add feature" not "added feature")
- Use imperative mood ("move cursor to..." not "moves cursor to...")
- Keep subject line under 72 characters
- Capitalize first letter of subject
- No period at the end of subject
- Separate subject from body with blank line
- Wrap body at 72 characters
- Explain what and why, not how

---

## Pull Request Process

### Before Submitting

1. **Update from upstream**:
   ```bash
   git fetch upstream
   git rebase upstream/main
   ```

2. **Run all checks**:
   ```bash
   npm run lint
   npm run test
   npm run build
   ```

3. **Test manually** in Firefox

### PR Title

Follow the same format as commit messages:
```
feat(ai): add support for Gemini 2.0 Flash model
```

### PR Description Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Unit tests added/updated
- [ ] Manual testing completed
- [ ] All tests passing

## Screenshots (if applicable)
Add screenshots for UI changes

## Checklist
- [ ] Code follows project style guidelines
- [ ] Self-review completed
- [ ] Comments added for complex code
- [ ] Documentation updated
- [ ] No new warnings generated
```

### Review Process

1. Maintainer will review your PR
2. Address any feedback or requested changes
3. Once approved, maintainer will merge

### After Merge

1. Delete your feature branch:
   ```bash
   git branch -d feature/my-new-feature
   git push origin --delete feature/my-new-feature
   ```

2. Update your local main:
   ```bash
   git checkout main
   git pull upstream main
   ```

---

## Areas for Contribution

### Good First Issues

Look for issues labeled `good first issue` on GitHub. These are beginner-friendly tasks.

### High Priority Areas

1. **Test Coverage**: Increase unit test coverage
2. **Accessibility**: Improve WCAG compliance
3. **Performance**: Optimize large PDF handling
4. **Documentation**: Improve inline documentation
5. **Internationalization**: Add more language translations

### Feature Ideas

- Offline mode with local LLM (WebLLM)
- Browser sync for history
- Custom prompt templates
- Advanced analytics dashboard
- Chromium browsers support (Chrome, Edge)

### Bug Fixes

Check the [Issues](https://github.com/AndreaBonn/web-article-summarizer/issues) page for reported bugs.

---

## Getting Help

### Documentation

- [Architecture Documentation](ARCHITECTURE.md)
- [API Reference](API.md)
- [README](../../README.md)

### Communication

- **GitHub Issues**: For bug reports and feature requests
- **GitHub Discussions**: For questions and general discussion
- **Pull Request Comments**: For code-specific questions

### Questions?

If you have questions about contributing:

1. Check existing documentation
2. Search closed issues and PRs
3. Open a new discussion on GitHub
4. Tag maintainers if urgent

---

## Recognition

Contributors will be recognized in:
- GitHub contributors page
- Release notes (for significant contributions)
- Project README (for major features)

---

## License

By contributing, you agree that your contributions will be licensed under the Apache License 2.0.

---

Thank you for contributing to Web Article Summarizer! 🎉
