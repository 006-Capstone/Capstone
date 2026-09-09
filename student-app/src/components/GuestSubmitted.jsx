import React, { useState } from 'react';
import { FaCheckCircle, FaDownload, FaCopy, FaCheck, FaTrackChanges, FaArrowRight } from 'react-icons/fa';
import { MdTrackChanges } from 'react-icons/md';
import { jsPDF } from 'jspdf';
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
    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('ACADEMIA DE SAN JOSE', 105, 20, { align: 'center' });
    
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text('Guest Request Submission Receipt', 105, 28, { align: 'center' });
    
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
    
    // Description section
    y += 15;
    doc.setFont('helvetica', 'bold');
    doc.text('DESCRIPTION:', 20, y);
    
    y += 8;
    doc.setFont('helvetica', 'normal');
    const descriptionLines = doc.splitTextToSize(data.description || 'N/A', 170);
    doc.text(descriptionLines, 20, y);
    
    // Instructions section
    y += (descriptionLines.length * 5) + 15;
    doc.setFont('helvetica', 'bold');
    doc.text('INSTRUCTIONS:', 20, y);
    
    y += 8;
    doc.setFont('helvetica', 'normal');
    const instructions = 'Keep this receipt and your Request Number safe. You can check the real-time status of your request at any time on the Guest Portal.';
    const instructionLines = doc.splitTextToSize(instructions, 170);
    doc.text(instructionLines, 20, y);
    
    // Download PDF
    doc.save(`receipt-${(data.rawRequestId || data.requestNumber).replace('#', '')}.pdf`);
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