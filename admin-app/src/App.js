import React, { useState, useEffect } from 'react';
import { FaBars, FaUserCircle } from 'react-icons/fa';
import Login from './components/Login';
import ForgotPassword from './components/ForgotPassword';
import ChangePasswordModal from './components/ChangePasswordModal';
import AdminSidebar from './components/AdminSidebar';
import AdminDashboard from './components/AdminDashboard';
import MyTickets from './components/MyTickets';
import TicketDetails from './components/TicketDetails';
import Analytics from './components/Analytics';
import BulletinBoard from './components/BulletinBoard';
import Feedback from './components/Feedback';
import ProfileSettings from './components/ProfileSettings';
import './App.css';

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    // Check if staffData exists (from Firebase authentication)
    const staffData = localStorage.getItem('staffData');
    return staffData !== null;
  });
  const [selectedDepartment, setSelectedDepartment] = useState(() => {
    const staffData = localStorage.getItem('staffData');
    if (staffData) {
      try {
        const parsed = JSON.parse(staffData);
        return parsed.office || '';
      } catch (e) {
        return '';
      }
    }
    return '';
  });
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [activePage, setActivePage] = useState(() => {
    const stored = localStorage.getItem('adminActivePage');
    return stored || 'dashboard';
  });
  const [selectedTicket, setSelectedTicket] = useState(() => {
    // Restore selected ticket from localStorage if available
    const stored = localStorage.getItem('selectedTicket');
    return stored ? JSON.parse(stored) : null;
  });
  const [showProfileSettings, setShowProfileSettings] = useState(false);
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [staffData, setStaffData] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Check if staff must change password on login
  useEffect(() => {
    if (isLoggedIn) {
      const storedData = localStorage.getItem('staffData');
      if (storedData) {
        const data = JSON.parse(storedData);
        setStaffData(data);
        setMustChangePassword(data.mustChangePassword === true);
      }
    }
  }, [isLoggedIn]);

  // Close the mobile drawer on page changes
  useEffect(() => {
    setIsSidebarOpen(false);
  }, [activePage]);

  // Close the mobile drawer on Escape key
  useEffect(() => {
    if (!isSidebarOpen) return undefined;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setIsSidebarOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSidebarOpen]);

  const handleLogin = (department) => {
    setSelectedDepartment(department);
    setIsLoggedIn(true);
    setActivePage('dashboard'); // Always go to dashboard on login
    localStorage.setItem('adminActivePage', 'dashboard'); // Reset to dashboard
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setSelectedDepartment('');
    localStorage.removeItem('staffData');
    localStorage.removeItem('selectedTicket'); // Clear selected ticket on logout
  };

  const handleNavigate = (page, ticket = null) => {
    setActivePage(page);
    setIsSidebarOpen(false);
    if (ticket) {
      setSelectedTicket(ticket);
      // Save to localStorage so it persists on page refresh
      localStorage.setItem('selectedTicket', JSON.stringify(ticket));
    } else if (page !== 'ticket-details') {
      // Clear selected ticket from localStorage when navigating away from ticket details
      localStorage.removeItem('selectedTicket');
      setSelectedTicket(null);
    }
  };

  // Open a ticket straight from a notification click — same path as
  // "View Ticket" buttons (sets the ticket + navigates to its details).
  const handleViewTicket = (ticket) => {
    setSelectedTicket(ticket);
    // Save to localStorage so it persists on page refresh
    localStorage.setItem('selectedTicket', JSON.stringify(ticket));
    setActivePage('ticket-details');
  };

  const handlePasswordChanged = () => {
    setMustChangePassword(false);
    // Reload staff data
    const storedData = localStorage.getItem('staffData');
    if (storedData) {
      setStaffData(JSON.parse(storedData));
    }
  };

  // Save active page to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('adminActivePage', activePage);
  }, [activePage]);

  if (!isLoggedIn) {
    return (
      <>
        <Login onLogin={handleLogin} onForgotPassword={() => setShowForgotPassword(true)} />
        {showForgotPassword && (
          <ForgotPassword onClose={() => setShowForgotPassword(false)} />
        )}
      </>
    );
  }

  // Show password change modal if required
  if (mustChangePassword && staffData) {
    return <ChangePasswordModal staffData={staffData} onPasswordChanged={handlePasswordChanged} />;
  }

  return (
    <div className="admin-app-layout">
      {/* Mobile Topbar (visible only < 1024px) */}
      <header className="admin-mobile-topbar">
        <button
          className="admin-hamburger-btn"
          onClick={() => setIsSidebarOpen(true)}
          aria-label="Open menu"
        >
          <FaBars />
        </button>
        <div className="admin-mobile-brand">
          <img
            src="/school-logo.jpg"
            alt="ASJ Logo"
            className="admin-mobile-logo"
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
          <span className="admin-mobile-dept">{selectedDepartment} OFFICE</span>
        </div>
        <div className="admin-mobile-actions">
          <button
            className="admin-mobile-profile-btn"
            onClick={() => setShowProfileSettings(true)}
            aria-label="Profile Settings"
          >
            <FaUserCircle />
          </button>
        </div>
      </header>

      <div className="admin-app-body">
        <AdminSidebar 
          activePage={activePage} 
          onNavigate={handleNavigate}
          department={selectedDepartment.toUpperCase()}
          onOpenProfile={() => setShowProfileSettings(true)}
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
        />
        <main className="admin-main-content">
          {activePage === 'dashboard' && (
            <AdminDashboard 
              department={selectedDepartment} 
              onNavigate={handleNavigate} 
              onViewRequest={handleViewTicket} 
            />
          )}
          {activePage === 'my-tickets' && (
            <MyTickets 
              department={selectedDepartment} 
              onNavigate={handleNavigate} 
              onViewRequest={handleViewTicket} 
            />
          )}
          {activePage === 'ticket-details' && selectedTicket && (
            <TicketDetails 
              ticketData={selectedTicket} 
              department={selectedDepartment} 
              onNavigate={handleNavigate} 
              onViewRequest={handleViewTicket} 
            />
          )}
          {activePage === 'analytics' && (
            <Analytics 
              department={selectedDepartment} 
              onViewRequest={handleViewTicket} 
            />
          )}
          {activePage === 'bulletin' && (
            <BulletinBoard 
              department={selectedDepartment} 
              onViewRequest={handleViewTicket} 
            />
          )}
          {activePage === 'feedback' && (
            <Feedback 
              department={selectedDepartment} 
              onViewRequest={handleViewTicket} 
            />
          )}
        </main>
      </div>
      
      {showProfileSettings && (
        <ProfileSettings onClose={() => setShowProfileSettings(false)} />
      )}
    </div>
  );
}

export default App;
