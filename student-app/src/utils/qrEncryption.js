import CryptoJS from 'crypto-js';

const ENCRYPTION_KEY = process.env.REACT_APP_QR_ENCRYPTION_KEY || 'asj_student_qr_default_secret_key';
const APP_SIGNATURE = 'ASJ_STUDENT_QR'; // Unique signature for this app

/**
 * Encrypts student credentials for QR code
 * @param {string} studentId - 4-digit student ID
 * @param {string} password - Student password
 * @returns {string} Encrypted string for QR code
 */
export const encryptCredentials = (studentId, password) => {
  try {
    // Create payload with signature
    const payload = {
      sig: APP_SIGNATURE,
      id: studentId,
      pwd: password,
      ts: Date.now() // timestamp for additional security
    };
    
    // Convert to JSON string
    const jsonString = JSON.stringify(payload);
    
    // Encrypt using AES
    const encrypted = CryptoJS.AES.encrypt(jsonString, ENCRYPTION_KEY).toString();
    
    console.log('[Encryption] Credentials encrypted successfully');
    return encrypted;
  } catch (error) {
    console.error('[Error] Encryption error:', error);
    throw new Error('Failed to encrypt credentials');
  }
};

/**
 * Decrypts QR code data
 * @param {string} encryptedData - Encrypted string from QR code
 * @returns {object|null} { studentId, password } or null if invalid
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
    
    // Check if QR code is too old (optional - prevent old QR codes from working)
    const ageInDays = (Date.now() - payload.ts) / (1000 * 60 * 60 * 24);
    if (ageInDays > 365) { // QR code expires after 1 year
      console.error('[Error] QR code expired');
      return null;
    }
    
    console.log('[Success] Credentials decrypted successfully');
    return {
      studentId: payload.id,
      password: payload.pwd
    };
  } catch (error) {
    console.error('[Error] Decryption error:', error);
    return null;
  }
};
