import CryptoJS from 'crypto-js';

const ENCRYPTION_KEY = process.env.REACT_APP_QR_ENCRYPTION_KEY || 'asj_student_qr_default_secret_key';
const APP_SIGNATURE = 'ASJ_STUDENT_QR'; // Unique signature for this app

export const generateSecureToken = () => {
  return 'qrt_' + CryptoJS.lib.WordArray.random(16).toString();
};

/**
 * Encrypts student QR data WITHOUT storing the raw password (#1 and #3)
 * @param {string} studentId - 4-digit student ID
 * @param {string} token - Random cryptographic token
 * @returns {string} Encrypted string for QR code
 */
export const encryptQRData = (studentId, token) => {
  try {
    const payload = {
      sig: APP_SIGNATURE,
      id: studentId,
      token: token,
      ts: Date.now()
    };
    
    const jsonString = JSON.stringify(payload);
    const encrypted = CryptoJS.AES.encrypt(jsonString, ENCRYPTION_KEY).toString();
    console.log('[Encryption] Secure passwordless QR generated successfully');
    return encrypted;
  } catch (error) {
    console.error('[Error] Encryption error:', error);
    throw new Error('Failed to encrypt QR data');
  }
};

/**
 * Legacy wrapper / fallback
 */
export const encryptCredentials = (studentId, password, token = null) => {
  if (token) {
    return encryptQRData(studentId, token);
  }
  try {
    const payload = {
      sig: APP_SIGNATURE,
      id: studentId,
      pwd: password,
      ts: Date.now()
    };
    const jsonString = JSON.stringify(payload);
    return CryptoJS.AES.encrypt(jsonString, ENCRYPTION_KEY).toString();
  } catch (error) {
    console.error('[Error] Encryption error:', error);
    throw new Error('Failed to encrypt credentials');
  }
};

/**
 * Decrypts QR code data
 * Supports both new secure token format and legacy password format
 * @param {string} encryptedData - Encrypted string from QR code
 * @returns {object|null} { studentId, token, password, isTokenBased } or null if invalid
 */
export const decryptCredentials = (encryptedData) => {
  try {
    // Decrypt using AES
    const decrypted = CryptoJS.AES.decrypt(encryptedData, ENCRYPTION_KEY);
    const decryptedString = decrypted.toString(CryptoJS.enc.Utf8);
    
    if (!decryptedString) {
      console.error('[Error] Decryption failed - invalid key or corrupted data');
      return null;
    }
    
    // Parse JSON
    const payload = JSON.parse(decryptedString);
    
    // Verify signature
    if (payload.sig !== APP_SIGNATURE) {
      console.error('[Error] Invalid QR code - not from this application');
      return null;
    }
    
    // Check if QR code is too old (1 year expiration)
    if (payload.ts) {
      const ageInDays = (Date.now() - payload.ts) / (1000 * 60 * 60 * 24);
      if (ageInDays > 365) {
        console.error('[Error] QR code expired');
        return null;
      }
    }
    
    console.log('[Success] QR payload decrypted successfully');
    return {
      studentId: payload.id,
      token: payload.token || null,
      password: payload.pwd || null,
      isTokenBased: Boolean(payload.token)
    };
  } catch (error) {
    console.error('[Error] Decryption error:', error);
    return null;
  }
};
