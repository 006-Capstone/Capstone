import React from 'react';
import { FaBell } from 'react-icons/fa';
import '../styles/NotificationBell.css';

const NotificationBell = ({ unreadCount = 0, onClick, isOpen = false, className = '' }) => {
  return (
    <div className={`notification-bell-wrap ${className}`}>
      <button
        type="button"
        className={`icon-button notification-bell-btn notification-bell ${isOpen ? 'active' : ''}`}
        aria-label="Notifications"
        aria-haspopup="true"
        aria-expanded={isOpen}
        onClick={onClick}
        title="Notifications"
      >
        <FaBell className="bell-icon" aria-hidden="true" />
        {unreadCount > 0 && (
          <span className="notification-badge" aria-label={`${unreadCount} unread notifications`}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>
    </div>
  );
};

export default NotificationBell;
