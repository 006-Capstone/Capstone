import React, { useState, useEffect } from 'react';
import Login from './components/Login';
import ForgotPassword from './components/ForgotPassword';
import GuestLogin from './components/GuestLogin';
import ChangePasswordModal from './components/ChangePasswordModal';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import MyRequest from './components/MyRequest';
import RequestDetails from './components/RequestDetails';
import NewRequest from './components/NewRequest';
import Feedback from './components/Feedback';
import MyFeedback from './components/MyFeedback';
import BulletinBoard from './components/BulletinBoard';
import FAQs from './components/FAQs';
import IdleTimeout from './components/IdleTimeout';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';
import { db, auth } from './firebase';
import { signInAnonymously } from 'firebase/auth';
import './App.css';

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    return localStorage.getItem('studentLoggedIn') === 'true';
  });
  const [isGuest, setIsGuest] = useState(() => {
    return localStorage.getItem('studentIsGuest') === 'true';
  });
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [activePage, setActivePage] = useState(() => {
    const stored = localStorage.getItem('studentActivePage');
    return stored || 'dashboard';
  });
  const [selectedRequest, setSelectedRequest] = useState(() => {
    // Restore selected request from localStorage if available
    const stored = localStorage.getItem('selectedRequest');
    return stored ? JSON.parse(stored) : null;
  }); // Store selected request
  const [feedbackRequest, setFeedbackRequest] = useState(null); // Store request for feedback
  // Status filter pre-applied when opening Request History from the dashboard cards
  const [requestStatusFilter, setRequestStatusFilter] = useState('All Status');
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [studentData, setStudentData] = useState(null);
  const [hasUnreadBulletin, setHasUnreadBulletin] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false); // Mobile drawer state

  // Save active page to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('studentActivePage', activePage);
  }, [activePage]);

  // Close the mobile drawer whenever the active page changes
  useEffect(() => {
    setIsSidebarOpen(false);
  }, [activePage]);

  // Close the mobile drawer with the Escape key
  useEffect(() => {
    if (!isSidebarOpen) return undefined;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsSidebarOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSidebarOpen]);

  // Check for unread bulletin posts
  useEffect(() => {
    if (!isLoggedIn || isGuest) return;

    const announcementsQuery = query(
      collection(db, 'announcements'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(announcementsQuery, (querySnapshot) => {
      const currentAnnouncementIds = querySnapshot.docs.map(doc => doc.id);
      const readAnnouncementsStr = localStorage.getItem('readAnnouncements');
      
      if (!readAnnouncementsStr) {
        // No announcements have been read yet
        setHasUnreadBulletin(currentAnnouncementIds.length > 0);
      } else {
        const readAnnouncements = JSON.parse(readAnnouncementsStr);
        // Check if there are any new announcements not in the read list
        const hasUnread = currentAnnouncementIds.some(id => !readAnnouncements.includes(id));
        setHasUnreadBulletin(hasUnread);
      }
    });

    return () => unsubscribe();
  }, [isLoggedIn, isGuest]);

  // Check if user must change password on login
  useEffect(() => {
    if (isLoggedIn && !isGuest) {
      const storedData = localStorage.getItem('studentData');
      if (storedData) {
        const data = JSON.parse(storedData);
        setStudentData(data);
        setMustChangePassword(data.mustChangePassword === true);
      }
    }
  }, [isLoggedIn, isGuest]);

  const handleLogin = () => {
    setIsLoggedIn(true);
    setIsGuest(false);
    setActivePage('dashboard'); // Always go to dashboard on login
    localStorage.setItem('studentLoggedIn', 'true');
    localStorage.setItem('studentIsGuest', 'false');
    localStorage.setItem('studentActivePage', 'dashboard'); // Reset to dashboard
  };

  const handleGuestLogin = async () => {
    try {
      // Sign in anonymously for guest access
      await signInAnonymously(auth);
      console.log('[Guest] Signed in anonymously');
      
      setIsGuest(true);
      setIsLoggedIn(false);
      localStorage.setItem('studentIsGuest', 'true');
      localStorage.setItem('studentLoggedIn', 'false');
    } catch (error) {
      console.error('[Guest] Error signing in anonymously:', error);
      alert('Failed to access guest mode. Please try again.');
    }
  };

  const handleLogout = async () => {
    try {
      // Sign out if authenticated (including anonymous users)
      if (auth.currentUser) {
        await auth.signOut();
        console.log('[Logout] Signed out');
      }
    } catch (error) {
      console.error('[Logout] Error signing out:', error);
    }
    
    setIsLoggedIn(false);
    setIsGuest(false);
    localStorage.removeItem('studentLoggedIn');
    localStorage.removeItem('studentIsGuest');
    localStorage.removeItem('studentData');
    localStorage.removeItem('selectedRequest'); // Clear selected request on logout
    setActivePage('dashboard'); // Reset to dashboard on logout
  };

  const handlePasswordChanged = () => {
    setMustChangePassword(false);
    // Reload student data
    const storedData = localStorage.getItem('studentData');
    if (storedData) {
      setStudentData(JSON.parse(storedData));
    }
  };
  
  const handleViewRequestDetails = (request) => {
    setSelectedRequest(request);
    // Save to localStorage so it persists on page refresh
    localStorage.setItem('selectedRequest', JSON.stringify(request));
    setActivePage('request-details');
  };

  // Plain navigation to Request History (sidebar, breadcrumbs, "View all")
  // always shows all requests — no status filter.
  const handleNavigate = (page, data = null) => {
    if (page === 'request') setRequestStatusFilter('All Status');
    if (page === 'feedback-for-request' && data) {
      setFeedbackRequest(data);
    }
    // Clear selected request from localStorage when navigating away from request details
    if (page !== 'request-details') {
      localStorage.removeItem('selectedRequest');
      setSelectedRequest(null);
    }
    setActivePage(page);
  };

  // Dashboard stat cards: open Request History pre-filtered by status.
  const handleViewRequests = (statusFilter) => {
    setRequestStatusFilter(statusFilter || 'All Status');
    setActivePage('request');
  };

  // Clear unread bulletin indicator when navigating to bulletin board
  useEffect(() => {
    if (activePage === 'bulletin') {
      setHasUnreadBulletin(false);
    }
  }, [activePage]);

  const renderPage = () => {
    switch(activePage) {
      case 'dashboard':
        return <Dashboard onNavigate={handleNavigate} onViewDetails={handleViewRequestDetails} onViewRequests={handleViewRequests} />;
      case 'request':
        return <MyRequest onViewDetails={handleViewRequestDetails} onNavigate={handleNavigate} initialStatusFilter={requestStatusFilter} />;
      case 'request-details':
        return <RequestDetails requestData={selectedRequest} onNavigate={handleNavigate} />;
      case 'new-request':
        return <NewRequest onNavigate={handleNavigate} />;
      case 'my-feedback':
        return <MyFeedback onNavigate={handleNavigate} />;
      case 'bulletin':
        return <BulletinBoard />;
      case 'feedback':
        return <Feedback onNavigate={setActivePage} />;
      case 'feedback-for-request':
        return <Feedback selectedRequest={feedbackRequest} onNavigate={handleNavigate} />;
      case 'feedback-guidance':
        return <Feedback selectedOffice="guidance" onNavigate={setActivePage} />;
      case 'feedback-library':
        return <Feedback selectedOffice="library" onNavigate={setActivePage} />;
      case 'feedback-registrar':
        return <Feedback selectedOffice="registrar" onNavigate={setActivePage} />;
      case 'feedback-finance':
        return <Feedback selectedOffice="finance" onNavigate={setActivePage} />;
      case 'faq':
        return <FAQs />;
      default:
        return <Dashboard onNavigate={handleNavigate} onViewDetails={handleViewRequestDetails} onViewRequests={handleViewRequests} />;
    }
  };

  if (!isLoggedIn && !isGuest) {
    if (showForgotPassword) {
      return <ForgotPassword onClose={() => setShowForgotPassword(false)} />;
    }
    return <Login onLogin={handleLogin} onGuestLogin={handleGuestLogin} onForgotPassword={() => setShowForgotPassword(true)} />;
  }

  if (isGuest) {
    return <GuestLogin />;
  }

  // Show password change modal if required
  if (mustChangePassword && studentData) {
    return <ChangePasswordModal studentData={studentData} onPasswordChanged={handlePasswordChanged} />;
  }

  return (
    <div className="app">
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <Header
        onMenuToggle={() => setIsSidebarOpen(true)}
        isSidebarOpen={isSidebarOpen}
        onViewRequest={handleViewRequestDetails}
      />
      <div className="app-body">
        <Sidebar
          activePage={activePage}
          onNavigate={handleNavigate}
          hasUnreadBulletin={hasUnreadBulletin}
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
        />
        <main id="main-content" className="main-content" tabIndex={-1}>
          {renderPage()}
        </main>
      </div>
      {/* Idle timeout component - only active for logged-in students (not guests) */}
      <IdleTimeout onLogout={handleLogout} isGuest={isGuest} />
    </div>
  );
}

export default App;
