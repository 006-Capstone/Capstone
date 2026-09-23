import React, { useState, useEffect } from 'react';
import Login from './components/Login';
import SuperAdminSidebar from './components/SuperAdminSidebar';
import SuperAdminDashboard from './components/SuperAdminDashboard';
import EditRequestForm from './components/EditRequestForm';
import Analytics from './components/Analytics';
import UserManagement from './components/UserManagement';
import './App.css';

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    return localStorage.getItem('superadminAuth') === 'true';
  });
  const [activePage, setActivePage] = useState(() => {
    return localStorage.getItem('superadminActivePage') || 'dashboard';
  });

  const handleLogin = () => {
    setIsLoggedIn(true);
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    localStorage.removeItem('superadminAuth');
  };

  const handleNavigate = (page) => {
    setActivePage(page);
  };

  // Save active page to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('superadminActivePage', activePage);
  }, [activePage]);

  if (!isLoggedIn) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="superadmin-app">
      <SuperAdminSidebar activePage={activePage} onNavigate={handleNavigate} />
      <div className="superadmin-main">
        {activePage === 'dashboard' && <SuperAdminDashboard />}
        {activePage === 'edit-request' && <EditRequestForm />}
        {activePage === 'analytics' && <Analytics />}
        {activePage === 'user-management' && <UserManagement />}
      </div>
    </div>
  );
}

export default App;
