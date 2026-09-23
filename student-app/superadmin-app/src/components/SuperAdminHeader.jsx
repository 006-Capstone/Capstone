import React from 'react';
import { FaBell } from 'react-icons/fa';
import '../styles/SuperAdminHeader.css';

const SuperAdminHeader = () => {
  return (
    <header className="superadmin-header">
      <div className="header-logo">
        <img src="/school-logo.png" alt="School Logo" />
      </div>
      <div className="header-title">
        <h1>Dashboard</h1>
      </div>
      <div className="header-notification">
        <FaBell className="notification-icon" />
      </div>
    </header>
  );
};

export default SuperAdminHeader;
