# Code Naming Convention

## Purpose

Naming conventions ensure **consistency**, **readability**, and **maintainability** across the Academia De San Jose Student Request Management System codebase.

**Why?**
- **Consistency**: All developers follow the same patterns
- **Readability**: Code is easier to understand at a glance
- **Maintainability**: Reduces cognitive load when making changes

---

## Casing Styles

### 1. camelCase

**Used For**: Variables, functions, object properties

**Format**: First word lowercase, subsequent words capitalized

**Examples**:
```javascript
// Variables
const studentId = '2024';
const fullName = 'Juan Dela Cruz';
const isActive = true;

// Functions
function sendEmail() { }
function validateCredentials() { }
function getUserById() { }

// Object properties
const user = {
  firstName: 'Juan',
  lastName: 'Dela Cruz',
  emailAddress: 'juan@example.com'
};
```

---

### 2. PascalCase

**Used For**: React components, classes, constructor functions

**Format**: First letter of each word capitalized

**Examples**:
```javascript
// React components
function Dashboard() { }
function MyRequest() { }
function ProfileSettings() { }

// Classes
class UserAccount { }
class RequestManager { }

// Files (React components)
Dashboard.jsx
MyRequest.jsx
ProfileSettings.jsx
```

---

### 3. SCREAMING_SNAKE_CASE

**Used For**: Constants, environment variables

**Format**: All uppercase with underscores

**Examples**:
```javascript
// Constants
const MAX_FILE_SIZE = 5242880;
const API_TIMEOUT = 30000;
const DEFAULT_PAGE_SIZE = 10;

// Environment variables
REACT_APP_GROQ_API_KEY
REACT_APP_QR_ENCRYPTION_KEY
GMAIL_USER
GMAIL_APP_PASSWORD
```

---

### 4. kebab-case

**Used For**: File names (non-components), folders, URLs, API endpoints

**Format**: All lowercase with hyphens

**Examples**:
```javascript
// Files
qr-encryption.js
content-moderation.js
notification-helper.js

// Folders
student-app/
email-backend/
admin-app/

// API endpoints
/api/send-reset-code
/api/verify-reset-code
/api/reset-password
```

---

### 5. snake_case

**Used For**: Database field names (rare, only if required by external system)

**Format**: All lowercase with underscores

**Note**: We prefer camelCase for Firestore, but snake_case may be used for compatibility with external systems.

---

## Casing Summary Table

| Element | Casing Style | Example |
|---------|--------------|---------|
| Variables | camelCase | `studentId`, `fullName` |
| Functions | camelCase | `sendEmail()`, `validateUser()` |
| React Components | PascalCase | `Dashboard`, `MyRequest` |
| Classes | PascalCase | `UserAccount`, `RequestManager` |
| Constants | SCREAMING_SNAKE_CASE | `MAX_FILE_SIZE`, `API_TIMEOUT` |
| Environment Variables | SCREAMING_SNAKE_CASE | `REACT_APP_GROQ_API_KEY` |
| Files (components) | PascalCase | `Dashboard.jsx` |
| Files (utilities) | camelCase or kebab-case | `qrEncryption.js`, `qr-encryption.js` |
| Folders | kebab-case | `student-app/`, `email-backend/` |
| API Endpoints | kebab-case | `/api/send-reset-code` |

---

## Prefixes and Suffixes

### Boolean Variables

**Prefix with**: `is`, `has`, `can`, `should`

**Examples**:
```javascript
const isActive = true;
const hasQRCode = false;
const isArchived = false;
const canEdit = true;
const shouldValidate = true;
```

**❌ Avoid**:
```javascript
const active = true;           // Not clear it's boolean
const qrCode = false;          // Ambiguous
const archived = false;        // Could be date or boolean
```

---

### Private Variables/Functions

**Prefix with**: `_` (underscore)

**Examples**:
```javascript
// Private function
function _internalHelper() { }

// Private variable
const _secretKey = 'xxx';
```

**Note**: Use sparingly. In modern JavaScript, prefer proper encapsulation with modules or classes.

---

### Event Handlers

**Prefix with**: `handle`

**Examples**:
```javascript
function handleSubmit() { }
function handleClick() { }
function handleChange() { }
function handlePasswordReset() { }
```

---

### React Hooks

**Prefix with**: `use`

**Examples**:
```javascript
function useOfficeTickets() { }
function useAuth() { }
function useNotifications() { }
```

---

### Utility/Helper Functions

**Suffix with**: `Helper` or use descriptive verb

**Examples**:
```javascript
// With Helper suffix
notificationHelper.js
etcHelper.js

// Descriptive verb (preferred)
qrEncryption.js
contentModeration.js
```

---

## Abbreviations

### Allowed Standard Abbreviations

**Common abbreviations that are widely understood**:

| Abbreviation | Full Form | Example |
|--------------|-----------|---------|
| `id` | identifier | `studentId`, `userId` |
| `uid` | unique identifier | `firebase uid` |
| `url` | uniform resource locator | `apiUrl` |
| `api` | application programming interface | `apiKey` |
| `qr` | quick response | `qrCode` |
| `etc` | estimated time of completion | `etcHelper` |
| `db` | database | `db.collection()` |
| `req` | request | `req.body` |
| `res` | response | `res.json()` |
| `err` | error | `catch (err)` |
| `auth` | authentication | `authToken` |
| `pwd` | password | `pwd` (only in encryption) |

**Examples**:
```javascript
const studentId = '2024';
const apiUrl = 'https://api.example.com';
const qrCode = 'encrypted-string';
const authToken = 'xyz123';
```

---

### Discouraged Abbreviations

**Avoid abbreviations that are unclear or ambiguous**:

**❌ Avoid**:
```javascript
const stdnt = 'Juan';          // Use studentName
const req = 'Billing';         // Use requestType
const desc = 'Description';    // Use description
const addr = 'Address';        // Use address
const num = 42;                // Use number or count
const btn = document.get...;   // Use button
```

**✅ Use Full Words**:
```javascript
const studentName = 'Juan';
const requestType = 'Billing';
const description = 'Description text';
const address = '123 Main St';
const count = 42;
const button = document.getElementById('submit');
```

**Exception**: In loops, single-letter variables are acceptable:
```javascript
for (let i = 0; i < array.length; i++) { }
array.map((item, index) => { });
```

---

## Exceptions and Special Cases

### 1. Constants (All Caps)

**Used For**: Configuration values, limits, fixed strings

**Examples**:
```javascript
const MAX_FILE_SIZE = 5242880;              // 5MB in bytes
const API_TIMEOUT = 30000;                  // 30 seconds
const DEFAULT_PAGE_SIZE = 10;
const OFFICE_CODES = {
  'FIN-001': 'Finance',
  'LIB-001': 'Library'
};
```

---

### 2. React Environment Variables

**Must Start With**: `REACT_APP_`

**Format**: SCREAMING_SNAKE_CASE with `REACT_APP_` prefix

**Examples**:
```bash
REACT_APP_GROQ_API_KEY=xxx
REACT_APP_QR_ENCRYPTION_KEY=xxx
REACT_APP_EMAIL_API=http://localhost:5000
```

**Why?** Create React App only exposes variables with this prefix to the browser.

---

### 3. Firebase Collections

**Format**: lowercase plural

**Examples**:
```javascript
collection(db, 'students')        // Not Students or student
collection(db, 'requests')        // Not Requests or request
collection(db, 'notifications')   // Not Notification
```

---

### 4. Firestore Document Fields

**Format**: camelCase (matching JavaScript objects)

**Examples**:
```javascript
{
  studentId: '2024',           // Not student_id or StudentId
  fullName: 'Juan Dela Cruz',  // Not full_name or FullName
  createdAt: Timestamp,        // Not created_at or CreatedAt
  isActive: true               // Not is_active or IsActive
}
```

---

### 5. CSS Class Names

**Format**: kebab-case

**Examples**:
```css
.dashboard-container { }
.request-card { }
.submit-button { }
.notification-badge { }
```

---

### 6. Office Codes

**Format**: Three uppercase letters, hyphen, three digits

**Examples**:
```javascript
'FIN-001'    // Finance Office
'LIB-001'    // Library Office
'REG-001'    // Registrar Office
'GUI-001'    // Guidance Office
```

---

### 7. Git Branch Names

**Format**: `type/description-in-kebab-case`

**Examples**:
```
feature/qr-code-login
bugfix/password-reset-expiry
hotfix/security-vulnerability
```

---

### 8. Acronyms in Names

**Rule**: Treat acronyms as single words

**Examples**:
```javascript
// ✅ Correct
const apiUrl = 'https://api.example.com';
const qrCode = 'encrypted';
const htmlContent = '<div>...</div>';

// ❌ Incorrect
const APIUrl = 'https://api.example.com';
const QRCode = 'encrypted';
const HTMLContent = '<div>...</div>';
```

**Exception**: When acronym is at the start of PascalCase name:
```javascript
// Component names
function QRScanner() { }      // OK (component)
function HTMLParser() { }     // OK (component)

// But for variables/functions
const qrScanner = new QRScanner();    // Still camelCase
```

---

## Summary

### Quick Reference

1. **Variables & Functions**: camelCase (`studentId`, `sendEmail`)
2. **Components & Classes**: PascalCase (`Dashboard`, `UserAccount`)
3. **Constants & Env Vars**: SCREAMING_SNAKE_CASE (`MAX_FILE_SIZE`, `REACT_APP_API_KEY`)
4. **Files & Folders**: kebab-case or match content (`qr-encryption.js`, `Dashboard.jsx`)
5. **Booleans**: Prefix with `is`, `has`, `can` (`isActive`, `hasPermission`)
6. **Private**: Prefix with `_` (`_internalHelper`)
7. **Handlers**: Prefix with `handle` (`handleSubmit`)
8. **Hooks**: Prefix with `use` (`useAuth`)
9. **Abbreviations**: Use standard ones only (`id`, `api`, `url`, `qr`)
10. **Exceptions**: Constants ALL_CAPS, React env vars need `REACT_APP_` prefix

---

**Document Version**: 1.0  
**Last Updated**: January 9, 2025  
**Maintained By**: Development Team
