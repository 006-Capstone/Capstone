import React, { useState, useEffect, useLayoutEffect } from 'react';
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

// Anchor the panel consistently just below the notification bell
const computePanelPosition = () => {
  const bell = document.querySelector('.notification-bell') || document.querySelector('.figma-bell-wrap');
  const isMobile = window.innerWidth <= 768;

  if (!bell) {
    return isMobile
      ? { top: 64, left: 12, right: 12, width: 'auto' }
      : { top: 72, right: 80 };
  }

  const rect = bell.getBoundingClientRect();
  const gap = 10;
  const top = Math.min(rect.bottom + gap, window.innerHeight - 32);

  if (isMobile) {
    return { top, left: 12, right: 12, width: 'auto' };
  }

  const right = Math.max(16, window.innerWidth - rect.right);
  return { top, right };
};

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
      // Standardized Blue/Indigo/Purple for New Request / Pending
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

const Notifications = ({ isOpen, onClose, onViewRequest }) => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [panelStyle, setPanelStyle] = useState({});

  useLayoutEffect(() => {
    if (!isOpen) return undefined;

    setPanelStyle(computePanelPosition());

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
      }
    } catch (error) {
      console.error('[Error] Error opening ticket from notification:', error);
    }
  };

  const handleMarkAllAsRead = async () => {
    const staffData = JSON.parse(localStorage.getItem('staffData'));
    if (staffData?.uid) {
      await markAllAsRead(staffData.uid, 'staff');
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

  if (!isOpen) return null;

  return (
    <div className="notifications-overlay" onClick={onClose}>
      <div className="notifications-panel" style={panelStyle} onClick={(e) => e.stopPropagation()}>
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

        {/* Notification List */}
        <div className="notifications-list">
          {loading ? (
            <LoadingSpinner message="Loading notifications..." fullScreen={false} />
          ) : notifications.length === 0 ? (
            <div className="notifications-empty">
              <div className="empty-bell-circle">
                <FaBell className="empty-icon" />
              </div>
              <h3>No Notifications Yet</h3>
              <p>You’re completely up to date. You will be notified when new requests or updates arrive.</p>
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
            <span>Showing recent notifications</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default Notifications;
