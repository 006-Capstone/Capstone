import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FaUserCircle, FaBell, FaBars } from 'react-icons/fa';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import ProfileSettings from './ProfileSettings';
import Notifications from './Notifications';
import Brand from './Brand';
import '../styles/Header.css';

function Header({ onMenuToggle, isSidebarOpen = false, onViewRequest, onNavigate }) {
  const [studentData, setStudentData] = useState(null);
  const [showProfileSettings, setShowProfileSettings] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const bellRef = useRef(null);

  // Stable callback so the dropdown's document listeners aren't re-attached
  // on every Header re-render (e.g. unread-count updates)
  const handleCloseNotifications = useCallback(() => {
    setShowNotifications(false);
  }, []);

  useEffect(() => {
    const data = JSON.parse(localStorage.getItem('studentData'));
    if (data) {
      setStudentData(data);

      // Listen for unread notifications in real-time
      // Simplified query to avoid index requirement
      if (data.uid) {
        const q = query(
          collection(db, 'notifications'),
          where('recipientId', '==', data.uid),
          where('recipientType', '==', 'student')
        );

        const unsubscribe = onSnapshot(q, (querySnapshot) => {
          const unread = querySnapshot.docs.filter(doc => !doc.data().isRead).length;
          setUnreadCount(unread);
        });

        return () => unsubscribe();
      }
    }
  }, []);

  return (
    <>
      <header className="top-header">
        <div className="header-left">
          <button
            type="button"
            className="menu-toggle"
            onClick={onMenuToggle}
            aria-label={isSidebarOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={isSidebarOpen}
            aria-controls="primary-sidebar"
          >
            <FaBars aria-hidden="true" />
          </button>
          {/* Branding — always visible (Figma: brand lives in the header top-left) */}
          <div className="header-branding">
            <Brand />
          </div>
        </div>

        <div className="header-right">
          {/* Profile — sits where the bell used to be */}
          <button
            type="button"
            className="user-profile"
            onClick={() => setShowProfileSettings(true)}
            aria-label="Open profile settings"
          >
            <span className="user-text">
              <span className="user-name">
                {studentData?.firstName || 'Student'} {studentData?.lastName || ''}
              </span>
              <span className="student-id">
                Student ID: {studentData?.studentId || '00-0000-000000'}
              </span>
            </span>
            <span className="avatar">
              {studentData?.profilePicture ? (
                <img
                  src={studentData.profilePicture}
                  alt=""
                  className="avatar-img"
                />
              ) : (
                <FaUserCircle aria-hidden="true" />
              )}
            </span>
          </button>

          {/* Notification bell — rightmost side of the header. The dropdown is
              anchored to this wrapper so it hangs directly beneath the bell. */}
          <div className="notification-wrapper">
            <button
              ref={bellRef}
              type="button"
              className="notification-bell"
              onClick={() => setShowNotifications((prev) => !prev)}
              aria-label={unreadCount > 0 ? `Notifications (${unreadCount} unread)` : 'Notifications'}
              aria-haspopup="true"
              aria-expanded={showNotifications}
              aria-controls="notifications-dropdown"
            >
              <FaBell className="bell-icon" aria-hidden="true" />
              {unreadCount > 0 && <span className="notification-badge">{unreadCount}</span>}
            </button>

            <Notifications
              isOpen={showNotifications}
              onClose={handleCloseNotifications}
              bellRef={bellRef}
              onViewRequest={onViewRequest}
              onNavigate={onNavigate}
            />
          </div>
        </div>
      </header>

      {showProfileSettings && (
        <ProfileSettings onClose={() => setShowProfileSettings(false)} />
      )}
    </>
  );
}

export default Header;
