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
import { Skeleton } from './common/Skeleton';
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
    doc.text('Request Receipt', 105, 28, { align: 'center' });
    
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
    doc.text(data.estimatedCompletion || 'To be determined', 70, y);
    
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
    
    // Footer/Disclaimer (optional)
    y += 20;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    doc.text('This is an official receipt issued by Academia de San Jose.', 105, y, { align: 'center' });
    
    // Download PDF
    doc.save(`receipt-${(data.rawRequestId || data.requestNumber).replace('#', '')}.pdf`);
  };

  if (loading) {
    return (
      <div className="guest-status-page" aria-label="Loading request status..." role="status">
        <div className="guest-status-heading">
          <div className="guest-status-pill-wrap" style={{ display: 'flex', justifyContent: 'center' }}>
            <Skeleton variant="pill" width="130px" height="28px" />
          </div>
          <Skeleton variant="text" width="220px" height="28px" style={{ margin: '8px auto' }} />
          <Skeleton variant="text" width="340px" height="14px" style={{ margin: '0 auto' }} />
        </div>

        <div className="guest-hero-card" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <Skeleton variant="pill" width="140px" height="24px" />
              <Skeleton variant="text" width="260px" height="24px" />
              <Skeleton variant="text" width="160px" height="18px" />
            </div>
            <Skeleton variant="rounded" width="130px" height="42px" />
          </div>
          <Skeleton variant="rounded" width="100%" height="60px" />
        </div>

        <div className="guest-results-grid">
          <div className="guest-result-card" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <Skeleton variant="text" width="160px" height="20px" />
            <Skeleton variant="rounded" width="100%" height="32px" />
            <Skeleton variant="rounded" width="100%" height="32px" />
            <Skeleton variant="rounded" width="100%" height="32px" />
          </div>
          <div className="guest-result-card" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <Skeleton variant="text" width="160px" height="20px" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '8px' }}>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <Skeleton variant="circular" width={28} height={28} />
                <Skeleton variant="text" width="70%" height="16px" />
              </div>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <Skeleton variant="circular" width={28} height={28} />
                <Skeleton variant="text" width="55%" height="16px" />
              </div>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <Skeleton variant="circular" width={28} height={28} />
                <Skeleton variant="text" width="80%" height="16px" />
              </div>
            </div>
          </div>
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

        {data.resolutionNote && (
          <div className="guest-resolution-box">
            <span className="resolution-label">
              <FaCheckCircle className="resolution-icon-inline" /> Staff Resolution Note:
            </span>
            <p className="resolution-text">"{data.resolutionNote}"</p>
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
          {data.parentGuardianName && (
            <div className="guest-detail-row">
              <span className="guest-detail-label">Parent / Guardian</span>
              <span className="guest-detail-value">{data.parentGuardianName}</span>
            </div>
          )}
          <div className="guest-detail-row">
            <span className="guest-detail-label">Date Submitted</span>
            <span className="guest-detail-value">{data.dateCreated}</span>
          </div>
          <div className="guest-detail-row">
            <span className="guest-detail-label">Estimated Completion</span>
            <span className={`guest-detail-value est-completion-pill ${(!data.estimatedCompletion || data.estimatedCompletion === 'To be determined') ? 'is-tbd' : ''}`}>
              {data.estimatedCompletion || 'To be determined'}
            </span>
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
      {data.followUps && data.followUps.filter(f => 
        f.sentBy === 'staff' &&
        !f.message?.includes('automatically assigned to') &&
        !f.message?.includes('Request marked as Resolved') &&
        !f.message?.toLowerCase().includes('request rejected by') &&
        !f.message?.toLowerCase().includes('reassigned from') &&
        !f.message?.toLowerCase().includes('rerouted from') &&
        !f.message?.toLowerCase().includes('claimed and taken over') &&
        !f.message?.toLowerCase().includes('taken over by') &&
        !f.message?.toLowerCase().includes('workload rebalanced') &&
        f.type !== 'takeover' &&
        f.type !== 'reassigned' &&
        f.type !== 'reassign_staff'
      ).length > 0 && (
        <div className="guest-replies-section">
          <h3 className="section-title-guest">Official Office Updates</h3>
          {data.followUps.filter(f => 
            f.sentBy === 'staff' &&
            !f.message?.includes('automatically assigned to') &&
            !f.message?.includes('Request marked as Resolved') &&
            !f.message?.toLowerCase().includes('request rejected by') &&
            !f.message?.toLowerCase().includes('reassigned from') &&
            !f.message?.toLowerCase().includes('rerouted from') &&
            !f.message?.toLowerCase().includes('claimed and taken over') &&
            !f.message?.toLowerCase().includes('taken over by') &&
            !f.message?.toLowerCase().includes('workload rebalanced') &&
            f.type !== 'takeover' &&
            f.type !== 'reassigned' &&
            f.type !== 'reassign_staff'
          ).map((reply, rIdx) => (
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
          <FaDownload /> Download Receipt
        </button>
        <button type="button" className="submit-btn-guest" onClick={onHome}>
          Check Another Request
        </button>
      </div>
    </div>
  );
};

export default GuestRequestStatus;