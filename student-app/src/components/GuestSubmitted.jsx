import React from 'react';
import { FaCheckCircle, FaDownload } from 'react-icons/fa';
import '../styles/GuestSubmitted.css';

const GuestSubmitted = ({ data, onHome }) => {
  if (!data) return null;

  const handleDownload = () => {
    const lines = [
      'REQUEST DETAILS',
      `Request Number: ${data.requestNumber}`,
      `Office Code: ${data.officeCode}`,
      `Office: ${data.officeName}`,
      `Subject: ${data.subject || 'N/A'}`,
      `Date of Creation: ${data.dateCreated}`,
      `Estimated Completion: ${data.estimatedCompletion}`
    ];
    if (data.description) {
      lines.push(`Description: ${data.description}`);
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `request-details-${data.requestNumber.replace('#', '')}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="guest-submitted">
      <div className="guest-success-hero">
        <div className="guest-success-icon">
          <FaCheckCircle />
        </div>
        <h2 className="guest-success-title">Request Submitted</h2>
        <p className="guest-success-message">
          Your request has been successfully submitted to the {data.officeName} Office.
          You can use your Request ID and the Office Code to track its progress at any time.
        </p>
      </div>

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

      <div className="guest-result-actions">
        <button type="button" className="guest-outline-btn" onClick={handleDownload}>
          <FaDownload /> Download Request Details
        </button>
        <button type="button" className="submit-btn-guest" onClick={onHome}>
          Submit Another Request
        </button>
      </div>
    </div>
  );
};

export default GuestSubmitted;