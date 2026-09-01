import { useState, useEffect } from 'react';
import { MdStar, MdStarHalf, MdStarBorder } from 'react-icons/md';
import { FaArrowLeft, FaChevronRight } from 'react-icons/fa';
import { collection, addDoc, serverTimestamp, doc, updateDoc, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import LoadingSpinner from './LoadingSpinner';
import '../styles/Feedback.css';

// Default office structure - will be populated with real data from Firebase
const DEFAULT_OFFICES = [
  { id: 'finance', name: 'Finance', rating: 0, responseTime: 0, helpfulness: 0, breakdown: [0, 0, 0, 0, 0], totalFeedback: 0 },
  { id: 'registrar', name: 'Registrar', rating: 0, responseTime: 0, helpfulness: 0, breakdown: [0, 0, 0, 0, 0], totalFeedback: 0 },
  { id: 'library', name: 'Library', rating: 0, responseTime: 0, helpfulness: 0, breakdown: [0, 0, 0, 0, 0], totalFeedback: 0 },
  { id: 'guidance', name: 'Guidance', rating: 0, responseTime: 0, helpfulness: 0, breakdown: [0, 0, 0, 0, 0], totalFeedback: 0 }
];

function Feedback({ selectedOffice: initialOffice, selectedRequest, onNavigate }) {
  const [selectedOffice, setSelectedOffice] = useState(initialOffice || (selectedRequest?.officeId) || null);
  const [responseTime, setResponseTime] = useState(0);
  const [responseTimeHover, setResponseTimeHover] = useState(0);
  const [helpfulness, setHelpfulness] = useState(0);
  const [helpfulnessHover, setHelpfulnessHover] = useState(0);
  const [comments, setComments] = useState('');
  const [followUp, setFollowUp] = useState(false);
  const [offices, setOffices] = useState(DEFAULT_OFFICES);
  const [submitting, setSubmitting] = useState(false);
  const [loadingRatings, setLoadingRatings] = useState(true);

  // Frontend-only gating: Submit Feedback stays disabled until both required
  // star ratings are given (Additional Comments and Follow-up are optional).
  const isFormValid = responseTime > 0 && helpfulness > 0;

  // Update selectedOffice when prop changes or when selectedRequest changes
  useEffect(() => {
    if (selectedRequest) {
      // Map office name to office ID
      const officeMap = {
        'Finance': 'finance',
        'Library': 'library',
        'Registrar': 'registrar',
        'Guidance': 'guidance'
      };
      setSelectedOffice(officeMap[selectedRequest.office] || initialOffice || null);
    } else {
      setSelectedOffice(initialOffice || null);
    }
  }, [initialOffice, selectedRequest]);

  // React reuses this component across feedback-* routes, so reset the form
  // whenever the office changes (otherwise ratings/comments would leak over).
  useEffect(() => {
    setResponseTime(0);
    setResponseTimeHover(0);
    setHelpfulness(0);
    setHelpfulnessHover(0);
    setComments('');
    setFollowUp(false);
  }, [initialOffice]);

  // Fetch and calculate real office ratings from Firebase
  useEffect(() => {
    loadOfficeRatings();
  }, []);

  const loadOfficeRatings = async () => {
    try {
      setLoadingRatings(true);
      
      // Fetch all feedback from Firebase
      const feedbackRef = collection(db, 'feedback');
      const feedbackSnapshot = await getDocs(feedbackRef);
      
      // Calculate ratings for each office
      const officeStats = {};
      
      feedbackSnapshot.forEach((doc) => {
        const feedback = doc.data();
        const officeId = feedback.officeId;
        
        if (!officeStats[officeId]) {
          officeStats[officeId] = {
            totalRating: 0,
            totalResponseTime: 0,
            totalHelpfulness: 0,
            count: 0,
            ratingCounts: [0, 0, 0, 0, 0] // Count of 5★, 4★, 3★, 2★, 1★
          };
        }
        
        officeStats[officeId].totalRating += feedback.overallRating || 0;
        officeStats[officeId].totalResponseTime += feedback.responseTime || 0;
        officeStats[officeId].totalHelpfulness += feedback.helpfulness || 0;
        officeStats[officeId].count += 1;
        
        // Count rating distribution (round to nearest integer for breakdown)
        const roundedRating = Math.round(feedback.overallRating || 0);
        if (roundedRating >= 1 && roundedRating <= 5) {
          officeStats[officeId].ratingCounts[5 - roundedRating] += 1;
        }
      });
      
      // Update offices with calculated stats
      const updatedOffices = DEFAULT_OFFICES.map(office => {
        const stats = officeStats[office.id];
        
        if (!stats || stats.count === 0) {
          return {
            ...office,
            rating: 0,
            responseTime: 0,
            helpfulness: 0,
            breakdown: [0, 0, 0, 0, 0],
            totalFeedback: 0
          };
        }
        
        const avgRating = stats.totalRating / stats.count;
        const avgResponseTime = stats.totalResponseTime / stats.count;
        const avgHelpfulness = stats.totalHelpfulness / stats.count;
        
        // Calculate percentage breakdown
        const breakdown = stats.ratingCounts.map(count => 
          Math.round((count / stats.count) * 100)
        );
        
        // Convert star averages to percentages (out of 5 stars = 100%)
        const responseTimePercent = Math.round((avgResponseTime / 5) * 100);
        const helpfulnessPercent = Math.round((avgHelpfulness / 5) * 100);
        
        return {
          ...office,
          rating: parseFloat(avgRating.toFixed(1)),
          responseTime: responseTimePercent,
          helpfulness: helpfulnessPercent,
          breakdown,
          totalFeedback: stats.count
        };
      });
      
      setOffices(updatedOffices);
      console.log('[Success] Loaded office ratings from Firebase:', updatedOffices);
      
    } catch (error) {
      console.error('[Error] Error loading office ratings:', error);
      // Keep default offices on error
      setOffices(DEFAULT_OFFICES);
    } finally {
      setLoadingRatings(false);
    }
  };

  // Navigate to the dedicated feedback page for an office. Falls back to
  // in-page selection when no router callback is provided.
  const navigateToOffice = (officeId) => {
    if (onNavigate) {
      onNavigate(`feedback-${officeId}`);
    } else {
      setSelectedOffice(officeId);
    }
  };

  // Return to the feedback overview page.
  const goBackToOverview = () => {
    if (onNavigate) {
      onNavigate('feedback');
    } else {
      setSelectedOffice(null);
    }
  };

  const handleSubmitFeedback = async () => {
    if (!responseTime || !helpfulness) {
      alert('Please rate both Response Time and Helpfulness');
      return;
    }

    setSubmitting(true);

    try {
      const studentData = JSON.parse(localStorage.getItem('studentData'));
      
      // Calculate overall rating (average of the two ratings)
      const overallRating = ((responseTime + helpfulness) / 2).toFixed(1);

      const feedbackData = {
        officeId: selectedOffice,
        officeName: offices.find(o => o.id === selectedOffice)?.name || '',
        studentId: studentData.studentId || studentData.id,
        studentUid: studentData.uid,
        studentName: studentData.name || `${studentData.firstName} ${studentData.lastName}`.trim(),
        studentEmail: studentData.email,
        responseTime,
        helpfulness,
        overallRating: parseFloat(overallRating),
        comments: comments.trim(),
        followUp,
        createdAt: serverTimestamp()
      };

      console.log('💾 Saving feedback with data:', {
        officeId: feedbackData.officeId,
        officeName: feedbackData.officeName,
        studentName: feedbackData.studentName,
        overallRating: feedbackData.overallRating
      });

      // If feedback is for a specific request, link it
      if (selectedRequest) {
        feedbackData.requestId = selectedRequest.requestId;
        feedbackData.requestFirestoreId = selectedRequest.firestoreId;
        console.log('🔗 Linking feedback to request:', selectedRequest.requestId);
      }

      // Save feedback to Firestore
      const docRef = await addDoc(collection(db, 'feedback'), feedbackData);
      console.log('[Success] Feedback submitted with ID:', docRef.id);

      // If linked to a request, update the request to mark feedback as provided
      if (selectedRequest?.firestoreId) {
        const requestRef = doc(db, 'requests', selectedRequest.firestoreId);
        await updateDoc(requestRef, {
          feedbackProvided: true,
          feedbackId: docRef.id,
          updatedAt: serverTimestamp()
        });
      }

      // Wait a moment for Firestore real-time listeners to update
      await new Promise(resolve => setTimeout(resolve, 500));

      alert('Thank you for your feedback!');
      
      // Reload ratings to reflect the new feedback
      await loadOfficeRatings();
      
      // Reset form
      setResponseTime(0);
      setHelpfulness(0);
      setComments('');
      setFollowUp(false);
      
      // Navigate back to appropriate page
      if (selectedRequest) {
        // If came from a request, go back to request history
        onNavigate('request');
      } else {
        // Otherwise go back to feedback overview
        goBackToOverview();
      }
      
    } catch (error) {
      console.error('[Error] Error submitting feedback:', error);
      alert('Failed to submit feedback: ' + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const renderStars = (rating) => {
    const stars = [];
    for (let i = 0; i < 5; i++) {
      const value = rating - i;
      if (value >= 0.75) {
        stars.push(<MdStar key={i} />);
      } else if (value >= 0.25) {
        stars.push(<MdStarHalf key={i} />);
      } else {
        stars.push(<MdStarBorder key={i} className="empty" />);
      }
    }
    return stars;
  };

  const RATING_LABELS = {
    1: 'Poor',
    2: 'Fair',
    3: 'Good',
    4: 'Very Good',
    5: 'Excellent'
  };

  const renderStarRating = (value, setValue, hoverValue, setHoverValue, categoryLabel) => {
    const activeValue = hoverValue || value;
    return (
      <div className="star-rating">
        <div className="stars-container" role="radiogroup" aria-label={categoryLabel}>
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              className={`star-btn ${activeValue >= star ? 'filled' : ''}`}
              onClick={() => setValue(star)}
              onMouseEnter={() => setHoverValue(star)}
              onMouseLeave={() => setHoverValue(0)}
              aria-label={`${star} star${star > 1 ? 's' : ''} - ${RATING_LABELS[star]}`}
            >
              <MdStar />
            </button>
          ))}
        </div>
        <span className="rating-text">
          {activeValue ? RATING_LABELS[activeValue] : 'Click to rate'}
        </span>
      </div>
    );
  };

  // Show office grid view by default (not the form)
  if (!selectedOffice) {
    return (
      <div className="feedback-page">
        <div className="feedback-container">
          <div className="page-header">
            <div className="page-header-text">
              <h1>Share your feedback</h1>
              <p className="feedback-subtitle">
                Rate your experience with campus offices to help us improve student services.
              </p>
            </div>
          </div>

          {loadingRatings ? (
            <LoadingSpinner message="Loading office ratings..." fullScreen={false} />
          ) : (
            <div className="office-grid">
              {offices.map((office) => (
                <div
                  key={office.id}
                  className="office-rating-card"
                  role="button"
                  tabIndex={0}
                  onClick={() => navigateToOffice(office.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      navigateToOffice(office.id);
                    }
                  }}
                  aria-label={`Rate the ${office.name} office`}
                >
                  <div className="office-card-header">
                    <h3>{office.name}</h3>
                    <span className="rate-office-tag">
                      Rate <FaChevronRight className="rate-arrow-icon" />
                    </span>
                  </div>

                  <div className="rating-display">
                    <span className="rating-number">
                      {office.rating > 0 ? office.rating.toFixed(1) : 'N/A'}
                      <span className="rating-total">/5</span>
                    </span>
                    <div className="stars" aria-hidden="true">
                      {office.rating > 0 ? renderStars(office.rating) : (
                        <>
                          <MdStarBorder className="empty" />
                          <MdStarBorder className="empty" />
                          <MdStarBorder className="empty" />
                          <MdStarBorder className="empty" />
                          <MdStarBorder className="empty" />
                        </>
                      )}
                    </div>
                  </div>
                  {office.totalFeedback > 0 && (
                    <p className="feedback-count">{office.totalFeedback} feedback{office.totalFeedback !== 1 ? 's' : ''}</p>
                  )}
                  <div className="metrics">
                    <div className="metric-row">
                      <span className="metric-label">Response Time</span>
                      <div className="metric-bar">
                        <div className="metric-fill" style={{ width: `${office.responseTime}%` }}></div>
                      </div>
                      <span className="metric-value">{office.responseTime}%</span>
                    </div>
                    <div className="metric-row">
                      <span className="metric-label">Helpfulness</span>
                      <div className="metric-bar">
                        <div className="metric-fill" style={{ width: `${office.helpfulness}%` }}></div>
                      </div>
                      <span className="metric-value">{office.helpfulness}%</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Dedicated feedback page for the selected office
  const currentOffice = offices.find(o => o.id === selectedOffice);
  const officeName = currentOffice?.name || 'Office';
  const breakdown = currentOffice?.breakdown || [85, 12, 3, 0, 0];
  
  // Check if this is feedback for a specific resolved request
  const isRequestFeedback = !!selectedRequest;
  
  return (
    <div className="feedback-page">
      <div className="feedback-container">
        {!isRequestFeedback && (
          <div className="feedback-back-wrapper">
            <button
              type="button"
              className="feedback-back-link"
              onClick={goBackToOverview}
            >
              <FaArrowLeft />
              <span>All Offices</span>
            </button>
          </div>
        )}

        <div className="page-header-figma">
          <h1>Share your feedback</h1>
        </div>

        {/* Overall Satisfaction card */}
        {!isRequestFeedback && (
          <div className="satisfaction-card-figma">
            <div className="satisfaction-header-figma">
              <MdStar className="satisfaction-star-figma" aria-hidden="true" />
              <h3>Overall Satisfaction</h3>
            </div>
            
            <div className="satisfaction-body-figma">
              <div className="satisfaction-rating-left">
                <span className="big-rating-figma">{currentOffice ? currentOffice.rating.toFixed(1) : '—'}</span>
                <div className="summary-stars-figma" aria-hidden="true">
                  {currentOffice ? renderStars(currentOffice.rating) : null}
                </div>
                <p className="summary-label-figma">Average Rating</p>
              </div>

              <div className="rating-bars-figma" aria-label="Rating distribution">
                {[5, 4, 3, 2, 1].map((star, i) => (
                  <div className="rating-bar-row-figma" key={star}>
                    <span className="star-label-figma">{star}</span>
                    <div className="bar-figma">
                      <div className="bar-fill-figma" style={{ width: `${breakdown[i]}%` }}></div>
                    </div>
                    <span className="percentage-figma">{breakdown[i]}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

      {/* Remove .feedback-form wrapper and .form-header completely to match Figma */}
        <div className="rating-categories-figma">
          <div className="rating-category-card">
            <h4>Response Time</h4>
            {renderStarRating(responseTime, setResponseTime, responseTimeHover, setResponseTimeHover, 'Response Time')}
          </div>
          <div className="rating-category-card">
            <h4>Helpfulness</h4>
            {renderStarRating(helpfulness, setHelpfulness, helpfulnessHover, setHelpfulnessHover, 'Helpfulness')}
          </div>
        </div>

        <div className="comments-card">
          <div className="comments-header-row">
            <h4>Additional Comments</h4>
          </div>
          <textarea
            className="figma-textarea"
            value={comments}
            maxLength={500}
            onChange={(e) => setComments(e.target.value)}
          />
        </div>

        <div className="follow-up-card">
          <div className="follow-up-header">
            <div>
              <h4>Follow-up Contact</h4>
              <p>May we contact you for further details about your experience?</p>
            </div>
            {/* Scoped class names (follow-up-*) so this switch never collides
                with the settings 2FA toggle (both defined global .toggle-switch) */}
            <div
              className={`follow-up-switch ${followUp ? 'active' : ''}`}
              role="switch"
              aria-checked={followUp}
              aria-label="Allow follow-up contact"
              tabIndex={0}
              onClick={() => setFollowUp(!followUp)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setFollowUp(!followUp);
                }
              }}
            >
              <div className="follow-up-slider"></div>
            </div>
          </div>
        </div>

        <div className="form-actions-figma">
          <button 
            type="button"
            className="cancel-btn-feedback" 
            onClick={() => isRequestFeedback ? onNavigate('request') : goBackToOverview()}
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            type="button"
            className="submit-feedback-btn"
            onClick={handleSubmitFeedback}
            disabled={!isFormValid || submitting}
            title={!isFormValid ? 'Rate Response Time and Helpfulness to submit' : undefined}
          >
            {submitting && <span className="btn-spinner"></span>}
            {submitting ? 'Submitting...' : 'Submit Feedback'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default Feedback;
