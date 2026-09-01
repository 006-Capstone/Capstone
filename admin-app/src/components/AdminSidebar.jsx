import React, { useState, useEffect } from 'react';
import { 
  FaThLarge, 
  FaTicketAlt, 
  FaChartLine, 
  FaClipboard, 
  FaComment, 
  FaUserCircle, 
  FaSignOutAlt,
  FaTimes
} from 'react-icons/fa';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';
import '../styles/AdminSidebar.css';

const AdminSidebar = ({ activePage, onNavigate, department, onOpenProfile, isOpen = false, onClose }) => {
  const [staffName, setStaffName] = useState('Staff User');
  const [profilePicture, setProfilePicture] = useState('');

  useEffect(() => {
    // Load staff data from localStorage
    const staffData = localStorage.getItem('staffData');
    if (staffData) {
      try {
        const parsed = JSON.parse(staffData);
        let fullName = parsed.fullName || '';
        if (!fullName && (parsed.firstName || parsed.lastName)) {
          fullName = `${parsed.firstName || ''} ${parsed.lastName || ''}`.trim();
        }
        setStaffName(fullName || 'Staff User');
        setProfilePicture(parsed.profilePicture || '');
      } catch (e) {
        console.error('Error parsing staff data:', e);
      }
    }
  }, []);

  const handleLogout = async () => {
    if (window.confirm('Are you sure you want to logout?')) {
      try {
        await signOut(auth);
        localStorage.removeItem('staffData');
        window.location.reload();
      } catch (error) {
        console.error('Logout error:', error);
        alert('Failed to logout. Please try again.');
      }
    }
  };

  const handleItemClick = (page) => {
    onNavigate(page);
    if (onClose) onClose();
  };
  
  return (
    <>
      <div 
        className={`admin-sidebar-backdrop ${isOpen ? 'show' : ''}`}
        onClick={onClose}
        aria-hidden="true"
      />
      <aside className={`admin-sidebar ${isOpen ? 'sidebar--open' : ''}`}>
        <button 
          className="sidebar-close-btn"
          onClick={onClose}
          aria-label="Close menu"
        >
          <FaTimes />
        </button>

        {/* School crest and institution branding at the top */}
        <div className="sidebar-logo">
          <div className="sidebar-logo-crest">
            <img
              src="/school-logo.jpg"
              alt="Academia De San Jose"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
            <span className="sidebar-logo-fallback" aria-hidden="true">ASJ</span>
          </div>
          <div className="sidebar-brand-text">
            <span className="sidebar-school-title">ACADEMIA DE SAN JOSE</span>
            <span className="sidebar-portal-badge">ADMIN PORTAL</span>
          </div>
        </div>

        <nav className="sidebar-menu">
          <div
            className={`sidebar-item ${activePage === 'dashboard' ? 'active' : ''}`}
            onClick={() => handleItemClick('dashboard')}
            role="button"
            tabIndex={0}
          >
            <FaThLarge className="sidebar-icon" />
            <span className="sidebar-label">Dashboard</span>
          </div>
          
          <div
            className={`sidebar-item ${(activePage === 'my-tickets' || activePage === 'ticket-details') ? 'active' : ''}`}
            onClick={() => handleItemClick('my-tickets')}
            role="button"
            tabIndex={0}
          >
            <FaTicketAlt className="sidebar-icon" />
            <span className="sidebar-label">My Requests</span>
          </div>
          
          <div
            className={`sidebar-item ${activePage === 'analytics' ? 'active' : ''}`}
            onClick={() => handleItemClick('analytics')}
            role="button"
            tabIndex={0}
          >
            <FaChartLine className="sidebar-icon" />
            <span className="sidebar-label">Analytics</span>
          </div>
          
          <div
            className={`sidebar-item ${activePage === 'bulletin' ? 'active' : ''}`}
            onClick={() => handleItemClick('bulletin')}
            role="button"
            tabIndex={0}
          >
            <FaClipboard className="sidebar-icon" />
            <span className="sidebar-label">Bulletin Board</span>
          </div>
          
          <div
            className={`sidebar-item ${activePage === 'feedback' ? 'active' : ''}`}
            onClick={() => handleItemClick('feedback')}
            role="button"
            tabIndex={0}
          >
            <FaComment className="sidebar-icon" />
            <span className="sidebar-label">Feedback</span>
          </div>
        </nav>
        
        <div className="sidebar-footer">
          <div 
            className="sidebar-user" 
            onClick={() => {
              if (onClose) onClose();
              onOpenProfile();
            }} 
            title="Edit Profile Settings"
            role="button"
            tabIndex={0}
          >
            {profilePicture ? (
              <img src={profilePicture} alt="Profile" className="user-icon-img" />
            ) : (
              <FaUserCircle className="user-icon" />
            )}
            <div className="user-info">
              <p className="user-name">{staffName}</p>
              <span className="user-department">{department} DEPARTMENT</span>
            </div>
          </div>
          
          <button className="logout-button" onClick={handleLogout} type="button">
            <FaSignOutAlt className="logout-icon" />
            <span>Logout</span>
          </button>
        </div>
      </aside>
    </>
  );
};

export default AdminSidebar;
