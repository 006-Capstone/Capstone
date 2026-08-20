import CryptoJS from 'crypto-js';

const ENCRYPTION_KEY = process.env.REACT_APP_QR_ENCRYPTION_KEY || '';
const APP_SIGNATURE = 'ASJ_ADMIN_QR'; // Unique signature for admin app

/**
 * Encrypts admin credentials for QR code
 * @param {string} username - Admin username
 * @param {string} password - Admin password
 * @param {string} office - Office ID (finance, library, guidance, registrar)
 * @returns {string} Encrypted string for QR code
 */
export const encryptCredentials = (username, password, office) => {
  try {
    // Create payload with signature
    const payload = {
      sig: APP_SIGNATURE,
      usr: username,
      pwd: password,
      off: office,
      ts: Date.now() // timestamp for additional security
    };
    
    // Convert to JSON string
    const jsonString = JSON.stringify(payload);
    
    // Encrypt using AES
    const encrypted = CryptoJS.AES.encrypt(jsonString, ENCRYPTION_KEY).toString();
    
    console.log('[Encryption] Admin credentials encrypted successfully');
    return encrypted;
  } catch (error) {
    console.error('[Error] Encryption error:', error);
    throw new Error('Failed to encrypt credentials');
  }
};

/**
 * Decrypts QR code data
 * @param {string} encryptedData - Encrypted string from QR code
 * @returns {object|null} { username, password, office } or null if invalid
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
      console.error('[Error] Invalid QR code - not from admin application');
      return null;
    }
    
    // Check if QR code is too old (optional - prevent old QR codes from working)
    const ageInDays = (Date.now() - payload.ts) / (1000 * 60 * 60 * 24);
    if (ageInDays > 365) { // QR code expires after 1 year
      console.error('[Error] QR code expired');
      return null;
    }
    
    console.log('[Success] Admin credentials decrypted successfully');
    return {
      username: payload.usr,
      password: payload.pwd,
      office: payload.off
    };
  } catch (error) {
    console.error('[Error] Decryption error:', error);
    return null;
  }
};
