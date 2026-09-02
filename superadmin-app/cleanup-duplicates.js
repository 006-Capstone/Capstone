/**
 * Cleanup script to remove duplicate student and staff accounts
 * Run this in the browser console on the SuperAdmin page
 */

import { collection, query, where, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { db } from './src/firebase';

async function cleanupDuplicateAccounts() {
  console.log('[Cleanup] Starting duplicate cleanup...');
  
  const collections = ['students', 'staff'];
  
  for (const collectionName of collections) {
    console.log(`[Cleanup] Checking ${collectionName} collection...`);
    
    const snapshot = await getDocs(collection(db, collectionName));
    const accountsByUID = new Map();
    
    // Group accounts by UID
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.uid) {
        if (!accountsByUID.has(data.uid)) {
          accountsByUID.set(data.uid, []);
        }
        accountsByUID.set(data.uid).push({ id: doc.id, ...data });
      }
    });
    
    // Find and delete duplicates (keep the most recent one)
    for (const [uid, accounts] of accountsByUID.entries()) {
      if (accounts.length > 1) {
        console.log(`[Cleanup] Found ${accounts.length} duplicates for UID: ${uid}`);
        
        // Sort by creation date (keep most recent)
        accounts.sort((a, b) => {
          const dateA = a.createdAt?.toDate?.() || new Date(a.createdAt || 0);
          const dateB = b.createdAt?.toDate?.() || new Date(b.createdAt || 0);
          return dateB - dateA; // Most recent first
        });
        
        // Delete all except the first one
        for (let i = 1; i < accounts.length; i++) {
          console.log(`[Cleanup] Deleting duplicate: ${accounts[i].id} (${accounts[i].name || accounts[i].fullName})`);
          await deleteDoc(doc(db, collectionName, accounts[i].id));
        }
        
        console.log(`[Cleanup] Kept: ${accounts[0].id} (${accounts[0].name || accounts[0].fullName})`);
      }
    }
  }
  
  console.log('[Cleanup] Duplicate cleanup completed!');
}

// Export for use
export { cleanupDuplicateAccounts };

// To run manually in console:
// import { cleanupDuplicateAccounts } from './cleanup-duplicates.js';
// cleanupDuplicateAccounts();
