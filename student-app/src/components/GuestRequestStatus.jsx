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
import { jsPDF } from 'jspdf';
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
    
    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('ACADEMIA DE SAN JOSE', 105, 20, { align: 'center' });
    
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text('Guest Request Status Report', 105, 28, { align: 'center' });
    
    // Divider
    doc.setLineWidth(0.5);
    doc.line(20, 32, 190, 32);
    
    // Content
    let y = 45;
    doc.setFontSize(10);
    
    doc.setFont('helvetica', 'bold');
    doc.text('Request Number:', 20, y);
    doc.setFont('helvetica', 'normal');
    doc.text(data.requestNumber, 70, y);
    
    y += 8;
    doc.setFont('helvetica', 'bold');
    doc.text('Office:', 20, y);
    doc.setFont('helvetica', 'normal');
    doc.text(data.officeName, 70, y);
    
    y += 8;
    doc.setFont('helvetica', 'bold');
    doc.text('Office Code:', 20, y);
    doc.setFont('helvetica', 'normal');
    doc.text(data.officeCode, 70, y);
    
    y += 8;
    doc.setFont('helvetica', 'bold');
    doc.text('Status:', 20, y);
    doc.setFont('helvetica', 'normal');
    doc.text(data.status, 70, y);
    
    y += 8;
    doc.setFont('helvetica', 'bold');
    doc.text('Subject:', 20, y);
    doc.setFont('helvetica', 'normal');
    doc.text(data.subject || 'N/A', 70, y);
    
    y += 8;
    doc.setFont('helvetica', 'bold');
    doc.text('Date Created:', 20, y);
    doc.setFont('helvetica', 'normal');
    doc.text(data.dateCreated, 70, y);
    
    y += 8;
    doc.setFont('helvetica', 'bold');
    doc.text('Estimated Completion:', 20, y);
    doc.setFont('helvetica', 'normal');
    doc.text(data.estimatedCompletion, 70, y);
    
    y += 8;
    doc.setFont('helvetica', 'bold');
    doc.text('Student Name:', 20, y);
    doc.setFont('helvetica', 'normal');
    doc.text(data.studentName, 70, y);
    
    y += 8;
    doc.setFont('helvetica', 'bold');
    doc.text('Grade & Section:', 20, y);
    doc.setFont('helvetica', 'normal');
    doc.text(`${data.grade} - ${data.section}`, 70, y);
    
    y += 8;
    doc.setFont('helvetica', 'bold');
    doc.text('Assigned Handler:', 20, y);
    doc.setFont('helvetica', 'normal');
    doc.text(data.handler || 'Unassigned', 70, y);
    
    // Description section
    y += 15;
    doc.setFont('helvetica', 'bold');
    doc.text('DESCRIPTION:', 20, y);
    
    y += 8;
    doc.setFont('helvetica', 'normal');
    const descriptionLines = doc.splitTextToSize(data.description || 'No description provided.', 170);
    doc.text(descriptionLines, 20, y);
    
    // Timeline section
    y += (descriptionLines.length * 5) + 15;
    doc.setFont('helvetica', 'bold');
    doc.text('TIMELINE HISTORY:', 20, y);
    
    y += 8;
    doc.setFont('helvetica', 'normal');
    
    if (data.timeline && data.timeline.length > 0) {
      data.timeline.forEach((t) => {
        const statusText = `[${t.completed ? 'COMPLETED' : 'PENDING'}] ${t.status}`;
        const timelineLines = doc.splitTextToSize(`${statusText}: ${t.description || ''} (${t.date || ''})`, 170);
        doc.text(timelineLines, 20, y);
        y += (timelineLines.length * 5);
      });
    } else {
      doc.text('No timeline data available.', 20, y);
    }
    
    // Download PDF
    doc.save(`status-${(data.rawRequestId || data.requestNumber).replace('#', '')}.pdf`);
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