# Taxonomy/Metadata Standards

## Purpose

This document establishes standardized practices for how data, code, APIs, and system elements are classified, labeled, and documented across the Academia De San Jose Student Request Management System.

### Why Taxonomy & Metadata Standards?

1. **Consistency**: Unified naming and classification across database, code, and APIs
2. **Discoverability**: Easy to find and understand data structures and code elements
3. **Maintainability**: Clear documentation reduces cognitive load for developers
4. **Interoperability**: Standardized formats enable smooth integration
5. **Version Management**: Clear tracking of changes and releases
6. **Quality Assurance**: Structured metadata enables automated validation

---

## Table of Contents
1. [Database Schema Metadata](#database-schema-metadata)
2. [API Metadata Standards](#api-metadata-standards)
3. [Code Documentation Metadata](#code-documentation-metadata)
4. [Version Control Tagging](#version-control-tagging)
5. [Configuration & Feature Metadata](#configuration--feature-metadata)
6. [Status & State Taxonomies](#status--state-taxonomies)
7. [Error & Response Codes](#error--response-codes)

---

## Database Schema Metadata

### Firestore Collection Naming

**Standard Format**: `lowercase` (plural nouns)

```javascript
// ✅ Correct collection names
collection(db, 'students')           // Student accounts
collection(db, 'staff')              // Staff/admin accounts
collection(db, 'requests')           // Student requests/tickets
collection(db, 'notifications')      // System notifications
collection(db, 'announcements')      // Bulletin board posts
collection(db, 'feedback')           // User feedback

// ❌ Incorrect
collection(db, 'Students')           // Don't use PascalCase
collection(db, 'student')            // Use plural
collection(db, 'studentData')        // Keep it simple
```

---

### Document Field Naming

**Standard Format**: `camelCase`

```javascript
// ✅ Correct field names
{
  studentId: '2024',
  fullName: 'Juan Dela Cruz',
  emailAddress: 'juan@example.com',
  yearLevel: 'Grade 11',
  isActive: true,
  createdAt: Timestamp,
  updatedAt: Timestamp
}

// ❌ Incorrect
{
  student_id: '2024',        // Don't use snake_case
  StudentId: '2024',         // Don't use PascalCase
  full_name: 'Juan',         // Don't use snake_case
  IsActive: true             // Don't use PascalCase
}
```

---

### Common Field Patterns

#### Identity Fields

```javascript
{
  id: 'auto-generated-firestore-id',     // Firestore document ID
  uid: 'firebase-auth-uid',               // Firebase Auth UID
  studentId: '2024',                      // Business ID (student number)
  username: 'staff_john',                 // Staff username
  email: 'user@example.com'               // Email address
}
```

**Rules**:
- `id` = Firestore document ID (auto-generated)
- `uid` = Firebase Authentication UID
- `[entity]Id` = Business identifier (e.g., `studentId`, `requestId`)

---

#### Timestamp Fields

```javascript
{
  createdAt: serverTimestamp(),          // Document creation time
  updatedAt: serverTimestamp(),          // Last modification time
  deletedAt: serverTimestamp(),          // Soft delete timestamp
  submittedAt: serverTimestamp(),        // Request submission time
  resolvedAt: serverTimestamp(),         // Request resolution time
  readAt: serverTimestamp(),             // Notification read time
  expiresAt: serverTimestamp()           // Expiration time
}
```

**Rules**:
- Always use `serverTimestamp()` for consistency
- Use `[action]At` pattern (camelCase)
- Past tense verbs: `created`, `updated`, `deleted`, `submitted`

---

#### Boolean Fields

```javascript
{
  isActive: true,                        // Account status
  isRead: false,                         // Notification read status
  isArchived: false,                     // Soft delete flag
  hasQRCode: true,                       // Feature flag
  isGuest: false,                        // User type flag
  isUrgent: false                        // Priority flag
}
```

**Rules**:
- Prefix with `is`, `has`, or `can`
- Use `true`/`false` (not `1`/`0` or `'yes'`/'no'`)
- Default to `false` for safety

---

#### Status Fields

```javascript
{
  status: 'Pending',                     // Request status
  accountStatus: 'Active',               // Account status
  paymentStatus: 'Unpaid',               // Payment status
  verificationStatus: 'Verified'         // Verification status
}
```

**Standard Status Values** (see [Status Taxonomies](#status--state-taxonomies))

---

### Data Type Standards

| Field Type | Firestore Type | Example | Notes |
|-----------|----------------|---------|-------|
| **Text (short)** | `string` | `'Juan Dela Cruz'` | Names, emails, IDs |
| **Text (long)** | `string` | `'This is my request...'` | Descriptions, messages |
| **Number (integer)** | `number` | `2024` | Years, counts, IDs |
| **Number (decimal)** | `number` | `99.99` | Prices, ratings |
| **Boolean** | `boolean` | `true` / `false` | Flags, toggles |
| **Timestamp** | `Timestamp` | `serverTimestamp()` | Dates, times |
| **Reference** | `DocumentReference` | `doc(db, 'staff', 'uid123')` | Links to other documents |
| **Array** | `array` | `['FIN-001', 'LIB-001']` | Lists of values |
| **Map/Object** | `map` | `{ name: 'John', age: 25 }` | Nested objects |

---

### Indexing Standards

**When to Create Indexes**:

1. **Query Filters**: Fields used in `where()` clauses
2. **Ordering**: Fields used in `orderBy()`
3. **Composite Queries**: Multiple filters in one query

**Example Indexes for `requests` Collection**:

```javascript
// Query: All pending requests for Finance Office
query(
  collection(db, 'requests'),
  where('office', '==', 'Finance'),
  where('status', '==', 'Pending')
);
// Index needed: office (Ascending) + status (Ascending)

// Query: Recent requests by student
query(
  collection(db, 'requests'),
  where('studentId', '==', '2024'),
  orderBy('createdAt', 'desc')
);
// Index needed: studentId (Ascending) + createdAt (Descending)
```

**Index Naming** (Firebase auto-generates, but for documentation):
- `idx_[collection]_[field1]_[field2]`
- Example: `idx_requests_office_status`

---

### Schema Documentation Format

Each collection should be documented:

```markdown
### Collection: `students`

**Purpose**: Student account information

**Fields**:
| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| `id` | string | Yes | Firestore document ID | `auto-generated` |
| `uid` | string | Yes | Firebase Auth UID | `abc123xyz` |
| `studentId` | string | Yes | Student number | `2024` |
| `fullName` | string | Yes | Student full name | `Juan Dela Cruz` |
| `email` | string | Yes | Student email | `juan@example.com` |
| `yearLevel` | string | Yes | Grade level | `Grade 11` |
| `section` | string | Yes | Class section | `STEM-A` |
| `isActive` | boolean | Yes | Account active status | `true` |
| `hasQRCode` | boolean | Yes | Has generated QR | `false` |
| `qrCodeData` | string | No | Encrypted QR data | `encrypted-string` |
| `createdAt` | Timestamp | Yes | Account creation | `serverTimestamp()` |
| `updatedAt` | Timestamp | Yes | Last update | `serverTimestamp()` |

**Indexes**:
- `studentId` (Ascending) - Unique identifier lookup
- `uid` (Ascending) - Firebase Auth mapping
- `email` (Ascending) - Email lookup

**Security Rules**:
- Students: Read/write own document only
- Staff: Read all, write none
- Superadmin: Full access
```

---

## API Metadata Standards

### Endpoint Naming

**Standard Format**: `kebab-case` (lowercase with hyphens)

```javascript
// ✅ Correct endpoint names
POST /api/send-credentials
POST /api/send-reset-code
POST /api/verify-reset-code
POST /api/reset-password
POST /api/delete-user

// ❌ Incorrect
POST /api/sendCredentials        // Don't use camelCase
POST /api/SendResetCode          // Don't use PascalCase
POST /api/send_reset_code        // Don't use snake_case
```

---

### HTTP Methods

Use appropriate HTTP methods:

| Method | Purpose | Example |
|--------|---------|---------|
| `GET` | Retrieve data | `GET /api/users` |
| `POST` | Create resource or execute action | `POST /api/send-email` |
| `PUT` | Update entire resource | `PUT /api/user/123` |
| `PATCH` | Partial update | `PATCH /api/user/123` |
| `DELETE` | Remove resource | `DELETE /api/user/123` |

---

### API Versioning

**Header-Based Versioning** (Recommended):

```javascript
// Client request
fetch('/api/send-credentials', {
  headers: {
    'API-Version': '1.0',
    'Content-Type': 'application/json'
  }
});

// Server response headers
{
  'API-Version': '1.0',
  'Content-Type': 'application/json',
  'X-RateLimit-Limit': '100',
  'X-RateLimit-Remaining': '95'
}
```

**URL-Based Versioning** (Alternative):

```javascript
POST /api/v1/send-credentials
POST /api/v2/send-credentials
```

**Versioning Rules**:
- **Major version** (`v1`, `v2`): Breaking changes
- **Minor version** (`v1.1`, `v1.2`): New features, backward-compatible
- **Patch version** (`v1.1.1`): Bug fixes, no API changes

---

### Request/Response Structure

#### Request Metadata

```javascript
// POST /api/send-credentials
{
  // Request metadata (optional)
  "meta": {
    "requestId": "req_abc123xyz",      // Unique request ID (optional)
    "timestamp": 1704708000000,        // Client timestamp (optional)
    "clientVersion": "1.0.0"           // Client app version (optional)
  },
  
  // Actual request payload
  "email": "juan@example.com",
  "studentId": "2024",
  "password": "tempPass123",
  "studentName": "Juan Dela Cruz"
}
```

---

#### Response Metadata (Success)

```javascript
{
  // Response metadata
  "success": true,
  "timestamp": 1704708000000,
  "version": "1.0",
  
  // Response data
  "data": {
    "messageId": "msg_xyz789abc"
  },
  
  // Optional metadata
  "meta": {
    "executionTime": 250,             // ms
    "server": "email-backend-01"
  }
}
```

---

#### Response Metadata (Error)

```javascript
{
  // Response metadata
  "success": false,
  "timestamp": 1704708000000,
  "version": "1.0",
  
  // Error details
  "error": {
    "code": "MISSING_FIELDS",
    "message": "Missing required fields",
    "details": {
      "missingFields": ["email", "password"]
    }
  }
}
```

---

### Content-Type Headers

**Standard Content Types**:

```javascript
// JSON API responses (default)
'Content-Type': 'application/json'

// HTML responses
'Content-Type': 'text/html; charset=UTF-8'

// Plain text
'Content-Type': 'text/plain; charset=UTF-8'

// Form data
'Content-Type': 'application/x-www-form-urlencoded'

// Multipart file uploads
'Content-Type': 'multipart/form-data'
```

---

### Response Status Codes

Use standard HTTP status codes:

| Code | Meaning | Usage |
|------|---------|-------|
| **200** | OK | Successful GET, PUT, PATCH |
| **201** | Created | Successful POST (resource created) |
| **204** | No Content | Successful DELETE |
| **400** | Bad Request | Invalid input, validation error |
| **401** | Unauthorized | Missing or invalid authentication |
| **403** | Forbidden | Authenticated but not allowed |
| **404** | Not Found | Resource doesn't exist |
| **409** | Conflict | Resource already exists |
| **500** | Internal Server Error | Server-side error |
| **503** | Service Unavailable | Temporary downtime |

---

## Code Documentation Metadata

### JSDoc Standards

Use JSDoc tags for all functions, classes, and modules.

#### Function Documentation

```javascript
/**
 * Encrypts student credentials for QR code generation
 * 
 * @param {string} studentId - 4-digit student ID (e.g., "2024")
 * @param {string} password - Student password (plaintext)
 * @returns {string} Encrypted string for QR code
 * @throws {Error} If encryption fails or key is missing
 * 
 * @example
 * const encrypted = encryptCredentials('2024', 'myPassword123');
 * // Returns: "U2FsdGVkX1+..."
 * 
 * @since 1.0.0
 * @see {@link decryptCredentials} for decryption
 */
export const encryptCredentials = (studentId, password) => {
  // Implementation...
};
```

---

#### Required JSDoc Tags

| Tag | Purpose | Example |
|-----|---------|---------|
| `@param` | Function parameter | `@param {string} name - User's full name` |
| `@returns` | Return value | `@returns {boolean} True if valid` |
| `@throws` | Exceptions thrown | `@throws {Error} If validation fails` |
| `@example` | Usage example | `@example const result = validate(...)` |
| `@since` | Version introduced | `@since 1.2.0` |
| `@deprecated` | Deprecated code | `@deprecated Use newFunction() instead` |
| `@see` | Related code/docs | `@see {@link relatedFunction}` |
| `@todo` | Pending work | `@todo Add validation for edge case` |
| `@private` | Internal use only | `@private Internal helper function` |
| `@async` | Async function | `@async Returns a Promise` |

---

#### Complex Object Parameters

```javascript
/**
 * Validates student request content using AI
 * 
 * @param {string} subject - Selected request subject
 * @param {string} description - Request description text
 * @param {string} [officeName=''] - Office name (optional)
 * @returns {Promise<ValidationResult>} Validation result object
 * @returns {boolean} returns.isValid - Whether content is valid
 * @returns {string[]} returns.errors - Array of error messages
 * @returns {string[]} returns.warnings - Array of warnings
 * @returns {string} returns.language - Detected language
 * 
 * @example
 * const result = await validateContent(
 *   'Billing Inquiry',
 *   'Why did I receive this bill?',
 *   'Finance'
 * );
 * if (!result.isValid) {
 *   console.error(result.errors);
 * }
 */
export const validateContent = async (subject, description, officeName = '') => {
  // Implementation...
};
```

---

#### React Component Documentation

```javascript
/**
 * Dashboard component for student portal
 * 
 * Displays student information, recent requests, and quick actions.
 * 
 * @component
 * @param {Object} props - Component props
 * @param {Object} props.user - Logged-in user object
 * @param {string} props.user.studentId - Student ID
 * @param {string} props.user.fullName - Student full name
 * @param {Function} props.onLogout - Logout callback function
 * 
 * @example
 * <Dashboard 
 *   user={{ studentId: '2024', fullName: 'Juan' }}
 *   onLogout={() => console.log('Logged out')}
 * />
 * 
 * @since 1.0.0
 */
const Dashboard = ({ user, onLogout }) => {
  // Implementation...
};
```

---

### Deprecation Tags

Mark deprecated code clearly:

```javascript
/**
 * Legacy encryption function
 * 
 * @deprecated Since version 2.0.0. Use {@link encryptCredentials} instead.
 * @param {string} data - Data to encrypt
 * @returns {string} Encrypted data
 * 
 * @example
 * // ❌ Old way (deprecated)
 * const encrypted = legacyEncrypt('data');
 * 
 * // ✅ New way (recommended)
 * const encrypted = encryptCredentials('2024', 'password');
 */
export const legacyEncrypt = (data) => {
  console.warn('[Deprecation] legacyEncrypt() is deprecated. Use encryptCredentials()');
  // Implementation...
};
```

---

### TODO Comments

Standardized TODO format:

```javascript
// TODO: Add email validation
// TODO(john): Optimize this query for large datasets
// TODO [P1]: Fix security vulnerability in password reset
// TODO [2025-02-01]: Remove after migration is complete
// FIXME: This causes memory leak on large files
// HACK: Temporary workaround for API bug
// NOTE: This function is called by Firebase Functions
```

**Priority Levels**:
- `[P0]` or `[CRITICAL]` - Blocker, fix immediately
- `[P1]` or `[HIGH]` - Important, fix soon
- `[P2]` or `[MEDIUM]` - Normal priority
- `[P3]` or `[LOW]` - Nice to have

---

## Version Control Tagging

### Semantic Versioning

**Format**: `vMAJOR.MINOR.PATCH`

```bash
v1.0.0    # Major version 1, minor version 0, patch 0
v1.2.3    # Major version 1, minor version 2, patch 3
v2.0.0    # Major version 2 (breaking changes)
```

**Version Increment Rules**:

| Change Type | Version | Example |
|------------|---------|---------|
| **Breaking change** | MAJOR (`v1.x.x` → `v2.0.0`) | API endpoint removed |
| **New feature** | MINOR (`v1.0.x` → `v1.1.0`) | Add QR code login |
| **Bug fix** | PATCH (`v1.0.0` → `v1.0.1`) | Fix password reset bug |

---

### Git Tag Creation

```bash
# Create annotated tag (recommended)
git tag -a v1.0.0 -m "Release version 1.0.0 - Initial production release"

# Push tag to remote
git push origin v1.0.0

# Push all tags
git push origin --tags

# List all tags
git tag -l

# Delete tag (local)
git tag -d v1.0.0

# Delete tag (remote)
git push origin --delete v1.0.0
```

---

### Release Tag Format

**Tag Message Template**:

```
v1.2.0 - QR Code Authentication Release

## New Features
- QR code login for students
- Auto-invalidate QR on password change
- Guest request submission

## Improvements
- Improved AI content moderation accuracy
- Faster notification delivery

## Bug Fixes
- Fixed password reset expiration bug
- Resolved duplicate request issue

## Breaking Changes
None

## Migration Notes
Update REACT_APP_QR_ENCRYPTION_KEY in production
```

---

### Pre-release Tags

```bash
v1.0.0-alpha.1    # Alpha release 1
v1.0.0-alpha.2    # Alpha release 2
v1.0.0-beta.1     # Beta release 1
v1.0.0-rc.1       # Release candidate 1
v1.0.0            # Stable release
```

**Naming Convention**:
- `alpha` - Early development, unstable
- `beta` - Feature-complete, testing phase
- `rc` (release candidate) - Final testing before release

---

### Commit Message Metadata

**Format**: `type(scope): subject`

```bash
# Feature
feat(auth): add QR code login

# Bug fix
fix(reset-password): clear QR codes on password reset

# Documentation
docs(readme): update installation instructions

# Refactor
refactor(encryption): simplify QR encryption logic

# Performance
perf(notifications): optimize query with indexes

# Style
style(dashboard): fix button alignment

# Test
test(auth): add unit tests for login

# Chore
chore(deps): update Firebase SDK to v12
```

**Types**:
- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation only
- `style` - Code style (formatting, no logic change)
- `refactor` - Code restructure (no feature/bug change)
- `perf` - Performance improvement
- `test` - Add/update tests
- `chore` - Maintenance (deps, config, etc.)

---

## Configuration & Feature Metadata

### Feature Flags

**Naming Convention**: `ENABLE_[FEATURE_NAME]`

```javascript
// .env
ENABLE_AI_MODERATION=true
ENABLE_QR_CODE_LOGIN=true
ENABLE_TWO_FACTOR_AUTH=false
ENABLE_DEBUG_MODE=false

// Usage in code
const useAIModeration = process.env.ENABLE_AI_MODERATION === 'true';

if (useAIModeration) {
  await validateContent(subject, description);
}
```

---

### Environment Tags

```javascript
// Environment detection
const environment = process.env.NODE_ENV;

// Environment-specific behavior
switch (environment) {
  case 'development':
    console.log('[Dev] Debug logs enabled');
    break;
  case 'staging':
    console.log('[Staging] Testing environment');
    break;
  case 'production':
    // Silent mode
    break;
  default:
    console.warn('[Unknown] Environment not configured');
}
```

**Standard Environments**:
- `development` - Local development
- `staging` - Pre-production testing
- `production` - Live system

---

### Logging Metadata

**Log Level Taxonomy**:

```javascript
// Log levels (in order of severity)
console.debug('[Debug] Variable value:', value);     // Verbose debugging
console.log('[Info] User logged in:', userId);       // General information
console.warn('[Warning] Deprecated function used');  // Warnings
console.error('[Error] Failed to send email:', err); // Errors
```

**Log Format**:

```javascript
// Format: [LEVEL] Message: context
console.log('[Success] Email sent successfully via Gmail:', messageId);
console.error('[Error] Decryption failed - invalid key or corrupted data');
console.warn('[Warning] Firebase Admin not initialized - some features disabled');
```

---

## Status & State Taxonomies

### Request Status Values

**Standard Status Values** (exact spelling, case-sensitive):

```javascript
const REQUEST_STATUSES = {
  PENDING: 'Pending',               // Initial state, not assigned
  IN_PROGRESS: 'In Progress',       // Staff working on it
  RESOLVED: 'Resolved',             // Completed successfully
  CANCELLED: 'Cancelled',           // Cancelled by student
  FORWARDED: 'Forwarded'            // Sent to another office
};
```

**Status Transitions**:

```
Pending → In Progress → Resolved
Pending → Cancelled
Pending → Forwarded → Pending (in new office)
In Progress → Resolved
In Progress → Forwarded
```

---

### Account Status Values

```javascript
const ACCOUNT_STATUSES = {
  ACTIVE: 'Active',                 // Normal active account
  INACTIVE: 'Inactive',             // Temporarily disabled
  ARCHIVED: 'Archived',             // Soft deleted
  SUSPENDED: 'Suspended'            // Banned/restricted
};
```

---

### Notification Types

```javascript
const NOTIFICATION_TYPES = {
  REQUEST_CREATED: 'request_created',
  REQUEST_ASSIGNED: 'request_assigned',
  REQUEST_UPDATED: 'request_updated',
  REQUEST_RESOLVED: 'request_resolved',
  REQUEST_FORWARDED: 'request_forwarded',
  ACCOUNT_CREATED: 'account_created',
  PASSWORD_RESET: 'password_reset',
  SYSTEM_ANNOUNCEMENT: 'system_announcement'
};
```

---

### Office Codes

**Standard Office Codes**:

```javascript
const OFFICE_CODES = {
  'FIN-001': 'Finance',
  'LIB-001': 'Library',
  'REG-001': 'Registrar',
  'GUI-001': 'Guidance'
};
```

**Format Rules**:
- 3-letter prefix (uppercase)
- Hyphen separator
- 3-digit number (zero-padded)
- Example: `FIN-001`, `LIB-001`

---

### Year Level Values

```javascript
const YEAR_LEVELS = [
  'Grade 7',
  'Grade 8',
  'Grade 9',
  'Grade 10',
  'Grade 11',
  'Grade 12'
];
```

**Format**: `Grade [number]` (exact spelling, space between)

---

## Error & Response Codes

### Application Error Codes

**Format**: `CATEGORY_SPECIFIC_ERROR`

```javascript
// Authentication errors
AUTH_INVALID_CREDENTIALS
AUTH_USER_NOT_FOUND
AUTH_ACCOUNT_DISABLED
AUTH_EMAIL_ALREADY_EXISTS

// Validation errors
VALIDATION_MISSING_FIELDS
VALIDATION_INVALID_FORMAT
VALIDATION_PROFANITY_DETECTED
VALIDATION_CONTENT_IRRELEVANT

// Authorization errors
PERMISSION_DENIED
PERMISSION_INSUFFICIENT_ROLE

// Resource errors
RESOURCE_NOT_FOUND
RESOURCE_ALREADY_EXISTS
RESOURCE_CONFLICT

// System errors
SYSTEM_DATABASE_ERROR
SYSTEM_EMAIL_FAILED
SYSTEM_ENCRYPTION_ERROR
SYSTEM_API_UNAVAILABLE
```

---

### Error Response Structure

```javascript
{
  "success": false,
  "error": {
    "code": "VALIDATION_MISSING_FIELDS",
    "message": "Missing required fields",
    "details": {
      "missingFields": ["email", "password"],
      "providedFields": ["studentId", "studentName"]
    },
    "timestamp": 1704708000000,
    "requestId": "req_abc123"
  }
}
```

---

## Summary

### Key Principles

1. **Database**:
   - Collections: lowercase plural (`students`, `requests`)
   - Fields: camelCase (`studentId`, `createdAt`)
   - Timestamps: `serverTimestamp()` with `[action]At` pattern

2. **API**:
   - Endpoints: kebab-case (`/api/send-reset-code`)
   - Versioning: Header-based or URL-based (`v1.0`, `v2.0`)
   - Responses: Consistent `success` + `data`/`error` structure

3. **Code**:
   - JSDoc: Required for all functions (`@param`, `@returns`)
   - TODOs: Prioritized and dated
   - Deprecation: Clearly marked with alternatives

4. **Versioning**:
   - Semantic: `vMAJOR.MINOR.PATCH`
   - Tags: Annotated with release notes
   - Commits: Conventional format (`type(scope): subject`)

5. **Configuration**:
   - Feature flags: `ENABLE_[FEATURE]`
   - Environments: `development`, `staging`, `production`
   - Logging: Leveled (`[Debug]`, `[Info]`, `[Error]`)

6. **Taxonomies**:
   - Status: Exact values (`Pending`, `In Progress`, `Resolved`)
   - Office codes: Format `XXX-001`
   - Error codes: `CATEGORY_SPECIFIC_ERROR`

---

**Document Version**: 1.0  
**Last Updated**: January 9, 2025  
**Maintained By**: Development Team  
**Review Cycle**: Quarterly or when adding new taxonomies

---

## Additional Resources

- [JSDoc Documentation](https://jsdoc.app/)
- [Semantic Versioning](https://semver.org/)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [HTTP Status Codes](https://httpstatuses.com/)
- [Firestore Data Model](https://firebase.google.com/docs/firestore/data-model)
