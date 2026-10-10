import { doc, updateDoc, arrayUnion, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { notifyStudentInactivityCancelled } from './notificationHelper';

/**
 * Returns the inactivity deadline Date for a request.
 * Priority:
 * 1. The staff's Estimated Time of Completion (etc or estimatedCompletion)
 * 2. Fallback: 5 calendar days from when staff requested follow-up
 *
 * @param {object} ticket
 * @returns {Date|null}
 */
export const getInactivityDeadline = (ticket) => {
  if (!ticket) return null;

  // 1. Check ticket.etc ('YYYY-MM-DD' string)
  if (ticket.etc) {
    if (typeof ticket.etc === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(ticket.etc)) {
      const [y, m, d] = ticket.etc.split('-').map(Number);
      const target = new Date(y, m - 1, d, 23, 59, 59, 999);
      if (!isNaN(target.getTime())) return target;
    } else {
      const d = new Date(ticket.etc);
      if (!isNaN(d.getTime())) {
        d.setHours(23, 59, 59, 999);
        return d;
      }
    }
  }

  // 2. Check ticket.estimatedCompletion
  if (ticket.estimatedCompletion) {
    const d = ticket.estimatedCompletion?.toDate
      ? ticket.estimatedCompletion.toDate()
      : new Date(ticket.estimatedCompletion);
    if (!isNaN(d.getTime())) {
      d.setHours(23, 59, 59, 999);
      return d;
    }
  }

  // 3. Fallback: 5 days from when staff sent follow-up request
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
 * Checks whether a request is In Process, awaiting student response, and has passed its deadline.
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
 * @returns {Promise<boolean>}
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
    console.error('[inactivityHelper] Failed to auto-cancel request:', err);
    return false;
  }
};
