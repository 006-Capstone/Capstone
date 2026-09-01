import React, { useState, useEffect, useRef } from 'react';
import { 
  FaBell, 
  FaCheck, 
  FaCheckDouble, 
  FaTimes, 
  FaArrowRight,
  FaCommentDots,
  FaCheckCircle,
  FaTicketAlt,
  FaExchangeAlt,
  FaClock,
  FaInfoCircle
} from 'react-icons/fa';
import { collection, query, where, onSnapshot, getDocs, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { markAsRead, markAllAsRead } from '../utils/notificationHelper';
import LoadingSpinner from './LoadingSpinner';
import '../styles/Notifications.css';

const CLOSE_ANIMATION_MS = 180;

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

const getNotificationIcon = (notif) => {
  const type = notif.type;
  const newStatus = (notif.metadata?.newStatus || '').toLowerCase();

  switch (type) {
    case 'new_request':
      // Standardized Blue/Indigo/Purple for New Request
      return { icon: <FaTicketAlt />, className: 'type-request' };
    case 'status_change':
      if (newStatus.includes('process') || newStatus.includes('progress')) {
        return { icon: <FaClock />, className: 'type-inprocess' };
      }
      return { icon: <FaCheckCircle />, className: 'type-status' };
    case 'new_comment':
    case 'student_followup':
      return { icon: <FaCommentDots />, className: 'type-comment' };
    case 'ticket_rerouted':
      return { icon: <FaExchangeAlt />, className: 'type-rerouted' };
    case 'etc_update':
      return { icon: <FaClock />, className: 'type-etc' };
    default:
      return { icon: <FaInfoCircle />, className: 'type-default' };
  }
};

const Notifications = ({ isOpen, onClose, bellRef, onViewRequest }) => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [visible, setVisible] = useState(false);
  const panelRef = useRef(null);

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

  useEffect(() => {
    if (!visible) return undefined;

    const handleClickOutside = (event) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(event.target) &&
        !event.target.closest('.notification-bell')
      ) {
        onClose();
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

      notifs.sort((a, b) => {
        const timeA = a.createdAt?.getTime() || 0;
        const timeB = b.createdAt?.getTime() || 0;
        return timeB - timeA;
      });
      const limitedNotifs = notifs.slice(0, 25);

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

  const handleNotificationClick = async (notif) => {
    try {
      if (!notif.isRead) {
        await handleMarkAsRead(notif.id);
      }

      const request = await fetchRequestByNotification(notif);
      if (request && onViewRequest) {
        onViewRequest(request);
        onClose();
        bellRef?.current?.focus();
      }
    } catch (error) {
      console.error('[Error] Error opening request from notification:', error);
    }
  };

  const handleMarkAllAsRead = async () => {
    const studentData = JSON.parse(localStorage.getItem('studentData'));
    if (studentData?.uid) {
      await markAllAsRead(studentData.uid, 'student');
    }
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
    if (diffDays === 1) return 'Yesterday';
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
      {/* Header */}
      <div className="notifications-header">
        <div className="notifications-header-left">
          <div className="header-bell-badge">
            <FaBell />
          </div>
          <div className="header-title-container">
            <h2>Notifications</h2>
            {unreadCount > 0 ? (
              <span className="unread-badge">{unreadCount} new</span>
            ) : (
              <span className="all-read-badge">All caught up</span>
            )}
          </div>
        </div>

        <div className="notifications-header-right">
          {unreadCount > 0 && (
            <button 
              className="mark-all-read-btn" 
              onClick={handleMarkAllAsRead} 
              title="Mark all as read" 
              aria-label="Mark all as read"
            >
              <FaCheckDouble />
              <span>Mark all read</span>
            </button>
          )}
          <button 
            className="close-notifications-btn" 
            onClick={onClose} 
            aria-label="Close notifications"
            title="Close"
          >
            <FaTimes />
          </button>
        </div>
      </div>

      {/* Notifications List */}
      <div className="notifications-list">
        {loading ? (
          <LoadingSpinner message="Loading notifications..." fullScreen={false} />
        ) : notifications.length === 0 ? (
          <div className="notifications-empty">
            <div className="empty-bell-circle">
              <FaBell className="empty-icon" />
            </div>
            <h3>No Notifications Yet</h3>
            <p>You’re completely up to date. You will be notified when staff update your requests.</p>
          </div>
        ) : (
          notifications.map((notif) => {
            const { icon, className: iconClass } = getNotificationIcon(notif);
            const requestId = notif.metadata?.requestId;

            return (
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
                title={requestId ? `Open Request #${requestId}` : undefined}
              >
                <div className={`notif-type-icon ${iconClass}`}>
                  {icon}
                </div>

                <div className="notification-content">
                  <div className="notification-top-row">
                    <span className="notification-title">{notif.title}</span>
                    {requestId && (
                      <span className="notif-request-chip">#{requestId}</span>
                    )}
                  </div>
                  <div className="notification-message">{notif.message}</div>
                  <div className="notification-time">{getTimeAgo(notif.createdAt)}</div>
                </div>

                {requestId && (
                  <div className="notification-open-indicator" aria-hidden="true">
                    <FaArrowRight />
                  </div>
                )}

                {!notif.isRead && (
                  <span className="notification-unread-dot" title="Unread" />
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      {notifications.length > 0 && (
        <div className="notifications-footer">
          <span>Showing recent updates</span>
        </div>
      )}
    </div>
  );
};

export default Notifications;
