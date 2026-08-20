import React, { useState, useEffect, useRef } from 'react';
import { FaBell, FaCheck, FaCheckDouble, FaTimes, FaArrowRight } from 'react-icons/fa';
import { collection, query, where, onSnapshot, getDocs, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { markAsRead, markAllAsRead } from '../utils/notificationHelper';
import LoadingSpinner from './LoadingSpinner';
import '../styles/Notifications.css';

const CLOSE_ANIMATION_MS = 180;

// Look up the request a notification refers to (by its human-readable request
// ID) so the app can open it. Tickets that were reassigned get a NEW requestId
// while the notification keeps the old one, so fall back to previousRequestId.
const fetchRequestByNotification = async (notif) => {
  const requestId = notif.metadata?.requestId;
  if (!requestId) return null;

  const requestsRef = collection(db, 'requests');
  const queries = [
    query(requestsRef, where('requestId', '==', requestId), limit(1)),
    query(requestsRef, where('previousRequestId', '==', requestId), limit(1))
  ];

  for (const q of queries) {
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      const doc = snapshot.docs[0];
      return { firestoreId: doc.id, ...doc.data() };
    }
  }
  return null;
};

const Notifications = ({ isOpen, onClose, bellRef, onViewRequest }) => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  // Stays true briefly after close so the fade-out animation can play
  const [visible, setVisible] = useState(false);
  const panelRef = useRef(null);

  // Keep the panel mounted for the close animation, then unmount
  useEffect(() => {
    if (isOpen) {
      setVisible(true);
      return undefined;
    }
    if (visible) {
      const timer = setTimeout(() => setVisible(false), CLOSE_ANIMATION_MS);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [isOpen, visible]);

  // Click outside the dropdown (or on the bell itself) closes it;
  // Escape closes it and returns focus to the bell
  useEffect(() => {
    if (!visible) return undefined;

    const handleClickOutside = (event) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(event.target) &&
        !event.target.closest('.notification-bell')
      ) {
        onClose();
        // Return focus to the trigger, per the disclosure/dialog pattern
        bellRef?.current?.focus();
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose();
        bellRef?.current?.focus();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [visible, onClose, bellRef]);

  // Move focus into the dropdown when it opens (no scroll jump)
  useEffect(() => {
    if (visible) {
      panelRef.current?.focus({ preventScroll: true });
    }
  }, [visible]);

  useEffect(() => {
    if (!isOpen) return;

    const studentData = JSON.parse(localStorage.getItem('studentData'));
    if (!studentData || !studentData.uid) {
      setLoading(false);
      return;
    }

    // Simplified query to avoid index requirement - we'll sort in JavaScript
    const q = query(
      collection(db, 'notifications'),
      where('recipientId', '==', studentData.uid),
      where('recipientType', '==', 'student')
    );

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const notifs = [];
      let unread = 0;

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        notifs.push({
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate()
        });
        if (!data.isRead) unread++;
      });

      // Sort by date in JavaScript (newest first) and limit to 20
      notifs.sort((a, b) => {
        const timeA = a.createdAt?.getTime() || 0;
        const timeB = b.createdAt?.getTime() || 0;
        return timeB - timeA;
      });
      const limitedNotifs = notifs.slice(0, 20);

      setNotifications(limitedNotifs);
      setUnreadCount(unread);
      setLoading(false);
    }, (error) => {
      console.error('[Error] Error loading notifications:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [isOpen]);

  const handleMarkAsRead = async (notificationId) => {
    await markAsRead(notificationId);
  };

  // Clicking a notification marks it read and, when it references a request,
  // opens that request's details page (closing the dropdown on the way).
  const handleNotificationClick = async (notif) => {
    try {
      if (!notif.isRead) {
        await handleMarkAsRead(notif.id);
      }

      const request = await fetchRequestByNotification(notif);
      if (request && onViewRequest) {
        onViewRequest(request);
        onClose();
        // Return focus to the bell, per the disclosure/dialog pattern
        bellRef?.current?.focus();
      }
    } catch (error) {
      console.error('[Error] Error opening request from notification:', error);
    }
  };

  const handleMarkAllAsRead = async () => {
    const studentData = JSON.parse(localStorage.getItem('studentData'));
    await markAllAsRead(studentData.uid, 'student');
  };

  const getTimeAgo = (date) => {
    if (!date) return '';
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  if (!visible) return null;

  return (
    <div
      id="notifications-dropdown"
      ref={panelRef}
      tabIndex={-1}
      role="dialog"
      aria-label="Notifications"
      className={`notifications-panel${isOpen ? '' : ' closing'}`}
    >
      <div className="notifications-header">
        <div className="notifications-header-left">
          <FaBell className="notifications-bell-icon" />
          <h2>Notifications</h2>
          {unreadCount > 0 && <span className="unread-badge">{unreadCount}</span>}
        </div>
        <div className="notifications-header-right">
          {unreadCount > 0 && (
            <button className="mark-all-read-btn" onClick={handleMarkAllAsRead} title="Mark all as read" aria-label="Mark all as read">
              <FaCheckDouble />
            </button>
          )}
          <button className="close-notifications-btn" onClick={onClose} aria-label="Close notifications">
            <FaTimes />
          </button>
        </div>
      </div>

      <div className="notifications-list">
        {loading ? (
          <LoadingSpinner message="Loading notifications..." fullScreen={false} />
        ) : notifications.length === 0 ? (
          <div className="notifications-empty">
            <FaBell className="empty-icon" />
            <p>No notifications yet</p>
          </div>
        ) : (
          notifications.map((notif) => (
            <div
              key={notif.id}
              role="button"
              tabIndex={0}
              className={`notification-item ${!notif.isRead ? 'unread' : ''}`}
              onClick={() => handleNotificationClick(notif)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleNotificationClick(notif);
                }
              }}
              title={notif.metadata?.requestId ? 'Open request' : undefined}
            >
              <div className="notification-content">
                <div className="notification-title">{notif.title}</div>
                <div className="notification-message">{notif.message}</div>
                <div className="notification-time">{getTimeAgo(notif.createdAt)}</div>
              </div>
              {notif.metadata?.requestId && (
                <div className="notification-open-indicator" aria-hidden="true">
                  <FaArrowRight />
                </div>
              )}
              {!notif.isRead && (
                <div className="notification-unread-indicator">
                  <FaCheck className="mark-read-icon" />
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default Notifications;
