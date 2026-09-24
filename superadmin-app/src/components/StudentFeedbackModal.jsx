import React, { useState, useMemo, useEffect } from 'react';
import { 
  FaTimes, 
  FaStar, 
  FaUser, 
  FaCalendarAlt, 
  FaSearch, 
  FaFilter, 
  FaCommentDots, 
  FaBuilding, 
  FaReply,
  FaCheckCircle,
  FaTicketAlt
} from 'react-icons/fa';
import '../styles/StudentFeedbackModal.css';

const parseFeedbackDate = (value) => {
  if (!value) return null;
  if (value?.toDate) return value.toDate();
  if (value instanceof Date) return value;
  if (typeof value === 'string') {
    const iso = new Date(value);
    if (!isNaN(iso.getTime())) return iso;
    const m = value.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
    if (m) {
      const parsed = new Date(Number(m[3]), Number(m[1]) - 1, Number(m[2]));
      if (!isNaN(parsed.getTime())) return parsed;
    }
  }
  const fallback = new Date(value);
  return isNaN(fallback.getTime()) ? null : fallback;
};

const formatFeedbackDate = (date) => {
  if (!date) return 'N/A';
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const getOfficeBadgeInfo = (feedback) => {
  const rawId = String(feedback.officeId || '').toLowerCase();
  const rawName = String(feedback.office || '').toLowerCase();

  if (rawId.includes('finance') || rawName.includes('finance')) {
    return { name: 'Finance Office', code: 'finance', className: 'badge-finance' };
  }
  if (rawId.includes('library') || rawName.includes('library')) {
    return { name: 'Library', code: 'library', className: 'badge-library' };
  }
  if (rawId.includes('registrar') || rawName.includes('registrar')) {
    return { name: 'Registrar', code: 'registrar', className: 'badge-registrar' };
  }
  if (rawId.includes('guidance') || rawName.includes('guidance')) {
    return { name: 'Guidance', code: 'guidance', className: 'badge-guidance' };
  }
  return { 
    name: feedback.office || feedback.officeId || 'General Office', 
    code: rawId || 'general', 
    className: 'badge-default' 
  };
};

const StudentFeedbackModal = ({ 
  isOpen, 
  onClose, 
  feedbacks = [], 
  initialOffice = 'all' 
}) => {
  const [selectedOffice, setSelectedOffice] = useState(initialOffice || 'all');
  const [selectedRating, setSelectedRating] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;

  // Sync selected office with prop when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedOffice(initialOffice || 'all');
      setCurrentPage(1);
    }
  }, [isOpen, initialOffice]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return undefined;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Prevent background scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  // Reset page when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedOffice, selectedRating, searchQuery, sortBy]);

  // Overall stats computed from all feedbacks
  const overallStats = useMemo(() => {
    const total = feedbacks.length;
    if (total === 0) {
      return { total: 0, average: '0.0', percentage: 0, starCounts: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 } };
    }

    const starCounts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    let totalScore = 0;

    feedbacks.forEach(f => {
      const r = Math.min(5, Math.max(1, Math.round(f.overallRating || f.rating || 0)));
      if (starCounts[r] !== undefined) {
        starCounts[r]++;
      }
      totalScore += (f.overallRating || f.rating || 0);
    });

    const average = (totalScore / total).toFixed(1);
    const percentage = Math.round(((totalScore / total) / 5) * 100);

    return { total, average, percentage, starCounts };
  }, [feedbacks]);

  // Filter and sort feedbacks
  const filteredFeedbacks = useMemo(() => {
    let result = [...feedbacks];

    // Filter by office
    if (selectedOffice !== 'all') {
      result = result.filter(f => {
        const badge = getOfficeBadgeInfo(f);
        return badge.code === selectedOffice;
      });
    }

    // Filter by rating
    if (selectedRating !== 'all') {
      const targetStar = Number(selectedRating);
      result = result.filter(f => {
        const r = Math.round(f.overallRating || f.rating || 0);
        return r === targetStar;
      });
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(f => {
        const studentId = String(f.studentId || '').toLowerCase();
        const studentName = String(f.studentName || f.name || '').toLowerCase();
        const comment = String(f.comments || f.comment || '').toLowerCase();
        const requestId = String(f.requestId || '').toLowerCase();
        const office = String(f.office || f.officeId || '').toLowerCase();

        return (
          studentId.includes(q) ||
          studentName.includes(q) ||
          comment.includes(q) ||
          requestId.includes(q) ||
          office.includes(q)
        );
      });
    }

    // Sort
    result.sort((a, b) => {
      const dateA = parseFeedbackDate(a.createdAt || a.date)?.getTime() || 0;
      const dateB = parseFeedbackDate(b.createdAt || b.date)?.getTime() || 0;
      const ratingA = a.overallRating || a.rating || 0;
      const ratingB = b.overallRating || b.rating || 0;

      if (sortBy === 'newest') return dateB - dateA;
      if (sortBy === 'oldest') return dateA - dateB;
      if (sortBy === 'highest') return ratingB - ratingA || dateB - dateA;
      if (sortBy === 'lowest') return ratingA - ratingB || dateB - dateA;
      return 0;
    });

    return result;
  }, [feedbacks, selectedOffice, selectedRating, searchQuery, sortBy]);

  // Pagination
  const totalPages = Math.ceil(filteredFeedbacks.length / itemsPerPage) || 1;
  const paginatedFeedbacks = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredFeedbacks.slice(start, start + itemsPerPage);
  }, [filteredFeedbacks, currentPage, itemsPerPage]);

  const renderStars = (rating) => {
    const numericRating = Math.round(rating || 0);
    return (
      <div className="feedback-stars-row" title={`${rating || 0} out of 5 stars`}>
        {[1, 2, 3, 4, 5].map((star) => (
          <FaStar
            key={star}
            className={`feedback-star-icon ${star <= numericRating ? 'filled' : 'empty'}`}
          />
        ))}
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="feedback-modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div 
        className="feedback-modal-container" 
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="feedback-modal-header">
          <div className="feedback-header-left">
            <div className="feedback-header-icon-wrap">
              <FaStar className="header-star-icon" />
            </div>
            <div>
              <div className="feedback-header-badge-row">
                <span className="feedback-header-tag">Superadmin Analytics</span>
                <span className="feedback-header-count">{feedbacks.length} Total Submissions</span>
              </div>
              <h2 className="feedback-modal-title">Student Satisfaction & Feedback Reviews</h2>
              <p className="feedback-modal-subtitle">
                Review student feedback submissions, ratings, and office performance notes across all departments
              </p>
            </div>
          </div>
          <button 
            className="feedback-modal-close-btn" 
            onClick={onClose} 
            aria-label="Close modal"
            title="Close"
          >
            <FaTimes />
          </button>
        </div>

        {/* Quick Satisfaction Overview Bar */}
        <div className="feedback-overview-bar">
          <div className="feedback-stat-summary">
            <div className="stat-score-circle">
              <span className="score-num">{overallStats.average}</span>
              <span className="score-scale">/5.0</span>
            </div>
            <div className="stat-text-group">
              <div className="stat-stars-render">
                {renderStars(Number(overallStats.average))}
              </div>
              <div className="stat-label-text">
                <strong>{overallStats.percentage}%</strong> Overall Satisfaction Rating
              </div>
            </div>
          </div>

          <div className="feedback-stars-pills">
            {[5, 4, 3, 2, 1].map((star) => {
              const count = overallStats.starCounts[star] || 0;
              const pct = overallStats.total > 0 ? Math.round((count / overallStats.total) * 100) : 0;
              const isActive = selectedRating === String(star);

              return (
                <button
                  key={star}
                  type="button"
                  className={`star-pill-btn ${isActive ? 'active' : ''}`}
                  onClick={() => setSelectedRating(isActive ? 'all' : String(star))}
                  title={`Filter by ${star} Stars (${count} reviews)`}
                >
                  <span className="star-pill-label">
                    {star} <FaStar className="pill-star" />
                  </span>
                  <span className="star-pill-count">{count}</span>
                  <span className="star-pill-pct">({pct}%)</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Filter Controls Row */}
        <div className="feedback-controls-bar">
          <div className="feedback-search-wrap">
            <FaSearch className="feedback-search-icon" />
            <input
              type="text"
              placeholder="Search by student ID, comment, or ticket #..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="feedback-search-input"
            />
            {searchQuery && (
              <button 
                type="button" 
                className="feedback-search-clear" 
                onClick={() => setSearchQuery('')}
                title="Clear search"
              >
                <FaTimes />
              </button>
            )}
          </div>

          <div className="feedback-filters-group">
            {/* Office Filter */}
            <div className="feedback-filter-select-wrap">
              <FaBuilding className="filter-select-icon" />
              <select
                value={selectedOffice}
                onChange={(e) => setSelectedOffice(e.target.value)}
                className="feedback-filter-select"
                aria-label="Filter by Department"
              >
                <option value="all">All Departments</option>
                <option value="finance">Finance Office</option>
                <option value="library">Library</option>
                <option value="registrar">Registrar's Office</option>
                <option value="guidance">Guidance Office</option>
              </select>
            </div>

            {/* Rating Filter */}
            <div className="feedback-filter-select-wrap">
              <FaStar className="filter-select-icon" />
              <select
                value={selectedRating}
                onChange={(e) => setSelectedRating(e.target.value)}
                className="feedback-filter-select"
                aria-label="Filter by Star Rating"
              >
                <option value="all">All Ratings</option>
                <option value="5">5 Stars Only</option>
                <option value="4">4 Stars Only</option>
                <option value="3">3 Stars Only</option>
                <option value="2">2 Stars Only</option>
                <option value="1">1 Star Only</option>
              </select>
            </div>

            {/* Sort Select */}
            <div className="feedback-filter-select-wrap">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="feedback-filter-select"
                aria-label="Sort Reviews"
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="highest">Highest Rating</option>
                <option value="lowest">Lowest Rating</option>
              </select>
            </div>

            {/* Reset Filter Button */}
            {(selectedOffice !== 'all' || selectedRating !== 'all' || searchQuery.trim()) && (
              <button
                type="button"
                className="feedback-reset-filters-btn"
                onClick={() => {
                  setSelectedOffice('all');
                  setSelectedRating('all');
                  setSearchQuery('');
                }}
              >
                Reset
              </button>
            )}
          </div>
        </div>

        {/* Feedback List Body */}
        <div className="feedback-modal-body">
          {paginatedFeedbacks.length === 0 ? (
            <div className="feedback-empty-state">
              <div className="empty-state-icon-circle">
                <FaCommentDots />
              </div>
              <h3>No Feedback Found</h3>
              <p>
                {searchQuery || selectedOffice !== 'all' || selectedRating !== 'all'
                  ? 'No reviews match your filter criteria. Try adjusting the search query or department filter.'
                  : 'There are no student satisfaction reviews submitted yet.'}
              </p>
              {(searchQuery || selectedOffice !== 'all' || selectedRating !== 'all') && (
                <button
                  type="button"
                  className="empty-state-reset-btn"
                  onClick={() => {
                    setSelectedOffice('all');
                    setSelectedRating('all');
                    setSearchQuery('');
                  }}
                >
                  Show All Feedbacks
                </button>
              )}
            </div>
          ) : (
            <div className="feedback-cards-grid">
              {paginatedFeedbacks.map((item, idx) => {
                const dateObj = parseFeedbackDate(item.createdAt || item.date);
                const badge = getOfficeBadgeInfo(item);
                const rating = item.overallRating || item.rating || 0;
                const studentIdentifier = item.studentId || item.studentName || item.name || 'Anonymous Student';
                const commentText = item.comments || item.comment || '';
                const replies = Array.isArray(item.replies) ? item.replies : [];

                return (
                  <div key={item.id || idx} className="feedback-review-card">
                    <div className="review-card-header">
                      <div className="review-student-info">
                        <div className="student-avatar-wrap">
                          <FaUser className="student-avatar-icon" />
                        </div>
                        <div className="student-text-wrap">
                          <div className="student-name-row">
                            <span className="student-name">{studentIdentifier}</span>
                          </div>
                          <div className="review-date-row">
                            <FaCalendarAlt className="date-icon" />
                            <span>{formatFeedbackDate(dateObj)}</span>
                          </div>
                        </div>
                      </div>

                      <div className="review-header-tags">
                        <span className={`dept-badge ${badge.className}`}>
                          <FaBuilding className="badge-icon" /> {badge.name}
                        </span>
                        {item.requestId && (
                          <span className="request-id-chip" title="Associated Request ID">
                            <FaTicketAlt className="ticket-icon" /> #{item.requestId}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="review-rating-banner">
                      <div className="rating-pill-display">
                        {renderStars(rating)}
                        <span className="rating-num-badge">{Number(rating).toFixed(1)} / 5.0</span>
                      </div>

                      <div className="rating-subdimensions">
                        {item.responseTime !== undefined && item.responseTime !== null && (
                          <span className="sub-dim-pill">
                            Response Speed: <strong>{item.responseTime}/5</strong>
                          </span>
                        )}
                        {item.helpfulness !== undefined && item.helpfulness !== null && (
                          <span className="sub-dim-pill">
                            Helpfulness: <strong>{item.helpfulness}/5</strong>
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="review-comment-box">
                      {commentText ? (
                        <p className="review-comment-text">"{commentText}"</p>
                      ) : (
                        <p className="review-no-comment">No written comments provided by student.</p>
                      )}
                    </div>

                    {replies.length > 0 && (
                      <div className="review-replies-container">
                        <div className="replies-header">
                          <FaReply className="reply-icon" />
                          <span>Staff Responses ({replies.length})</span>
                        </div>
                        {replies.map((reply, rIdx) => (
                          <div key={rIdx} className="reply-item">
                            <div className="reply-meta">
                              <span className="reply-author">
                                {reply.staffName || 'Staff Member'}
                              </span>
                              <span className="reply-time">
                                {formatFeedbackDate(parseFeedbackDate(reply.createdAt))}
                              </span>
                            </div>
                            <div className="reply-body">{reply.message || reply.text}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="feedback-modal-footer">
          <div className="footer-count-text">
            Showing <strong>{filteredFeedbacks.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1}</strong> to{' '}
            <strong>{Math.min(currentPage * itemsPerPage, filteredFeedbacks.length)}</strong> of{' '}
            <strong>{filteredFeedbacks.length}</strong> feedback{filteredFeedbacks.length === 1 ? '' : 's'}
            {filteredFeedbacks.length !== feedbacks.length && (
              <span className="filtered-from-label"> (filtered from {feedbacks.length} total)</span>
            )}
          </div>

          {totalPages > 1 && (
            <div className="feedback-pagination">
              <button
                type="button"
                className="page-nav-btn"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                Previous
              </button>
              <div className="page-numbers">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                  <button
                    key={page}
                    type="button"
                    className={`page-num-btn ${currentPage === page ? 'active' : ''}`}
                    onClick={() => setCurrentPage(page)}
                  >
                    {page}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="page-nav-btn"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                Next
              </button>
            </div>
          )}

          <div className="footer-actions">
            <button type="button" className="footer-close-btn" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentFeedbackModal;
