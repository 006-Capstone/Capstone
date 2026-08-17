Secure Web-Based Academic Request Ticketing and Management System
Project Description / Purpose
The Secure Web-Based Academic Request Ticketing and Management System is an automated request handling platform designed for Academia de San Jose. It transitions manual student request processing into a digital workflow.
* Target Users: Enrolled Students, Guest Requesters, Office Staff / Department Admins, and Super Admins.
* Core Functionality: Enables students and guest users to submit academic inquiries and request documents online, attach supporting files, and track request statuses in real time using unique tracking IDs. Office staff process, verify, and resolve tickets through an administrative dashboard, while Super Admins oversee system security, user provisioning, and role-based access controls.
Setup Instructions
1. Prerequisites & Dependencies
Ensure you have the following installed on your local machine:
* Node.js (v18.0.0 or higher)
* npm or yarn package manager
* Firebase CLI (npm install -g firebase-tools)
* Git
2. Installation Steps
* Clone the Repository:
git clone https://github.com/Sanes1/Capstone.git
cd https://github.com/Sanes1/Capstone.git

* Install Root and Sub-App Dependencies:
npm install
cd student-app && npm install
cd ../admin-app && npm install
cd ../superadmin-app && npm install
cd ../functions && npm install
cd ..

* Configure Environment Variables:
Create a .env.local file inside the respective app folders (student-app, admin-app, superadmin-app) with your backend credentials:
NEXT_PUBLIC_FIREBASE_API_KEY=the_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=the_auth_domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=the_project_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
NEXT_PUBLIC_EMAIL_BACKEND_ID=email_api

* Run the System Locally:
Navigate into the specific application folder you want to run (e.g., student-app or admin-app) and start the development server:
npm run dev

File Structure Explanation
| Directory / File | Description |
|---|---|
| admin-app/ | Frontend application portal for Office Staff / Department Admins to process and resolve tickets. |
| email-backend/ | Backend service handling automated email notifications for ticket updates and password resets. |
| functions/ | Firebase Cloud Functions for serverless backend logic, database triggers, and security checks. |
| student-app/ | Frontend web portal for Enrolled Students and Guest Users to submit and track academic requests. |
| superadmin-app/ | Management console for Super Admins to manage accounts, audit logs, and global settings. |
| .firebaserc | Firebase project environment mapping configuration. |
| .gitignore | Specifies files and folders (e.g., node_modules, .env) ignored by Git version control. |
| FORGOT_PASSWORD_SETUP.md | Step-by-step technical guide for configuring password reset functionality. |
| TESTING_FORGOT_PASSWORD.md | Testing protocols and test cases for validating password recovery workflows. |
| VERCEL_SETUP_COMPLETE.md | Deployment guide and configuration details for Vercel cloud hosting. |
| firebase.js | Primary Firebase initialization file connecting the apps to Firebase services. |
| firebase.json | Configuration file for Firebase hosting, rules, and deployment functions. |
| package-lock.json | Locked dependency tree ensuring exact npm package version installations. |
| package.json | Root project manifest listing workspace scripts, metadata, and shared dependencies. |
| README.md | Main project documentation and setup manual for the repository. | 

Contact Information
For inquiries regarding this repository or system setup, reach out to the development team:
Development Team:Vanessa Althea Sanes (theangsanes@gmail.com), Jefelah Amistoso (jefelah23@gmail.com), and Dorothy May Gerolaga (gerolagadorothymay@gmail.com)



