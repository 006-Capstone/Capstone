import React from 'react';
import { FaCheckCircle, FaDownload, FaArrowLeft, FaPlus } from 'react-icons/fa';
import { MdExitToApp } from 'react-icons/md';

const GuestRequestSuccess = ({ requestData, onBackToLogin, onSubmitAnother, onTrackStatus }) => {
  const handleLogout = () => {
    if (window.confirm('Are you sure you want to logout?')) {
      localStorage.removeItem('studentLoggedIn');
      localStorage.removeItem('studentIsGuest');
      window.location.href = '/';
    }
  };
  const styles = {
    page: {
      height: '100vh',
      backgroundColor: '#f5f5f5',
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      margin: 0,
      padding: 0
    },
    header: {
      background: 'white',
      padding: '16px 40px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
      flexShrink: 0
    },
    headerLeft: {
      display: 'flex',
      alignItems: 'center',
      gap: '12px'
    },
    logo: {
      width: '45px',
      height: '45px',
      objectFit: 'contain'
    },
    title: {
      fontSize: '18px',
      fontWeight: 600,
      color: '#1a1a1a'
    },
    headerRight: {
      display: 'flex',
      gap: '12px',
      alignItems: 'center'
    },
    btnSecondary: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px',
      padding: '10px 18px',
      fontSize: '14px',
      fontWeight: 600,
      borderRadius: '6px',
      cursor: 'pointer',
      transition: 'all 0.2s',
      background: 'white',
      color: '#333',
      border: '1px solid #d0d0d0'
    },
    btnPrimary: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px',
      padding: '10px 18px',
      fontSize: '14px',
      fontWeight: 600,
      borderRadius: '6px',
      cursor: 'pointer',
      transition: 'all 0.2s',
      background: '#4CAF50',
      color: 'white',
      border: 'none'
    },
    btnLogout: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px',
      padding: '10px 18px',
      fontSize: '14px',
      fontWeight: 600,
      borderRadius: '6px',
      cursor: 'pointer',
      transition: 'all 0.2s',
      background: '#f44336',
      color: 'white',
      border: 'none'
    },
    main: {
      flex: 1,
      overflowY: 'auto',
      overflowX: 'hidden',
      padding: '40px 20px 60px',
      WebkitOverflowScrolling: 'touch'
    },
    card: {
      maxWidth: '800px',
      margin: '0 auto',
      background: 'white',
      borderRadius: '12px',
      padding: '50px 40px',
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
      textAlign: 'center'
    },
    checkIcon: {
      fontSize: '70px',
      color: '#4CAF50',
      marginBottom: '20px'
    },
    heading: {
      fontSize: '28px',
      fontWeight: 700,
      color: '#1a1a1a',
      margin: '0 0 20px 0'
    },
    infoBox: {
      background: '#e8f5e9',
      borderRadius: '8px',
      padding: '20px',
      margin: '0 auto 40px',
      maxWidth: '650px'
    },
    infoPara: {
      fontSize: '15px',
      color: '#555',
      lineHeight: 1.7,
      margin: '0 0 10px 0'
    },
    detailsBox: {
      background: '#fafafa',
      border: '1px solid #e0e0e0',
      borderRadius: '10px',
      padding: '30px',
      margin: '0 auto 30px',
      maxWidth: '650px'
    },
    detailsHeading: {
      fontSize: '18px',
      fontWeight: 600,
      color: '#1a1a1a',
      margin: '0 0 24px 0',
      paddingBottom: '16px',
      borderBottom: '1px solid #e0e0e0'
    },
    detailItem: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '16px 0',
      borderBottom: '1px solid #e5e5e5'
    },
    detailLabel: {
      fontSize: '11px',
      fontWeight: 600,
      color: '#666',
      letterSpacing: '0.5px',
      textTransform: 'uppercase'
    },
    detailValue: {
      fontSize: '16px',
      fontWeight: 700,
      color: '#1a1a1a'
    },
    actionButtons: {
      display: 'flex',
      gap: '12px',
      maxWidth: '650px',
      margin: '0 auto'
    },
    btnDownload: {
      flex: 1,
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '8px',
      padding: '14px 24px',
      fontSize: '15px',
      fontWeight: 600,
      borderRadius: '6px',
      cursor: 'pointer',
      transition: 'all 0.2s',
      background: '#4CAF50',
      color: 'white',
      border: 'none'
    },
    btnSubmitAnother: {
      flex: 1,
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '8px',
      padding: '14px 24px',
      fontSize: '15px',
      fontWeight: 600,
      borderRadius: '6px',
      cursor: 'pointer',
      transition: 'all 0.2s',
      background: 'white',
      color: '#4CAF50',
      border: '2px solid #4CAF50'
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
    <div style={styles.page}>
      {/* Header */}
      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <img src="/school-logo.jpg" alt="Logo" style={styles.logo} />
          <span style={styles.title}>Academia De San Jose</span>
        </div>
        <div style={styles.headerRight}>
          <button style={styles.btnSecondary} onClick={onBackToLogin}>
            <FaArrowLeft /> Guest Log In
          </button>
          <button style={styles.btnPrimary} onClick={onTrackStatus}>
            Track Request Status →
          </button>
          <button style={styles.btnLogout} onClick={handleLogout}>
            <MdExitToApp /> Logout
          </button>
        </div>
      </header>

      {/* Main Content - SCROLLABLE */}
      <main style={styles.main}>
        <div style={styles.card}>
          <div style={styles.checkIcon}>
            <FaCheckCircle />
          </div>
          
          <h1 style={styles.heading}>Request Submitted</h1>
          
          <div style={styles.infoBox}>
            <p style={styles.infoPara}>Your request has been successfully submitted to the <strong>{requestData.office}</strong>.</p>
            <p style={{...styles.infoPara, marginBottom: 0}}>You can use your Request Number and the Office Code to track its progress at any time.</p>
          </div>

          <div style={styles.detailsBox}>
            <h2 style={styles.detailsHeading}>Request Details</h2>
            
            <div>
              <div style={styles.detailItem}>
                <div style={styles.detailLabel}>REQUEST NUMBER</div>
                <div style={styles.detailValue}>{requestData.requestId}</div>
              </div>

              <div style={styles.detailItem}>
                <div style={styles.detailLabel}>OFFICE CODE</div>
                <div style={styles.detailValue}>{requestData.officeCode}</div>
              </div>

              <div style={styles.detailItem}>
                <div style={styles.detailLabel}>DATE OF CREATION</div>
                <div style={styles.detailValue}>{requestData.createdAt}</div>
              </div>

              <div style={{...styles.detailItem, borderBottom: 'none'}}>
                <div style={styles.detailLabel}>ESTIMATED COMPLETION</div>
                <div style={styles.detailValue}>{requestData.estimatedCompletion || 'TO BE DETERMINED'}</div>
              </div>
            </div>
          </div>

          <div style={styles.actionButtons}>
            <button style={styles.btnDownload} onClick={handleDownload}>
              <FaDownload /> Download Request Details
            </button>
            <button style={styles.btnSubmitAnother} onClick={onSubmitAnother}>
              <FaPlus /> Submit Another Request
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default GuestRequestSuccess;
