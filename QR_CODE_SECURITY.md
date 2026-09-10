# QR Code Security Features

## Overview
The student QR code system includes encrypted login credentials for quick access. This document outlines the security measures implemented to protect these credentials.

## Security Measures Implemented

### 1. Password Change Flow
**Location**: `student-app/src/components/ProfileSettings.jsx`

**Behavior**:
- When a student changes their password, the old QR code is **immediately invalidated**
- QR code data is cleared from Firestore database
- QR code display is removed from the UI
- User receives an alert explaining that their old QR code no longer works
- **Automatic prompt** opens after 500ms asking the user to regenerate their QR code with the NEW password

**Database Changes**:
```javascript
{
  qrCodeData: '',              // Encrypted QR data cleared
  qrCodeGeneratedAt: null,     // Generation timestamp cleared
  lastPasswordUpdate: <timestamp>
}
```

### 2. Forgot Password Flow
**Location**: `student-app/api/reset-password.js`

**Behavior**:
- When a password is reset via the forgot password flow, QR codes are automatically cleared
- Uses Firebase Admin SDK to clear QR data from Firestore
- Happens server-side for added security
- User must generate a new QR code after password reset

**Database Changes** (server-side):
```javascript
{
  qrCodeData: '',
  qrCodeGeneratedAt: null,
  lastPasswordUpdate: <serverTimestamp>
}
```

### 3. Account Archive & Restoration Flow
**Location**: `superadmin-app/src/components/Archive.jsx`

**Behavior**:
- When a student account is **archived**, QR code data is preserved in the archive
- When a student account is **restored** from archive, QR code data is **cleared**
- User is marked with `mustChangePassword: true`
- User must change password and regenerate QR code after restoration

**Database Changes** (on restoration):
```javascript
{
  mustChangePassword: true,
  qrCodeData: '',              // Old QR code cleared
  qrCodeGeneratedAt: null,
  restoredAt: <serverTimestamp>,
  restoredBy: <superadmin_email>
}
```

## User Experience Flow

### Scenario 1: Password Change
1. User goes to Settings → Changes password
2. ✅ Old QR code is immediately removed
3. ✅ Alert: "Your old QR code has been removed and will no longer work"
4. ✅ QR password prompt automatically opens
5. User enters NEW password
6. ✅ New QR code is generated with new encrypted credentials

### Scenario 2: Forgot Password
1. User completes forgot password flow
2. ✅ Password is reset successfully
3. ✅ QR code data is cleared server-side
4. User logs in with new password
5. User goes to Settings → Generate QR Code
6. ✅ New QR code is generated

### Scenario 3: Account Restoration
1. Superadmin restores archived student account
2. ✅ Account is restored with cleared QR code data
3. ✅ `mustChangePassword` flag is set to true
4. Student receives notification to change password
5. Student logs in and is prompted to change password
6. After password change, student can generate new QR code

## Technical Implementation

### QR Code Generation
- Uses AES-256-CBC encryption (via `qrEncryption.js`)
- Stores encrypted data in Firestore
- QR code image is generated client-side from encrypted data
- QR code persists until explicitly regenerated or password changed

### QR Code Validation
- Admin/Staff apps scan QR code
- Decrypt credentials client-side
- Attempt login with decrypted credentials
- If password has changed, login fails → QR code is invalid

### Database Schema
```javascript
{
  // Student document in Firestore
  qrCodeData: string,           // Encrypted credential string (empty = no QR code)
  qrCodeGeneratedAt: timestamp, // When QR was last generated (null = never generated)
  lastPasswordUpdate: timestamp, // When password was last changed
  mustChangePassword: boolean    // Flag for account restoration
}
```

## Security Best Practices

✅ **Automatic Invalidation**: Old QR codes are automatically invalidated on password change
✅ **Server-Side Clearing**: Forgot password flow clears QR data server-side using Firebase Admin
✅ **User Awareness**: Clear messaging when QR codes are invalidated
✅ **Guided Regeneration**: Automatic prompts to regenerate QR codes after password changes
✅ **Archive Safety**: Restored accounts require password change and QR regeneration
✅ **Encryption**: All QR codes contain encrypted credentials (AES-256-CBC)
✅ **No Plaintext**: Credentials are never stored in plaintext in QR codes

## Files Modified

1. `student-app/src/components/ProfileSettings.jsx`
   - Enhanced password change handler to clear QR codes
   - Added automatic prompt for QR regeneration

2. `student-app/api/reset-password.js`
   - Added Firestore update to clear QR code data
   - Clears `qrCodeData` and `qrCodeGeneratedAt` on password reset

3. `superadmin-app/src/components/Archive.jsx`
   - Clear QR codes when restoring accounts
   - Both for new documents and existing document updates

## Testing Checklist

- [ ] Change password → QR code is cleared and prompt opens
- [ ] Use forgot password → QR code is cleared server-side
- [ ] Restore archived account → QR code is cleared
- [ ] Try to use old QR code after password change → Login fails
- [ ] Generate new QR code after password change → Login succeeds
- [ ] Verify database updates for all three scenarios

## Future Enhancements

Consider adding:
- QR code expiry (time-based automatic invalidation)
- QR code usage logging (track when and where QR codes are used)
- Multi-factor authentication before QR generation
- Email notification when QR code is generated or regenerated
- Admin dashboard showing QR code generation statistics
