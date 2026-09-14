# Folder Structure

## Organizing Principle

The Academia De San Jose Student Request Management System follows a **Type-Based Organization** pattern, where files are grouped by their technical type and purpose (components, styles, utilities, APIs) rather than by feature.

### Key Characteristics:
- **Separation by application role**: Student, Admin, Superadmin apps are completely separate
- **Type-based grouping**: Within each app, files are organized by type (components, styles, utils)
- **Shared backend services**: Email and Firebase functions are centralized
- **Monorepo structure**: All applications exist in a single repository

---

## Top-Level Folder Structure

```
ASJ/
├── student-app/          # Student portal application
├── admin-app/            # Staff/Admin portal application
├── superadmin-app/       # Superadmin portal application
├── email-backend/        # Email service (Gmail SMTP)
├── functions/            # Firebase Cloud Functions
├── node_modules/         # Root-level dependencies
├── .git/                 # Git version control
├── .vscode/              # VS Code workspace settings
├── *.md                  # Documentation files
├── firebase.json         # Firebase configuration
├── .gitignore           # Git ignore rules
└── package.json         # Root package configuration
```

---

## Application Folders (React Apps)

### student-app/

**Purpose**: Student-facing web portal for submitting and tracking requests

```
student-app/
├── api/                     # Serverless functions (Vercel)
│   ├── reset-password.js
│   ├── send-reset-code.js
│   ├── send-temporary-password.js
│   └── verify-reset-code.js
├── public/                  # Static assets
│   ├── index.html
│   ├── logo.jpg
│   └── school-*.jpg
├── src/                     # Source code
│   ├── components/          # React components
│   ├── styles/              # CSS stylesheets
│   ├── utils/               # Utility functions
│   ├── App.js               # Main application component
│   ├── App.css              # Main application styles
│   ├── firebase.js          # Firebase configuration
│   └── index.js             # Application entry point
├── .env                     # Environment variables (not in Git)
├── .env.example             # Environment variable template
├── package.json             # Dependencies and scripts
├── firebase.json            # Firebase hosting config
├── vercel.json              # Vercel deployment config
└── README.md                # Application documentation
```

---

### admin-app/

**Purpose**: Staff/Admin portal for managing and responding to student requests

```
admin-app/
├── public/                  # Static assets
│   ├── index.html
│   ├── logo.jpg
│   └── school-*.jpg
├── src/                     # Source code
│   ├── components/          # React components
│   ├── styles/              # CSS stylesheets
│   ├── utils/               # Utility functions
│   ├── hooks/               # Custom React hooks
│   ├── App.js               # Main application component
│   ├── firebase.js          # Firebase configuration
│   └── index.js             # Application entry point
├── .env                     # Environment variables (not in Git)
├── .env.example             # Environment variable template
├── package.json             # Dependencies and scripts
└── README.md                # Application documentation
```

---

### superadmin-app/

**Purpose**: Superadmin portal for system-wide management and user administration

```
superadmin-app/
├── public/                  # Static assets
│   └── index.html
├── src/                     # Source code
│   ├── components/          # React components
│   ├── styles/              # CSS stylesheets
│   ├── utils/               # Utility functions
│   ├── App.js               # Main application component
│   ├── firebase.js          # Firebase configuration
│   └── index.js             # Application entry point
├── .env                     # Environment variables (not in Git)
├── .env.example             # Environment variable template
├── package.json             # Dependencies and scripts
└── README.md                # Application documentation
```

---

## Backend Folders

### email-backend/

**Purpose**: Node.js/Express server for handling email operations via Gmail SMTP

```
email-backend/
├── node_modules/            # Dependencies
├── .env                     # Environment variables (not in Git)
├── .env.example             # Environment variable template
├── .gitignore               # Git ignore rules
├── package.json             # Dependencies and scripts
├── server.js                # Main server file
├── serviceAccountKey.json   # Firebase Admin SDK key (not in Git)
└── README.md                # Backend documentation
```

**Key Files**:
- `server.js`: Express server with email endpoints
- `serviceAccountKey.json`: Firebase Admin credentials (excluded from Git)

---

### functions/

**Purpose**: Firebase Cloud Functions for server-side operations

```
functions/
├── node_modules/            # Dependencies
├── .env                     # Environment variables (not in Git)
├── .env.example             # Environment variable template
├── .eslintrc.js             # ESLint configuration
├── .gitignore               # Git ignore rules
├── index.js                 # Cloud Functions definitions
├── package.json             # Dependencies and scripts
└── README.md                # Functions documentation
```

**Key Files**:
- `index.js`: All Firebase Cloud Functions
- `.eslintrc.js`: Google-style ESLint rules for Firebase

---

## Nested Structure Rules

### src/components/

**Purpose**: React component files (UI building blocks)

**Rules**:
- One component per file
- Component name matches file name (PascalCase)
- File extension: `.jsx` or `.js`

**Example**:
```
src/components/
├── Dashboard.jsx            # Main dashboard component
├── Login.jsx                # Login page component
├── MyRequest.jsx            # Request list component
├── NewRequest.jsx           # Request submission form
├── ProfileSettings.jsx      # User profile settings
├── BulletinBoard.jsx        # Announcements board
├── LoadingSpinner.jsx       # Loading indicator component
└── StatusBadge.jsx          # Request status badge component
```

---

### src/styles/

**Purpose**: CSS stylesheet files for component styling

**Rules**:
- One CSS file per component
- CSS file name matches component name (PascalCase)
- Shared styles can be in `shared.css` or `design-tokens.css`

**Example**:
```
src/styles/
├── Dashboard.css            # Dashboard component styles
├── Login.css                # Login page styles
├── MyRequest.css            # Request list styles
├── NewRequest.css           # Request form styles
├── ProfileSettings.css      # Profile settings styles
├── shared.css               # Shared/common styles
└── design-tokens.css        # CSS variables and tokens
```

**Naming Pattern**:
- Component: `Dashboard.jsx` → Styles: `Dashboard.css`
- Component: `MyRequest.jsx` → Styles: `MyRequest.css`

---

### src/utils/

**Purpose**: Utility functions and helper modules

**Rules**:
- Descriptive camelCase file names
- Export specific functions (named exports preferred)
- Group related utilities in one file

**Example**:
```
src/utils/
├── qrEncryption.js          # QR code encryption/decryption
├── contentModeration.js     # AI content validation
├── notificationHelper.js    # Notification management
└── etcHelper.js             # ETC calculation helpers
```

**Naming Pattern**:
- Purpose-based naming: `[purpose]Helper.js` or `[feature].js`
- Use camelCase: `qrEncryption.js`, `contentModeration.js`

---

### src/hooks/

**Purpose**: Custom React hooks (only in admin-app currently)

**Rules**:
- File names start with `use` prefix
- One hook per file
- Export default or named export

**Example**:
```
src/hooks/
└── useOfficeTickets.js      # Custom hook for office ticket management
```

---

### api/

**Purpose**: Serverless function endpoints (Vercel deployment)

**Rules**:
- One function per file
- Descriptive kebab-case file names
- Export default handler function

**Example**:
```
api/
├── send-reset-code.js           # Send password reset code
├── verify-reset-code.js         # Verify reset code
├── reset-password.js            # Reset user password
└── send-temporary-password.js   # Send temp password email
```

**Naming Pattern**:
- Action-based: `[verb]-[noun].js`
- Use kebab-case: `send-reset-code.js`, `verify-reset-code.js`

---

### public/

**Purpose**: Static assets served directly by the web server

**Rules**:
- All files publicly accessible
- No processing/bundling
- Lowercase or kebab-case names

**Example**:
```
public/
├── index.html               # HTML template
├── logo.jpg                 # Application logo
├── school-logo.jpg          # School logo
└── school-cover.jpg         # Cover image
```

---

## Folder Naming Conventions

### General Rules:
1. **Lowercase with hyphens**: Multi-word folders use kebab-case
   - ✅ `email-backend/`, `student-app/`, `admin-app/`
   - ❌ `EmailBackend/`, `studentApp/`, `AdminApp/`

2. **Singular for type folders**: Use singular form for type-based folders
   - ✅ `src/components/` (not `src/component/`)
   - ✅ `src/styles/` (not `src/style/`)
   - ✅ `src/utils/` (not `src/util/`)

3. **Descriptive names**: Folder name should clearly indicate its purpose
   - ✅ `email-backend/` - Clear purpose
   - ✅ `student-app/` - Clear user role
   - ❌ `backend/` - Too vague
   - ❌ `app/` - Too generic

---

## Folder Hierarchy Depth

### Maximum Depth: 3-4 levels

**Good** (3 levels):
```
student-app/
  └── src/
      └── components/
          └── Dashboard.jsx
```

**Acceptable** (4 levels):
```
student-app/
  └── src/
      └── styles/
          └── components/
              └── Dashboard.css
```

**Avoid** (too deep):
```
student-app/
  └── src/
      └── features/
          └── requests/
              └── components/
                  └── list/
                      └── RequestItem.jsx
```

**Reason**: Shallow hierarchies are easier to navigate and maintain.

---

## Special Files and Locations

### Configuration Files (Root of each app)

```
app/
├── .env                     # Environment variables
├── .env.example             # Template for environment variables
├── .gitignore               # Git ignore rules
├── .eslintrc.js             # ESLint configuration
├── package.json             # Dependencies and scripts
├── firebase.json            # Firebase configuration
├── vercel.json              # Vercel deployment config
└── README.md                # Application documentation
```

---

### Entry Points

Each application has a standard entry point:

```
src/
├── index.js                 # Application entry point (ReactDOM.render)
└── App.js                   # Main application component (routing, state)
```

**Purpose**:
- `index.js`: Bootstraps React application
- `App.js`: Contains main application logic and routing

---

### Firebase Configuration

Firebase config exists in two places:

```
# App-level (each React app)
src/firebase.js              # Firebase initialization and exports

# Project-level (root)
firebase.json                # Firebase project configuration
.firebaserc                  # Firebase project aliases
```

---

## Documentation Files (Root Level)

Documentation files are stored at the project root for easy access:

```
ASJ/
├── README.md                           # Project overview
├── CODE_NAMING_CONVENTION.md           # Naming standards
├── CODING_STANDARDS.md                 # Coding guidelines
├── ENVIRONMENT_VARIABLES_STANDARDS.md  # Env var documentation
├── FOLDER_STRUCTURE.md                 # This file
├── QR_CODE_SECURITY.md                 # QR security documentation
├── DEPLOYMENT.md                       # Deployment guide
└── FORGOT_PASSWORD_SETUP.md            # Feature documentation
```

---

## Module-Specific Rules

### Student App

**Additional folders**:
- `api/` - Serverless functions for password reset

**Key characteristics**:
- Contains QR code encryption utilities
- AI content moderation integration
- Guest request submission

---

### Admin App

**Additional folders**:
- `hooks/` - Custom React hooks for admin features

**Key characteristics**:
- QR code scanning functionality
- Request management and assignment
- Notifications system

---

### Superadmin App

**Key characteristics**:
- User management (create, archive, restore)
- System-wide analytics
- Archive management

---

### Email Backend

**Structure**:
- Single `server.js` file (no nested structure)
- Express REST API endpoints
- Nodemailer integration

---

### Firebase Functions

**Structure**:
- Single `index.js` file with all functions
- Firebase Functions framework
- Server-side operations

---

## Folder Creation Guidelines

### When to Create a New Folder

✅ **Create a new folder when**:
- You have 5+ files of the same type
- Files serve a distinct purpose/category
- Grouping improves code discoverability

❌ **Don't create a new folder when**:
- You have only 1-2 files
- The grouping is unclear or arbitrary
- It adds unnecessary hierarchy depth

---

### Example Decision Tree

**Scenario**: Adding authentication utilities

**Option 1** (Too granular):
```
src/
└── utils/
    └── auth/
        ├── validation.js
        └── tokenHelper.js
```

**Option 2** (Better):
```
src/
└── utils/
    ├── authValidation.js
    └── tokenHelper.js
```

**Reason**: Only 2 files don't justify a subfolder. Use descriptive names instead.

---

## Common Patterns

### Pattern 1: Component-Style Pairing

Every component has a matching CSS file:

```
src/
├── components/
│   ├── Dashboard.jsx
│   └── Login.jsx
└── styles/
    ├── Dashboard.css
    └── Login.css
```

---

### Pattern 2: Feature Utilities

Utilities are named after their feature/purpose:

```
src/utils/
├── qrEncryption.js          # QR-related functions
├── contentModeration.js     # Content validation
└── notificationHelper.js    # Notification functions
```

---

### Pattern 3: API Endpoints

Serverless functions follow action-based naming:

```
api/
├── send-reset-code.js       # POST /api/send-reset-code
├── verify-reset-code.js     # POST /api/verify-reset-code
└── reset-password.js        # POST /api/reset-password
```

---

## Summary

### Key Takeaways:

1. **Type-based organization**: Files grouped by technical type (components, styles, utils)
2. **Flat hierarchy**: Maximum 3-4 levels deep
3. **Consistent naming**: Folders use kebab-case, files follow their respective conventions
4. **One-to-one mapping**: Components and styles have matching names
5. **Clear purpose**: Every folder has a single, clear responsibility
6. **Minimal nesting**: Avoid over-organization with too many subfolders

---

**Document Version**: 1.0  
**Last Updated**: January 9, 2025  
**Maintained By**: Development Team
