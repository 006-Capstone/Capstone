import { collection, query, where, getDocs, limit, doc, updateDoc } from 'firebase/firestore';

/**
 * Auto-heals the Firestore request document so that the original handler
 * is permanently stored in `firstClaimedBy` and `reassignedFromStaff`.
 */
async function autoHealTicket(db, docId, originalHandler) {
  if (!db || !docId || !originalHandler) return;
  try {
    const docRef = doc(db, 'requests', docId);
    await updateDoc(docRef, {
      firstClaimedBy: originalHandler,
      reassignedFromStaff: originalHandler
    });
  } catch (err) {
    // Non-blocking background sync
    console.debug('[ticketHistoryHelper] autoHeal note:', err?.message || err);
  }
}

/**
 * Dynamically resolves the original staff handler who first accepted and processed
 * the request before any SuperAdmin reassignment or colleague takeover occurred.
 *
 * Looks up across:
 * 1. Document direct fields (firstClaimedBy, reassignedFromStaff, officeHistory)
 * 2. Follow-up audit logs and regex patterns
 * 3. Firestore `notifications` collection (metadata.fromStaff / message)
 * 4. Firestore `performance_logs` collection (fromStaffName)
 * 5. Firestore `staff` directory for the office
 * 
 * Auto-heals the Firestore document once resolved.
 *
 * @param {object} db - Firestore database instance
 * @param {string} docId - Request Firestore document ID
 * @param {object} ticketData - Request data object
 * @returns {Promise<string>} The resolved original handler name
 */
export async function resolveOriginalHandler(db, docId, ticketData) {
  if (!ticketData) return '';

  const clean = (val) => (typeof val === 'string' ? val.trim() : '');

  // 1. Detect if a takeover occurred and identify the takeover staff member (taker)
  let takerName = '';
  if (ticketData.followUps && Array.isArray(ticketData.followUps)) {
    for (const f of ticketData.followUps) {
      if (!f || !f.message || typeof f.message !== 'string') continue;
      const msg = f.message;
      const msgLower = msg.toLowerCase();
      if (msgLower.includes('claimed and taken over') || msgLower.includes('taken over by') || f.type === 'takeover') {
        const match = msg.match(/(?:claimed and taken over by|taken over by)\s+([^.\r\n]+)/i);
        if (match && match[1]) {
          takerName = clean(match[1]);
          break;
        } else if (f.sentByName) {
          takerName = clean(f.sentByName);
          break;
        }
      }
    }
  }

  // Also check if ticket has reassignedToStaff matching claimedBy and not pendingTakeover
  if (!takerName && ticketData.reassignedToStaff && ticketData.claimedBy) {
    if (ticketData.reassignedToStaff.toLowerCase() === ticketData.claimedBy.toLowerCase() && ticketData.pendingTakeover === false) {
      takerName = clean(ticketData.claimedBy);
    }
  }

  const isTaker = (name) => {
    if (!takerName || !name) return false;
    return clean(name).toLowerCase() === takerName.toLowerCase();
  };

  // 2. Check direct fields on the ticket
  const directCandidates = [
    ticketData.firstClaimedBy,
    ticketData.reassignedFromStaff,
    ticketData.originalClaimedBy,
    ticketData.initialClaimedBy
  ].map(clean).filter(Boolean);

  for (const candidate of directCandidates) {
    if (!isTaker(candidate)) {
      return candidate;
    }
  }

  // 3. Check officeHistory
  if (ticketData.officeHistory && typeof ticketData.officeHistory === 'object') {
    for (const [, val] of Object.entries(ticketData.officeHistory)) {
      if (val?.handledBy) {
        const handledBy = clean(val.handledBy);
        if (handledBy && !isTaker(handledBy)) {
          return handledBy;
        }
      }
    }
  }

  // 4. Check followUps for reassignment logs or earlier staff messages
  if (ticketData.followUps && Array.isArray(ticketData.followUps)) {
    for (const f of ticketData.followUps) {
      if (!f || !f.message || typeof f.message !== 'string') continue;
      const msg = f.message;

      const patterns = [
        /reassigned\s+from\s+([^\r\n,]+?)\s+to\s+([^\r\n,]+?)\s+by/i,
        /reassigned\s+from\s+([^\r\n,]+?)\s+to/i,
        /workload\s+rebalanced.*?from\s+([^\r\n,]+?)\s+to/i
      ];

      for (const pattern of patterns) {
        const match = msg.match(pattern);
        if (match && match[1]) {
          const fromName = clean(match[1]);
          if (fromName && !isTaker(fromName)) {
            autoHealTicket(db, docId, fromName);
            return fromName;
          }
        }
      }
    }

    // Check earlier messages from staff prior to takeover
    for (const f of ticketData.followUps) {
      if (!f) continue;
      if (f.type !== 'takeover' && f.sentBy === 'staff' && f.sentByName) {
        const staffName = clean(f.sentByName);
        if (staffName && !isTaker(staffName)) {
          autoHealTicket(db, docId, staffName);
          return staffName;
        }
      }
    }
  }

  // 5. Query Firestore `notifications` collection
  if (db) {
    const requestId = clean(ticketData.requestId || ticketData.ticketId);
    const actualDocId = clean(docId || ticketData.firestoreId || ticketData.id);

    try {
      const notifsRef = collection(db, 'notifications');
      let foundStaff = '';

      // 5a. Search by metadata.firestoreId
      if (actualDocId) {
        try {
          const q1 = query(notifsRef, where('metadata.firestoreId', '==', actualDocId), limit(10));
          const snap1 = await getDocs(q1);
          for (const d of snap1.docs) {
            const data = d.data();
            if (data?.metadata?.fromStaff) {
              foundStaff = clean(data.metadata.fromStaff);
              break;
            }
            if (data?.message) {
              const m = data.message.match(/from\s+([^\r\n,]+?)\s+for\s+workload/i);
              if (m && m[1]) {
                foundStaff = clean(m[1]);
                break;
              }
            }
          }
        } catch (_) {}
      }

      // 5b. Search by metadata.requestId
      if (!foundStaff && requestId) {
        try {
          const q2 = query(notifsRef, where('metadata.requestId', '==', requestId), limit(10));
          const snap2 = await getDocs(q2);
          for (const d of snap2.docs) {
            const data = d.data();
            if (data?.metadata?.fromStaff) {
              foundStaff = clean(data.metadata.fromStaff);
              break;
            }
            if (data?.message) {
              const m = data.message.match(/from\s+([^\r\n,]+?)\s+for\s+workload/i);
              if (m && m[1]) {
                foundStaff = clean(m[1]);
                break;
              }
            }
          }
        } catch (_) {}
      }

      // 5c. Search recent ticket_rerouted notifications
      if (!foundStaff) {
        try {
          const q3 = query(notifsRef, where('type', '==', 'ticket_rerouted'), limit(25));
          const snap3 = await getDocs(q3);
          for (const d of snap3.docs) {
            const data = d.data();
            const text = (data?.message || '') + ' ' + JSON.stringify(data?.metadata || {});
            if ((requestId && text.includes(requestId)) || (actualDocId && text.includes(actualDocId))) {
              if (data?.metadata?.fromStaff) {
                foundStaff = clean(data.metadata.fromStaff);
                break;
              }
              const m = (data.message || '').match(/from\s+([^\r\n,]+?)\s+for\s+workload/i);
              if (m && m[1]) {
                foundStaff = clean(m[1]);
                break;
              }
            }
          }
        } catch (_) {}
      }

      if (foundStaff && !isTaker(foundStaff)) {
        autoHealTicket(db, actualDocId || docId, foundStaff);
        return foundStaff;
      }

      // 6. Query Firestore `performance_logs` collection
      try {
        const perfRef = collection(db, 'performance_logs');
        const qPerf = query(perfRef, where('action', '==', 'tickets_reassigned'), limit(20));
        const snapPerf = await getDocs(qPerf);
        for (const d of snapPerf.docs) {
          const pData = d.data();
          const tIds = pData.ticketIds || [];
          if (
            (actualDocId && tIds.includes(actualDocId)) ||
            (requestId && tIds.includes(requestId)) ||
            (takerName && pData.toStaffName && clean(pData.toStaffName).toLowerCase() === takerName.toLowerCase())
          ) {
            if (pData.fromStaffName) {
              const fromName = clean(pData.fromStaffName);
              if (fromName && !isTaker(fromName)) {
                autoHealTicket(db, actualDocId || docId, fromName);
                return fromName;
              }
            }
          }
        }
      } catch (_) {}

      // 7. Query Firestore `staff` collection in the department
      const ticketOffice = clean(ticketData.office || ticketData.department);
      if (ticketOffice && takerName) {
        try {
          const staffRef = collection(db, 'staff');
          const snapStaff = await getDocs(staffRef);
          const deptStaff = [];
          snapStaff.forEach((docSnap) => {
            const sData = docSnap.data();
            const sOffice = clean(sData.office || sData.officeId || sData.department);
            const sName = clean(sData.name || sData.fullName || `${sData.firstName || ''} ${sData.lastName || ''}`);
            if (sOffice.toLowerCase().includes(ticketOffice.toLowerCase()) || ticketOffice.toLowerCase().includes(sOffice.toLowerCase())) {
              if (sName && !isTaker(sName)) {
                deptStaff.push(sName);
              }
            }
          });
          if (deptStaff.length === 1) {
            const fallbackStaff = deptStaff[0];
            autoHealTicket(db, actualDocId || docId, fallbackStaff);
            return fallbackStaff;
          }
        } catch (_) {}
      }
    } catch (err) {
      console.warn('[ticketHistoryHelper] Error resolving original handler:', err);
    }
  }

  // 8. If NO takeover occurred, the handler who claimed/was assigned the ticket is original
  if (!takerName) {
    return clean(ticketData.claimedBy || ticketData.assignedTo || ticketData.assignedToStaff);
  }

  // 9. If a takeover DID occur, NEVER return takerName as the initial handler
  const fallback = clean(ticketData.firstClaimedBy || ticketData.reassignedFromStaff);
  if (fallback && !isTaker(fallback)) {
    return fallback;
  }

  return '';
}
