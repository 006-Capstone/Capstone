import React, { useState, useMemo } from 'react';
import {
  FaTimes,
  FaQuestionCircle,
  FaSearch,
  FaChevronDown,
  FaChevronUp,
  FaIdCard,
  FaKey,
  FaQrcode,
  FaUserFriends,
  FaShieldAlt,
  FaGraduationCap,
  FaExternalLinkAlt,
  FaEnvelope,
  FaClock,
  FaTools
} from 'react-icons/fa';
import '../styles/StudentFAQModal.css';

const FAQ_ITEMS = [
  {
    id: 'first-time-credentials',
    category: 'account',
    icon: FaGraduationCap,
    question: 'How do I log in to my student account for the first time?',
    answer: 'To log in for the first time, use the last four digits of your student ID and the temporary password sent to your email. Upon your initial login, the system will prompt you to change your temporary password to a secure permanent password.'
  },
  {
    id: 'student-id-format',
    category: 'account',
    icon: FaIdCard,
    question: 'What is the format of my Student ID?',
    answer: 'Enter the 4-digit student number assigned to you upon enrollment (e.g., 1001). If your school ID card shows the full academic year format such as 05-2425-001001, you can simply enter the last 4 digits (1001).'
  },
  {
    id: 'missing-activation-email',
    category: 'admissions',
    icon: FaEnvelope,
    question: "What should I do if I didn't receive my activation email with temporary password?",
    answer: 'If you cannot find your activation email, please check your Spam or Junk mail folder first. If it is still missing, follow these steps:\n• Click the "Contact Admissions" button located at the bottom of the Login page.\n• Fill out the brief inquiry form with your Student ID Number, Active Contact Email, and describe your problem.\n• Click Submit.\nNote: A Super Admin will review your account details and resend your temporary password directly to your verified email address.'
  },
  {
    id: 'forgot-password',
    category: 'password',
    icon: FaKey,
    question: 'I forgot my password. How can I regain access?',
    answer: 'If you forgot your password, click "Forgot Password?" above the password input on the login page. Enter your 4-digit Student ID, and an email containing a 6-digit verification code will be sent to your registered address to initiate a password reset.'
  },
  {
    id: 'processing-time',
    category: 'admissions',
    icon: FaClock,
    question: 'How long does it take for a Super Admin to process my "Contact Admissions" request?',
    answer: 'Account credential requests and inquiries submitted through the "Contact Admissions" button are reviewed during regular school office hours (Monday to Friday, 8:00 AM – 5:00 PM). You will receive your access credentials or response within 1 business day.'
  },
  {
    id: 'technical-glitches',
    category: 'admissions',
    icon: FaTools,
    question: 'Who can I contact if I am experiencing technical glitches during login?',
    answer: 'For technical issues, submit a quick alert using the "Contact Admissions" button on the login interface. Ensure you provide an accurate contact email where the administrative team can reach you with resolution updates.'
  },
  {
    id: 'account-suspended',
    category: 'admissions',
    icon: FaShieldAlt,
    question: 'What should I do if my account status is Suspended or Archived?',
    answer: 'If your student account has been suspended or archived, you can submit an assistance request directly to the Super Admin using the "Contact Admissions" button at the bottom of the login page. Fill in your Student ID, registered email, and explain your situation. The Super Admin will review your account status and assist in restoring or reactivating your access.'
  },
  {
    id: 'qr-code-login',
    category: 'qr',
    icon: FaQrcode,
    question: 'How do I sign in using my Student QR Code Badge?',
    answer: 'Click "Login with QR code" on the login screen. You can either hold your printed or digital student badge in front of your device\'s camera, or click "Upload QR Image" to select a photo of your badge. QR badges can be downloaded at any time from your Profile Settings once logged in.'
  },
  {
    id: 'guest-requests',
    category: 'guest',
    icon: FaUserFriends,
    question: 'Can I submit requests or inquiries without logging in?',
    answer: 'Yes! Click "Continue as Guest" to submit official document requests, inquiries, or admissions assistance. You will receive a unique Reference Number (e.g., #REQ-123-456-789) that allows you to track real-time processing status without needing an account.'
  }
];

const CATEGORIES = [
  { id: 'all', label: 'All FAQs' },
  { id: 'account', label: 'First Login & ID' },
  { id: 'admissions', label: 'Admissions & Support' },
  { id: 'password', label: 'Passwords & Recovery' },
  { id: 'qr', label: 'QR Code Login' },
  { id: 'guest', label: 'Guest Tracking' }
];

const StudentFAQModal = ({ isOpen, onClose, onOpenContactAdmissions }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [expandedId, setExpandedId] = useState('student-id-format'); // First item open by default

  const filteredFaqs = useMemo(() => {
    return FAQ_ITEMS.filter((item) => {
      const matchesCategory = activeCategory === 'all' || item.category === activeCategory;
      const term = searchTerm.toLowerCase().trim();
      const matchesSearch =
        !term ||
        item.question.toLowerCase().includes(term) ||
        item.answer.toLowerCase().includes(term);
      return matchesCategory && matchesSearch;
    });
  }, [searchTerm, activeCategory]);

  if (!isOpen) return null;

  const toggleAccordion = (id) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="faq-modal-overlay" onClick={onClose}>
      <div 
        className="faq-modal-card" 
        onClick={(e) => e.stopPropagation()} 
        role="dialog" 
        aria-modal="true" 
        aria-labelledby="faq-modal-title"
      >
        {/* Header */}
        <div className="faq-modal-header">
          <div className="faq-header-title-wrap">
            <div className="faq-header-icon-wrap" aria-hidden="true">
              <FaQuestionCircle />
            </div>
            <div>
              <h2 id="faq-modal-title" className="faq-modal-title">
                Frequently Asked Questions
              </h2>
              <p className="faq-modal-subtitle">
                Quick answers to common questions about student login, accounts, and portal access.
              </p>
            </div>
          </div>
          <button
            type="button"
            className="faq-modal-close"
            onClick={onClose}
            aria-label="Close FAQ modal"
          >
            <FaTimes />
          </button>
        </div>

        {/* Search Bar */}
        <div className="faq-search-wrap">
          <FaSearch className="faq-search-icon" aria-hidden="true" />
          <input
            type="text"
            className="faq-search-input"
            placeholder="Search questions, keywords (e.g. ID, password, QR)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button
              type="button"
              className="faq-search-clear"
              onClick={() => setSearchTerm('')}
              aria-label="Clear search"
            >
              <FaTimes />
            </button>
          )}
        </div>

        {/* Category Pills */}
        <div className="faq-category-pills">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              className={`faq-pill ${activeCategory === cat.id ? 'active' : ''}`}
              onClick={() => setActiveCategory(cat.id)}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Accordion FAQ List */}
        <div className="faq-accordion-list">
          {filteredFaqs.length === 0 ? (
            <div className="faq-empty-state">
              <FaQuestionCircle className="faq-empty-icon" />
              <p className="faq-empty-title">No matching questions found</p>
              <p className="faq-empty-desc">
                Try searching for different keywords or select "All FAQs" above.
              </p>
            </div>
          ) : (
            filteredFaqs.map((faq) => {
              const isExpanded = expandedId === faq.id;
              const IconComponent = faq.icon || FaQuestionCircle;

              return (
                <div
                  key={faq.id}
                  className={`faq-accordion-item ${isExpanded ? 'expanded' : ''}`}
                >
                  <button
                    type="button"
                    className="faq-accordion-header"
                    onClick={() => toggleAccordion(faq.id)}
                    aria-expanded={isExpanded}
                  >
                    <div className="faq-question-left">
                      <span className="faq-item-icon" aria-hidden="true">
                        <IconComponent />
                      </span>
                      <span className="faq-question-text">{faq.question}</span>
                    </div>
                    <span className="faq-chevron" aria-hidden="true">
                      {isExpanded ? <FaChevronUp /> : <FaChevronDown />}
                    </span>
                  </button>

                  {isExpanded && (
                    <div className="faq-accordion-body">
                      {faq.answer.split('\n').map((line, idx) => {
                        let lineClass = '';
                        if (line.startsWith('•')) {
                          lineClass = 'faq-bullet-line';
                        } else if (line.startsWith('Note:')) {
                          lineClass = 'faq-note-line';
                        }
                        return (
                          <p key={idx} className={lineClass}>
                            {line}
                          </p>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer / Help Route */}
        <div className="faq-modal-footer">
          <div className="faq-footer-help-text">
            <span>Still can't find what you need?</span>
          </div>
          <div className="faq-footer-actions">
            <button
              type="button"
              className="faq-admissions-btn"
              onClick={onOpenContactAdmissions}
            >
              <span>Contact Admissions</span>
              <FaExternalLinkAlt className="faq-btn-icon" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentFAQModal;
