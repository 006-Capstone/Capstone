import { useState, useRef, useEffect } from 'react';
import {
  MdDashboard,
  MdDescription,
  MdViewList,
  MdThumbUp,
  MdHelp,
  MdExpandMore,
  MdExpandLess,
  MdClose,
  MdAccessTime,
  MdEmail,
  MdLocationOn
} from 'react-icons/md';
import '../styles/Sidebar.css';

const FEEDBACK_OFFICES = [
  { label: 'My Feedback', page: 'my-feedback', isSpecial: true },
  { label: 'Guidance', page: 'feedback-guidance' },
  { label: 'Library', page: 'feedback-library' },
  { label: 'Registrar', page: 'feedback-registrar' },
  { label: 'Finance', page: 'feedback-finance' }
];

function Sidebar({ activePage, onNavigate, hasUnreadBulletin = false, isOpen = false, onClose }) {
  const [feedbackOpen, setFeedbackOpen] = useState(activePage.startsWith('feedback'));
  const closeBtnRef = useRef(null);

  // Move focus into the drawer when it opens and restore it to the trigger
  // (hamburger) when it closes, for keyboard accessibility.
  useEffect(() => {
    if (isOpen) {
      closeBtnRef.current?.focus();
    } else {
      const toggle = document.querySelector('.menu-toggle');
      if (toggle && window.matchMedia('(max-width: 1023px)').matches) {
        toggle.focus();
      }
    }
  }, [isOpen]);

  const handleNavigate = (page) => {
    onNavigate(page);
    onClose?.(); // Close the mobile drawer after navigating
  };

  const handleToggleFeedback = () => {
    setFeedbackOpen((prev) => {
      const next = !prev;
      if (next && !isOpen && activePage !== 'feedback') {
        handleNavigate('feedback');
      }
      return next;
    });
  };

  return (
    <>
      {/* Backdrop — only visible when the drawer is open on small screens */}
      <div
        className={`sidebar-backdrop ${isOpen ? 'sidebar-backdrop--show' : ''}`}
        onClick={onClose}
        aria-hidden="true"
      />

      <aside id="primary-sidebar" className={`sidebar ${isOpen ? 'sidebar--open' : ''}`} aria-label="Primary navigation">
        {/* Close button — only visible on mobile drawer */}
        <button
          type="button"
          ref={closeBtnRef}
          className="sidebar-close-btn"
          onClick={onClose}
          aria-label="Close navigation menu"
        >
          <MdClose aria-hidden="true" />
        </button>

        <nav className="menu" aria-label="Main">
          <button
            type="button"
            className={activePage === 'dashboard' ? 'active' : ''}
            onClick={() => handleNavigate('dashboard')}
            aria-current={activePage === 'dashboard' ? 'page' : undefined}
          >
            <MdDashboard aria-hidden="true" />
            <span>Dashboard</span>
          </button>

          <button
            type="button"
            className={(activePage === 'request' || activePage === 'request-details' || activePage === 'new-request') ? 'active' : ''}
            onClick={() => handleNavigate('request')}
            aria-current={(activePage === 'request' || activePage === 'request-details' || activePage === 'new-request') ? 'page' : undefined}
          >
            <MdDescription aria-hidden="true" />
            <span>My Request</span>
          </button>

          <button
            type="button"
            className={activePage === 'bulletin' ? 'active' : ''}
            onClick={() => handleNavigate('bulletin')}
            aria-current={activePage === 'bulletin' ? 'page' : undefined}
          >
            <MdViewList aria-hidden="true" />
            <span>Bulletin Board</span>
            {hasUnreadBulletin && (
              <>
                <span className="unread-indicator" aria-hidden="true" />
                <span className="sr-only">Unread announcements</span>
              </>
            )}
          </button>

          <div className="menu-group">
            <button
              type="button"
              className={activePage.startsWith('feedback') ? 'active' : ''}
              onClick={handleToggleFeedback}
              aria-expanded={feedbackOpen}
              aria-controls="feedback-submenu"
              aria-current={activePage.startsWith('feedback') ? 'page' : undefined}
            >
              <MdThumbUp aria-hidden="true" />
              <span>Feedback</span>
              {feedbackOpen ? (
                <MdExpandLess className="expand-icon" aria-hidden="true" />
              ) : (
                <MdExpandMore className="expand-icon" aria-hidden="true" />
              )}
            </button>

            {feedbackOpen && (
              <div id="feedback-submenu" className="submenu">
                {FEEDBACK_OFFICES.map((office) => (
                  <button
                    type="button"
                    key={office.page}
                    className={`submenu-item ${office.isSpecial ? 'submenu-special' : ''} ${activePage === office.page ? 'submenu-active' : ''}`}
                    onClick={() => handleNavigate(office.page)}
                    aria-current={activePage === office.page ? 'page' : undefined}
                  >
                    {office.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            type="button"
            className={activePage === 'faq' ? 'active' : ''}
            onClick={() => handleNavigate('faq')}
            aria-current={activePage === 'faq' ? 'page' : undefined}
          >
            <MdHelp aria-hidden="true" />
            <span>FAQ's</span>
          </button>
        </nav>

        <address className="office-info">
          <div className="office-info-block">
            <div className="office-info-title-row">
              <MdAccessTime className="office-info-icon" aria-hidden="true" />
              <h4>Office Hours</h4>
            </div>
            <p>Mon – Fri: 7:00 AM – 7:00 PM</p>
            <p>Sat: 9:00 AM – 3:00 PM</p>
          </div>
          <div className="office-info-divider" aria-hidden="true" />
          <div className="office-info-row">
            <MdEmail className="office-info-icon" aria-hidden="true" />
            <span className="office-info-value">academiadesanjose@gmail.com</span>
          </div>
          <div className="office-info-row">
            <MdLocationOn className="office-info-icon" aria-hidden="true" />
            <span className="office-info-value">8WHV+322, S.B. Cabahug, Mandaue</span>
          </div>
        </address>
      </aside>
    </>
  );
}

export default Sidebar;
