import React from 'react';
import { FaThLarge, FaEdit, FaChartLine, FaUsers, FaUserCircle, FaSignOutAlt, FaTimes, FaArchive } from 'react-icons/fa';
import '../styles/SuperAdminSidebar.css';

const SuperAdminSidebar = ({ activePage, onNavigate, isOpen = false, onClose, onLogout }) => {
  const handleLogout = () => {
    if (window.confirm('Are you sure you want to logout?')) {
      // For superadmin, just clear any stored data and reload
      localStorage.clear();
      window.location.reload();
    }
  };

  const NAV_ITEMS = [
    { key: 'dashboard', label: 'Dashboard', icon: FaThLarge },
    { key: 'edit-request', label: 'Edit Request Form', icon: FaEdit },
    { key: 'analytics', label: 'Analytics', icon: FaChartLine },
    { key: 'user-management', label: 'User Management', icon: FaUsers },
    { key: 'archive', label: 'Archive', icon: FaArchive }
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
          <img src="/school-logo.jpg" alt="Academia De San Jose school logo" />
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
              </button>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <FaUserCircle className="user-icon" aria-hidden="true" />
            <span className="user-label">SUPER ADMIN</span>
          </div>

          <button className="logout-button" onClick={onLogout || handleLogout}>
            <FaSignOutAlt className="logout-icon" aria-hidden="true" />
            <span>Logout</span>
          </button>
        </div>
      </aside>
    </>
  );
};

export default SuperAdminSidebar;
