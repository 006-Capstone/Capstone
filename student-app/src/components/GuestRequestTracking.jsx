import React from 'react';
import { FaArrowLeft, FaCheckCircle, FaClock, FaTimesCircle } from 'react-icons/fa';
import { MdExitToApp } from 'react-icons/md';
import '../styles/GuestRequestTracking.css';

const GuestRequestTracking = ({ requestData, onBackToLogin }) => {
  const handleLogout = () => {
    if (window.confirm('Are you sure you want to logout?')) {
      localStorage.removeItem('studentLoggedIn');
      localStorage.removeItem('studentIsGuest');
      window.location.href = '/';
    }
  };
  const getStatusIcon = (status) => {
    const statusLower = status?.toLowerCase();
    if (statusLower === 'resolved') return { icon: <FaCheckCircle />, color: '#4CAF50', text: 'Resolved' };
    if (statusLower === 'in process' || statusLower === 'processing') return { icon: <FaClock />, color: '#FFA500', text: 'In Process' };
    if (statusLower === 'rejected' || statusLower === 'cancelled') return { icon: <FaTimesCircle />, color: '#F44336', text: 'Rejected' };
    return { icon: <FaClock />, color: '#2196F3', text: 'Pending' };
  };

  const getEstimatedCompletion = () => {
    // Use the actual estimated completion date set by admin
    if (requestData?.estimatedCompletion) {
      const date = requestData.estimatedCompletion.toDate 
        ? requestData.estimatedCompletion.toDate() 
        : new Date(requestData.estimatedCompletion);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase();
    }
    
    // Fallback: if no estimated completion is set, show "To be determined"
    return 'TO BE DETERMINED';
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    
    // If it's already a formatted string (from success page), return it
    if (typeof timestamp === 'string') {
      return timestamp;
    }
    
    // If it's a Firestore timestamp, convert it
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase();
  };

  const statusInfo = getStatusIcon(requestData.status);

  const renderTimeline = () => {
    const status = requestData.status?.toLowerCase();
    
    // Timeline items
    const timelineItems = [];

    // 1. SUBMITTED - Always shown
    timelineItems.push({
      label: 'SUBMITTED',
      date: formatDate(requestData.createdAt),
      description: 'Initial Student Request',
      completed: true
    });

    // 2. PROCESSING - Show if status is 'in process' or higher
    if (status === 'in process' || status === 'processing' || status === 'resolved') {
      timelineItems.push({
        label: 'PROCESSING',
        date: requestData.claimedAt ? formatDate(requestData.claimedAt) : formatDate(requestData.createdAt),
        description: requestData.claimedBy ? `Being Processed by ${requestData.claimedBy}` : 'Being Processed by Staff',
        completed: true
      });
    }

    // 3. RESOLVED - Show if status is 'resolved'
    if (status === 'resolved') {
      timelineItems.push({
        label: 'RESOLVED',
        date: requestData.resolvedAt ? formatDate(requestData.resolvedAt) : 'COMPLETED',
        description: requestData.resolvedBy ? `Completed by ${requestData.resolvedBy}` : 'Request Completed',
        completed: true
      });
    } else {
      // Show RESOLVED as pending if not yet resolved
      timelineItems.push({
        label: 'RESOLVED',
        date: '',
        description: '',
        completed: false
      });
    }

    return timelineItems;
  };

  const timelineItems = renderTimeline();

  return (
    <div className="guest-tracking-page">
      {/* Header */}
      <header className="tracking-header">
        <div className="header-left">
          <img src="/school-logo.jpg" alt="Logo" className="tracking-logo" />
          <span className="tracking-header-title">Academia De San Jose</span>
        </div>
        <div className="header-right">
          <div className="guest-account-badge">
            <span>Guest Account</span>
          </div>
          <button className="logout-btn-tracking" onClick={handleLogout}>
            <MdExitToApp /> Logout
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="tracking-main">
        <div className="tracking-container">
          {/* Back Button */}
          <button className="back-btn-tracking" onClick={onBackToLogin}>
            <FaArrowLeft /> Guest Log In
          </button>

          {/* Status Badge */}
          <div className="status-badge-container">
            <div className="status-badge" style={{ color: statusInfo.color }}>
              {statusInfo.icon}
              <span>{statusInfo.text}</span>
            </div>
          </div>

          {/* Page Title */}
          <h1 className="tracking-title">Request Status</h1>
          <p className="tracking-subtitle">
            Here is the current progress and details for your submitted request.
          </p>

          {/* Two Column Layout */}
          <div className="tracking-grid">
            {/* Left: Request Details */}
            <div className="tracking-card">
              <h2 className="card-heading">Request Details</h2>
              
              <div className="detail-row-tracking">
                <span className="detail-label-tracking">REQUEST NUMBER</span>
                <span className="detail-value-tracking">{requestData.requestId}</span>
              </div>

              <div className="detail-row-tracking">
                <span className="detail-label-tracking">OFFICE CODE</span>
                <span className="detail-value-tracking">
                  {requestData.office?.substring(0, 3).toUpperCase() || 'N/A'}-001
                </span>
              </div>

              <div className="detail-row-tracking">
                <span className="detail-label-tracking">DATE OF CREATION</span>
                <span className="detail-value-tracking">{formatDate(requestData.createdAt)}</span>
              </div>

              <div className="detail-row-tracking">
                <span className="detail-label-tracking">ESTIMATED COMPLETION</span>
                <span className="detail-value-tracking">{getEstimatedCompletion()}</span>
              </div>
            </div>

            {/* Right: Status Timeline */}
            <div className="tracking-card">
              <h2 className="card-heading">Status Timeline</h2>
              
              <div className="timeline">
                {timelineItems.map((item, index) => (
                  <div key={index} className={`timeline-item ${item.completed ? 'completed' : 'pending'}`}>
                    <div className="timeline-icon">
                      {item.completed ? <FaCheckCircle /> : <div className="empty-circle"></div>}
                    </div>
                    <div className="timeline-content">
                      <div className="timeline-label">{item.label}</div>
                      {item.date && <div className="timeline-date">{item.date}</div>}
                      {item.description && <div className="timeline-description">{item.description}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default GuestRequestTracking;
