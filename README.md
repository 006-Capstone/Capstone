# Academia De San Jose

A secure web-based academic request ticketing and management system as a Capstone project for Academia De San Jose. The platform eliminates physical queues and paperwork through digitized ticket lifecycles, automated Estimated Time of Completion (ETC) tracking, dynamic multi-office request forms, and automated email receipts and notifications. It also integrates an AI Operational Insights Service (powered by the Groq API / LLaMA model) in the executive dashboard to analyze staff performance trends, ticket volume bottlenecks, and departmental efficiency.

---

## Live Deployments

* **Student & Guest Portal:** [https://student-portal-one-delta.vercel.app/](https://student-portal-one-delta.vercel.app/)
* **Office Staff Portal:** [https://admin-website-ruddy.vercel.app/](https://admin-website-ruddy.vercel.app/)
* **Super Admin Portal:** [https://superadmin-website.vercel.app/](https://superadmin-website.vercel.app/)

---

## Project Description

The **Academia De San Jose Secure Web-Based Academic Request Ticketing and Management System** is a centralized platform designed to digitize, streamline, and manage academic service requests and inquiries across institutional departments. 

The system transitions traditional manual paperwork and physical queues into a secure digital ticketing workflow for four primary offices: **Registrar**, **Accounting**, **Guidance**, and **Library**.

---

## Main Feature — Academic Request Ticketing & Management

* **Departmental Request Submission:** Dynamic, office-specific service forms with custom input fields and document attachments for Registrar, Accounting, Guidance, and Library requests.
* **Defined Status Timeline:** Real-time request tracking across standard institutional stages:
  $$\text{Pending} \longrightarrow \text{In Process} \longrightarrow \text{Rerouted / Reassigned} \longrightarrow \text{Resolved}$$
* **Estimated Time of Completion (ETC):** Departmental staff can set and update turnaround expectations for requestors.
* **Automated Email Notifications:** Instant email receipts upon ticket creation, status update notifications, and resolution alerts.
* **Student Rating & Feedback:** Post-resolution 5-star ratings and feedback submissions to evaluate departmental service quality.

---

## Sub-Features

* **QR Code Fast Login:** Fast and easy authentication allowing students and users to log in instantly by scanning their personal QR code without manually typing credentials.
* **Dynamic Form Editor:** Enables Super Admins to dynamically create and adjust services, form requirements, and input fields for departments without modifying code.
* **User & Role Management:** Role-based access control (RBAC), account generation, password recovery workflows, and bulk CSV user importation.
* **Departmental Bulletin Board:** Office-level publishing of official notices, announcements, and FAQs.
* **Ticket Rerouting & Auto-Escalation:** Capability to reroute requests across offices and detect overdue requests with automated staff reminders.
* **AI Operational Insights:** Executive-level performance analytics, workload distribution, and bottleneck detection powered by the **Groq API (LLaMA-3)**.
* **Secure Backend Services:** Express.js REST API and serverless cloud functions handling privileged Firebase Admin operations, authentication tokens, and email dispatch via Gmail SMTP.

---

## Roles & Access Control

The system is designed for the following roles:

* **Super Admin:** System-wide governance; manages offices (Registrar, Accounting, Guidance, Library), configures dynamic forms, oversees user accounts and CSV imports, manages ticket reassignments and escalations, monitors staff performance, and reviews AI operational insights.
* **Office Staff / Department Admin:** Operates within assigned offices (Registrar, Accounting, Guidance, or Library); reviews and processes incoming tickets, sets Estimated Time of Completion (ETC), updates statuses (**Pending, In Process, Rerouted/Reassigned, Resolved**), posts announcements, and reviews student feedback.
* **Student / Guest (Requestor):** Submits academic and office service requests, monitors live ticket status, receives email receipts, logs in via email/password or fast QR login, and submits service ratings upon resolution.

---

## Setup Instructions

### Prerequisites
* Node.js ≥ 18.x and npm ≥ 9.x
* A Firebase project (Authentication, Cloud Firestore, Cloud Storage, and Functions enabled)
* A Gmail account with an App Password generated for SMTP email services
* A Groq API key (for executive AI insights)

---

### 1. Clone the Repository
```bash
git clone https://github.com/006-Capstone/Capstone.git
cd Capstone
```

---

### 2. Install Dependencies

Install dependencies for the application portals:

```bash
# Student Portal
cd student-app && npm install && cd ..

# Office Staff Portal
cd admin-app && npm install && cd ..

# Super Admin Portal
cd superadmin-app && npm install && cd ..
```

---

### 3. Configure Environment Variables

Create `.env` files in the respective portal folders based on the provided `.env.example` templates:

```env
REACT_APP_FIREBASE_API_KEY=your_firebase_api_key
REACT_APP_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=your_project_id
REACT_APP_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
REACT_APP_FIREBASE_APP_ID=your_app_id

# Required for Super Admin AI Insights
GROQ_API_KEY=your_groq_api_key
```

#### Backend Email Service Configuration (`email-backend/.env`):
```env
GMAIL_USER=your_email@gmail.com
GMAIL_APP_PASSWORD=your_gmail_app_password
STUDENT_FRONTEND_URL=https://student-portal-one-delta.vercel.app
ADMIN_FRONTEND_URL=https://admin-website-ruddy.vercel.app
SUPERADMIN_FRONTEND_URL=https://superadmin-website.vercel.app
```

> Never commit `.env` files or Firebase private keys to GitHub.

---

### 4. Build for Production

To generate production builds for deployment:

```bash
cd student-app && npm run build
cd ../admin-app && npm run build
cd ../superadmin-app && npm run build
```

---

## File Structure

| Path | Description |
| :--- | :--- |
| `student-app/` | Student & Guest web portal (Request submission, tracking, QR login) |
| `student-app/src/` | Student portal React components, pages, context, and styles |
| `student-app/api/` | Serverless API routes for student functions |
| `admin-app/` | Office Staff portal (Ticket queues, status updates, announcements) |
| `admin-app/src/` | Office Staff React components, departmental views, and metrics |
| `superadmin-app/` | Super Admin portal (Dynamic forms, user management, analytics) |
| `superadmin-app/src/` | Super Admin dashboard, AI insight services, and system configuration |
| `superadmin-app/api/` | Serverless API endpoints for AI Groq insights and administration |
| `email-backend/` | Standalone Express.js REST API server |
| `email-backend/server.js` | Express endpoints (Auth, email receipts, credentials, Firebase Admin SDK) |
| `functions/` | Firebase Cloud Functions (v2) for cloud-based automation |
| `firebase.json` | Firebase configuration for hosting and cloud functions |
| `.firebaserc` | Firebase project bindings |
| `USER_MANUAL.md` | Comprehensive system user manual and documentation |
| `README.md` | Main project overview and setup guide |

---

## Contact

| Name | Role |
| :--- | :--- |
| **Vanessa Althea Sanes** | Lead Developer |
| **Dorothy May Gerolaga** | UI/UX Designer |
| **Jefelah Amistoso** | Project Manager |

For questions, bug reports, or inquiries regarding the system, please open an issue in the GitHub repository.

---

## License

**Proprietary — All Rights Reserved**

Copyright © 2024–2026 Southwestern University PHINMA.

This software and its source code are proprietary and confidential. No part of this codebase may be copied, modified, distributed, sublicensed, or used in any form — commercial or otherwise — without the express written permission of the copyright holders.

Unauthorized use, reproduction, or distribution of this software is strictly prohibited and may result in legal action.
