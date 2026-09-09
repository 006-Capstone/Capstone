# Vercel Deployment Guide - Academia De San Jose

## ✅ What's Included:

1. **Vercel Serverless Functions** in `student-app/api/`:
   - `send-reset-code.js` - Password reset emails
   - `verify-reset-code.js` - Code verification
   - `reset-password.js` - Password reset with Firebase Admin
   - `send-temporary-password.js` - New account emails

2. **Security Features**:
   - AI validation for guest requests
   - Password reuse prevention
   - Daily ticket limits (2 per department)
   - Archive restore (deletes duplicates)
   - Image compression for uploads

3. **PDF Downloads**:
   - Guest receipts as PDF
   - Status reports as PDF

## 🚀 Deploy to Vercel:

### Step 1: Push to GitHub

```bash
git add .
git commit -m "feat: Ready for Vercel deployment"
git push origin main
```

### Step 2: Deploy Each App

1. Go to https://vercel.com
2. Sign in with GitHub
3. Click **"Add New Project"**
4. Import your repository

#### A. Student App (with API)
- **Root Directory**: `student-app`
- **Framework**: Create React App
- **Build Command**: `npm run build`
- **Output**: `build`

**Environment Variables** (from your local `.env` files):
- Copy all values from `student-app/.env`
- Copy Firebase credentials from `email-backend/serviceAccountKey.json`
- Copy Gmail credentials from `email-backend/.env`

#### B. Admin App
- **Root Directory**: `admin-app`
- **Framework**: Create React App
- No environment variables needed

#### C. Superadmin App
- **Root Directory**: `superadmin-app`
- **Framework**: Create React App  
- No environment variables needed

## 📝 Important Notes:

- Gmail SMTP works on Vercel (no port blocking)
- No cold starts or sleep issues
- All apps share the same API functions from student-app
- Keep your `.env` files safe and never commit them!
- The Vercel API routes work locally and in production

## 🧪 Testing Locally:

For local development, the API routes point to `http://localhost:3000/api/*`

Run the student app and the API functions will be available.

## 🧪 Testing After Deployment:

1. Test forgot password feature
2. Test guest login with image upload
3. Test creating new accounts (temporary password emails)
4. Download PDF receipts
