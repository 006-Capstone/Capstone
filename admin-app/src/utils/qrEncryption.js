import CryptoJS from 'crypto-js';

const ENCRYPTION_KEY = process.env.REACT_APP_QR_ENCRYPTION_KEY || '';
const APP_SIGNATURE = 'ASJ_STAFF_QR'; // Unique signature for the staff app

/**
 * Encrypts staff credentials for QR code
 * @param {string} username - Staff username
 * @param {string} officeId - Staff office id (finance, library, guidance, registrar)
 * @param {string} password - Staff password
 * @returns {string} Encrypted string for QR code
 */
export const encryptCredentials = (username, officeId, password) => {
  try {
    // Create payload with signature
    const payload = {
      sig: APP_SIGNATURE,
      username: username,
      officeId: officeId,
      pwd: password,
      ts: Date.now() // timestamp for additional security
    };

    // Convert to JSON string
    const jsonString = JSON.stringify(payload);

    // Encrypt using AES
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
 * @param {string} encryptedData - Encrypted string from QR code
 * @returns {object|null} { username, officeId, password } or null if invalid
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

    // Verify signature
    if (payload.sig !== APP_SIGNATURE) {
      console.error('❌ Invalid QR code - not from this application');
      return null;
    }

    // Check if QR code is too old (optional - prevent old QR codes from working)
    const ageInDays = (Date.now() - payload.ts) / (1000 * 60 * 60 * 24);
    if (ageInDays > 365) { // QR code expires after 1 year
      console.error('❌ QR code expired');
      return null;
    }

    console.log('✅ Credentials decrypted successfully');
    return {
      username: payload.username,
      officeId: payload.officeId,
      password: payload.pwd
    };
  } catch (error) {
    console.error('❌ Decryption error:', error);
    return null;
  }
};
