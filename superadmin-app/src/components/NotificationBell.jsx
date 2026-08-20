import React, { useState, useEffect, useRef } from 'react';
import { FaBell, FaCheckDouble, FaTimes } from 'react-icons/fa';
import { collection, query, where, onSnapshot, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import LoadingSpinner from './LoadingSpinner';
import '../styles/NotificationBell.css';

const NotificationBell = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const wrapRef = useRef(null);
  // Track ALL unread ids (not just the 20 shown) so "mark all" clears
  // everything the badge counts
  const unreadIdsRef = useRef([]);

  // Load notifications for the superadmin (real-time). If there are none,
  // the panel still opens with an empty state.
  useEffect(() => {
    const q = query(
      collection(db, 'notifications'),
      where('recipientType', '==', 'superadmin')
    );

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const notifs = [];
      let unread = 0;

      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        notifs.push({
          id: docSnap.id,
          ...data,
          createdAt: data.createdAt?.toDate?.() || data.createdAt || null
        });
        if (!data.isRead) unread++;
      });

      // Track every unread doc id for "mark all"
      unreadIdsRef.current = notifs.filter(n => !n.isRead).map(n => n.id);

      // Sort newest first, cap at 20
      notifs.sort((a, b) => {
        const timeA = a.createdAt?.getTime?.() || 0;
        const timeB = b.createdAt?.getTime?.() || 0;
        return timeB - timeA;
      });

      setNotifications(notifs.slice(0, 20));
      setUnreadCount(unread);
      setLoading(false);
    }, (error) => {
      console.error('[Error] Error loading notifications:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Close when clicking outside the bell
  useEffect(() => {
    if (!isOpen) return undefined;

    const handleClickOutside = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setIsOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleMarkAsRead = async (notificationId) => {
    try {
      await updateDoc(doc(db, 'notifications', notificationId), {
        isRead: true,
        readAt: serverTimestamp()
      });
    } catch (error) {
      console.error('[Error] Error marking notification as read:', error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await Promise.all(
        unreadIdsRef.current.map(id => updateDoc(doc(db, 'notifications', id), {
          isRead: true,
          readAt: serverTimestamp()
        }))
      );
    } catch (error) {
      console.error('[Error] Error marking all as read:', error);
    }
  };

  const getTimeAgo = (date) => {
    if (!date) return '';
    const dateObj = date instanceof Date ? date : new Date(date);
    if (isNaN(dateObj.getTime())) return '';

    const now = new Date();
    const diffMs = now - dateObj;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  return (
    <div className="notification-bell-wrap" ref={wrapRef}>
      <button
        type="button"
        className="icon-button notification-bell-btn"
        aria-label="Notifications"
        aria-haspopup="true"
        aria-expanded={isOpen}
        onClick={() => setIsOpen(prev => !prev)}
      >
        <FaBell aria-hidden="true" />
        {unreadCount > 0 && (
          <span className="notification-badge" aria-label={`${unreadCount} unread notifications`}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="notification-dropdown" role="dialog" aria-label="Notifications">
          <div className="notification-dropdown-header">
            <div className="notification-dropdown-title">
              <FaBell className="notification-dropdown-bell" aria-hidden="true" />
              <h3>Notifications</h3>
              {unreadCount > 0 && <span className="unread-count-chip">{unreadCount}</span>}
            </div>
            <div className="notification-dropdown-actions">
              {unreadCount > 0 && (
                <button
                  type="button"
                  className="mark-all-read-btn"
                  onClick={handleMarkAllAsRead}
                  title="Mark all as read"
                  aria-label="Mark all as read"
                >
                  <FaCheckDouble aria-hidden="true" />
                </button>
              )}
              <button
                type="button"
                className="close-notifications-btn"
                onClick={() => setIsOpen(false)}
                aria-label="Close notifications"
              >
                <FaTimes aria-hidden="true" />
              </button>
            </div>
          </div>

          <div className="notification-dropdown-list">
            {loading ? (
              <div className="notification-dropdown-loading">
                <LoadingSpinner message="Loading notifications..." fullScreen={false} />
              </div>
            ) : notifications.length === 0 ? (
              <div className="notification-empty">
                <FaBell className="notification-empty-icon" aria-hidden="true" />
                <p>No notifications yet</p>
                <span className="notification-empty-hint">
                  You're all caught up — new updates will appear here.
                </span>
              </div>
            ) : (
              notifications.map((notif) => (
                <div
                  key={notif.id}
                  className={`notification-item ${!notif.isRead ? 'unread' : ''}`}
                  onClick={() => !notif.isRead && handleMarkAsRead(notif.id)}
                >
                  <div className="notification-content">
                    <div className="notification-title">{notif.title}</div>
                    {notif.message && <div className="notification-message">{notif.message}</div>}
                    <div className="notification-time">{getTimeAgo(notif.createdAt)}</div>
                  </div>
                  {!notif.isRead && <div className="notification-unread-dot" aria-hidden="true" />}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
