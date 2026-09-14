import React, { useState } from 'react';
import { FaTimes, FaBell, FaExclamationTriangle } from 'react-icons/fa';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import '../styles/NudgeModal.css';

const NUDGE_TEMPLATES = {
  gentle: {
    title: '🔔 Gentle Reminder',
    message: 'Hi! Just a friendly reminder that you have {count} pending ticket(s) that need attention. Take your time to review them when you can. Thanks for your hard work!'
  },
  urgent: {
    title: '⚠️ Urgent: Pending Tickets',
    message: 'You currently have {count} overdue ticket(s) requiring immediate attention. Please prioritize these to maintain service quality. Let us know if you need support.'
  },
  critical: {
    title: '🚨 Critical: SLA Breach Risk',
    message: 'CRITICAL: You have {count} ticket(s) at risk of SLA breach. Immediate action is required to prevent service disruption. Please address these tickets ASAP or request workload rebalancing.'
  }
};

const NudgeModal = ({ isOpen, onClose, staffMember }) => {
  const [selectedTemplate, setSelectedTemplate] = useState('gentle');
  const [customMessage, setCustomMessage] = useState('');
  const [useCustom, setUseCustom] = useState(false);
  const [sending, setSending] = useState(false);

  if (!isOpen || !staffMember) return null;

  const handleSendNudge = async () => {
    try {
      setSending(true);

      const template = NUDGE_TEMPLATES[selectedTemplate];
      const message = useCustom 
        ? customMessage 
        : template.message.replace('{count}', staffMember.activeTickets);

      // Create notification in Firestore
      await addDoc(collection(db, 'notifications'), {
        userId: staffMember.id,
        userType: 'staff',
        type: 'performance_nudge',
        title: useCustom ? 'Performance Reminder' : template.title,
        message: message,
        timestamp: serverTimestamp(),
        read: false,
        priority: selectedTemplate === 'critical' ? 'high' : selectedTemplate === 'urgent' ? 'medium' : 'low',
        metadata: {
          sentBy: 'superadmin',
          reason: 'performance_monitoring',
          staffName: staffMember.name,
          ticketCount: staffMember.activeTickets,
          overdueCount: staffMember.overdueTickets,
          riskScore: staffMember.riskScore
        }
      });

      // Log the nudge action
      await addDoc(collection(db, 'performance_logs'), {
        action: 'nudge_sent',
        staffId: staffMember.id,
        staffName: staffMember.name,
        template: selectedTemplate,
        message: message,
        timestamp: serverTimestamp(),
        metrics: {
          activeTickets: staffMember.activeTickets,
          overdueTickets: staffMember.overdueTickets,
          riskScore: staffMember.riskScore
        }
      });

      alert('✅ Nudge sent successfully!');
      onClose();
    } catch (error) {
      console.error('Error sending nudge:', error);
      alert('❌ Failed to send nudge. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const currentTemplate = NUDGE_TEMPLATES[selectedTemplate];
  const previewMessage = useCustom 
    ? customMessage 
    : currentTemplate.message.replace('{count}', staffMember.activeTickets);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content nudge-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-group">
            <FaBell className="modal-icon" />
            <div>
              <h2>Send Performance Nudge</h2>
              <p className="modal-subtitle">Send a reminder to {staffMember.name}</p>
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>
            <FaTimes />
          </button>
        </div>

        <div className="modal-body">
          {/* Staff Info Card */}
          <div className="nudge-staff-card">
            <div className="staff-info-row">
              <span className="info-label">Staff Member:</span>
              <span className="info-value">{staffMember.name}</span>
            </div>
            <div className="staff-info-row">
              <span className="info-label">Department:</span>
              <span className="info-value">{staffMember.department}</span>
            </div>
            <div className="staff-info-row">
              <span className="info-label">Active Tickets:</span>
              <span className="info-value">{staffMember.activeTickets}</span>
            </div>
            <div className="staff-info-row">
              <span className="info-label">Overdue Tickets:</span>
              <span className="info-value danger">{staffMember.overdueTickets}</span>
            </div>
            <div className="staff-info-row">
              <span className="info-label">Risk Score:</span>
              <span className={`info-value ${staffMember.riskScore >= 70 ? 'danger' : staffMember.riskScore >= 40 ? 'warning' : 'success'}`}>
                {staffMember.riskScore}%
              </span>
            </div>
          </div>

          {/* Template Selection */}
          <div className="template-section">
            <label className="section-label">Select Nudge Type:</label>
            <div className="template-options">
              <button
                className={`template-btn ${selectedTemplate === 'gentle' ? 'active' : ''}`}
                onClick={() => setSelectedTemplate('gentle')}
              >
                <FaBell />
                Gentle Reminder
              </button>
              <button
                className={`template-btn ${selectedTemplate === 'urgent' ? 'active' : ''}`}
                onClick={() => setSelectedTemplate('urgent')}
              >
                <FaExclamationTriangle />
                Urgent
              </button>
              <button
                className={`template-btn critical ${selectedTemplate === 'critical' ? 'active' : ''}`}
                onClick={() => setSelectedTemplate('critical')}
              >
                <FaExclamationTriangle />
                Critical
              </button>
            </div>
          </div>

          {/* Custom Message Toggle */}
          <div className="custom-toggle">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={useCustom}
                onChange={(e) => setUseCustom(e.target.checked)}
              />
              <span>Use custom message</span>
            </label>
          </div>

          {/* Message Preview/Editor */}
          {useCustom ? (
            <div className="message-editor">
              <label className="section-label">Custom Message:</label>
              <textarea
                className="custom-message-input"
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                placeholder="Write your custom message here..."
                rows={6}
              />
            </div>
          ) : (
            <div className="message-preview">
              <label className="section-label">Message Preview:</label>
              <div className="preview-box">
                <div className="preview-title">{currentTemplate.title}</div>
                <div className="preview-text">{previewMessage}</div>
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose} disabled={sending}>
            Cancel
          </button>
          <button 
            className="btn-primary" 
            onClick={handleSendNudge}
            disabled={sending || (useCustom && !customMessage.trim())}
          >
            {sending ? 'Sending...' : 'Send Nudge'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default NudgeModal;
