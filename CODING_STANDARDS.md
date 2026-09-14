# Coding Standards

## Purpose

This document defines the coding standards for the Academia De San Jose Student Request Management System to ensure consistent, maintainable, and high-quality code.

---

## Table of Contents
1. [Coding Philosophy/Principles](#coding-philosophyprinciples)
2. [Style Guides](#style-guides)
3. [Formatting Rules](#formatting-rules)
4. [Commenting/Documentation](#commentingdocumentation)
5. [Error Handling](#error-handling)
6. [Enforcement Tools](#enforcement-tools)

---

## Coding Philosophy/Principles

### 1. DRY (Don't Repeat Yourself)

**Principle**: Avoid code duplication. Extract repeated logic into reusable functions.

**❌ Bad**:
```javascript
// Duplicated validation logic
function createStudent() {
  if (!email || !email.includes('@')) {
    throw new Error('Invalid email');
  }
  // ... create logic
}

function updateStudent() {
  if (!email || !email.includes('@')) {
    throw new Error('Invalid email');
  }
  // ... update logic
}
```

**✅ Good**:
```javascript
// Reusable validation
function validateEmail(email) {
  if (!email || !email.includes('@')) {
    throw new Error('Invalid email');
  }
}

function createStudent() {
  validateEmail(email);
  // ... create logic
}

function updateStudent() {
  validateEmail(email);
  // ... update logic
}
```

---

### 2. KISS (Keep It Simple, Stupid)

**Principle**: Write simple, straightforward code. Avoid unnecessary complexity.

**❌ Bad**:
```javascript
// Overly complex
const isValid = condition1 ? (condition2 ? (condition3 ? true : false) : false) : false;
```

**✅ Good**:
```javascript
// Simple and clear
const isValid = condition1 && condition2 && condition3;
```

---

### 3. YAGNI (You Aren't Gonna Need It)

**Principle**: Don't add functionality until it's actually needed.

**❌ Bad**:
```javascript
// Adding features "just in case"
function sendEmail(to, subject, body, cc, bcc, attachments, priority, scheduledTime) {
  // Only using to, subject, body right now
}
```

**✅ Good**:
```javascript
// Only what's needed now
function sendEmail(to, subject, body) {
  // Add parameters when actually needed
}
```

---

### 4. SOLID Principles

#### S - Single Responsibility Principle
Each function/class should have one clear purpose.

**❌ Bad**:
```javascript
// Does too many things
function processRequest(request) {
  validateRequest(request);
  saveToDatabase(request);
  sendEmailNotification(request);
  updateAnalytics(request);
}
```

**✅ Good**:
```javascript
// Each function has one responsibility
function validateRequest(request) { }
function saveRequest(request) { }
function notifyUser(request) { }
function trackAnalytics(request) { }
```

#### O - Open/Closed Principle
Open for extension, closed for modification.

**✅ Good**:
```javascript
// Use configuration instead of hardcoding
const officeConfig = {
  'FIN-001': { name: 'Finance', email: 'finance@asj.edu' },
  'LIB-001': { name: 'Library', email: 'library@asj.edu' }
};
```

#### L - Liskov Substitution Principle
Subtypes must be substitutable for their base types.

#### I - Interface Segregation Principle
Many specific interfaces are better than one general interface.

#### D - Dependency Inversion Principle
Depend on abstractions, not concrete implementations.

---

## Style Guides

### JavaScript/React

**Primary Reference**: [Airbnb JavaScript Style Guide](https://github.com/airbnb/javascript)

**Key Rules**:
- Use `const` and `let`, never `var`
- Prefer arrow functions for callbacks
- Use template literals for string concatenation
- Destructure objects and arrays
- Use async/await over promises when possible

**Examples**:
```javascript
// ✅ Use const/let
const name = 'Juan';
let count = 0;

// ❌ Don't use var
var name = 'Juan';

// ✅ Arrow functions
const double = (x) => x * 2;

// ✅ Template literals
const greeting = `Hello, ${name}!`;

// ❌ String concatenation
const greeting = 'Hello, ' + name + '!';

// ✅ Destructuring
const { studentId, fullName } = student;

// ✅ Async/await
async function fetchData() {
  const data = await api.getData();
  return data;
}
```

---

### CSS

**Guidelines**:
- Use kebab-case for class names
- Organize properties logically
- Avoid !important unless absolutely necessary
- Use CSS variables for colors and spacing

**Example**:
```css
.dashboard-container {
  /* Layout */
  display: flex;
  flex-direction: column;
  
  /* Spacing */
  padding: 20px;
  margin: 0 auto;
  
  /* Sizing */
  max-width: 1200px;
  
  /* Visual */
  background-color: var(--bg-color);
  border-radius: 8px;
}
```

---

## Formatting Rules

### Indentation

**Standard**: 2 spaces (no tabs)

**JavaScript**:
```javascript
function example() {
  if (condition) {
    return true;
  }
  return false;
}
```

**JSX**:
```javascript
function Component() {
  return (
    <div className="container">
      <h1>Title</h1>
      <p>Content</p>
    </div>
  );
}
```

---

### Line Length

**Maximum**: 100 characters per line

**Exception**: Long strings or URLs can exceed this limit

**Example**:
```javascript
// ✅ Good - under 100 characters
const message = 'This is a reasonable length message';

// ✅ OK - break long lines
const longMessage = 
  'This is a very long message that needs to be broken ' +
  'into multiple lines for better readability';

// ✅ OK - long URLs are acceptable
const apiUrl = 'https://us-central1-academia-de-san-jose.cloudfunctions.net/sendEmail';
```

---

### Bracket Placement

**Style**: Opening bracket on same line (K&R style)

**JavaScript Functions**:
```javascript
// ✅ Correct
function example() {
  // code
}

// ❌ Wrong
function example()
{
  // code
}
```

**If Statements**:
```javascript
// ✅ Correct
if (condition) {
  // code
} else {
  // code
}

// ❌ Wrong
if (condition)
{
  // code
}
else
{
  // code
}
```

**JSX**:
```javascript
// ✅ Correct
return (
  <div>
    <Component />
  </div>
);
```

---

### Spacing

**Rules**:
- Space after keywords (`if`, `for`, `while`)
- Space around operators (`=`, `+`, `===`)
- No space before function parentheses
- Blank line between logical sections

**Examples**:
```javascript
// ✅ Correct spacing
if (condition) {
  const result = a + b;
  return result;
}

function example() {
  // code
}

// ❌ Wrong spacing
if(condition){
  const result=a+b;
  return result;
}

function example (){
  // code
}
```

---

### Semicolons

**Rule**: Always use semicolons

```javascript
// ✅ Correct
const name = 'Juan';
const age = 20;

// ❌ Wrong
const name = 'Juan'
const age = 20
```

---

### Quotes

**Rule**: Use single quotes for JavaScript, double quotes for JSX

**JavaScript**:
```javascript
// ✅ Correct
const message = 'Hello World';

// ❌ Wrong
const message = "Hello World";
```

**JSX**:
```javascript
// ✅ Correct
<div className="container" id="main">

// ❌ Wrong
<div className='container' id='main'>
```

---

### Trailing Commas

**Rule**: Use trailing commas in multi-line arrays/objects

```javascript
// ✅ Correct
const student = {
  name: 'Juan',
  age: 20,
  grade: 'A',  // trailing comma
};

// ❌ Wrong
const student = {
  name: 'Juan',
  age: 20,
  grade: 'A'
};
```

---

## Commenting/Documentation

### JSDoc for Functions

**Required for**: All exported functions, complex functions

**Format**:
```javascript
/**
 * Brief description of what the function does
 * 
 * @param {type} paramName - Parameter description
 * @returns {type} Return value description
 * @throws {Error} When error occurs
 * 
 * @example
 * functionName(param);
 */
function functionName(paramName) {
  // implementation
}
```

**Example**:
```javascript
/**
 * Encrypts student credentials for QR code generation
 * 
 * @param {string} studentId - 4-digit student ID
 * @param {string} password - Student password
 * @returns {string} Encrypted string for QR code
 * @throws {Error} If encryption fails
 * 
 * @example
 * const encrypted = encryptCredentials('2024', 'password123');
 */
export const encryptCredentials = (studentId, password) => {
  // implementation
};
```

---

### Inline Comments

**When to Use**:
- Explain complex logic
- Document non-obvious decisions
- Mark TODO items

**Format**:
```javascript
// Single-line comment for brief explanations

/*
 * Multi-line comment for longer explanations
 * that span multiple lines
 */
```

**Examples**:
```javascript
// Check if user has permission to edit
if (user.role === 'admin' || request.createdBy === user.id) {
  // Allow edit
}

// TODO: Add email validation
// FIXME: This causes memory leak
// NOTE: Firebase requires this format
```

---

### Component Comments

**React Components**:
```javascript
/**
 * Dashboard component for student portal
 * 
 * Displays student information and recent requests.
 * 
 * @component
 * @param {Object} props - Component props
 * @param {Object} props.user - Logged-in user object
 * @param {Function} props.onLogout - Logout callback
 */
const Dashboard = ({ user, onLogout }) => {
  return (
    <div>
      {/* Main dashboard content */}
    </div>
  );
};
```

---

### What NOT to Comment

**Avoid obvious comments**:
```javascript
// ❌ Bad - obvious
// Increment counter
counter++;

// ❌ Bad - redundant
// Get student by ID
const student = getStudentById(id);

// ✅ Good - explains WHY
// Increment counter to track failed login attempts
failedAttempts++;
```

---

## Error Handling

### Try-Catch Blocks

**Rule**: Always handle errors, especially for async operations and external APIs

**Structure**:
```javascript
try {
  // Code that might throw error
} catch (error) {
  // Handle error appropriately
  console.error('[Error] Description:', error);
  // User-friendly error message
}
```

**Example**:
```javascript
async function sendEmail(to, subject, body) {
  try {
    const result = await emailAPI.send({ to, subject, body });
    console.log('[Success] Email sent:', result.messageId);
    return result;
  } catch (error) {
    console.error('[Error] Failed to send email:', error);
    throw new Error('Failed to send email. Please try again.');
  }
}
```

---

### Console Logging Format

**Format**: `[LEVEL] Message: context`

**Levels**:
```javascript
console.log('[Info] User logged in:', userId);
console.log('[Success] Request created:', requestId);
console.warn('[Warning] Deprecated function used');
console.error('[Error] Failed to fetch data:', error);
```

---

### User-Facing Error Messages

**Rules**:
- Be clear and specific
- Avoid technical jargon
- Suggest solutions when possible

**Examples**:
```javascript
// ❌ Bad
throw new Error('Error 500');

// ❌ Bad
throw new Error('Database query failed at line 42');

// ✅ Good
throw new Error('Failed to save request. Please check your internet connection and try again.');

// ✅ Good
throw new Error('Invalid email format. Please enter a valid email address.');
```

---

### Validation Errors

**Return structured error objects**:
```javascript
function validateRequest(request) {
  const errors = [];
  
  if (!request.subject) {
    errors.push('Subject is required');
  }
  
  if (!request.description || request.description.length < 20) {
    errors.push('Description must be at least 20 characters');
  }
  
  return {
    isValid: errors.length === 0,
    errors: errors
  };
}
```

---

### API Error Responses

**Consistent format**:
```javascript
// Success
{
  success: true,
  data: { /* result */ }
}

// Error
{
  success: false,
  error: {
    code: 'VALIDATION_ERROR',
    message: 'Invalid input',
    details: { /* specific errors */ }
  }
}
```

---

## Enforcement Tools

### 1. ESLint (Linter)

**Purpose**: Catch code quality issues and enforce style

**Configuration**: `.eslintrc.js`

**Example**:
```javascript
module.exports = {
  extends: ['eslint:recommended', 'plugin:react/recommended'],
  rules: {
    'no-console': 'warn',
    'no-unused-vars': 'error',
    'semi': ['error', 'always'],
    'quotes': ['error', 'single']
  }
};
```

**Usage**:
```bash
# Run ESLint
npm run lint

# Auto-fix issues
npm run lint -- --fix
```

---

### 2. Prettier (Formatter)

**Purpose**: Automatic code formatting

**Configuration**: `.prettierrc`

**Example**:
```json
{
  "singleQuote": true,
  "trailingComma": "es5",
  "tabWidth": 2,
  "semi": true,
  "printWidth": 100
}
```

**Usage**:
```bash
# Format all files
npx prettier --write "src/**/*.{js,jsx,json,css}"
```

---

### 3. Git Hooks (Pre-commit)

**Purpose**: Enforce standards before code is committed

**Tool**: Husky + lint-staged

**Configuration**: `package.json`
```json
{
  "husky": {
    "hooks": {
      "pre-commit": "lint-staged"
    }
  },
  "lint-staged": {
    "*.{js,jsx}": [
      "eslint --fix",
      "prettier --write"
    ]
  }
}
```

**What It Does**:
- Runs ESLint on staged files
- Runs Prettier to format code
- Blocks commit if errors found

---

### 4. Editor Configuration

**EditorConfig**: `.editorconfig`

**Purpose**: Consistent editor settings across team

**Example**:
```ini
root = true

[*]
indent_style = space
indent_size = 2
end_of_line = lf
charset = utf-8
trim_trailing_whitespace = true
insert_final_newline = true

[*.md]
trim_trailing_whitespace = false
```

---

### Tool Summary

| Tool | Purpose | When It Runs |
|------|---------|-------------|
| **ESLint** | Code quality & style | On save (IDE), manual, pre-commit |
| **Prettier** | Code formatting | On save (IDE), manual, pre-commit |
| **Husky** | Git hooks | Pre-commit, pre-push |
| **lint-staged** | Run linters on staged files | Pre-commit |
| **EditorConfig** | Editor settings | Always (in editor) |

---

## Summary

### Key Points

1. **Principles**:
   - DRY: Don't repeat code
   - KISS: Keep it simple
   - YAGNI: Only add what's needed
   - SOLID: Single responsibility, etc.

2. **Style Guide**:
   - Follow Airbnb JavaScript Style Guide
   - Use modern JavaScript features (const/let, arrow functions, async/await)

3. **Formatting**:
   - 2 spaces indentation
   - 100 characters line length
   - K&R bracket placement
   - Always use semicolons
   - Single quotes for JS, double for JSX

4. **Documentation**:
   - JSDoc for all exported functions
   - Inline comments for complex logic
   - Avoid obvious comments

5. **Error Handling**:
   - Always use try-catch for async operations
   - Structured error responses
   - User-friendly error messages
   - Console logging format: `[LEVEL] Message`

6. **Tools**:
   - ESLint: Code quality
   - Prettier: Formatting
   - Husky: Git hooks
   - EditorConfig: Editor settings

---

**Document Version**: 1.0  
**Last Updated**: January 9, 2025  
**Maintained By**: Development Team
