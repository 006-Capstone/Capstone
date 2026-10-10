import { doc, updateDoc, arrayUnion, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { parseTicketETC } from './etcHelper';
import { notifyStudentInactivityCancelled } from './notificationHelper';

/**
 * Returns the inactivity deadline Date for a ticket.
 * Priority:
 * 1. The staff's Estimated Time of Completion (ETC) / target completion date
 * 2. Fallback: 5 calendar days from when staff requested follow-up
 *
 * @param {object} ticket
 * @returns {Date|null}
 */
export const getInactivityDeadline = (ticket) => {
  if (!ticket) return null;

  // 1. Check ETC parsed date
  const parsed = parseTicketETC(ticket);
  if (parsed && parsed.targetDate && !isNaN(parsed.targetDate.getTime())) {
    const d = new Date(parsed.targetDate);
    // Deadline is the end of that day (23:59:59.999)
    d.setHours(23, 59, 59, 999);
    return d;
  }

  // 2. Check internalTargetDate
  if (ticket.internalTargetDate) {
    if (typeof ticket.internalTargetDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(ticket.internalTargetDate)) {
      const [y, m, d] = ticket.internalTargetDate.split('-').map(Number);
      const target = new Date(y, m - 1, d, 23, 59, 59, 999);
      if (!isNaN(target.getTime())) return target;
    }
  }

  // 3. Fallback: 5 days from when staff sent the follow-up request
  if (ticket.awaitingResponseSince) {
    const sinceDate = ticket.awaitingResponseSince?.toDate
      ? ticket.awaitingResponseSince.toDate()
      : new Date(ticket.awaitingResponseSince);
    if (!isNaN(sinceDate.getTime())) {
      const fallback = new Date(sinceDate);
      fallback.setDate(fallback.getDate() + 5);
      fallback.setHours(23, 59, 59, 999);
      return fallback;
    }
  }

  return null;
};

/**
 * Formats the inactivity deadline Date into a human-readable string.
 * @param {object} ticket
 * @returns {string}
 */
export const formatInactivityDeadline = (ticket) => {
  const deadline = getInactivityDeadline(ticket);
  if (!deadline) return 'estimated completion deadline';
  return deadline.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
};

/**
 * Checks whether a ticket is In Process, awaiting student response, and has passed its deadline.
 *
 * @param {object} ticket
 * @returns {boolean}
 */
export const isTicketInactiveExpired = (ticket) => {
  if (!ticket) return false;
  const status = (ticket.status || '').toLowerCase();
  if (status !== 'in process') return false;
  if (!ticket.awaitingStudentResponse) return false;

  const deadline = getInactivityDeadline(ticket);
  if (!deadline) return false;

  return new Date() > deadline;
};

/**
 * Cancels an inactive expired ticket in Firestore and notifies the student.
 *
 * @param {object} ticket
 * @returns {Promise<boolean>} True if cancelled successfully, false otherwise.
 */
export const autoCancelInactiveTicket = async (ticket) => {
  if (!ticket || !ticket.firestoreId) return false;
  if (!isTicketInactiveExpired(ticket)) return false;

  try {
    const docRef = doc(db, 'requests', ticket.firestoreId);
    const cancelMsg = 'Request automatically closed and cancelled due to requester inactivity. No response was received within the estimated time of completion. If you still require assistance, please submit a new request.';

    await updateDoc(docRef, {
      status: 'Cancelled',
      awaitingStudentResponse: false,
      cancelledAt: new Date().toISOString(),
      cancelledBy: 'System (Inactivity Policy)',
      cancelReason: 'Closed due to requester inactivity (no response within estimated time of completion)',
      followUps: arrayUnion({
        message: cancelMsg,
        sentBy: 'system',
        sentByName: 'System',
        sentAt: new Date().toISOString()
      }),
      updatedAt: serverTimestamp()
    });

    if (ticket.studentUid) {
      await notifyStudentInactivityCancelled(ticket.studentUid, ticket.requestId, ticket.subject);
    }

    return true;
  } catch (err) {
    console.error('[inactivityHelper] Failed to auto-cancel ticket:', err);
    return false;
  }
};

/**
 * Scans an array of tickets and auto-cancels any that are inactive and expired.
 *
 * @param {Array} tickets
 * @returns {Promise<number>} Count of tickets cancelled
 */
export const checkAndCancelInactiveTickets = async (tickets = []) => {
  if (!Array.isArray(tickets) || tickets.length === 0) return 0;

  const expiredTickets = tickets.filter(isTicketInactiveExpired);
  if (expiredTickets.length === 0) return 0;

  let cancelledCount = 0;
  for (const ticket of expiredTickets) {
    const success = await autoCancelInactiveTicket(ticket);
    if (success) cancelledCount++;
  }
  return cancelledCount;
};
