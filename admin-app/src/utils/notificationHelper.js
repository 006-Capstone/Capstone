import { db } from '../firebase';
import { collection, addDoc, serverTimestamp, query, where, getDocs, updateDoc, doc, orderBy, limit } from 'firebase/firestore';

/**
 * Create a notification for a user
 * @param {string} recipientId - UID of the recipient (student or staff)
 * @param {string} recipientType - 'student' or 'staff'
 * @param {string} type - Type of notification (e.g., 'status_change', 'new_comment', 'new_request')
 * @param {string} title - Notification title
 * @param {string} message - Notification message
 * @param {object} metadata - Additional data (requestId, etc.)
 */
export const createNotification = async (recipientId, recipientType, type, title, message, metadata = {}) => {
  try {
    await addDoc(collection(db, 'notifications'), {
      recipientId,
      recipientType,
      type,
      title,
      message,
      metadata,
      isRead: false,
      createdAt: serverTimestamp()
    });
    console.log('[Success] Notification created:', { recipientId, type, title });
  } catch (error) {
    console.error('[Error] Error creating notification:', error);
  }
};

/**
 * Get unread notifications count for a user
 * @param {string} userId - UID of the user
 * @param {string} userType - 'student' or 'staff'
 * @returns {Promise<number>} Count of unread notifications
 */
export const getUnreadCount = async (userId, userType) => {
  try {
    const q = query(
      collection(db, 'notifications'),
      where('recipientId', '==', userId),
      where('recipientType', '==', userType),
      where('isRead', '==', false)
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.size;
  } catch (error) {
    console.error('[Error] Error getting unread count:', error);
    return 0;
  }
};

/**
 * Get notifications for a user
 * @param {string} userId - UID of the user
 * @param {string} userType - 'student' or 'staff'
 * @param {number} limitCount - Maximum number of notifications to fetch
 * @returns {Promise<Array>} Array of notifications
 */
export const getNotifications = async (userId, userType, limitCount = 20) => {
  try {
    const q = query(
      collection(db, 'notifications'),
      where('recipientId', '==', userId),
      where('recipientType', '==', userType),
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate()
    }));
  } catch (error) {
    console.error('[Error] Error getting notifications:', error);
    return [];
  }
};

/**
 * Mark a notification as read
 * @param {string} notificationId - ID of the notification
 */
export const markAsRead = async (notificationId) => {
  try {
    await updateDoc(doc(db, 'notifications', notificationId), {
      isRead: true,
      readAt: serverTimestamp()
    });
  } catch (error) {
    console.error('[Error] Error marking notification as read:', error);
  }
};

/**
 * Mark all notifications as read for a user
 * @param {string} userId - UID of the user
 * @param {string} userType - 'student' or 'staff'
 */
export const markAllAsRead = async (userId, userType) => {
  try {
    const q = query(
      collection(db, 'notifications'),
      where('recipientId', '==', userId),
      where('recipientType', '==', userType),
      where('isRead', '==', false)
    );
    const querySnapshot = await getDocs(q);
    
    const updatePromises = querySnapshot.docs.map(docSnapshot =>
      updateDoc(doc(db, 'notifications', docSnapshot.id), {
        isRead: true,
        readAt: serverTimestamp()
      })
    );
    
    await Promise.all(updatePromises);
    console.log('[Success] All notifications marked as read');
  } catch (error) {
    console.error('[Error] Error marking all notifications as read:', error);
  }
};

/**
 * Helper to notify student about request status change
 */
export const notifyStudentStatusChange = async (studentUid, requestId, requestSubject, oldStatus, newStatus) => {
  await createNotification(
    studentUid,
    'student',
    'status_change',
    'Request Status Updated',
    `Your request "${requestSubject}" status changed from ${oldStatus} to ${newStatus}`,
    { requestId, oldStatus, newStatus }
  );
};

/**
 * Helper to notify student about staff comment
 */
export const notifyStudentComment = async (studentUid, requestId, requestSubject, staffName) => {
  await createNotification(
    studentUid,
    'student',
    'new_comment',
    'New Reply from Staff',
    `${staffName} replied to your request "${requestSubject}"`,
    { requestId, staffName }
  );
};

/**
 * Human-friendly version of an ETC value for notification text.
 */
const formatEtcForMessage = (etc) => {
  if (!etc) return 'soon';
  if (/^\d{4}-\d{2}-\d{2}$/.test(etc)) {
    const [y, m, d] = etc.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }
  return `within ${etc}`;
};

/**
 * Helper to notify student when staff updates the estimated time of completion
 */
export const notifyStudentEtcChange = async (studentUid, requestId, requestSubject, etc, reason = '') => {
  const reasonSuffix = reason ? `\nReason: "${reason}"` : '';
  await createNotification(
    studentUid,
    'student',
    'etc_update',
    'Estimated Completion Updated',
    `Your request "${requestSubject}" is now estimated to be completed ${formatEtcForMessage(etc)}.${reasonSuffix}`,
    { requestId, etc, reason }
  );
};

/**
 * Helper to notify staff about new request
 */
export const notifyStaffNewRequest = async (office, requestId, requestSubject, studentName) => {
  try {
    // Get all active staff in this office
    const staffQuery = query(
      collection(db, 'staff'),
      where('office', '==', office),
      where('isActive', '==', true)
    );
    const querySnapshot = await getDocs(staffQuery);
    
    // Create notification for each staff member
    const notificationPromises = querySnapshot.docs.map(staffDoc => 
      createNotification(
        staffDoc.data().uid,
        'staff',
        'new_request',
        'New Request Received',
        `${studentName} submitted a new request: "${requestSubject}"`,
        { requestId, studentName, office }
      )
    );
    
    await Promise.all(notificationPromises);
  } catch (error) {
    console.error('[Error] Error notifying staff about new request:', error);
  }
};

/**
 * Helper to notify staff about student follow-up
 */
export const notifyStaffFollowUp = async (assignedToStaffName, requestId, requestSubject, studentName, office) => {
  try {
    // Find staff by name in the office
    const staffQuery = query(
      collection(db, 'staff'),
      where('name', '==', assignedToStaffName),
      where('office', '==', office)
    );
    const querySnapshot = await getDocs(staffQuery);
    
    if (!querySnapshot.empty) {
      const staffDoc = querySnapshot.docs[0];
      await createNotification(
        staffDoc.data().uid,
        'staff',
        'student_followup',
        'Student Added Comment',
        `${studentName} added a comment to request "${requestSubject}"`,
        { requestId, studentName }
      );
    }
  } catch (error) {
    console.error('[Error] Error notifying staff about follow-up:', error);
  }
};

/**
 * Helper to notify staff about ticket reassignment
 */
export const notifyStaffReassignment = async (toOffice, requestId, requestSubject, fromOffice, reassignedBy) => {
  try {
    // Get all active staff in the target office
    const staffQuery = query(
      collection(db, 'staff'),
      where('office', '==', toOffice),
      where('isActive', '==', true)
    );
    const querySnapshot = await getDocs(staffQuery);
    
    // Create notification for each staff member
    const notificationPromises = querySnapshot.docs.map(staffDoc => 
      createNotification(
        staffDoc.data().uid,
        'staff',
        'ticket_rerouted',
        'Request Rerouted to Your Office',
        `Request "${requestSubject}" was rerouted from ${fromOffice} by ${reassignedBy}`,
        { requestId, fromOffice, toOffice, reassignedBy }
      )
    );
    
    await Promise.all(notificationPromises);
  } catch (error) {
    console.error('[Error] Error notifying staff about reassignment:', error);
  }
};
