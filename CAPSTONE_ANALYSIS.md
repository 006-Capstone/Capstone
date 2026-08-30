# Academia De San Jose — School Request & Ticketing System (Analysis)

Read-only analysis of the three client apps under `C:\Users\user\School\Capstone`:
`student-app`, `admin-app`, `superadmin-app`, plus their supporting backend code
(`email-backend`, `functions`, Vercel serverless `api/`).

All three apps use the **same Firebase project**: `academia-de-san-jose`
(identical `src/firebase.js`, apiKey `AIzaSyBeoTH1ZiOaifIf214ZSFsD0vOT6C_FoL4`).
Each app runs on its own dev port:

| App | Port | Purpose |
| --- | --- | --- |
| student-app | 3000 (CRA default) | Students submit/​track requests, give feedback, read announcements |
| admin-app | 3001 | Office staff claim/manage/resolve tickets, post announcements, view analytics |
| superadmin-app | 3002 | Super admin: create/suspend/delete users, edit the request form config, full analytics |
| email-backend | 5000 (Express) | Forgot-password reset codes + credential emails (local) |

---

## A. App Overview

### 1. Student App
- **Purpose:** Self-service portal where students log in with a 4-digit Student ID, submit requests to school offices, track their request status, reply/ask for follow-up, give star feedback, and read the bulletin board and FAQs.
- **Users / role:** Students (4-digit ID + password login). Also supports **Guest mode** — a visitor can submit a request using a request number + office code with a "Guest Request", without creating an account.
- **Extra dependencies vs others:** `crypto-js`, `html5-qrcode`, `react-qr-scanner`, `qrcode`, `groq-sdk`.

### 2. Admin App
- **Purpose:** Office-admin workbench. Staff members log in by picking their office (Finance, Library, Registrar, Guidance) + username + password, then manage tickets for their office only.
- **Users / role:** Staff/Office admins. Accounts are created by the super admin; staff must change their temporary password on first login (`mustChangePassword`).
- **Extra dependencies:** only `firebase` + `react-icons` (leanest frontend).

### 3. Super Admin App
- **Purpose:** Administrative control panel. Lets the super admin see school-wide stats/analytics, create student and staff accounts (auto-generates credentials and emails them), suspend/activate/delete accounts, and edit the shared **request form configuration** (office descriptions + request subjects) that the student app renders.
- **Users / role:** Super admin (username + password, `signInWithEmailAndPassword` against the `superadmin` collection).
- **Extra dependencies:** `nodemailer`, `react-router-dom` (declared but the app actually uses manual page switching, not routes).

---

## B. Pages / Components

### Student App (`src/components`, 23 files)
| Page/Component | Purpose |
| --- | --- |
| `Login.jsx` | 4-digit Student ID + password; **QR code login** (scans encrypted QR, decrypts via `qrEncryption`); remember device; entry to Forgot Password and Guest mode |
| `GuestLogin.jsx` | Request number + office code; submits guest request (subject/description per office, optional attachment + auth file) |
| `ForgotPassword.jsx` | 3-step reset: Student ID → email 6-digit code → new password (60s expiry timer, resend) |
| `ChangePasswordModal.jsx` | Mandatory "change temporary password" on first login (min 8 chars, upper/lower/digit) |
| `Header.jsx` | Brand, notification bell (live unread count), profile setting trigger, mobile menu |
| `Sidebar.jsx` | Page nav; feedback submenu (My Feedback, Guidance, Library, Registrar, Finance); unread-bulletin indicator |
| `Dashboard.jsx` | Stat cards (Total / Pending / In Process / Resolved) seeded from student's requests; clicking a card opens Request History pre-filtered by status |
| `MyRequest.jsx` | Request history: search, status filter (Pending / In Process / Resolved / Cancelled / Returned / For Follow Up), office filter, pagination (8/page) |
| `RequestDetails.jsx` | Single request detail (fetches the fresh doc by id); comments, follow-up attachments, status timeline, notify-staff button |
| `NewRequest.jsx` | Compose request: office + subject + description; client-side image compression (≤1280px, ~0.9 MiB base64); **Groq AI content moderation** |
| `Feedback.jsx` | Star ratings (response time, helpfulness) + comment + follow-up flag; reused for My Feedback and per-office feedback (`feedback-*` routes) |
| `MyFeedback.jsx` | Live list of the student's own feedback |
| `BulletinBoard.jsx` | Announcements + important/deadline dates (hero item + list, real-time) |
| `FAQs.jsx` | Static accordion FAQ |
| `IdleTimeout.jsx` | Auto-logout after ~4.5 min idle with 30s warning; disabled for guests |
| `Notifications.jsx`, `AnnouncementCard.jsx`, `Brand.jsx`, `Breadcrumb.jsx`, `FilterDropdown.jsx`, `LoadingSpinner.jsx`, `StatusBadge.jsx` | Shared/utility UI (bell panel, announcement card, logo, breadcrumb, filters, spinner, status pill) |
| `ProfileSettings.jsx` | Edit profile fields, upload profile picture (Storage), change password (with re-auth), generate own login QR |

### Admin App (`src/components`, 14 files)
| Page/Component | Purpose |
| --- | --- |
| `Login.jsx` | Office picker (finance/library/guidance/registrar) + username + password; looks up `staff` by `username` + `officeId`; checks `isActive` |
| `ForgotPassword.jsx` | Same 3-step email-code reset as student app but keyed off **username** |
| `ChangePasswordModal.jsx` | Mandatory first-login temp-password change (writes `mustChangePassword:false`, `passwordLastChanged`) |
| `AdminSidebar.jsx` | Office wall dashboard nav + logout |
| `AdminDashboard.jsx` | Office stats: total / unassigned / claimed / resolved (via `useOfficeTickets`); ticket tabs; notifications |
| `MyTickets.jsx` | Office ticket list: search, status filter (New Requests / In Progress / Resolved / Rejected), time filter |
| `TicketDetails.jsx` | Full ticket view: reply with file attachments, claim/resolve/cancel actions, **reassign modal** (office, urgency, note), notifies student/staff |
| `Analytics.jsx` | Office-level charts: monthly volume, status distribution, per-subject breakdown; date-range filter |
| `BulletinBoard.jsx` | Staff create/edit/delete announcements + deadlines (compressed image upload), featured hero card |
| `Feedback.jsx` | **Static demo feedback** (4 hard-coded entries) - no live student-feedback query; replies appended via `arrayUnion` |
| `Notifications.jsx`, `ProfileSettings.jsx`, `DateRangeFilterDropdown.jsx` | Bell panel (same pattern), profile editing (position/office/staffId read-only), date range picker |
| `LoadingSpinner.jsx` | Shared spinner (fullscreen + inline) |

### Super Admin App (`src/components`, 10 files)
| Page/Component | Purpose |
| --- | --- |
| `Login.jsx` | Username + password; queries `superadmin` collection, checks `isActive`, then `signInWithEmailAndPassword` |
| `SuperAdminSidebar.jsx` | Nav: Dashboard, Edit Request Form, Analytics, User Management; logout (clears localStorage) |
| `SuperAdminDashboard.jsx` | School-wide stats: total requests, **avg resolution time** (`createdAt`→`resolvedAt` of Resolved), cancelled rate, active users (students+staff); per-department bar chart with date filter |
| `EditRequestForm.jsx` | Edits `config/requestForm` doc: office descriptions + subjects per office; add/edit/delete subjects; Save only enabled on real changes |
| `Analytics.jsx` | Rich analytics: request-volume trends by semester (1st: Jun–Dec, 2nd: Jan–Apr), student satisfaction (rating % + 5-star/4-star counts, per-office filter), department efficiency table; **Export CSV** |
| `UserManagement.jsx` | Student/Staff tabs: create accounts (auto password + email via Vercel API), search/filter/sort/paginate, suspend/activate/delete (confirmation modals) |
| `SuperAdminHeader.jsx`, `NotificationBell.jsx`, `DateRangeFilterDropdown.jsx`, `LoadingSpinner.jsx` | Header, notification bell (`recipientType == 'superadmin'`), shared filter, spinner |

---

## C. App Functionalities (by category)

### Authentication & Accounts
- **Student:** find `students` doc by 4-digit `id`/`studentId`; verify password against Firebase Auth; supports QR-based login (`AES`-encrypted QR, signature `ASJ_STUDENT_QR`); remember-device flag; guest path requires request number + office code instead of an account.
- **Admin/Staff:** login by `username` + `officeId` (department-specific), suspended accounts rejected (`isActive`).
- **Super admin:** `superadmin` collection lookup + Firebase email/password auth.
- **First-login password change:** `mustChangePassword` flag on students and staff forces `ChangePasswordModal` (Firebase `updatePassword` + Firestore flag update).
- **Forgot password:** 3-step code flow handled by the local Express backend on port 5000 (`/api/send-reset-code` → `/api/verify-reset-code` → `/api/reset-password`), code expires in 60s.

### Request / Ticket Lifecycle
- Student creates request → `requests` doc with office, officeId, subject, description, student refs, status (e.g. `Pending`), `createdAt`.
- Staff see only their office's requests (`useOfficeTickets`, live snapshot, 12s timeout).
- Staff can claim (assigned/In Progress), resolve (`resolvedAt` timestamp), reject/cancel, and **reassign** to another office with urgency + note; students get notifications on status changes and comments.
- Admin creates notification docs (e.g. `notifyStaffNewRequest`, `notifyStudentStatusChange`, `notifyStaffReassignment`) in `notifications`.

### Notifications (all three apps)
- Single `notifications` collection filtered by `recipientType` (`student` / `staff` / `superadmin`) + `recipientId`.
- Live unread badge via `onSnapshot`; single + mark-all-as-read; time-ago labels; clicking a ticket notification opens the request/ticket detail.

### Content / Media
- **Image compression:** request attachments & announcements scaled to ≤1280px and ~0.9 MiB base64 before store.
- **AI moderation (student only):** `groq-sdk` validates the request description (`validateContent`, 20–1000 characters) before submission.
- **QR:** `qrcode` generation of encrypted student credentials + `react-qr-scanner`/`html5-qrcode` scan-to-login; `ProfileSettings` lets students re-generate their own QR.
- **Profile picture upload** to Firebase Storage (student + staff profile settings).

### Bulletin Board
- `announcements` collection (`announcement` vs `deadline` types, optional `featured` hero).
- Students: read-only, live, tracks read IDs (`readAnnouncements` in localStorage) to badge the sidebar.
- Staff: full CRUD. Super admin: no bulletin page (not part of their nav).

### Feedback
- Students submit star ratings (response time, helpfulness), overall rating, optional follow-up flag, comments.
- Admin app currently shows **static demo entries** (not the real `feedback` data) — a known gap.
- Superadmin Analytics computes satisfaction % from real `feedback` docs (`overallRating`/`rating`, filterable per office).

### Analytics
- **Admin:** current office only — status/subject/monthly breakdowns.
- **Superadmin:** school-wide — total requests, avg resolution time, cancelled rate, active users, semester volume trends, department efficiency table, satisfaction, and **CSV export**.

### User Management (super admin only)
- Create student (4-digit ID uniqueness, grade level, section) or staff (username, office assignment); generates an 8-char random password; creates the Firebase Auth account; writes `students`/`staff` docs with `mustChangePassword:true`; emails credentials.
- Search, status filter (All/Active/Suspended), office filter (staff), sort (recent/A–Z/Z–A), pagination (8/page).
- Suspend/activate (toggles `isActive`) and delete (removes Firestore doc; auth user remains, per code comment).

---

## D. User Actions (page-by-page)

### Student
- Login with ID+password or scanned QR; Forgot Password; guest submission without login.
- Dashboard: click stat cards to jump to filtered request history; view request details.
- Requests: new request (office/subject/description + image + moderation), view history with filters/search/pagination, view details, add comments + follow-up files, get staff updates.
- Feedback: rate resolved requests, view own feedback list, per-office feedback entry.
- Bulletin Board: read announcements/deadlines (real-time).
- Profile: edit personal details, upload photo, change password, generate QR.
- FAQ browsing; auto idle logout.

### Admin / Staff
- Login by office + username; forced password change on first login.
- Dashboard: office ticket stats, jump into ticket lists.
- Tickets: search + status filter, open details, reply with attachments, claim/resolve/cancel, reassign to another office with urgency and note.
- Bulletin board: create/edit/delete posts and deadlines (with image).
- Feedback: view demo feedback and reply (seed data).
- Analytics: office-level charts with date range.
- Notifications: view, mark read / mark all read, open linked tickets.
- Profile settings: edit profile, upload photo, change password.

### Super Admin
- Login (username+password); logout clears storage.
- Dashboard: global KPIs + per-department request bars with date filter.
- Edit Request Form: pick an office, edit its description (card or section), add/rename/delete subjects, save all changes to `config/requestForm`.
- Analytics: filter by date range and office; switch semesters; export CSV report.
- User Management: create accounts (auto credentials, emailed), search/filter/sort/paginate, suspend/activate/delete with confirm modals.
- Notifications bell (`superadmin` type).

---

## E. Data & Connections

### Firebase services
| Service | Usage |
| --- | --- |
| Firebase Auth | Student/staff/superadmin authentication; password changes; first-login flags |
| Firestore (`db`) | All app data (see collections) |
| Firebase Storage | Profile pictures; request/attachment uploads |
| Analytics | Initialized but no explicit tracking calls observed |

### Firestore collections
| Collection | Key fields used |
| --- | --- |
| `students` | id (4-digit), uid, firstName/lastName/middleName/middleInitial/suffix, name/fullName, gradeLevel, section, email, role 'student', createdAt, isActive, mustChangePassword |
| `staff` | uid, username, email, name/fullName, office + officeId, role 'staff', isActive, mustChangePassword, createdAt |
| `superadmin` | username, email, uid, isActive |
| `requests` | office/officeId, subject, description, status, studentUid/studentId, createdAt, resolvedAt, comments, follow-up files, reassignOffice/urgencyLevel/reassignNote, previousRequestId |
| `notifications` | recipientId + recipientType (student/staff/superadmin), type, title, message, metadata, isRead, readAt, createdAt |
| `feedback` | studentUid, office/officeId, ratings (responseTime, helpfulness), overallRating, comments, followUp, createdAt |
| `announcements` | title, detail/description, type (announcement/deadline), featured, date, createdAt |
| `config` | doc `requestForm` → `{ offices: [{ id, name, description, subjects[] }] }` |

### localStorage keys
| App | Keys |
| --- | --- |
| student-app | `studentLoggedIn`, `studentIsGuest`, `studentData`, `studentActivePage`, `readAnnouncements` |
| admin-app | `staffData`, `adminActivePage` |
| superadmin-app | `superadminAuth`, `superadminActivePage`, `superadminData` |

### Environment variables
| Where | Vars | Notes |
| --- | --- | --- |
| student-app `.env.example` | `REACT_APP_GROQ_API_KEY`, `REACT_APP_QR_ENCRYPTION_KEY` | moderation + QR secret |
| superadmin-app `.env.example`/vercel.json | `GMAIL_USER`, `GMAIL_APP_PASSWORD` (Vercel: `@gmail_user`, `@gmail_app_password`) | credential emails |
| email-backend `.env.example` | `GMAIL_USER`, `GMAIL_APP_PASSWORD` (+ optional `RESEND_API_KEY`, `BREVO`) | reset codes + credentials |
| functions `.env.example` | `GMAIL_USER`, `GMAIL_APP_PASSWORD` | credentials emails |
| admin-app | no `.env.example` | uses none |

### Backend endpoints
- **email-backend (Express, `localhost:5000`)** — used by student-app and admin-app Forgot Password flows, and referenced by superadmin-app in development:
  - `POST /api/send-reset-code`, `POST /api/verify-reset-code`, `POST /api/clear-reset-code`, `POST /api/reset-password` (verification codes in-memory `Map`, 60s expiry; password reset needs Firebase Admin `serviceAccountKey.json`)
  - `POST /api/send-credentials`, `POST /api/send-staff-credentials` (credential emails via Gmail SMTP)
  - `POST /api/delete-user` (Firebase Admin, optional)
- **Vercel serverless (superadmin-app/api)** — used by superadmin-app in production:
  - `/api/send-student-email`, `/api/send-staff-email` (Gmail SMTP via nodemailer; wired through `vercel.json` routes and env)
- **Firebase Cloud Functions (`functions/index.js`)** — `sendCredentialsEmail` and `sendStaffCredentialsEmail` (v2 callable, Gmail). Deployable via `firebase deploy`; **not currently called by the frontends**, which instead hit the Vercel/Express APIs above.

---

## F. Role / Permission Comparison

| Capability | Student | Admin (Staff) | Super Admin |
| --- | :---: | :---: | :---: |
| Create / track own request | ✅ | — | — |
| Guest submission (no account) | ✅ | — | — |
| View requests (own or office) | Own only | Own office only | All (analytics only) |
| Claim / resolve / reject / cancel ticket | — | ✅ own office | — |
| Reassign ticket to another office | — | ✅ (with urgency + note) | — |
| Reply/comments on tickets | ✅ (own) | ✅ | — |
| Notifications | ✅ (student type) | ✅ (staff type) | ✅ (superadmin type) |
| Give feedback / ratings | ✅ | — | — |
| View feedback analytics | — | Demo only (static) | ✅ (real, per-office, CSV) |
| Post announcements/deadlines | — | ✅ CRUD | — |
| Read announcements | ✅ | ✅ | — |
| Edit request form config (offices/subjects) | — | — | ✅ |
| Create accounts (student/staff + email creds) | — | — | ✅ |
| Suspend / activate / delete accounts | — | — | ✅ |
| School-wide analytics / CSV export | — | — | ✅ |
| Forgot password | ✅ (Student ID) | ✅ (username) | — (link present but no handler) |
| Mandatory first-login password change | ✅ | ✅ | — |
| QR login / guest mode | ✅ | — | — |
| AI content moderation (Groq) | ✅ | — | — |

### Notable observations / gaps
1. **Forgot Password** on all sides requires the local `email-backend` on port 5000 (hard-coded `http://localhost:5000`), so the flow breaks in production unless that backend is deployed too.
2. **Admin Feedback page** shows hard-coded demo entries, not the real `feedback` collection.
3. **Two parallel email implementations** exist (Vercel API for superadmin credential emails, Express backend for reset codes); the `functions` callable version appears unused by the current frontends.
4. **Admin-app Search in SuperAdminDashboard** — the active-users count uses `students`/`staff` without `isActive` filtering in Analytics (it does filter in the Dashboard).
5. **User delete** removes the Firestore doc only; the Firebase Auth record is intentionally left (comment), though `email-backend` exposes a `/api/delete-user` endpoint that isn't wired to the UI.
6. `react-router-dom` is declared in superadmin-app but the app uses a manual `activePage` state switch instead of routes.
7. All three apps are CRA builds (`react-scripts`); no test suites are configured in `package.json`.