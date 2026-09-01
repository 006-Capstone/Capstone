import React, { useState } from 'react';
import { FaThLarge, FaEdit, FaChartLine, FaUsers, FaUserCircle, FaSignOutAlt, FaTimes, FaExclamationTriangle } from 'react-icons/fa';
import '../styles/SuperAdminSidebar.css';

const SuperAdminSidebar = ({ activePage, onNavigate, isOpen = false, onClose, onLogout }) => {
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const handleLogout = () => {
    // For superadmin, just clear any stored data and reload (fallback if
    // no onLogout handler is provided by the parent)
    localStorage.clear();
    window.location.reload();
  };

  const confirmLogout = () => {
    setShowLogoutConfirm(false);
    (onLogout || handleLogout)();
  };

  const NAV_ITEMS = [
    { key: 'dashboard', label: 'Dashboard', icon: FaThLarge },
    { key: 'edit-request', label: 'Edit Request Form', icon: FaEdit },
    { key: 'analytics', label: 'Analytics', icon: FaChartLine },
    { key: 'user-management', label: 'User Management', icon: FaUsers }
  ];

  const handleNavigate = (page) => {
    onNavigate(page);
    onClose?.();
  };

  return (
    <>
      {/* Backdrop — only visible when the drawer is open on small screens */}
      <div
        className={`sidebar-backdrop ${isOpen ? 'sidebar-backdrop--show' : ''}`}
        onClick={onClose}
        aria-hidden="true"
      />

      <aside
        id="superadmin-sidebar"
        className={`superadmin-sidebar ${isOpen ? 'sidebar--open' : ''}`}
        aria-label="Super admin navigation"
      >
        {/* Close button — only visible on the mobile drawer */}
        <button
          type="button"
          className="sidebar-close-btn"
          onClick={onClose}
          aria-label="Close navigation menu"
        >
          <FaTimes aria-hidden="true" />
        </button>

        <div className="sidebar-logo">
          <div className="sidebar-logo-img-wrap">
            <img src="/school-logo.jpg" alt="Academia De San Jose school logo" />
          </div>
          <div className="sidebar-brand-text">
            <h2 className="sidebar-brand-title">Academia De San Jose</h2>
          </div>
        </div>

        <nav className="sidebar-menu" aria-label="Main">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.key}
                type="button"
                className={`sidebar-item ${activePage === item.key ? 'active' : ''}`}
                onClick={() => handleNavigate(item.key)}
                aria-current={activePage === item.key ? 'page' : undefined}
              >
                <Icon className="sidebar-icon" aria-hidden="true" />
                <span className="sidebar-label">{item.label}</span>
                {activePage === item.key && (
                  <span className="sidebar-active-indicator" aria-hidden="true" />
                )}
              </button>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user-card">
            <div className="sidebar-user-avatar">
              <FaUserCircle className="user-icon" aria-hidden="true" />
              <span className="user-online-pip" title="Active session" />
            </div>
            <div className="sidebar-user-details">
              <span className="user-name">Super Admin</span>
              <span className="user-role">System Administrator</span>
            </div>
          </div>

          <button
            type="button"
            className="logout-button"
            onClick={() => setShowLogoutConfirm(true)}
          >
            <FaSignOutAlt className="logout-icon" aria-hidden="true" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {showLogoutConfirm && (
        <div
          className="logout-modal-backdrop"
          onClick={() => setShowLogoutConfirm(false)}
        >
          <div
            className="logout-confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Confirm logout"
            onClick={(e) => e.stopPropagation()}
          >
            <FaExclamationTriangle className="logout-confirm-icon" aria-hidden="true" />
            <h3 className="logout-confirm-title">Logout</h3>
            <p className="logout-confirm-message">
              Are you sure you want to sign out? You'll need to log in again to
              access the super admin dashboard.
            </p>
            <div className="logout-confirm-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setShowLogoutConfirm(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-danger"
                onClick={confirmLogout}
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default SuperAdminSidebar;
