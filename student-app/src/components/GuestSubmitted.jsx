import React, { useState } from 'react';
import { FaCheckCircle, FaDownload, FaCopy, FaCheck, FaTrackChanges, FaArrowRight } from 'react-icons/fa';
import { MdTrackChanges } from 'react-icons/md';
import '../styles/GuestSubmitted.css';

const GuestSubmitted = ({ data, onHome, onTrack }) => {
  const [copied, setCopied] = useState(false);
  if (!data) return null;

  const handleCopyId = () => {
    const idToCopy = data.rawRequestId || data.requestNumber.replace('#', '');
    navigator.clipboard.writeText(idToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const lines = [
      'ACADEMIA DE SAN JOSE — GUEST REQUEST SUBMISSION RECEIPT',
      '======================================================',
      `Request Number: ${data.requestNumber}`,
      `Office: ${data.officeName}`,
      `Office Code: ${data.officeCode}`,
      `Subject: ${data.subject || 'N/A'}`,
      `Date Created: ${data.dateCreated}`,
      `Estimated Completion: ${data.estimatedCompletion}`,
      '',
      'DESCRIPTION:',
      data.description || 'N/A',
      '',
      'INSTRUCTIONS:',
      'Keep this receipt and your Request Number safe. You can check the real-time status of your request at any time on the Guest Portal.'
    ];

    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `receipt-${(data.rawRequestId || data.requestNumber).replace('#', '')}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="guest-submitted">
      <div className="guest-success-hero">
        <div className="guest-success-icon">
          <FaCheckCircle />
        </div>
        <h2 className="guest-success-title">Request Successfully Submitted</h2>
        <p className="guest-success-message">
          Your request has been routed to the <strong>{data.officeName} Department</strong>.
          Our office staff has been notified and will process your inquiry.
        </p>
      </div>

      <div className="guest-result-card">
        <div className="guest-card-header-row">
          <h3 className="guest-result-heading">Submission Receipt</h3>
          <button 
            type="button" 
            className="guest-copy-pill" 
            onClick={handleCopyId}
            title="Copy Request ID"
          >
            {copied ? <FaCheck className="copied-check" /> : <FaCopy />}
            <span>{copied ? 'Copied!' : 'Copy Request ID'}</span>
          </button>
        </div>

        <div className="guest-detail-row">
          <span className="guest-detail-label">Request Number</span>
          <span className="guest-detail-value font-mono font-bold">{data.requestNumber}</span>
        </div>
        <div className="guest-detail-row">
          <span className="guest-detail-label">Target Office</span>
          <span className="guest-detail-value">{data.officeName}</span>
        </div>
        <div className="guest-detail-row">
          <span className="guest-detail-label">Office Code</span>
          <span className="guest-detail-value">{data.officeCode}</span>
        </div>
        <div className="guest-detail-row">
          <span className="guest-detail-label">Subject</span>
          <span className="guest-detail-value">{data.subject}</span>
        </div>
        <div className="guest-detail-row">
          <span className="guest-detail-label">Date Submitted</span>
          <span className="guest-detail-value">{data.dateCreated}</span>
        </div>
        <div className="guest-detail-row">
          <span className="guest-detail-label">Estimated Completion</span>
          <span className="guest-detail-value est-completion-pill">{data.estimatedCompletion}</span>
        </div>
      </div>

      <div className="guest-result-actions">
        <button type="button" className="guest-outline-btn" onClick={handleDownload}>
          <FaDownload /> Download Receipt
        </button>
        {onTrack && (
          <button type="button" className="guest-track-btn" onClick={onTrack}>
            <MdTrackChanges /> Track Status Now
          </button>
        )}
        <button type="button" className="submit-btn-guest" onClick={onHome}>
          Submit Another Request
        </button>
      </div>
    </div>
  );
};

export default GuestSubmitted;