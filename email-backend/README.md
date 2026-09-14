# Email Backend - Academia De San Jose

Simple Express.js backend for sending emails using **Resend**.

## Features

✅ Send student credentials  
✅ Send staff credentials  
✅ Password reset verification codes  
✅ Clean HTML email templates  
✅ Firebase Admin integration  

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Create `.env` file:

```bash
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxx
FROM_EMAIL=Academia De San Jose <noreply@resend.dev>
```

Get your Resend API key from: https://resend.com/api-keys

### 3. Start Server

```bash
npm start
```

Server runs on: http://localhost:5000

## API Endpoints

### Health Check
```bash
GET /
```

### Send Student Credentials
```bash
POST /api/send-credentials
Content-Type: application/json

{
  "email": "student@example.com",
  "studentId": "2024",
  "password": "tempPass123",
  "studentName": "Juan Dela Cruz"
}
```

### Send Staff Credentials
```bash
POST /api/send-staff-credentials
Content-Type: application/json

{
  "email": "staff@example.com",
  "staffName": "John Doe",
  "username": "johndoe",
  "password": "tempPass123",
  "office": "Finance"
}
```

### Send Password Reset Code
```bash
POST /api/send-reset-code
Content-Type: application/json

{
  "email": "student@example.com",
  "studentName": "Juan Dela Cruz",
  "studentId": "2024",
  "expiryMinutes": 1
}
```

### Verify Reset Code
```bash
POST /api/verify-reset-code
Content-Type: application/json

{
  "email": "student@example.com",
  "code": "123456"
}
```

### Reset Password
```bash
POST /api/reset-password
Content-Type: application/json

{
  "email": "student@example.com",
  "newPassword": "newPass123",
  "verificationCode": "123456"
}
```

### Delete User from Firebase Auth
```bash
POST /api/delete-user
Content-Type: application/json

{
  "uid": "firebase-uid-here"
}
```

## Setup Guide

See [RESEND_SETUP.md](../RESEND_SETUP.md) for detailed setup instructions.

## Free Tier Limits

- **3,000 emails/month**
- **100 emails/day**

After free tier: $20/month for 50,000 emails

## Tech Stack

- **Express.js** - Web framework
- **Resend** - Email delivery
- **Firebase Admin** - Authentication management
- **dotenv** - Environment variables

## Security

- Never commit `.env` file
- Rotate API keys regularly
- Use environment variables in production

## Support

For Resend issues: https://resend.com/docs
