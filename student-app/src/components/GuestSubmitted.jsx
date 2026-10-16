import React, { useState } from 'react';
import { FaCheckCircle, FaDownload, FaCopy, FaCheck, FaTrackChanges, FaArrowRight, FaEnvelope } from 'react-icons/fa';
import { MdTrackChanges } from 'react-icons/md';
import { jsPDF } from 'jspdf';
import '../styles/GuestSubmitted.css';

const GuestSubmitted = ({ data, onHome, onTrack, onSubmitAnother }) => {
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
    doc.text(data.isAlumni ? 'Alumni Request Submission Receipt' : 'Guest Request Submission Receipt', 105, 28, { align: 'center' });
    
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
    doc.text('Requester Type:', 20, y);
    doc.setFont('helvetica', 'normal');
    doc.text(data.requesterType || (data.isAlumni ? 'Alumni' : 'Guest Requester'), 70, y);
    
    y += 8;
    doc.setFont('helvetica', 'bold');
    doc.text('Office:', 20, y);
    doc.setFont('helvetica', 'normal');
    doc.text(data.officeName, 70, y);
    
    y += 8;
    doc.setFont('helvetica', 'bold');
    doc.text('Subject:', 20, y);
    doc.setFont('helvetica', 'normal');
    doc.text(data.subject || 'N/A', 70, y);
    
    if (data.studentName) {
      y += 8;
      doc.setFont('helvetica', 'bold');
      doc.text(data.isAlumni ? 'Alumni Name:' : 'Student Name:', 20, y);
      doc.setFont('helvetica', 'normal');
      doc.text(data.studentName, 70, y);
    }

    if (data.isAlumni && data.batchYear) {
      y += 8;
      doc.setFont('helvetica', 'bold');
      doc.text('Batch / Year:', 20, y);
      doc.setFont('helvetica', 'normal');
      doc.text(data.batchYear, 70, y);
    }

    if (data.isAlumni && data.formerStudentId) {
      y += 8;
      doc.setFont('helvetica', 'bold');
      doc.text('Former Student ID:', 20, y);
      doc.setFont('helvetica', 'normal');
      doc.text(data.formerStudentId, 70, y);
    }

    if (!data.isAlumni && (data.grade || data.section)) {
      y += 8;
      doc.setFont('helvetica', 'bold');
      doc.text('Grade & Section:', 20, y);
      doc.setFont('helvetica', 'normal');
      doc.text(`${data.grade || ''}${data.section ? ` - Section ${data.section}` : ''}`, 70, y);
    }

    if (data.parentGuardianName) {
      y += 8;
      doc.setFont('helvetica', 'bold');
      doc.text('Parent/Guardian:', 20, y);
      doc.setFont('helvetica', 'normal');
      doc.text(data.parentGuardianName, 70, y);
    }

    if (data.email) {
      y += 8;
      doc.setFont('helvetica', 'bold');
      doc.text('Email Address:', 20, y);
      doc.setFont('helvetica', 'normal');
      doc.text(data.email, 70, y);
    }
    
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
          {data.email ? ' An official confirmation receipt with your Tracking Request ID has also been emailed to you.' : ' Our office staff has been notified and will process your inquiry.'}
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
          <span className="guest-detail-label">Requester Type</span>
          <span className="guest-detail-value font-semibold">
            {data.requesterType || (data.isAlumni ? 'Alumni' : 'Guest Requester')}
          </span>
        </div>
        <div className="guest-detail-row">
          <span className="guest-detail-label">Target Office</span>
          <span className="guest-detail-value">{data.officeName}</span>
        </div>
        <div className="guest-detail-row">
          <span className="guest-detail-label">Subject</span>
          <span className="guest-detail-value">{data.subject}</span>
        </div>
        {data.studentName && (
          <div className="guest-detail-row">
            <span className="guest-detail-label">{data.isAlumni ? 'Alumni Name' : 'Student Name'}</span>
            <span className="guest-detail-value">{data.studentName}</span>
          </div>
        )}
        {data.isAlumni && data.batchYear && (
          <div className="guest-detail-row">
            <span className="guest-detail-label">Batch / Year Graduated</span>
            <span className="guest-detail-value">{data.batchYear}</span>
          </div>
        )}
        {data.isAlumni && data.formerStudentId && (
          <div className="guest-detail-row">
            <span className="guest-detail-label">Former Student ID</span>
            <span className="guest-detail-value">{data.formerStudentId}</span>
          </div>
        )}
        {!data.isAlumni && (data.grade || data.section) && (
          <div className="guest-detail-row">
            <span className="guest-detail-label">Grade & Section</span>
            <span className="guest-detail-value">
              {data.grade || ''}{data.section ? ` - ${data.section}` : ''}
            </span>
          </div>
        )}
        {data.email && (
          <div className="guest-detail-row">
            <span className="guest-detail-label">Email Receipt Sent To</span>
            <span className="guest-detail-value font-semibold" style={{ color: '#166534', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <FaEnvelope /> {data.email}
            </span>
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

      <div className="guest-result-actions">
        <button type="button" className="guest-outline-btn" onClick={handleDownload}>
          <FaDownload /> Download Receipt
        </button>
        {onTrack && (
          <button type="button" className="guest-track-btn" onClick={onTrack}>
            <MdTrackChanges /> Track Status Now
          </button>
        )}
        <button type="button" className="submit-btn-guest" onClick={onSubmitAnother || onHome}>
          Submit Another Request
        </button>
      </div>
    </div>
  );
};

export default GuestSubmitted;