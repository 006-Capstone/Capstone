# Environment Variables Standards

## Purpose

Environment variables are a critical component of the Academia De San Jose Student Request Management System. This document defines standards for managing configuration, secrets, and environment-specific settings.

### Why Environment Variables?

1. **Configuration Separation**: Keep configuration separate from code logic
2. **Security**: Prevent sensitive credentials from being committed to version control
3. **Portability**: Enable different configurations for development, staging, and production
4. **Team Collaboration**: Allow developers to use their own API keys without conflicts
5. **Deployment Flexibility**: Easy configuration changes without code modifications

---

## Table of Contents
1. [Naming Convention](#naming-convention)
2. [Storage Locations](#storage-locations)
3. [Variable Categories](#variable-categories)
4. [Security Practices](#security-practices)
5. [What to Store vs. Hardcode](#what-to-store-vs-hardcode)
6. [Platform-Specific Guidelines](#platform-specific-guidelines)
7. [Usage in Code](#usage-in-code)
8. [Troubleshooting](#troubleshooting)
9. [Deployment Checklist](#deployment-checklist)

---

## Naming Convention

### Standard Format: `UPPER_SNAKE_CASE`

All environment variables must use **SCREAMING_SNAKE_CASE** (uppercase with underscores).

```bash
# ✅ Correct
REACT_APP_GROQ_API_KEY=xxx
GMAIL_USER=example@gmail.com
FIREBASE_PROJECT_ID=project-id
NODE_ENV=production

# ❌ Incorrect
reactAppGroqApiKey=xxx        # Wrong case
React_App_Groq_Api_Key=xxx    # Mixed case
REACT-APP-GROQ-API-KEY=xxx    # Hyphens instead of underscores
```

---

### Prefixing Rules

#### React Applications
React environment variables **MUST** be prefixed with `REACT_APP_` to be accessible in the browser.

```bash
# ✅ Accessible in React
REACT_APP_GROQ_API_KEY=xxx
REACT_APP_EMAIL_API=http://localhost:5000
REACT_APP_QR_ENCRYPTION_KEY=xxx

# ❌ Not accessible in React (no REACT_APP_ prefix)
GROQ_API_KEY=xxx              # Won't work in React
EMAIL_API=http://localhost:5000  # Won't work in React
```

**Why?** Create React App only exposes variables prefixed with `REACT_APP_` to prevent accidental exposure of server-side secrets.

---

#### Backend/Node.js Applications
Backend variables do NOT need a prefix.

```bash
# Backend environment variables
GMAIL_USER=academiadesanjose3@gmail.com
GMAIL_APP_PASSWORD=xxx
PORT=5000
NODE_ENV=production
```

---

#### Firebase Functions
Firebase Cloud Functions use specific prefixes:

```bash
# Firebase Functions variables
FIREBASE_PROJECT_ID=academia-de-san-jose
FIREBASE_CLIENT_EMAIL=xxx@xxx.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n..."
```

---

### Descriptive Names

Variable names should clearly indicate their purpose:

```bash
# ✅ Good: Clear and descriptive
REACT_APP_GROQ_API_KEY           # Groq AI API key
REACT_APP_QR_ENCRYPTION_KEY      # QR code encryption key
GMAIL_USER                       # Gmail SMTP username
GMAIL_APP_PASSWORD               # Gmail app-specific password
FIREBASE_PROJECT_ID              # Firebase project identifier

# ❌ Bad: Ambiguous or unclear
KEY                              # Which key?
PASSWORD                         # Password for what?
API                              # Which API?
SECRET                           # Too vague
```

---

## Storage Locations

### 1. `.env` Files (Local Development)

Each application module has its own `.env` file:

```
ASJ/
├── student-app/
│   └── .env                    # Student portal environment variables
├── admin-app/
│   └── .env                    # Admin portal environment variables
├── superadmin-app/
│   └── .env                    # Superadmin portal environment variables
├── email-backend/
│   └── .env                    # Email service environment variables
└── functions/
    └── .env                    # Firebase Functions environment variables
```

**Important**: `.env` files are **NEVER** committed to version control (see `.gitignore`).

---

### 2. `.env.example` Files (Templates)

Each module should have a `.env.example` file showing required variables **without actual values**.

```bash
# student-app/.env.example

# Groq AI API Key for Content Moderation
# Get your API key from: https://console.groq.com/keys
REACT_APP_GROQ_API_KEY=your_groq_api_key_here

# QR Code Encryption Key (use a strong, unique secret key)
REACT_APP_QR_ENCRYPTION_KEY=your_secret_encryption_key_here

# Email API Endpoint (use localhost for development)
REACT_APP_EMAIL_API=http://localhost:5000
```

**Purpose**: 
- Document required environment variables
- Help new developers set up their local environment
- Provide instructions on where to obtain API keys

---

### 3. `.gitignore` Protection

All `.env` files and service account keys must be excluded from version control:

```bash
# .gitignore

# Environment variables (contains API keys and passwords)
.env
*/.env
**/.env

# Firebase service account keys (NEVER commit these!)
serviceAccountKey.json
*/serviceAccountKey.json
**/*serviceAccountKey.json

# Environment-specific files
.env.local
.env.development.local
.env.test.local
.env.production.local
```

---

### 4. Cloud Secrets Manager (Production)

For production deployments, use secure secret management:

#### Vercel (Frontend Deployment)
- Store in Vercel Dashboard → Project Settings → Environment Variables
- Support for different environments (Production, Preview, Development)

#### Firebase Functions (Backend)
```bash
# Set secret via Firebase CLI
firebase functions:config:set gmail.user="academiadesanjose3@gmail.com"
firebase functions:config:set gmail.password="app-specific-password"

# View configured secrets
firebase functions:config:get
```

#### AWS Secrets Manager / Google Secret Manager
For enterprise deployments, use dedicated secret management services.

---

## Variable Categories

### Category 1: API Keys & Tokens

**Sensitivity**: 🔴 **HIGH** - NEVER commit to version control

```bash
# External Service API Keys
REACT_APP_GROQ_API_KEY=gsk_xxx...xxx
RESEND_API_KEY=re_xxx...xxx

# Authentication Tokens
AUTH_TOKEN=xxx
REFRESH_TOKEN=xxx
```

**Rules**:
- ✅ Store in `.env` file
- ✅ Add to `.gitignore`
- ✅ Rotate regularly (every 3-6 months)
- ✅ Use separate keys for dev/staging/production
- ❌ Never hardcode in source code
- ❌ Never commit to Git
- ❌ Never share via email or chat

---

### Category 2: Credentials & Passwords

**Sensitivity**: 🔴 **HIGH** - NEVER commit to version control

```bash
# Email Service Credentials
GMAIL_USER=academiadesanjose3@gmail.com
GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx

# Database Credentials
DB_USERNAME=admin
DB_PASSWORD=SecureP@ssw0rd

# Firebase Admin Credentials
FIREBASE_CLIENT_EMAIL=xxx@xxx.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n..."
```

**Rules**:
- ✅ Use app-specific passwords (not account passwords)
- ✅ Enable 2FA on all service accounts
- ✅ Store in secure secret managers for production
- ✅ Use different credentials per environment
- ❌ Never use personal email passwords
- ❌ Never share credentials in plain text

---

### Category 3: Encryption Keys & Secrets

**Sensitivity**: 🔴 **HIGH** - NEVER commit to version control

```bash
# Application-specific encryption keys
REACT_APP_QR_ENCRYPTION_KEY=ASJ_SecureQRCode_2024_Academia_De_San_Jose_Private_Key
SESSION_SECRET=random-32-char-string-here
JWT_SECRET=another-random-secret-key

# Hashing salts
PASSWORD_SALT=bcrypt-salt-rounds
```

**Rules**:
- ✅ Use cryptographically random keys (min 32 characters)
- ✅ Generate different keys for each environment
- ✅ Never reuse keys across projects
- ❌ Never use predictable patterns (no "password123" or "secret")
- ❌ Never store encryption keys in the same database they encrypt

**How to generate secure keys**:
```bash
# Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# OpenSSL
openssl rand -hex 32

# Online (use with caution)
# https://www.random.org/strings/
```

---

### Category 4: Service URLs & Endpoints

**Sensitivity**: 🟡 **MEDIUM** - Environment-specific but not secret

```bash
# API Endpoints
REACT_APP_EMAIL_API=http://localhost:5000
REACT_APP_API_URL=https://api.example.com

# Database URLs
DATABASE_URL=postgresql://localhost:5432/asj_db

# External Service URLs
GROQ_API_URL=https://api.groq.com/openai/v1
```

**Rules**:
- ✅ Store in `.env` for environment-specific URLs
- ✅ Use localhost for development
- ✅ Use production URLs in production `.env`
- ⚠️ Can be committed to `.env.example` with example values
- ❌ Don't hardcode URLs in source code

---

### Category 5: Feature Flags & Configuration

**Sensitivity**: 🟢 **LOW** - Can be version controlled

```bash
# Feature flags
ENABLE_AI_MODERATION=true
ENABLE_TWO_FACTOR_AUTH=false
MAX_UPLOAD_SIZE=5242880          # 5MB in bytes

# Environment
NODE_ENV=development             # development | production | test
PORT=5000

# Logging
LOG_LEVEL=debug                  # debug | info | warn | error
```

**Rules**:
- ✅ Can be stored in `.env` or hardcoded
- ✅ Can be committed to `.env.example`
- ✅ Use boolean values (true/false) for flags
- ✅ Document what each flag does

---

### Category 6: Firebase Project Configuration

**Sensitivity**: 🟡 **MEDIUM** - Project identifiers (not secret but sensitive)

```bash
# Firebase Project Info
FIREBASE_PROJECT_ID=academia-de-san-jose
FIREBASE_STORAGE_BUCKET=academia-de-san-jose.appspot.com
FIREBASE_MESSAGING_SENDER_ID=123456789012
FIREBASE_APP_ID=1:123456789012:web:abc123def456

# Firebase Admin SDK
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@academia-de-san-jose.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nXXX\n-----END PRIVATE KEY-----\n"
```

**Rules**:
- ✅ Project ID and public identifiers can be in `.env.example`
- ✅ Use Firebase security rules to protect data
- ❌ NEVER commit private keys or client secrets
- ❌ NEVER commit `serviceAccountKey.json`

---

## Security Practices

### 1. Never Commit Secrets to Git

**Critical Rule**: `.env` files must ALWAYS be in `.gitignore`

```bash
# .gitignore
.env
*/.env
**/.env
serviceAccountKey.json
```

**Why?** Git history is permanent. Once committed, secrets are exposed forever (even if deleted in later commits).

---

### 2. Use `.env.example` Templates

Always provide `.env.example` files with placeholder values:

```bash
# ✅ Good: .env.example (safe to commit)
REACT_APP_GROQ_API_KEY=your_groq_api_key_here
GMAIL_USER=your-email@gmail.com
GMAIL_APP_PASSWORD=your-16-char-app-password

# ❌ Bad: .env.example with real values (NEVER do this)
REACT_APP_GROQ_API_KEY=gsk_vxj9yxSG2bFxWHNUhytqWGdyb3FY...
GMAIL_USER=academiadesanjose3@gmail.com
GMAIL_APP_PASSWORD=fgkbieolymbu wlwq
```

---

### 3. Rotate Secrets Regularly

**Best Practice**: Rotate API keys and passwords every 3-6 months

```bash
# Keep track of when secrets were last rotated
# REACT_APP_GROQ_API_KEY - Last rotated: 2024-01-15
# GMAIL_APP_PASSWORD - Last rotated: 2024-01-20
```

**How to rotate**:
1. Generate new API key/password
2. Update `.env` file with new value
3. Restart application
4. Revoke old API key/password
5. Update production environment variables

---

### 4. Principle of Least Privilege

**Only include variables that are actually needed**:

```bash
# ✅ Good: Only necessary variables
REACT_APP_GROQ_API_KEY=xxx
REACT_APP_EMAIL_API=http://localhost:5000

# ❌ Bad: Unnecessary variables
REACT_APP_ADMIN_PASSWORD=xxx     # Frontend shouldn't have admin password
REACT_APP_DATABASE_URL=xxx       # Frontend shouldn't access database directly
```

---

### 5. Separate Environments

Use different values for different environments:

```bash
# Development (.env.development)
REACT_APP_EMAIL_API=http://localhost:5000
NODE_ENV=development

# Staging (.env.staging)
REACT_APP_EMAIL_API=https://staging-api.example.com
NODE_ENV=staging

# Production (.env.production)
REACT_APP_EMAIL_API=https://api.example.com
NODE_ENV=production
```

---

### 6. Secure Service Account Keys

**Firebase `serviceAccountKey.json`**:

```bash
# ❌ NEVER commit this file
serviceAccountKey.json

# ✅ Always in .gitignore
serviceAccountKey.json
*/serviceAccountKey.json
**/*serviceAccountKey.json
```

**How to handle**:
1. Download from Firebase Console → Project Settings → Service Accounts
2. Store locally in project root (ignored by Git)
3. For production, use environment variables instead:

```bash
# Instead of file, use env vars
FIREBASE_PROJECT_ID=academia-de-san-jose
FIREBASE_CLIENT_EMAIL=xxx@xxx.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nXXX\n-----END PRIVATE KEY-----\n"
```

---

### 7. Validate Environment Variables

**Always validate required variables at startup**:

```javascript
// server.js or index.js
const requiredEnvVars = [
  'GMAIL_USER',
  'GMAIL_APP_PASSWORD',
  'FIREBASE_PROJECT_ID'
];

requiredEnvVars.forEach((varName) => {
  if (!process.env[varName]) {
    console.error(`[Error] Missing required environment variable: ${varName}`);
    process.exit(1);
  }
});

console.log('[Success] All required environment variables are set');
```

---

## What to Store vs. Hardcode

### ✅ Store in Environment Variables:

| Type | Examples | Reason |
|------|----------|--------|
| **API Keys** | `REACT_APP_GROQ_API_KEY` | Secret, changes per environment |
| **Passwords** | `GMAIL_APP_PASSWORD` | Secret, should never be in code |
| **Encryption Keys** | `REACT_APP_QR_ENCRYPTION_KEY` | Secret, unique per deployment |
| **URLs** | `REACT_APP_EMAIL_API` | Changes per environment (localhost vs production) |
| **Service Credentials** | `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` | Secret, environment-specific |
| **Feature Flags** | `ENABLE_AI_MODERATION` | Configuration that may change |
| **Port Numbers** | `PORT=5000` | Changes per environment |
| **Database URLs** | `DATABASE_URL` | Changes per environment |

---

### ❌ DON'T Store in Environment Variables (Hardcode Instead):

| Type | Examples | Reason |
|------|----------|--------|
| **Business Logic** | Status values (`Pending`, `Resolved`) | Part of application logic |
| **UI Text** | Button labels, messages | Part of application code |
| **Static Configuration** | Office codes (`FIN-001`) | Doesn't change per environment |
| **Constants** | `MAX_FILE_SIZE = 5MB` | Can be hardcoded unless needs to vary |
| **Validation Rules** | Min/max lengths | Part of business logic |

```javascript
// ✅ Good: Hardcoded constants
const OFFICE_CODES = {
  'FIN-001': 'Finance',
  'LIB-001': 'Library',
  'REG-001': 'Registrar',
  'GUI-001': 'Guidance'
};

const MAX_DESCRIPTION_LENGTH = 1000;

// ❌ Bad: Unnecessary env variables
process.env.OFFICE_CODE_FINANCE        // Not needed
process.env.MAX_DESCRIPTION_LENGTH     // Not needed
```

---

## Platform-Specific Guidelines

### React Applications

#### Accessing Environment Variables

```javascript
// ✅ Correct: Access with process.env
const apiKey = process.env.REACT_APP_GROQ_API_KEY;
const apiUrl = process.env.REACT_APP_EMAIL_API;

// ❌ Incorrect: These won't work
const apiKey = REACT_APP_GROQ_API_KEY;  // ReferenceError
const apiKey = window.REACT_APP_GROQ_API_KEY;  // Undefined
```

#### Default Values / Fallbacks

```javascript
// ✅ Good: Provide fallback values
const apiUrl = process.env.REACT_APP_EMAIL_API || 'http://localhost:3000';
const encryptionKey = process.env.REACT_APP_QR_ENCRYPTION_KEY || '';

// With validation
if (!encryptionKey) {
  console.error('[Error] QR encryption key not configured');
}
```

#### Environment-Specific Files

Create React App supports multiple `.env` files:

```bash
.env                    # Default (all environments)
.env.local              # Local overrides (ignored by Git)
.env.development        # Development environment
.env.test               # Test environment
.env.production         # Production environment
```

**Priority** (highest to lowest):
1. `.env.local`
2. `.env.[environment].local`
3. `.env.[environment]`
4. `.env`

---

### Node.js Backend

#### Loading Environment Variables

```javascript
// Load at the very beginning of your app
require('dotenv').config();

// Or with path
require('dotenv').config({ path: './.env' });

// Validate required variables
if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
  console.error('[Error] Missing required environment variables');
  process.exit(1);
}
```

#### Type Conversion

```javascript
// ✅ Good: Convert to appropriate types
const port = parseInt(process.env.PORT) || 5000;
const enableFeature = process.env.ENABLE_FEATURE === 'true';
const maxSize = parseInt(process.env.MAX_UPLOAD_SIZE) || 5242880;

// ❌ Bad: Using strings as numbers/booleans
const port = process.env.PORT;  // This is a string!
if (process.env.ENABLE_FEATURE) { /* Always true, even if "false" */ }
```

---

### Firebase Functions

#### Setting Environment Variables

```bash
# Set variable
firebase functions:config:set gmail.user="academiadesanjose3@gmail.com"
firebase functions:config:set gmail.password="app-password"

# Get all variables
firebase functions:config:get

# Delete variable
firebase functions:config:unset gmail.password
```

#### Accessing in Functions

```javascript
const functions = require('firebase-functions');

exports.sendEmail = functions.https.onRequest((req, res) => {
  const gmailUser = functions.config().gmail.user;
  const gmailPassword = functions.config().gmail.password;
  
  // Use credentials...
});
```

---

### Vercel Deployment

#### Setting Environment Variables

1. Go to Vercel Dashboard
2. Select your project
3. Go to Settings → Environment Variables
4. Add variables with appropriate scope:
   - **Production**: Only available in production
   - **Preview**: Available in preview/staging
   - **Development**: Available in local development

#### Accessing in Vercel Functions

```javascript
// api/endpoint.js
export default function handler(req, res) {
  const apiKey = process.env.GROQ_API_KEY;
  const firebaseKey = process.env.FIREBASE_PRIVATE_KEY;
  
  // Vercel automatically loads environment variables
  // No need for dotenv
}
```

---

## Usage in Code

### Best Practices

```javascript
// ✅ Good: Load once at module level
const GROQ_API_KEY = process.env.REACT_APP_GROQ_API_KEY;
const EMAIL_API = process.env.REACT_APP_EMAIL_API || 'http://localhost:3000';

export function useGroqAI() {
  // Use GROQ_API_KEY here
}

// ❌ Bad: Load every time function is called
export function useGroqAI() {
  const key = process.env.REACT_APP_GROQ_API_KEY;  // Wasteful
}
```

---

### Error Handling

```javascript
// ✅ Good: Validate and provide helpful error messages
const ENCRYPTION_KEY = process.env.REACT_APP_QR_ENCRYPTION_KEY;

if (!ENCRYPTION_KEY) {
  throw new Error(
    'QR encryption key not configured. ' +
    'Please set REACT_APP_QR_ENCRYPTION_KEY in your .env file. ' +
    'See .env.example for instructions.'
  );
}

export const encryptCredentials = (studentId, password) => {
  // Safe to use ENCRYPTION_KEY here
};
```

---

### Security in Frontend

```javascript
// ⚠️ Warning: Environment variables in React are PUBLIC
// They are bundled into the JavaScript and can be viewed by anyone

// ✅ OK for frontend: API keys with usage limits
REACT_APP_GROQ_API_KEY=xxx  // OK if you have rate limiting

// ❌ NEVER in frontend: Passwords, private keys, admin secrets
REACT_APP_ADMIN_PASSWORD=xxx     // ❌ NEVER!
REACT_APP_DATABASE_PASSWORD=xxx  // ❌ NEVER!
REACT_APP_SECRET_KEY=xxx         // ❌ NEVER!
```

**Rule**: Only expose to frontend what you're comfortable with users seeing.

---

## Troubleshooting

### Problem 1: Environment Variable Not Working

**Symptoms**: `undefined` or `null` value

**Solutions**:

```bash
# 1. Check if .env file exists
ls -la

# 2. Verify variable name (must have REACT_APP_ prefix for React)
# ❌ Wrong
GROQ_API_KEY=xxx

# ✅ Correct
REACT_APP_GROQ_API_KEY=xxx

# 3. Restart development server (React doesn't hot-reload .env)
npm start

# 4. Check for typos
# Variable name in .env MUST match code exactly
```

---

### Problem 2: Changes Not Reflecting

**Solution**: Restart the development server

```bash
# React apps need restart for .env changes
# Stop server (Ctrl+C)
# Start again
npm start
```

---

### Problem 3: Multi-line Values (Private Keys)

**Problem**: Firebase private keys contain newlines

**Solution**: Use quotes and escape newlines

```bash
# ✅ Correct
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBg...\n-----END PRIVATE KEY-----\n"

# In code, replace \\n with \n
const privateKey = process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');
```

---

### Problem 4: Spaces in Values

**Problem**: Values with spaces break parsing

**Solution**: Use quotes

```bash
# ❌ Wrong
GMAIL_APP_PASSWORD=fgkb ieol ymbu wlwq

# ✅ Correct (no spaces)
GMAIL_APP_PASSWORD=fgkbieolymbu wlwq

# ✅ Or use quotes if spaces needed
APP_NAME="Academia De San Jose"
```

---

## Deployment Checklist

### Before Deploying

- [ ] All `.env` files are in `.gitignore`
- [ ] No secrets committed to Git history
- [ ] `.env.example` files are up to date
- [ ] Production environment variables are configured in deployment platform
- [ ] Different API keys/credentials for production (not reusing dev keys)
- [ ] All required variables are documented

---

### Setting Up New Environment

1. **Copy `.env.example` to `.env`**
   ```bash
   cp .env.example .env
   ```

2. **Fill in actual values**
   ```bash
   # Edit .env and replace placeholders
   nano .env
   ```

3. **Validate configuration**
   ```bash
   # Run validation script or start app
   npm start
   ```

4. **Test thoroughly**
   - Verify all features work
   - Check API connections
   - Test authentication

---

### Production Deployment

#### Vercel

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy with environment variables
vercel --prod

# Or set via dashboard:
# Vercel Dashboard → Project → Settings → Environment Variables
```

#### Firebase Functions

```bash
# Set production variables
firebase functions:config:set gmail.user="xxx" gmail.password="xxx"

# Deploy
firebase deploy --only functions
```

---

## Environment Variables Reference

### Student App (`student-app/.env`)

```bash
# AI Content Moderation
REACT_APP_GROQ_API_KEY=your_groq_api_key_here

# QR Code Security
REACT_APP_QR_ENCRYPTION_KEY=your_encryption_key_here

# Backend API
REACT_APP_EMAIL_API=http://localhost:5000
```

---

### Admin App (`admin-app/.env`)

```bash
# Backend API
REACT_APP_EMAIL_API=http://localhost:5000
```

---

### Superadmin App (`superadmin-app/.env`)

```bash
# Backend API
REACT_APP_EMAIL_API=http://localhost:5000
```

---

### Email Backend (`email-backend/.env`)

```bash
# Gmail SMTP
GMAIL_USER=your-email@gmail.com
GMAIL_APP_PASSWORD=your-16-char-password

# Server Configuration
PORT=5000
NODE_ENV=development

# Optional: Alternative email service
RESEND_API_KEY=your-resend-api-key
```

---

### Firebase Functions (`functions/.env`)

```bash
# Firebase Admin SDK
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=xxx@xxx.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nXXX\n-----END PRIVATE KEY-----\n"
```

---

## Summary

### Key Takeaways

1. **NEVER commit `.env` files** or secrets to Git
2. **Always use `UPPER_SNAKE_CASE`** for variable names
3. **React variables MUST start with `REACT_APP_`**
4. **Provide `.env.example`** templates for documentation
5. **Rotate secrets regularly** (every 3-6 months)
6. **Use different credentials** for dev/staging/production
7. **Validate required variables** at application startup
8. **Only expose to frontend what's safe** for public viewing

---

**Document Version**: 1.0  
**Last Updated**: January 9, 2025  
**Maintained By**: Development Team  
**Review Cycle**: Quarterly or when adding new services

---

## Additional Resources

- [Twelve-Factor App: Config](https://12factor.net/config)
- [Create React App: Environment Variables](https://create-react-app.dev/docs/adding-custom-environment-variables/)
- [dotenv Documentation](https://github.com/motdotla/dotenv)
- [Firebase Functions Configuration](https://firebase.google.com/docs/functions/config-env)
- [Vercel Environment Variables](https://vercel.com/docs/concepts/projects/environment-variables)
