import { collection, query, where, getDocs, limit, doc, updateDoc } from 'firebase/firestore';

/**
 * Auto-heals the Firestore request document so that the original handler
 * is permanently stored in `firstClaimedBy` and `reassignedFromStaff`.
 */
async function autoHealTicket(db, docId, originalHandler, ticketData) {
  if (!db || !docId) return;
  try {
    const docRef = doc(db, 'requests', docId);
    const healData = {};
    if (originalHandler) {
      healData.firstClaimedBy = originalHandler;
      healData.reassignedFromStaff = originalHandler;
    }
    if (ticketData && !ticketData.originalEtc) {
      const origEtc = getOriginalEtc(ticketData);
      if (origEtc) {
        healData.originalEtc = origEtc;
      }
    }
    if (Object.keys(healData).length > 0) {
      await updateDoc(docRef, healData);
    }
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
            autoHealTicket(db, docId, fromName, ticketData);
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
          autoHealTicket(db, docId, staffName, ticketData);
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
        autoHealTicket(db, actualDocId || docId, foundStaff, ticketData);
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
                autoHealTicket(db, actualDocId || docId, fromName, ticketData);
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
            autoHealTicket(db, actualDocId || docId, fallbackStaff, ticketData);
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

/**
 * Resolves the true office from which a staff follow-up/reply originated.
 * Avoids misattributing previous office messages to the new office after a reroute.
 *
 * @param {object} followUp - The followUp message object
 * @param {object} ticket - The ticket/request document object
 * @param {string} [currentDepartment] - Optional fallback department of viewing user
 * @returns {string} The resolved originating office name
 */
export function getStaffSenderOffice(followUp, ticket, currentDepartment = '') {
  if (!followUp) return ticket?.office || currentDepartment || '';

  // 1. Direct explicit office recorded on the message
  if (followUp.staffOffice && typeof followUp.staffOffice === 'string' && followUp.staffOffice.trim()) {
    return followUp.staffOffice.trim();
  }
  if (followUp.office && typeof followUp.office === 'string' && followUp.office.trim()) {
    return followUp.office.trim();
  }

  // 2. Check officeHistory by matching the handler name
  const senderName = (followUp.sentByName || '').trim().toLowerCase();
  if (senderName && ticket?.officeHistory && typeof ticket.officeHistory === 'object') {
    for (const [officeKey, hist] of Object.entries(ticket.officeHistory)) {
      const histHandler = (hist?.handledBy || '').trim().toLowerCase();
      if (histHandler && histHandler === senderName) {
        return officeKey;
      }
    }
  }

  // 3. Check if message was sent before reassignment/reroute
  if (ticket?.reassignedFrom && followUp.sentAt && ticket.reassignedAt) {
    try {
      const sentTime = new Date(followUp.sentAt).getTime();
      const reassignTime = ticket.reassignedAt?.toDate
        ? ticket.reassignedAt.toDate().getTime()
        : new Date(ticket.reassignedAt).getTime();
      if (!isNaN(sentTime) && !isNaN(reassignTime) && sentTime <= reassignTime) {
        return ticket.reassignedFrom;
      }
    } catch (_) {}
  }

  // 4. If sender name matches the person who rerouted or first claimed from previous office
  if (senderName) {
    const reassignedBy = (ticket?.reassignedBy || '').trim().toLowerCase();
    const firstClaimed = (ticket?.firstClaimedBy || '').trim().toLowerCase();
    if (ticket?.previousOffice && (senderName === reassignedBy || senderName === firstClaimed)) {
      return ticket.previousOffice;
    }
    if (ticket?.reassignedFrom && (senderName === reassignedBy || senderName === firstClaimed)) {
      return ticket.reassignedFrom;
    }
  }

  // 5. Fallback to current ticket office or department
  return ticket?.office || currentDepartment || '';
}

/**
 * Formats an office name to display neatly as "X Department" or "X Office"
 * without awkward duplicates like "Guidance Office Department" or "Registrar Department Department".
 *
 * @param {string} officeName
 * @returns {string}
 */
export function formatOfficeTitle(officeName) {
  if (!officeName || typeof officeName !== 'string') return 'Department';
  const clean = officeName.trim();
  if (/department$/i.test(clean) || /office$/i.test(clean)) {
    return clean;
  }
  return `${clean} Department`;
}

/**
 * Resolves the original department/office where the request was first filed.
 * Retains the original office even if the request was subsequently rerouted/reassigned.
 *
 * @param {object} ticket - Request data object
 * @returns {string} The original office name
 */
export function getOriginalOffice(ticket) {
  if (!ticket) return '';
  if (ticket.originalOffice) return ticket.originalOffice;

  // 1. Check officeHistory for the earliest recorded office
  if (ticket.officeHistory && typeof ticket.officeHistory === 'object' && Object.keys(ticket.officeHistory).length > 0) {
    const historyEntries = Object.entries(ticket.officeHistory);
    historyEntries.sort((a, b) => {
      const timeA = a[1]?.handledAt ? new Date(a[1].handledAt).getTime() : 0;
      const timeB = b[1]?.handledAt ? new Date(b[1].handledAt).getTime() : 0;
      return timeA - timeB;
    });
    if (historyEntries[0] && historyEntries[0][0]) {
      return historyEntries[0][0];
    }
  }

  // 2. Check followUps for the earliest reroute/reassignment event
  if (ticket.followUps && Array.isArray(ticket.followUps)) {
    for (const f of ticket.followUps) {
      if (!f || !f.message || typeof f.message !== 'string') continue;
      const msg = f.message;
      const match = msg.match(/(?:reassigned|rerouted) from\s+(.+?)\s+to\s+(.+?)\s+by/i);
      if (match && match[1]) {
        return match[1].trim();
      }
    }
  }

  // 3. Fallbacks
  return ticket.previousOffice || ticket.reassignedFrom || ticket.office || '';
}

/**
 * Resolves the original Request ID given when the request was first created.
 * Recovers the original ID (e.g. ACC-100-010-001) even if the request was previously rerouted.
 *
 * @param {object} ticket - Request data object
 * @returns {string} The original Request ID
 */
export function getOriginalRequestId(ticket) {
  if (!ticket) return '';
  if (ticket.originalRequestId) return ticket.originalRequestId;

  // 1. If ticket was previously rerouted under an older schema, previousRequestId holds the origin ID
  if (ticket.previousRequestId) return ticket.previousRequestId;

  // 2. Check followUps for the earliest logged reroute event mentioning the initial ID
  if (ticket.followUps && Array.isArray(ticket.followUps)) {
    for (const f of ticket.followUps) {
      if (!f || !f.message || typeof f.message !== 'string') continue;
      const match = f.message.match(/(?:reassigned|rerouted)\s+(?:from|request)\s+(?:#)?([A-Z0-9]{3}-\d{3}-\d{3}-\d{3})/i);
      if (match && match[1]) {
        return match[1].trim();
      }
    }
  }

  // 3. Fallback to requestId or id
  return ticket.requestId || ticket.id || '';
}

/**
 * Resolves the staff member who claimed/handled the request in a rerouted office.
 *
 * @param {object} ticket - Request data object
 * @param {string} toOffice - The destination office of the reroute
 * @returns {string} The staff member's name who claimed the rerouted request, or empty string if not claimed yet.
 */
export function getClaimedStaffForReroutedOffice(ticket, toOffice) {
  if (!ticket || !toOffice) return '';

  const clean = (val) => (typeof val === 'string' ? val.trim() : '');
  const norm = (o) => clean(o).toLowerCase().replace(/^office of the\s+/i, '').replace(/\s+(department|office)$/i, '');
  const isSameOffice = (a, b) => {
    const na = norm(a);
    const nb = norm(b);
    if (!na || !nb) return false;
    return na === nb || (['accounting', 'finance'].includes(na) && ['accounting', 'finance'].includes(nb));
  };

  const targetOffice = clean(toOffice);
  if (!targetOffice) return '';

  // 1. If ticket is currently in this office and has been claimed / processed
  const currentOffice = clean(ticket.office);
  if (isSameOffice(currentOffice, targetOffice)) {
    const statusLower = clean(ticket.status).toLowerCase();
    // If ticket is still Pending in this office and not yet claimed, return ''
    if (statusLower !== 'pending' && ticket.pendingTakeover !== true) {
      const candidate = clean(ticket.claimedBy || ticket.assignedTo || ticket.assignedToStaff || ticket.reassignedToStaff);
      if (candidate) {
        return candidate;
      }
    }
  }

  // 2. Check officeHistory if this office's processing was completed/recorded
  if (ticket.officeHistory && typeof ticket.officeHistory === 'object') {
    for (const [officeKey, data] of Object.entries(ticket.officeHistory)) {
      if (isSameOffice(officeKey, targetOffice) && data?.handledBy) {
        return clean(data.handledBy);
      }
    }
  }

  // 3. Check followUps for claim/takeover logged for targetOffice
  if (ticket.followUps && Array.isArray(ticket.followUps)) {
    let currentLegOffice = '';
    for (const f of ticket.followUps) {
      if (!f || !f.message || typeof f.message !== 'string') continue;
      const msg = f.message;
      const msgLower = msg.toLowerCase();

      // Check if this followUp marks a reroute to an office
      const rerouteMatch = msg.match(/(?:reassigned|rerouted) from\s+(.+?)\s+to\s+(.+?)(?:\s+by|\n|$)/i);
      if (rerouteMatch && rerouteMatch[2]) {
        currentLegOffice = rerouteMatch[2].trim();
        continue;
      }

      if (isSameOffice(currentLegOffice, targetOffice)) {
        if (msgLower.includes('claimed and taken over') || msgLower.includes('taken over by') || f.type === 'takeover') {
          const match = msg.match(/(?:claimed and taken over by|taken over by)\s+([^.\r\n]+)/i);
          if (match && match[1]) return clean(match[1]);
          if (f.sentByName) return clean(f.sentByName);
        }
        if (msgLower.includes('automatically assigned to')) {
          const match = msg.match(/automatically assigned to\s+([^(\r\n]+)/i);
          if (match && match[1]) return clean(match[1]);
        }
        if (f.sentBy === 'staff' && f.sentByName && (!f.staffOffice || isSameOffice(f.staffOffice, targetOffice))) {
          return clean(f.sentByName);
        }
      }
    }

    // Secondary scan across followUps if leg tracking didn't match
    for (const f of ticket.followUps) {
      if (!f || !f.message || typeof f.message !== 'string') continue;
      const msg = f.message;
      const msgLower = msg.toLowerCase();
      if (f.staffOffice && isSameOffice(f.staffOffice, targetOffice) && f.sentByName) {
        return clean(f.sentByName);
      }
      if (msgLower.includes('automatically assigned to') && msgLower.includes(targetOffice.toLowerCase())) {
        const match = msg.match(/automatically assigned to\s+([^(\r\n]+)/i);
        if (match && match[1]) return clean(match[1]);
      }
    }
  }

  // 4. Fallback if current office matches targetOffice even if status pending, but claimedBy exists
  if (isSameOffice(currentOffice, targetOffice)) {
    const candidate = clean(ticket.claimedBy || ticket.assignedTo || ticket.assignedToStaff);
    const rerouter = clean(ticket.reassignedBy);
    const originHandler = clean(ticket.firstClaimedBy || ticket.reassignedFromStaff);
    if (candidate && candidate !== rerouter && candidate !== originHandler) {
      return candidate;
    }
  }

  return '';
}

/**
 * Resolves the original estimated completion date ISO string (YYYY-MM-DD)
 * set by the staff that originally claimed the request.
 *
 * @param {object} ticket - Request data object
 * @returns {string} The original ISO date string (e.g. '2026-08-31') or empty string
 */
export function getOriginalEtc(ticket) {
  if (!ticket) return '';

  const clean = (val) => (typeof val === 'string' ? val.trim() : '');
  const isISODate = (val) => typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(val.trim());

  const toIso = (val) => {
    if (!val) return '';
    if (isISODate(val)) return clean(val);
    try {
      const d = val?.toDate ? val.toDate() : new Date(val);
      if (!isNaN(d.getTime())) {
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
      }
    } catch {
      // fallback
    }
    return '';
  };

  // 1. Direct explicit fields on document
  if (ticket.originalEtc && isISODate(ticket.originalEtc)) return clean(ticket.originalEtc);
  if (ticket.originalEstimatedCompletion) {
    const iso = toIso(ticket.originalEstimatedCompletion);
    if (iso) return iso;
  }
  if (ticket.firstEtc && isISODate(ticket.firstEtc)) return clean(ticket.firstEtc);
  if (ticket.initialEtc && isISODate(ticket.initialEtc)) return clean(ticket.initialEtc);

  // 2. Check officeHistory for the earliest office's recorded etc
  if (ticket.officeHistory && typeof ticket.officeHistory === 'object') {
    const entries = Object.entries(ticket.officeHistory);
    entries.sort((a, b) => {
      const timeA = a[1]?.handledAt ? new Date(a[1].handledAt).getTime() : 0;
      const timeB = b[1]?.handledAt ? new Date(b[1].handledAt).getTime() : 0;
      return timeA - timeB;
    });
    for (const [, hist] of entries) {
      if (hist?.originalEtc && isISODate(hist.originalEtc)) return clean(hist.originalEtc);
      if (hist?.etc && isISODate(hist.etc)) return clean(hist.etc);
      if (hist?.estimatedCompletion) {
        const iso = toIso(hist.estimatedCompletion);
        if (iso) return iso;
      }
    }
  }

  // 3. Check followUps for the earliest logged estimated completion setting
  if (ticket.followUps && Array.isArray(ticket.followUps)) {
    for (const f of ticket.followUps) {
      if (!f || !f.message || typeof f.message !== 'string') continue;
      const msg = f.message;
      
      // Match M/D/YYYY
      const matchMdy = msg.match(/Estimated completion date set to\s+(\d{1,2})\/(\d{1,2})\/(\d{4})/i);
      if (matchMdy) {
        const m = String(matchMdy[1]).padStart(2, '0');
        const d = String(matchMdy[2]).padStart(2, '0');
        const y = matchMdy[3];
        return `${y}-${m}-${d}`;
      }

      // Match YYYY-MM-DD
      const matchIso = msg.match(/Estimated completion date set to\s+(\d{4}-\d{2}-\d{2})/i);
      if (matchIso) {
        return clean(matchIso[1]);
      }

      // Match ISO date inside parentheses, e.g. (2026-08-31)
      const matchParenIso = msg.match(/Estimated completion date set to[^(]*\((\d{4}-\d{2}-\d{2})\)/i);
      if (matchParenIso) {
        return clean(matchParenIso[1]);
      }
    }
  }

  // 4. If ticket has etc or estimatedCompletion and was set
  if (ticket.etc && isISODate(ticket.etc)) return clean(ticket.etc);
  if (ticket.estimatedCompletion) {
    const iso = toIso(ticket.estimatedCompletion);
    if (iso) return iso;
  }

  return '';
}

/**
 * Resolves the original human-readable estimated completion date (e.g. 'Aug 31, 2026')
 * set by the staff that originally claimed the request.
 *
 * @param {object} ticket - Request data object
 * @returns {string} The formatted original date or 'To be determined'
 */
export function getOriginalEstimatedCompletion(ticket) {
  if (!ticket) return 'To be determined';

  const iso = getOriginalEtc(ticket);
  if (iso && /^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    const [y, m, d] = iso.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    if (!isNaN(dateObj.getTime())) {
      return dateObj.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    }
  }

  // If ticket has originalEstimatedCompletion or estimatedCompletion directly
  const raw = ticket.originalEstimatedCompletion || ticket.estimatedCompletion;
  if (raw) {
    try {
      const d = raw?.toDate ? raw.toDate() : new Date(raw);
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        });
      }
    } catch {
      // fallback
    }
  }

  return 'To be determined';
}




