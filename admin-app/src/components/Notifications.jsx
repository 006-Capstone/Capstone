import React, { useState, useEffect, useLayoutEffect } from 'react';
import { FaBell, FaCheck, FaCheckDouble, FaTimes, FaArrowRight } from 'react-icons/fa';
import { collection, query, where, onSnapshot, getDocs, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { markAsRead, markAllAsRead } from '../utils/notificationHelper';
import LoadingSpinner from './LoadingSpinner';
import '../styles/Notifications.css';

// Anchor the panel consistently just below the notification bell on every
// page. The bell sits in the page header, which is positioned differently
// per page, so we measure it at open time instead of using fixed offsets.
// Hoisted outside the component: pure function of the DOM, no state needed.
const computePanelPosition = () => {
  const bell = document.querySelector('.notification-bell');
  const isMobile = window.innerWidth <= 768;

  if (!bell) {
    // Fallback: sensible defaults if the bell isn't found
    return isMobile
      ? { top: 60, left: 12, right: 12, width: 'auto' }
      : { top: 70, right: 90 };
  }

  const rect = bell.getBoundingClientRect();
  const gap = 8;
  const top = Math.min(rect.bottom + gap, window.innerHeight - 32);

  if (isMobile) {
    // Full-width-ish panel below the bell on small screens
    return { top, left: 12, right: 12, width: 'auto' };
  }

  // Right edges align, so the panel drops straight down from the bell
  const right = Math.max(12, window.innerWidth - rect.right);
  return { top, right };
};

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

const Notifications = ({ isOpen, onClose, onViewRequest }) => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [panelStyle, setPanelStyle] = useState({});

  // useLayoutEffect so the measured position is applied before paint,
  // avoiding a visible flash at the CSS fallback position.
  useLayoutEffect(() => {
    if (!isOpen) return undefined;

    setPanelStyle(computePanelPosition());

    // Re-measure when the window resizes OR the page scrolls while the
    // panel is open, so it always stays anchored to the bell.
    const handleResize = () => setPanelStyle(computePanelPosition());
    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleResize, true);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleResize, true);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const staffData = JSON.parse(localStorage.getItem('staffData'));
    if (!staffData || !staffData.uid) {
      setLoading(false);
      return;
    }

    // Simplified query to avoid index requirement - we'll sort in JavaScript
    const q = query(
      collection(db, 'notifications'),
      where('recipientId', '==', staffData.uid),
      where('recipientType', '==', 'staff')
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
      }
    } catch (error) {
      console.error('[Error] Error opening ticket from notification:', error);
    }
  };

  const handleMarkAllAsRead = async () => {
    const staffData = JSON.parse(localStorage.getItem('staffData'));
    await markAllAsRead(staffData.uid, 'staff');
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

  if (!isOpen) return null;

  return (
    <div className="notifications-overlay" onClick={onClose}>
      <div className="notifications-panel" style={panelStyle} onClick={(e) => e.stopPropagation()}>
        <div className="notifications-header">
          <div className="notifications-header-left">
            <FaBell className="notifications-bell-icon" />
            <h2>Notifications</h2>
            {unreadCount > 0 && <span className="unread-badge">{unreadCount}</span>}
          </div>
          <div className="notifications-header-right">
            {unreadCount > 0 && (
              <button className="mark-all-read-btn" onClick={handleMarkAllAsRead} title="Mark all as read">
                <FaCheckDouble />
              </button>
            )}
            <button className="close-notifications-btn" onClick={onClose}>
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
    </div>
  );
};

export default Notifications;
