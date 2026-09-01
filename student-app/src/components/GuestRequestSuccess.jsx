import React from 'react';
import { FaCheckCircle, FaDownload, FaArrowLeft, FaPlus } from 'react-icons/fa';
import { MdExitToApp } from 'react-icons/md';
import Brand from './Brand';
import '../styles/GuestRequestSuccess.css';

const GuestRequestSuccess = ({ requestData, onBackToLogin, onSubmitAnother, onTrackStatus }) => {
  const handleLogout = () => {
    if (window.confirm('Are you sure you want to logout?')) {
      localStorage.removeItem('studentLoggedIn');
      localStorage.removeItem('studentIsGuest');
      window.location.href = '/';
    }
  };

  const handleDownload = () => {
    const content = `
ACADEMIA DE SAN JOSE
Request Confirmation

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

REQUEST NUMBER: ${requestData.requestId}
OFFICE CODE: ${requestData.officeCode}
DATE OF CREATION: ${requestData.createdAt}
ESTIMATED COMPLETION: ${requestData.estimatedCompletion || 'To be determined by staff'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SUBMITTED BY: ${requestData.studentName}
GRADE: ${requestData.studentGradeLevel}
SECTION: ${requestData.studentSection}

OFFICE: ${requestData.office}
SUBJECT: ${requestData.subject}

Please save this Request Number and Office Code to track your request status.

Thank you for using our service!
`;

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Request_${requestData.requestId}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="guest-success-page">
      {/* Header */}
      <header className="guest-success-header">
        <div className="guest-success-header-left">
          <Brand size="md" subtitle="Guest Portal" />
        </div>
        <div className="guest-success-header-right">
          <button type="button" className="guest-header-btn-secondary" onClick={onBackToLogin}>
            <FaArrowLeft /> Guest Portal
          </button>
          <button type="button" className="guest-header-btn-primary" onClick={onTrackStatus}>
            Track Request Status →
          </button>
          <button type="button" className="guest-header-btn-logout" onClick={handleLogout}>
            <MdExitToApp /> Logout
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="guest-success-main">
        <div className="guest-success-card">
          <div className="guest-success-check-icon">
            <FaCheckCircle />
          </div>
          
          <h1 className="guest-success-heading">Request Submitted</h1>
          
          <div className="guest-success-info-box">
            <p className="guest-success-info-para">
              Your request has been successfully submitted to the <strong>{requestData.office}</strong>.
            </p>
            <p className="guest-success-info-para">
              You can use your Request Number and Office Code to track its progress at any time.
            </p>
          </div>

          <div className="guest-success-details-box">
            <h2 className="guest-success-details-heading">Request Summary</h2>
            
            <div>
              <div className="guest-success-detail-item">
                <div className="guest-success-detail-label">Request Number</div>
                <div className="guest-success-detail-value">{requestData.requestId}</div>
              </div>

              <div className="guest-success-detail-item">
                <div className="guest-success-detail-label">Office Code</div>
                <div className="guest-success-detail-value">{requestData.officeCode}</div>
              </div>

              <div className="guest-success-detail-item">
                <div className="guest-success-detail-label">Date Submitted</div>
                <div className="guest-success-detail-value">{requestData.createdAt}</div>
              </div>

              <div className="guest-success-detail-item">
                <div className="guest-success-detail-label">Estimated Completion</div>
                <div className="guest-success-detail-value">{requestData.estimatedCompletion || 'To Be Determined'}</div>
              </div>
            </div>
          </div>

          <div className="guest-success-actions">
            <button type="button" className="guest-success-btn-download" onClick={handleDownload}>
              <FaDownload /> Download Receipt
            </button>
            <button type="button" className="guest-success-btn-another" onClick={onSubmitAnother}>
              <FaPlus /> Submit Another Request
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default GuestRequestSuccess;
