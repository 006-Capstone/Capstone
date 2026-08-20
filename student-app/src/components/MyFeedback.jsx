import React, { useState, useEffect } from 'react';
import { FaStar, FaUserCircle, FaClock, FaRegCommentDots } from 'react-icons/fa';
import { MdAssignment } from 'react-icons/md';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import '../styles/MyFeedback.css';

const MyFeedback = ({ onNavigate }) => {
  const [feedbackList, setFeedbackList] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const studentData = JSON.parse(localStorage.getItem('studentData'));
    
    if (!studentData?.uid) {
      console.error('No student UID found');
      setLoading(false);
      return;
    }

    // Query feedback submitted by this student
    const feedbackQuery = query(
      collection(db, 'feedback'),
      where('studentUid', '==', studentData.uid),
      orderBy('createdAt', 'desc')
    );

    console.log(`🔍 Loading feedback history for student: ${studentData.uid}`);

    const unsubscribe = onSnapshot(feedbackQuery, (querySnapshot) => {
      console.log(`📊 Found ${querySnapshot.docs.length} feedback submissions`);
      
      const feedback = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          officeId: data.officeId,
          officeName: data.officeName,
          responseTime: data.responseTime || 0,
          helpfulness: data.helpfulness || 0,
          overallRating: data.overallRating || 0,
          comments: data.comments || '',
          followUp: data.followUp || false,
          requestId: data.requestId || null,
          createdAt: data.createdAt,
          replies: data.replies || []
        };
      });

      setFeedbackList(feedback);
      setLoading(false);
      console.log(`✅ Loaded ${feedback.length} feedback items`);
    }, (error) => {
      console.error('[Error] Error loading feedback:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate();
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  if (loading) {
    return (
      <div className="my-feedback-container">
        <div className="my-feedback-header">
          <h1 className="my-feedback-title">My Feedback</h1>
          <p className="my-feedback-subtitle">View all your submitted feedback and staff responses</p>
        </div>
        <div className="my-feedback-loading">
          <p>Loading your feedback...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="my-feedback-container">
      <div className="my-feedback-header">
        <h1 className="my-feedback-title">My Feedback</h1>
        <p className="my-feedback-subtitle">View all your submitted feedback and staff responses</p>
      </div>

      {feedbackList.length === 0 ? (
        <div className="my-feedback-empty">
          <FaRegCommentDots className="empty-icon" />
          <h3>No Feedback Yet</h3>
          <p>You haven't submitted any feedback. After a request is resolved, you can provide feedback about the service.</p>
        </div>
      ) : (
        <div className="my-feedback-list">
          {feedbackList.map((feedback) => (
            <div key={feedback.id} className="my-feedback-card">
              {/* Header */}
              <div className="my-feedback-card-header">
                <div className="office-info">
                  <h3 className="office-name">{feedback.officeName}</h3>
                  <p className="feedback-submitted-date">
                    <FaClock className="date-icon" />
                    {formatDate(feedback.createdAt)}
                  </p>
                </div>
                <div className="overall-rating-badge">
                  <FaStar className="rating-star" />
                  <span className="rating-value">{feedback.overallRating.toFixed(1)}</span>
                </div>
              </div>

              {/* Request ID (if linked) */}
              {feedback.requestId && (
                <div className="linked-request">
                  <MdAssignment className="request-icon" />
                  <span>Request: {feedback.requestId}</span>
                </div>
              )}

              {/* Ratings Breakdown */}
              <div className="ratings-breakdown">
                <div className="rating-item">
                  <span className="rating-item-label">Response Time</span>
                  <div className="rating-stars-small">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <FaStar
                        key={star}
                        className={star <= feedback.responseTime ? 'star-filled-small' : 'star-empty-small'}
                      />
                    ))}
                  </div>
                </div>
                <div className="rating-item">
                  <span className="rating-item-label">Helpfulness</span>
                  <div className="rating-stars-small">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <FaStar
                        key={star}
                        className={star <= feedback.helpfulness ? 'star-filled-small' : 'star-empty-small'}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Comments */}
              {feedback.comments && (
                <div className="my-feedback-comment-section">
                  <h4 className="comment-heading">Your Comments</h4>
                  <p className="my-feedback-comment">{feedback.comments}</p>
                </div>
              )}

              {/* Staff Replies */}
              {feedback.replies && feedback.replies.length > 0 && (
                <div className="staff-replies-section">
                  <h4 className="replies-heading">Staff Responses ({feedback.replies.length})</h4>
                  {feedback.replies.map((reply, replyIndex) => (
                    <div key={replyIndex} className="staff-reply-item">
                      <div className="staff-reply-header">
                        <FaUserCircle className="staff-avatar-icon" />
                        <div className="staff-reply-info">
                          <span className="staff-name">{reply.sentByName}</span>
                          <span className="staff-office">({reply.sentByOffice})</span>
                        </div>
                        <span className="staff-reply-date">
                          {new Date(reply.sentAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      </div>
                      <p className="staff-reply-message">{reply.message}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Follow-up indicator */}
              {feedback.followUp && (
                <div className="followup-indicator">
                  <span>✓ Requested follow-up contact</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MyFeedback;
