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
git commit -m "feat: Add Vercel deployment features"
git push origin main
```

### Step 2: Deploy Each App

1. Go to https://vercel.com
2. Sign in with GitHub
3. Click **"Add New Project"**
4. Import `Sanes1/Capstone`

#### A. Student App (with API)
- **Root Directory**: `student-app`
- **Framework**: Create React App
- **Build Command**: `npm run build`
- **Output**: `build`

**Environment Variables** (from your local `.env` files):
- `REACT_APP_GROQ_API_KEY`
- `REACT_APP_QR_ENCRYPTION_KEY`
- `GMAIL_USER`
- `GMAIL_APP_PASSWORD`
- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY` (including BEGIN/END lines)

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
- No cold starts (unlike Render free tier)
- All apps share the same API functions
- Keep your `.env` files safe and never commit them!

## 🧪 Testing:

After deployment:
1. Test forgot password feature
2. Test guest login with image upload
3. Test creating new accounts (temporary password emails)
4. Download PDF receipts
