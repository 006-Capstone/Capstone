import React, { useState } from 'react';
import { 
  FaCheckCircle, 
  FaSearch, 
  FaExclamationTriangle, 
  FaUserCircle, 
  FaBuilding, 
  FaCopy, 
  FaCheck,
  FaFileAlt,
  FaDownload
} from 'react-icons/fa';
import '../styles/GuestRequestStatus.css';

const GuestRequestStatus = ({ data, loading, notFound, error, onHome }) => {
  const [copied, setCopied] = useState(false);

  const handleCopyId = () => {
    if (!data?.rawRequestId && !data?.requestNumber) return;
    const idToCopy = data.rawRequestId || data.requestNumber.replace('#', '');
    navigator.clipboard.writeText(idToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!data) return;
    const lines = [
      'ACADEMIA DE SAN JOSE — GUEST REQUEST STATUS REPORT',
      '==================================================',
      `Request Number: ${data.requestNumber}`,
      `Office: ${data.officeName}`,
      `Office Code: ${data.officeCode}`,
      `Status: ${data.status}`,
      `Subject: ${data.subject || 'N/A'}`,
      `Date Created: ${data.dateCreated}`,
      `Estimated Completion: ${data.estimatedCompletion}`,
      `Student Name: ${data.studentName}`,
      `Grade & Section: ${data.grade} - ${data.section}`,
      `Assigned Handler: ${data.handler || 'Unassigned'}`,
      '',
      'DESCRIPTION:',
      data.description || 'No description provided.',
      '',
      'TIMELINE HISTORY:'
    ];

    if (data.timeline && data.timeline.length > 0) {
      data.timeline.forEach((t) => {
        lines.push(`- [${t.completed ? 'COMPLETED' : 'PENDING'}] ${t.status}: ${t.description || ''} (${t.date || ''})`);
      });
    }

    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `status-${(data.rawRequestId || data.requestNumber).replace('#', '')}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="guest-status-page">
        <div className="guest-status-message-card">
          <div className="guest-spinner" aria-hidden="true"></div>
          <h3 className="guest-status-message-title">Checking request status...</h3>
          <p className="guest-status-message-text">Retrieving live tracking details from school office servers.</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="guest-status-page">
        <div className="guest-status-message-card">
          <FaExclamationTriangle className="guest-status-message-icon icon-error" />
          <h3 className="guest-status-message-title">Something went wrong</h3>
          <p className="guest-status-message-text">{error}</p>
          <button type="button" className="submit-btn-guest" onClick={onHome}>
            Return to Guest Portal
          </button>
        </div>
      </div>
    );
  }

  if (notFound || !data) {
    return (
      <div className="guest-status-page">
        <div className="guest-status-message-card">
          <FaSearch className="guest-status-message-icon icon-not-found" />
          <h3 className="guest-status-message-title">Request Not Found</h3>
          <p className="guest-status-message-text">
            We could not find any request matching that Request ID. Please verify the ID on your submission receipt and try again.
          </p>
          <button type="button" className="submit-btn-guest" onClick={onHome}>
            Check Another ID
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="guest-status-page">
      <div className="guest-status-heading">
        <div className="guest-status-pill-wrap">
          <div className={`guest-status-pill ${data.statusClass || 'is-pending'}`}>
            <span className="guest-status-dot"></span>
            {data.status}
          </div>
        </div>
        <h2 className="section-title-guest">Request Live Status</h2>
        <p className="section-subtitle-guest">
          Live progress and timeline details for your submitted guest request.
        </p>
      </div>

      {/* Top Hero Card for the request */}
      <div className="guest-hero-card">
        <div className="guest-hero-top">
          <div>
            <span className="guest-office-badge">
              <FaBuilding /> {data.officeName} Department
            </span>
            <h3 className="guest-request-subject">{data.subject}</h3>
            <div className="guest-id-row">
              <span className="guest-request-num">{data.requestNumber}</span>
              <button 
                type="button" 
                className="guest-copy-btn" 
                onClick={handleCopyId}
                title="Copy Request ID"
              >
                {copied ? <FaCheck className="copied-check" /> : <FaCopy />}
                <span>{copied ? 'Copied!' : 'Copy'}</span>
              </button>
            </div>
          </div>

          <div className="guest-handler-pill">
            <FaUserCircle className="handler-icon" />
            <div>
              <span className="handler-label">Handler</span>
              <span className="handler-name">{data.handler || 'Awaiting Assignment'}</span>
            </div>
          </div>
        </div>

        {data.description && (
          <div className="guest-inquiry-box">
            <span className="inquiry-label">Your Submitted Inquiry:</span>
            <p className="inquiry-text">"{data.description}"</p>
          </div>
        )}
      </div>

      <div className="guest-results-grid">
        {/* Left Column: Details Overview */}
        <div className="guest-result-card">
          <h3 className="guest-result-heading">Request Overview</h3>
          <div className="guest-detail-row">
            <span className="guest-detail-label">Request Number</span>
            <span className="guest-detail-value font-mono">{data.requestNumber}</span>
          </div>
          <div className="guest-detail-row">
            <span className="guest-detail-label">Office Code</span>
            <span className="guest-detail-value">{data.officeCode}</span>
          </div>
          <div className="guest-detail-row">
            <span className="guest-detail-label">Student Name</span>
            <span className="guest-detail-value">{data.studentName}</span>
          </div>
          {data.grade && (
            <div className="guest-detail-row">
              <span className="guest-detail-label">Grade & Section</span>
              <span className="guest-detail-value">{data.grade} - {data.section}</span>
            </div>
          )}
          <div className="guest-detail-row">
            <span className="guest-detail-label">Date Submitted</span>
            <span className="guest-detail-value">{data.dateCreated}</span>
          </div>
          <div className="guest-detail-row">
            <span className="guest-detail-label">Estimated Completion</span>
            <span className="guest-detail-value est-completion-pill">{data.estimatedCompletion}</span>
          </div>
        </div>

        {/* Right Column: Status Timeline */}
        <div className="guest-result-card">
          <h3 className="guest-result-heading">Status Timeline</h3>
          <div className="guest-timeline">
            {data.timeline && data.timeline.map((item, index) => (
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

      {/* Staff Response Card if any replies exist */}
      {data.followUps && data.followUps.filter(f => f.sentBy === 'staff').length > 0 && (
        <div className="guest-replies-section">
          <h3 className="section-title-guest">Official Office Updates</h3>
          {data.followUps.filter(f => f.sentBy === 'staff').map((reply, rIdx) => (
            <div key={rIdx} className="guest-staff-reply-card">
              <div className="reply-header">
                <FaUserCircle className="reply-staff-icon" />
                <div>
                  <h4 className="reply-title">{data.officeName} Department</h4>
                  <span className="reply-author">{reply.sentByName || 'Staff Representative'}</span>
                </div>
                <span className="reply-date">
                  {reply.sentAt ? new Date(reply.sentAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''}
                </span>
              </div>
              <p className="reply-text">{reply.message}</p>
            </div>
          ))}
        </div>
      )}

      <div className="guest-status-bottom-actions">
        <button type="button" className="guest-outline-btn" onClick={handleDownload}>
          <FaDownload /> Download Report
        </button>
        <button type="button" className="submit-btn-guest" onClick={onHome}>
          Check Another Request
        </button>
      </div>
    </div>
  );
};

export default GuestRequestStatus;