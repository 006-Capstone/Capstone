import CryptoJS from 'crypto-js';

const ENCRYPTION_KEY = process.env.REACT_APP_QR_ENCRYPTION_KEY || 'asj_staff_qr_default_secret_key';
const APP_SIGNATURE = 'ASJ_STAFF_QR'; // Unique signature for the staff app

export const generateSecureToken = () => {
  return 'qrt_' + CryptoJS.lib.WordArray.random(16).toString();
};

/**
 * Encrypts staff credentials for QR code WITHOUT storing password (#1 and #3)
 * @param {string} username - Staff username
 * @param {string} officeId - Staff office id (finance, library, guidance, registrar)
 * @param {string} token - Cryptographic token
 * @returns {string} Encrypted string for QR code
 */
export const encryptQRData = (username, officeId, token) => {
  try {
    const payload = {
      sig: APP_SIGNATURE,
      username: username,
      officeId: officeId,
      token: token,
      ts: Date.now()
    };

    const jsonString = JSON.stringify(payload);
    const encrypted = CryptoJS.AES.encrypt(jsonString, ENCRYPTION_KEY).toString();
    console.log('🔐 Secure passwordless staff QR encrypted successfully');
    return encrypted;
  } catch (error) {
    console.error('❌ Encryption error:', error);
    throw new Error('Failed to encrypt QR data');
  }
};

/**
 * Legacy wrapper / fallback
 */
export const encryptCredentials = (username, officeId, password, token = null) => {
  if (token) {
    return encryptQRData(username, officeId, token);
  }
  try {
    const payload = {
      sig: APP_SIGNATURE,
      username: username,
      officeId: officeId,
      pwd: password,
      ts: Date.now()
    };

    const jsonString = JSON.stringify(payload);
    const encrypted = CryptoJS.AES.encrypt(jsonString, ENCRYPTION_KEY).toString();
    console.log('🔐 Credentials encrypted successfully');
    return encrypted;
  } catch (error) {
    console.error('❌ Encryption error:', error);
    throw new Error('Failed to encrypt credentials');
  }
};

/**
 * Decrypts QR code data
 * Supports both new secure token format and legacy password format
 * @param {string} encryptedData - Encrypted string from QR code
 * @returns {object|null} { username, officeId, token, password, isTokenBased } or null if invalid
 */
export const decryptCredentials = (encryptedData) => {
  try {
    // Decrypt using AES
    const decrypted = CryptoJS.AES.decrypt(encryptedData, ENCRYPTION_KEY);
    const decryptedString = decrypted.toString(CryptoJS.enc.Utf8);

    if (!decryptedString) {
      console.error('❌ Decryption failed - invalid key or corrupted data');
      return null;
    }

    // Parse JSON
    const payload = JSON.parse(decryptedString);

    // Verify signature - accept both staff and admin signatures
    if (payload.sig !== APP_SIGNATURE && payload.sig !== 'ASJ_ADMIN_QR') {
      console.error('❌ Invalid QR code - not from this application');
      return null;
    }

    // Check if QR code is too old (1 year validity)
    if (payload.ts) {
      const ageInDays = (Date.now() - payload.ts) / (1000 * 60 * 60 * 24);
      if (ageInDays > 365) {
        console.error('❌ QR code expired');
        return null;
      }
    }

    const username = payload.username || payload.usr;
    const officeId = payload.officeId || payload.off;
    const token = payload.token || null;
    const password = payload.pwd || payload.password || null;

    if (!username || !officeId || (!token && !password)) {
      console.error('❌ Incomplete QR code payload:', payload);
      return null;
    }

    console.log('✅ Credentials decrypted successfully for:', username, officeId);
    return {
      username: username.trim(),
      officeId: officeId.trim().toLowerCase(),
      token: token,
      password: password,
      isTokenBased: Boolean(token)
    };
  } catch (error) {
    console.error('❌ Decryption error:', error);
    return null;
  }
};

