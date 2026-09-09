import React, { useState, useEffect } from 'react';
import { FaBars } from 'react-icons/fa';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from './firebase';
import Login from './components/Login';
import SuperAdminSidebar from './components/SuperAdminSidebar';
import SuperAdminDashboard from './components/SuperAdminDashboard';
import EditRequestForm from './components/EditRequestForm';
import Analytics from './components/Analytics';
import UserManagement from './components/UserManagement';
import LoadingSpinner from './components/LoadingSpinner';
import './App.css';

function App() {
  const [authChecking, setAuthChecking] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    return localStorage.getItem('superadminAuth') === 'true';
  });
  const [activePage, setActivePage] = useState(() => {
    return localStorage.getItem('superadminActivePage') || 'dashboard';
  });
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user && localStorage.getItem('superadminAuth') === 'true') {
        setIsLoggedIn(true);
      } else if (!user) {
        // If Firebase Auth has no active session, user cannot query protected Firestore data
        setIsLoggedIn(false);
        localStorage.removeItem('superadminAuth');
      }
      setAuthChecking(false);
    });

    return () => unsubscribe();
  }, []);

  const handleLogin = () => {
    setIsLoggedIn(true);
    setActivePage('dashboard'); // Always go to dashboard on login
    localStorage.setItem('superadminActivePage', 'dashboard'); // Reset to dashboard
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error('Sign out error:', err);
    }
    setIsLoggedIn(false);
    localStorage.removeItem('superadminAuth');
    localStorage.removeItem('superadminData');
  };

  const handleNavigate = (page) => {
    setActivePage(page);
    setIsSidebarOpen(false); // Close the mobile drawer after navigating
  };

  // Close the mobile drawer with the Escape key and lock body scroll while open
  useEffect(() => {
    if (!isSidebarOpen) return undefined;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsSidebarOpen(false);
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isSidebarOpen]);

  // Save active page to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('superadminActivePage', activePage);
  }, [activePage]);

  if (authChecking) {
    return <LoadingSpinner message="Checking superadmin session..." fullScreen={true} />;
  }

  if (!isLoggedIn) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="superadmin-app">
      <SuperAdminSidebar
        activePage={activePage}
        onNavigate={handleNavigate}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        onLogout={handleLogout}
      />
      <div className="superadmin-main">
        {/* Mobile-only top bar with hamburger to open the drawer */}
        <div className="mobile-topbar">
          <button
            type="button"
            className="mobile-menu-toggle"
            onClick={() => setIsSidebarOpen(true)}
            aria-label="Open navigation menu"
            aria-expanded={isSidebarOpen}
          >
            <FaBars aria-hidden="true" />
          </button>
          <img src="/school-logo.jpg" alt="School logo" className="mobile-logo" />
        </div>
        {activePage === 'dashboard' && <SuperAdminDashboard onNavigate={handleNavigate} />}
        {activePage === 'edit-request' && <EditRequestForm />}
        {activePage === 'analytics' && <Analytics />}
        {activePage === 'user-management' && <UserManagement />}
      </div>
    </div>
  );
}

export default App;
