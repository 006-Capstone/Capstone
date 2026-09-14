# Resend Email Setup Guide

The email backend uses **Resend** for sending emails. This guide will help you set it up.

---

## Why Resend?

✅ **Easy Setup** - Just need an API key, no complex configuration  
✅ **Better Deliverability** - Professional email infrastructure  
✅ **Free Tier** - 3,000 emails/month, 100 emails/day  
✅ **Custom Domain** - Use your school domain (optional)  
✅ **Analytics** - Track email opens, clicks, bounces  
✅ **Reliable** - Built for developers and production use

---

## Setup Steps

### 1. Sign Up for Resend

1. Go to https://resend.com
2. Click **"Get Started"**
3. Sign up with your email
4. Verify your email address

---

### 2. Get API Key

1. After login, go to **API Keys**: https://resend.com/api-keys
2. Click **"Create API Key"**
3. Name it: `ASJ Email Backend`
4. Select **"Full Access"** (or "Sending Access" only)
5. Click **"Create"**
6. **Copy the API key** (starts with `re_`)
   - ⚠️ **Save it now** - you won't be able to see it again!

---

### 3. Configure Environment Variables

1. Open `email-backend/.env` file
2. Add your Resend API key:

```bash
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxx
FROM_EMAIL=Academia De San Jose <noreply@resend.dev>
```

**Notes**:
- Replace `re_xxxxxxxxxxxxxxxxxxxxx` with your actual API key
- The `FROM_EMAIL` can include a display name: `Your Name <email@domain.com>`
- Without custom domain, use `noreply@resend.dev`

---

### 4. Start the Backend

```bash
cd email-backend
npm start
```

You should see:
```
🚀 Email backend running on http://localhost:5000
📧 Using Resend as email provider
[Success] Resend API configured
```

---

## Using Custom Domain (Optional)

### Why Use Custom Domain?

- ✅ Professional emails from `@academia-de-san-jose.edu`
- ✅ Better deliverability and trust
- ✅ School branding

---

### Setup Custom Domain

#### Step 1: Add Domain in Resend

1. Go to **Domains**: https://resend.com/domains
2. Click **"Add Domain"**
3. Enter your domain: `academia-de-san-jose.edu`
4. Click **"Add"**

---

#### Step 2: Configure DNS Records

Resend will show you DNS records to add. You need to add these to your domain registrar (GoDaddy, Namecheap, etc.)

**Example DNS Records**:
```
Type: TXT
Name: resend._domainkey
Value: p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC...

Type: TXT
Name: @
Value: resend-verification=abc123xyz

Type: MX
Name: @
Value: feedback.resend.dev
Priority: 10
```

---

#### Step 3: Verify Domain

1. After adding DNS records, click **"Verify"** in Resend
2. Verification can take **24-48 hours**
3. You'll receive an email when verified

---

#### Step 4: Update .env

Once verified, update your `.env`:

```bash
FROM_EMAIL=Academia De San Jose <noreply@academia-de-san-jose.edu>
```

---

## Testing Email Sending

### Method 1: Test Endpoint

```bash
curl -X POST http://localhost:5000/api/send-credentials \
  -H "Content-Type: application/json" \
  -d '{
    "email": "your-email@example.com",
    "studentId": "2024",
    "password": "tempPass123",
    "studentName": "Test Student"
  }'
```

---

### Method 2: Check Health Endpoint

```bash
curl http://localhost:5000/
```

Response:
```json
{
  "message": "Email backend is running!",
  "provider": "Resend"
}
```

---

### Method 3: Resend Dashboard

1. Go to https://resend.com/emails
2. Check recent emails
3. View delivery status, opens, clicks

---

## Free Tier Limits

| Limit | Value |
|-------|-------|
| **Monthly Emails** | 3,000 |
| **Daily Emails** | 100 |
| **Cost** | Free |

**After Free Tier**:
- $20/month for 50,000 emails
- See pricing: https://resend.com/pricing

---

## Monitoring Email Usage

### Check Dashboard

1. Go to https://resend.com/emails
2. View all sent emails
3. Track delivery status

---

### Check Logs

Backend logs show sent emails:
```
[Success] Email sent successfully: abc123xyz
```

---

## Troubleshooting

### "Invalid API key"

**Problem**: API key is incorrect or expired

**Solution**:
1. Check API key in `.env` file
2. Ensure it starts with `re_`
3. No extra spaces or quotes
4. Regenerate API key in Resend dashboard if needed

---

### "Domain not verified"

**Problem**: Custom domain not verified yet

**Solution**:
1. Check DNS records are correct
2. Wait 24-48 hours for DNS propagation
3. Use `noreply@resend.dev` for testing
4. Click "Verify" in Resend dashboard

---

### "Rate limit exceeded"

**Problem**: Exceeded free tier limits (100/day or 3,000/month)

**Solution**:
1. Wait until tomorrow (for daily limit)
2. Wait until next month (for monthly limit)
3. Upgrade to paid plan: https://resend.com/pricing

---

### Emails Going to Spam

**Solution**:
1. Use custom domain (increases trust)
2. Ask recipients to whitelist your email
3. Check email content (avoid spammy words)
4. Verify SPF, DKIM, DMARC records (Resend handles this)

---

### "Cannot connect to localhost:5000"

**Problem**: Backend not running

**Solution**:
```bash
cd email-backend
npm start
```

---

## Production Deployment

### Environment Variables (Vercel)

Add these to Vercel environment variables:

```
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxx
FROM_EMAIL=Academia De San Jose <noreply@resend.dev>
```

---

### Security Best Practices

1. ✅ **Never commit** `.env` file to Git
2. ✅ **Rotate API keys** regularly (every 6 months)
3. ✅ **Use environment variables** for production
4. ✅ **Monitor usage** to detect abuse
5. ✅ **Set up alerts** in Resend dashboard

---

## Cost Management

### Tracking Usage

1. Go to https://resend.com/usage
2. View monthly email count
3. Set up alerts for 80% usage

---

### Estimating Costs

**Example School**:
- 200 students
- 50 staff
- Average 10 emails/student/month = 2,000 emails/month
- Average 20 emails/staff/month = 1,000 emails/month
- **Total**: 3,000 emails/month = ✅ Free tier

**If you exceed**:
- 5,000 emails/month = $20/month
- 10,000 emails/month = $20/month (50k included)

---

## Support

### Resend Support

- **Docs**: https://resend.com/docs
- **Status**: https://status.resend.com
- **Email**: support@resend.com
- **Discord**: https://resend.com/discord

---

### Common Questions

**Q: Can I use multiple API keys?**  
A: Yes, create separate keys for development, staging, production

**Q: Can I send attachments?**  
A: Yes, Resend supports attachments (PDF, images, etc.)

**Q: How do I cancel?**  
A: Just stop using the API. Free tier requires no payment info.

**Q: What happens if I exceed free tier?**  
A: Emails will fail. Upgrade to paid plan to continue.

---

## Summary

### Quick Setup Checklist

- [ ] Sign up at https://resend.com
- [ ] Get API key from https://resend.com/api-keys
- [ ] Add `RESEND_API_KEY` to `.env`
- [ ] Set `FROM_EMAIL` (use `noreply@resend.dev` for now)
- [ ] Start backend: `npm start`
- [ ] Test with curl or Postman
- [ ] (Optional) Add custom domain
- [ ] Monitor usage in dashboard

---

**Document Version**: 1.0  
**Last Updated**: January 9, 2025  
**Maintained By**: Development Team
