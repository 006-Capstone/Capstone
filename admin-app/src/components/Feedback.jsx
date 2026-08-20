import React, { useState, useEffect, useMemo } from 'react';
import { FaBell, FaStar, FaUserCircle, FaCalendarAlt, FaTimes } from 'react-icons/fa';
import { BsChatDots } from 'react-icons/bs';
import { collection, query, where, onSnapshot, doc, updateDoc, arrayUnion, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import Notifications from './Notifications';
import DateRangeFilterDropdown from './DateRangeFilterDropdown';
import '../styles/Feedback.css';

const EMPTY_FILTER = { from: '', to: '' };

// Demo feedback (static). Real feedback from the feedback collection can be
// dropped in later — it carries rating, comment, and createdAt fields, which
// the helpers below already understand.
const DEMO_FEEDBACK = [
  {
    name: 'RICKY LIAM',
    date: '03-11-2026',
    rating: 5,
    comment: 'The transaction process was fast and smooth. It saved time and improved overall user experience.',
    responseTime: 5,
    helpfulness: 5
  },
  {
    name: 'JANE DOE',
    date: '03-11-2026',
    rating: 5,
    comment: 'Fast transaction speed helped reduce waiting time. It improved user satisfaction.',
    responseTime: 5,
    helpfulness: 5
  },
  {
    name: 'Ruth Mitch',
    date: '03-11-2026',
    rating: 5,
    comment: 'The transaction was completed quickly without delays. It made the process efficient and convenient.',
    responseTime: 5,
    helpfulness: 5
  },
  {
    name: 'JAYSONN MILLER',
    date: '03-11-2026',
    rating: 5,
    comment: 'The system handled the transaction instantly. It made the experience smooth and reliable.',
    responseTime: 5,
    helpfulness: 5
  }
];

/* ---------------------------------------------------------------------------
   Date helpers — the demo cards use the "MM-DD-YYYY" display format, but real
   feedback docs from the feedback collection carry a createdAt Timestamp.
   parseFeedbackDate accepts both (plus ISO strings) so the filter keeps
   working either way.
--------------------------------------------------------------------------- */
const parseFeedbackDate = (value) => {
  if (!value) return null;

  const fromTimestamp = value?.toDate ? value.toDate() : null;
  if (fromTimestamp && !isNaN(fromTimestamp.getTime())) return fromTimestamp;

  if (typeof value === 'string') {
    const iso = new Date(value);
    if (!isNaN(iso.getTime())) return iso;

    // MM-DD-YYYY (demo card format)
    const m = value.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
    if (m) {
      const parsed = new Date(Number(m[3]), Number(m[1]) - 1, Number(m[2]));
      if (!isNaN(parsed.getTime())) return parsed;
    }
  }

  const fallback = new Date(value);
  return isNaN(fallback.getTime()) ? null : fallback;
};

const getFeedbackDate = (item) => parseFeedbackDate(item?.createdAt || item?.date);

const filterFeedbackByDate = (items, filter) => {
  if (!filter.from && !filter.to) return items;

  return items.filter(item => {
    const created = getFeedbackDate(item);
    if (!created) return false;

    const from = filter.from ? new Date(`${filter.from}T00:00:00`) : null;
    const to = filter.to ? new Date(`${filter.to}T23:59:59.999`) : null;

    if (from && created < from) return false;
    if (to && created > to) return false;
    return true;
  });
};

const formatFilterDate = (dateStr) => {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-');
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

// Derive the satisfaction summary from the feedback actually being shown,
// so the filter changes the whole page — not just the card list.
const buildSatisfactionStats = (items) => {
  const total = items.length;
  const distribution = [5, 4, 3, 2, 1].map(stars => ({
    stars,
    percentage: total > 0
      ? Math.round((items.filter(f => (f.rating || 0) === stars).length / total) * 100)
      : 0
  }));
  const average = total > 0
    ? (items.reduce((sum, f) => sum + (f.rating || 0), 0) / total).toFixed(1)
    : '0.0';
  return { total, average, distribution };
};

const Feedback = ({ department, onViewRequest }) => {
  const [expandedCard, setExpandedCard] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [dateFilter, setDateFilter] = useState(EMPTY_FILTER);
  const [appliedFilter, setAppliedFilter] = useState(EMPTY_FILTER);
  const [feedbackData, setFeedbackData] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch feedback from Firebase for this department
  useEffect(() => {
    if (!department) return;

    setLoading(true);
    
    // Map department to officeId
    const officeIdMap = {
      'finance': 'finance',
      'library': 'library',
      'registrar': 'registrar',
      'guidance': 'guidance'
    };
    
    const officeId = officeIdMap[department.toLowerCase()];
    
    if (!officeId) {
      console.warn('Unknown department:', department);
      setFeedbackData(DEMO_FEEDBACK);
      setLoading(false);
      return;
    }

    // Query feedback for this office
    const feedbackQuery = query(
      collection(db, 'feedback'),
      where('officeId', '==', officeId)
    );

    console.log(`🔍 Admin querying feedback with officeId: "${officeId}" for department: "${department}"`);

    const unsubscribe = onSnapshot(feedbackQuery, (querySnapshot) => {
      console.log(`📊 Firebase returned ${querySnapshot.docs.length} feedback documents`);
      
      // Log the first document to see its structure
      if (querySnapshot.docs.length > 0) {
        const firstDoc = querySnapshot.docs[0].data();
        console.log('[File] First feedback document:', {
          officeId: firstDoc.officeId,
          officeName: firstDoc.officeName,
          studentName: firstDoc.studentName,
          rating: firstDoc.overallRating,
          repliesCount: firstDoc.replies?.length || 0,
          hasReplies: !!(firstDoc.replies && firstDoc.replies.length > 0)
        });
      }
      
      const feedback = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          name: data.studentName || 'Anonymous',
          date: data.createdAt?.toDate().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }) || 'N/A',
          rating: data.overallRating || 0,
          comment: data.comments || 'No comment provided',
          responseTime: data.responseTime || 0,
          helpfulness: data.helpfulness || 0,
          createdAt: data.createdAt,
          studentEmail: data.studentEmail,
          followUp: data.followUp || false,
          replies: data.replies || [] // Include replies array
        };
      });

      // Sort by date (newest first)
      feedback.sort((a, b) => {
        const dateA = a.createdAt?.toDate() || new Date(0);
        const dateB = b.createdAt?.toDate() || new Date(0);
        return dateB - dateA;
      });

      setFeedbackData(feedback.length > 0 ? feedback : DEMO_FEEDBACK);
      setLoading(false);
      console.log(`✅ Loaded ${feedback.length} feedback items for ${department}`);
    }, (error) => {
      console.error('[Error] Error loading feedback:', error);
      setFeedbackData(DEMO_FEEDBACK);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [department]);

  useEffect(() => {
    // Listen for unread notifications
    const staffData = JSON.parse(localStorage.getItem('staffData'));
    if (staffData?.uid) {
      const q = query(
        collection(db, 'notifications'),
        where('recipientId', '==', staffData.uid),
        where('recipientType', '==', 'staff')
      );

      const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const unread = querySnapshot.docs.filter(doc => !doc.data().isRead).length;
        setUnreadCount(unread);
      });

      return () => unsubscribe();
    }
  }, []);

  const filteredFeedback = useMemo(
    () => filterFeedbackByDate(feedbackData, appliedFilter),
    [feedbackData, appliedFilter]
  );

  const satisfactionStats = useMemo(
    () => buildSatisfactionStats(filteredFeedback),
    [filteredFeedback]
  );

  const isFilterActive = Boolean(appliedFilter.from || appliedFilter.to);
  const averageScore = Number(satisfactionStats.average);
  const filledStars = Math.min(5, Math.max(0, Math.round(averageScore)));

  const applyDateFilter = () => {
    // Validate range: From cannot be after To
    if (dateFilter.from && dateFilter.to && dateFilter.from > dateFilter.to) {
      alert('The "From" date cannot be later than the "To" date.');
      return false;
    }
    // A filter can move cards around, so close any open reply form first —
    // otherwise its index could point at a different feedback card.
    setExpandedCard(null);
    setReplyText('');
    setAppliedFilter(dateFilter);
    return true;
  };

  const clearDateFilter = () => {
    setExpandedCard(null);
    setReplyText('');
    setDateFilter(EMPTY_FILTER);
    setAppliedFilter(EMPTY_FILTER);
  };

  // Opening the reply form shows a popup over the page — the feedback
  // list stays intact behind it.
  const openReplyForm = (index) => {
    setExpandedCard(index);
    setReplyText('');
  };

  const closeReplyModal = () => {
    setExpandedCard(null);
    setReplyText('');
  };

  // Close the reply popup with Escape
  useEffect(() => {
    if (expandedCard === null) return undefined;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setExpandedCard(null);
        setReplyText('');
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [expandedCard]);

  const handleSendReply = async (index) => {
    // The button is disabled without a message, but keep this guard as a
    // safety net so an empty reply can never be sent.
    if (!replyText.trim()) return;
    
    try {
      const feedbackItem = filteredFeedback[index];
      const staffData = JSON.parse(localStorage.getItem('staffData'));
      
      const reply = {
        message: replyText.trim(),
        sentBy: 'staff',
        sentByName: staffData.name || 'Staff',
        sentByOffice: department,
        sentAt: new Date().toISOString(),
        timestamp: new Date().toISOString()
      };

      // Update the feedback document with the reply
      const feedbackRef = doc(db, 'feedback', feedbackItem.id);
      await updateDoc(feedbackRef, {
        replies: arrayUnion(reply),
        updatedAt: serverTimestamp()
      });

      console.log('[Success] Reply sent successfully');
      alert('Reply sent successfully!');
      closeReplyModal();
      
    } catch (error) {
      console.error('[Error] Error sending reply:', error);
      alert('Failed to send reply: ' + error.message);
    }
  };

  const expandedFeedback = expandedCard !== null ? filteredFeedback[expandedCard] : null;

  return (
    <div className="feedback-container">
      <div className="feedback-header">
        <div>
          <h1 className="feedback-title">{department ? `${department.charAt(0).toUpperCase() + department.slice(1)} Feedback` : 'Finance Feedback'}</h1>
          <p className="feedback-subtitle">What students think about your office's service</p>
        </div>
        <div className="feedback-header-actions">
          <DateRangeFilterDropdown
            filter={dateFilter}
            onFilterChange={setDateFilter}
            isActive={isFilterActive}
            onApply={applyDateFilter}
            onClear={clearDateFilter}
            appliedFilter={appliedFilter}
            idPrefix="feedback"
          />
          <div className="notification-bell" onClick={() => setShowNotifications(true)}>
            <FaBell className="bell-icon" />
            {unreadCount > 0 && <span className="notification-badge">{unreadCount}</span>}
          </div>
        </div>
      </div>

      {isFilterActive && (
        <div className="feedback-filter-summary">
          <FaCalendarAlt className="feedback-filter-summary-icon" aria-hidden="true" />
          <span>
            Showing <strong>{satisfactionStats.total}</strong> feedback
            {satisfactionStats.total === 1 ? '' : 's'}
            {appliedFilter.from && <> from <strong>{formatFilterDate(appliedFilter.from)}</strong></>}
            {appliedFilter.from && appliedFilter.to && <> to </>}
            {appliedFilter.to && <><strong>{formatFilterDate(appliedFilter.to)}</strong></>}
          </span>
        </div>
      )}

      <div className="overall-satisfaction-card">
            <div className="satisfaction-header">
              <FaStar className="star-icon-header" />
              <h3 className="satisfaction-title">Overall Satisfaction</h3>
            </div>

            <div className="satisfaction-content">
              <div className="satisfaction-score">
                <h2 className="score-value">{satisfactionStats.average}</h2>
                <div className="stars-display">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <FaStar
                      key={star}
                      className={star <= filledStars ? 'star-filled' : 'star-empty'}
                    />
                  ))}
                </div>
                <p className="average-label">Average Rating</p>
              </div>

              <div className="satisfaction-bars">
                {satisfactionStats.distribution.map((stat) => (
                  <div key={stat.stars} className="bar-row">
                    <span className="bar-star-number">{stat.stars}</span>
                    <div className="progress-bar-container">
                      <div
                        className="progress-bar-satisfaction"
                        style={{ width: `${stat.percentage}%` }}
                      ></div>
                    </div>
                    <span className="bar-percentage">{stat.percentage}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {loading ? (
            <div className="feedback-loading">
              <p>Loading feedback...</p>
            </div>
          ) : filteredFeedback.length === 0 ? (
            <div className="feedback-empty-state">
              {isFilterActive
                ? 'No feedback found for the selected date range.'
                : 'No feedback yet.'}
            </div>
          ) : (
            <div className="feedback-cards-grid">
              {filteredFeedback.map((feedback, index) => (
                <div key={feedback.id || index} className="feedback-card">
                  <div className="feedback-card-header">
                    <div className="user-info-feedback">
                      <FaUserCircle className="user-avatar-feedback" />
                      <div className="user-details-feedback">
                        <h4 className="user-name-feedback">{feedback.name}</h4>
                        <p className="feedback-date">{feedback.date}</p>
                      </div>
                    </div>
                    <div className="rating-stars">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <FaStar
                          key={star}
                          className={star <= Math.round(feedback.rating) ? 'star-filled' : 'star-empty'}
                        />
                      ))}
                    </div>
                  </div>

                  <p className="feedback-comment">{feedback.comment}</p>

                  {/* Show existing replies */}
                  {feedback.replies && feedback.replies.length > 0 && (
                    <div className="feedback-replies-section">
                      <h5 className="replies-title">Replies ({feedback.replies.length})</h5>
                      {feedback.replies.map((reply, replyIndex) => (
                        <div key={replyIndex} className="reply-item">
                          <div className="reply-header">
                            <span className="reply-author">{reply.sentByName}</span>
                            <span className="reply-office">({reply.sentByOffice})</span>
                            <span className="reply-date">
                              {new Date(reply.sentAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </span>
                          </div>
                          <p className="reply-message">{reply.message}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  <button className="reply-button" onClick={() => openReplyForm(index)}>
                    <BsChatDots />
                    Write a reply
                  </button>
                </div>
              ))}
            </div>
          )}

      {/* Reply popup — overlays the page instead of replacing its content */}
      {expandedFeedback !== null && (
        <div className="feedback-reply-overlay" onClick={closeReplyModal}>
          <div
            className="reply-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="reply-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="reply-modal-close-btn"
              onClick={closeReplyModal}
              aria-label="Close reply dialog"
            >
              <FaTimes />
            </button>

            <div className="feedback-card-header">
              <div className="user-info-feedback">
                <FaUserCircle className="user-avatar-feedback" />
                <div className="user-details-feedback">
                  <h4 className="user-name-feedback" id="reply-modal-title">{expandedFeedback.name}</h4>
                  <p className="feedback-date">{expandedFeedback.date}</p>
                </div>
              </div>
            </div>

            <p className="feedback-comment">{expandedFeedback.comment}</p>

            {/* Show existing replies in modal */}
            {expandedFeedback.replies && expandedFeedback.replies.length > 0 && (
              <div className="feedback-replies-section">
                <h5 className="replies-title">Previous Replies ({expandedFeedback.replies.length})</h5>
                {expandedFeedback.replies.map((reply, replyIndex) => (
                  <div key={replyIndex} className="reply-item">
                    <div className="reply-header">
                      <span className="reply-author">{reply.sentByName}</span>
                      <span className="reply-office">({reply.sentByOffice})</span>
                      <span className="reply-date">
                        {new Date(reply.sentAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                    </div>
                    <p className="reply-message">{reply.message}</p>
                  </div>
                ))}
              </div>
            )}

            <div className="expanded-ratings">
              <div className="rating-row">
                <span className="rating-label">Response Time</span>
                <div className="rating-stars-row">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <FaStar
                      key={star}
                      className={star <= expandedFeedback.responseTime ? 'star-filled' : 'star-empty'}
                    />
                  ))}
                </div>
              </div>
              <div className="rating-row">
                <span className="rating-label">Helpfulness</span>
                <div className="rating-stars-row">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <FaStar
                      key={star}
                      className={star <= expandedFeedback.helpfulness ? 'star-filled' : 'star-empty'}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="reply-form">
              <label className="reply-label" htmlFor="feedback-reply-textarea">Write a reply</label>
              <textarea
                id="feedback-reply-textarea"
                className="reply-textarea-feedback"
                placeholder="Type your response here..."
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                autoFocus
              />
              <div className="reply-actions">
                <button className="cancel-btn" onClick={closeReplyModal}>
                  Cancel
                </button>
                <button
                  className="send-message-btn-feedback"
                  onClick={() => handleSendReply(expandedCard)}
                  disabled={!replyText.trim()}
                  title={!replyText.trim() ? 'Type a reply to enable sending' : undefined}
                >
                  Send Reply
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <Notifications isOpen={showNotifications} onClose={() => setShowNotifications(false)} onViewRequest={onViewRequest} />
    </div>
  );
};

export default Feedback;
