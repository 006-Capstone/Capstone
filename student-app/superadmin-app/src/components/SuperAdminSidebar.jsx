import React from 'react';
import { FaThLarge, FaEdit, FaChartLine, FaUsers, FaUserCircle, FaSignOutAlt } from 'react-icons/fa';
import '../styles/SuperAdminSidebar.css';

const SuperAdminSidebar = ({ activePage, onNavigate }) => {
  const handleLogout = () => {
    if (window.confirm('Are you sure you want to logout?')) {
      // For superadmin, just clear any stored data and reload
      localStorage.clear();
      window.location.reload();
    }
  };
  return (
    <aside className="superadmin-sidebar">
      <div className="sidebar-logo">
        <img src="/school-logo.png" alt="School Logo" />
      </div>
      
      <nav className="sidebar-menu">
        <div
          className={`sidebar-item ${activePage === 'dashboard' ? 'active' : ''}`}
          onClick={() => onNavigate('dashboard')}
        >
          <FaThLarge className="sidebar-icon" />
          <span className="sidebar-label">Dashboard</span>
        </div>
        
        <div
          className={`sidebar-item ${activePage === 'edit-request' ? 'active' : ''}`}
          onClick={() => onNavigate('edit-request')}
        >
          <FaEdit className="sidebar-icon" />
          <span className="sidebar-label">Edit Request Form</span>
        </div>
        
        <div
          className={`sidebar-item ${activePage === 'analytics' ? 'active' : ''}`}
          onClick={() => onNavigate('analytics')}
        >
          <FaChartLine className="sidebar-icon" />
          <span className="sidebar-label">Analytics</span>
        </div>
        
        <div
          className={`sidebar-item ${activePage === 'user-management' ? 'active' : ''}`}
          onClick={() => onNavigate('user-management')}
        >
          <FaUsers className="sidebar-icon" />
          <span className="sidebar-label">User Management</span>
        </div>
      </nav>
      
      <div className="sidebar-footer">
        <div className="sidebar-user">
          <FaUserCircle className="user-icon" />
          <span className="user-label">SUPER ADMIN</span>
        </div>
        
        <button className="logout-button" onClick={handleLogout}>
          <FaSignOutAlt className="logout-icon" />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
};

export default SuperAdminSidebar;
