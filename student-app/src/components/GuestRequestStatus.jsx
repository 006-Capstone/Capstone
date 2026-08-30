import React from 'react';
import { FaCheckCircle, FaSearch, FaExclamationTriangle } from 'react-icons/fa';
import '../styles/GuestRequestStatus.css';

const GuestRequestStatus = ({ data, loading, notFound, error, onHome }) => {
  if (loading) {
    return (
      <div className="guest-status-page">
        <div className="guest-status-message-card">
          <div className="guest-spinner" aria-hidden="true"></div>
          <p className="guest-status-message-text">Checking your request status...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="guest-status-page">
        <div className="guest-status-message-card">
          <FaExclamationTriangle className="guest-status-message-icon" />
          <h3 className="guest-status-message-title">Something went wrong</h3>
          <p className="guest-status-message-text">{error}</p>
          <button type="button" className="submit-btn-guest" onClick={onHome}>
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (notFound || !data) {
    return (
      <div className="guest-status-page">
        <div className="guest-status-message-card">
          <FaSearch className="guest-status-message-icon" />
          <h3 className="guest-status-message-title">Request Not Found</h3>
          <p className="guest-status-message-text">
            We could not find a request matching that Request ID and Office Code.
            Double-check your details or contact your office for assistance.
          </p>
          <button type="button" className="submit-btn-guest" onClick={onHome}>
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="guest-status-page">
      <div className="guest-status-heading">
        <div className={`guest-status-pill ${data.statusClass || 'is-pending'}`}>
          <span className="guest-status-dot"></span>
          {data.status}
        </div>
        <h2 className="section-title-guest">Request Status</h2>
        <p className="section-subtitle-guest">
          Here is the current progress and details for your submitted request.
        </p>
      </div>

      <div className="guest-results-grid">
        <div className="guest-result-card">
          <h3 className="guest-result-heading">Request Details</h3>
          <div className="guest-detail-row">
            <span className="guest-detail-label">Request Number</span>
            <span className="guest-detail-value">{data.requestNumber}</span>
          </div>
          <div className="guest-detail-row">
            <span className="guest-detail-label">Office Code</span>
            <span className="guest-detail-value">{data.officeCode}</span>
          </div>
          <div className="guest-detail-row">
            <span className="guest-detail-label">Date of Creation</span>
            <span className="guest-detail-value">{data.dateCreated}</span>
          </div>
          <div className="guest-detail-row">
            <span className="guest-detail-label">Estimated Completion</span>
            <span className="guest-detail-value">{data.estimatedCompletion}</span>
          </div>
        </div>

        <div className="guest-result-card">
          <h3 className="guest-result-heading">Status Timeline</h3>
          <div className="guest-timeline">
            {data.timeline.map((item, index) => (
              <div key={index} className={`guest-timeline-item ${item.completed ? 'completed' : ''} ${item.active ? 'active' : ''}`}>
                <div className="guest-timeline-icon">
                  <FaCheckCircle />
                </div>
                <div className="guest-timeline-content">
                  <h4>{item.status}</h4>
                  {item.date && <p className="guest-timeline-date">{item.date}</p>}
                  {item.description && <p className="guest-timeline-desc">{item.description}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GuestRequestStatus;