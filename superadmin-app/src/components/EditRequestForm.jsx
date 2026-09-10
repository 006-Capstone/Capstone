import React, { useState, useEffect } from 'react';
import { FaPlus, FaEdit, FaTrash, FaSave, FaTimes, FaExclamationTriangle } from 'react-icons/fa';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import LoadingSpinner from './LoadingSpinner';
import NotificationBell from './NotificationBell';
import Toast from './Toast';
import '../styles/EditRequestForm.css';

const EditRequestForm = () => {
  const [selectedOffice, setSelectedOffice] = useState('finance');
  const [offices, setOffices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingCardOffice, setEditingCardOffice] = useState(null);
  const [cardDraft, setCardDraft] = useState('');
  const [editingSubject, setEditingSubject] = useState(null);
  const [subjectDraft, setSubjectDraft] = useState('');
  const [newSubject, setNewSubject] = useState('');
  const [toast, setToast] = useState(null);
  const [confirmDeleteSubject, setConfirmDeleteSubject] = useState(null); // { officeId, subject }
  // Snapshot of the config as loaded — the Save Changes button stays grayed
  // out until something actually differs from this.
  const [originalOffices, setOriginalOffices] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 4000);
  };

  const defaultOffices = [
    {
      id: 'finance',
      name: 'Finance',
      description: 'Manages tuition payments, student balances, billing concerns, and other school-related financial transactions.',
      subjects: ['Balance Verification', 'Payment Plan', 'Refund Request', 'Billing Inquiry']
    },
    {
      id: 'library',
      name: 'Library',
      description: 'Manages book borrowing/returning, library accounts, and student concerns related to library services and resources.',
      subjects: ['Book Request', 'Lost Book Report', 'Library Card Issue', 'Resource Access']
    },
    {
      id: 'registrar',
      name: 'Registrar',
      description: 'Handles student records such as enrollment, grades, certificates, transcripts, and other official academic documents.',
      subjects: ['Document Request', 'Grade Inquiry', 'Enrollment Issue', 'Transcript Request']
    },
    {
      id: 'guidance',
      name: 'Guidance',
      description: 'Handles student behavior concerns, violations, and disciplinary cases to maintain order and safety in school.',
      subjects: ['Counseling Request', 'Disciplinary Appeal', 'Behavior Report', 'Support Services']
    }
  ];

  useEffect(() => {
    loadFormConfig();
  }, []);

  const loadFormConfig = async () => {
    try {
      setLoading(true);
      const docRef = doc(db, 'config', 'requestForm');
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const loaded = docSnap.data().offices || defaultOffices;
        console.log('[EditRequestForm] Loaded config from Firestore:', loaded);
        setOffices(loaded);
        setOriginalOffices(JSON.parse(JSON.stringify(loaded))); // Deep copy
      } else {
        // Initialize with default config
        console.log('[EditRequestForm] No config found, initializing with defaults');
        setOffices(defaultOffices);
        setOriginalOffices(JSON.parse(JSON.stringify(defaultOffices))); // Deep copy
        await setDoc(docRef, { offices: defaultOffices });
      }
    } catch (error) {
      console.error('[EditRequestForm] Error loading form config:', error);
      setOffices(defaultOffices);
      setOriginalOffices(JSON.parse(JSON.stringify(defaultOffices))); // Deep copy
    } finally {
      setLoading(false);
    }
  };

  const saveFormConfig = async () => {
    try {
      setSaving(true);
      console.log('[EditRequestForm] Saving config to Firestore...');
      console.log('[EditRequestForm] Offices to save:', offices);
      
      const docRef = doc(db, 'config', 'requestForm');
      await setDoc(docRef, { offices });
      
      console.log('[EditRequestForm] Config saved successfully!');
      
      // Refresh the snapshot so the button re-grays until the next change
      setOriginalOffices(JSON.parse(JSON.stringify(offices)));
      showToast('Form configuration saved successfully!');
    } catch (error) {
      console.error('[EditRequestForm] Error saving form config:', error);
      console.error('[EditRequestForm] Error code:', error.code);
      console.error('[EditRequestForm] Error message:', error.message);
      showToast('Failed to save configuration: ' + error.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleOfficeDescriptionChange = (officeId, newDescription) => {
    setOffices(offices.map(office => 
      office.id === officeId 
        ? { ...office, description: newDescription }
        : office
    ));
  };

  const startCardEdit = (office) => {
    setEditingCardOffice(office.id);
    setCardDraft(office.description);
  };

  const saveCardEdit = (officeId) => {
    if (!cardDraft.trim()) {
      showToast('Description cannot be empty.', 'error');
      return;
    }
    handleOfficeDescriptionChange(officeId, cardDraft.trim());
    setEditingCardOffice(null);
  };

  const cancelCardEdit = () => {
    // Draft edits never touch `offices` until Save, so just exit edit mode
    setEditingCardOffice(null);
  };

  const handleAddSubject = (officeId) => {
    if (!newSubject.trim()) {
      showToast('Please enter a subject', 'error');
      return;
    }
    
    setOffices(offices.map(office => 
      office.id === officeId 
        ? { ...office, subjects: [...(office.subjects || []), newSubject.trim()] }
        : office
    ));
    setNewSubject('');
  };

  const handleEditSubject = (officeId, oldSubject, newSubject) => {
    if (!newSubject.trim()) {
      showToast('Subject cannot be empty', 'error');
      return;
    }
    
    setOffices(offices.map(office => 
      office.id === officeId 
        ? { 
            ...office, 
            subjects: office.subjects.map(s => s === oldSubject ? newSubject.trim() : s) 
          }
        : office
    ));
    setEditingSubject(null);
  };

  const requestDeleteSubject = (officeId, subject) => {
    setConfirmDeleteSubject({ officeId, subject });
  };

  const handleDeleteSubject = () => {
    if (!confirmDeleteSubject) return;
    const { officeId, subject } = confirmDeleteSubject;

    setOffices(offices.map(office => 
      office.id === officeId 
        ? { ...office, subjects: office.subjects.filter(s => s !== subject) }
        : office
    ));
    setConfirmDeleteSubject(null);
    showToast(`Removed "${subject}". Click "Save Changes" to apply.`);
  };

  // Switching offices dismisses any open subject editor — its key is tied
  // to the previously selected office.
  const handleSelectOffice = (officeId) => {
    setSelectedOffice(officeId);
    setEditingSubject(null);
    setSubjectDraft('');
    setConfirmDeleteSubject(null);
  };

  // Cancel edit or delete modal with Escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (confirmDeleteSubject) {
          setConfirmDeleteSubject(null);
        } else if (editingSubject) {
          setEditingSubject(null);
          setSubjectDraft('');
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [confirmDeleteSubject, editingSubject]);

  const selectedOfficeData = offices.find(o => o.id === selectedOffice);

  // Save Changes stays grayed out until the form actually differs from the
  // loaded configuration (description edits, subject adds/edits/deletes).
  const hasConfigChanges = JSON.stringify(offices) !== JSON.stringify(originalOffices || []);

  if (loading) {
    return <LoadingSpinner message="Loading form configuration..." fullScreen={true} />;
  }

  return (
    <div className="superadmin-page edit-request-form-container">
      <div className="page-header">
        <div>
          <h1 className="form-title">Edit Request Form Configuration</h1>
          <p className="page-subtitle">Manage the offices, descriptions, and subjects students can request</p>
        </div>
        <div className="form-actions-header">
          <button
            className="btn-primary save-config-btn"
            onClick={saveFormConfig}
            disabled={saving || !hasConfigChanges}
            title={!hasConfigChanges ? 'Make a change to enable saving' : undefined}
          >
            <FaSave aria-hidden="true" /> {saving ? 'Saving...' : 'Save Changes'}
          </button>
          <NotificationBell />
        </div>
      </div>

      <div className="form-content">
        <div className="form-section">
          <div className="section-header">
            <h2 className="section-title">Select Office to Edit</h2>
          </div>
          <div className="office-cards">
            {offices.map((office) => (
              <div
                key={office.id}
                className={`office-card ${selectedOffice === office.id ? 'selected' : ''} ${editingCardOffice === office.id ? 'editing' : ''}`}
                onClick={() => handleSelectOffice(office.id)}
              >
                <div className="radio-circle"></div>
                <div className="office-info">
                  <h3 className="office-name">{office.name}</h3>
                  {editingCardOffice === office.id ? (
                    <>
                      <textarea
                        className="office-card-textarea"
                        value={cardDraft}
                        onChange={(e) => setCardDraft(e.target.value)}
                        rows={3}
                        aria-label={`Edit ${office.name} description`}
                        autoFocus
                      />
                      <div className="office-card-actions">
                        <button
                          type="button"
                          className="icon-btn save-btn"
                          onClick={(e) => { e.stopPropagation(); saveCardEdit(office.id); }}
                        >
                          <FaSave /> Save
                        </button>
                        <button
                          type="button"
                          className="icon-btn cancel-btn"
                          onClick={(e) => { e.stopPropagation(); cancelCardEdit(); }}
                        >
                          <FaTimes /> Cancel
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="office-description">{office.description}</p>
                      <button
                        type="button"
                        className="office-edit-btn"
                        onClick={(e) => { e.stopPropagation(); startCardEdit(office); }}
                        aria-label={`Edit ${office.name} description`}
                      >
                        <FaEdit /> Edit
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {selectedOfficeData && (
          <>
            <div className="form-section">
              <div className="section-header">
                <h2 className="section-title">Subjects for {selectedOfficeData.name}</h2>
              </div>
              
              <div className="subjects-list">
                {(selectedOfficeData.subjects || []).map((subject, index) => (
                  <div key={index} className="subject-item">
                    {editingSubject === `${selectedOffice}-${index}` ? (
                      <div className="subject-edit-row">
                        <input
                          type="text"
                          className="subject-input-edit"
                          value={subjectDraft}
                          onChange={(e) => setSubjectDraft(e.target.value)}
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                              handleEditSubject(selectedOffice, subject, subjectDraft);
                            }
                          }}
                          aria-label={`Edit subject ${subject}`}
                          autoFocus
                        />
                        <div className="subject-edit-actions">
                          <button
                            className="icon-btn-small save-btn"
                            onClick={() => handleEditSubject(selectedOffice, subject, subjectDraft)}
                            disabled={!subjectDraft.trim()}
                            title={!subjectDraft.trim() ? 'Enter a subject to save' : 'Save changes'}
                            aria-label="Save subject changes"
                          >
                            <FaSave />
                          </button>
                          <button
                            className="icon-btn-small cancel-btn"
                            onClick={() => setEditingSubject(null)}
                            title="Cancel"
                            aria-label="Cancel subject edit"
                          >
                            <FaTimes />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <span className="subject-text">{subject}</span>
                        <div className="subject-actions">
                          <button
                            className="icon-btn-small edit-btn"
                            onClick={() => {
                              setEditingSubject(`${selectedOffice}-${index}`);
                              setSubjectDraft(subject);
                            }}
                            aria-label={`Edit subject ${subject}`}
                          >
                            <FaEdit />
                          </button>
                          <button
                            className="icon-btn-small delete-btn"
                            onClick={() => requestDeleteSubject(selectedOffice, subject)}
                            aria-label={`Delete subject ${subject}`}
                          >
                            <FaTrash />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>

              <div className="add-subject-section">
                <input
                  type="text"
                  className="form-input"
                  placeholder="Enter new subject..."
                  value={newSubject}
                  onChange={(e) => setNewSubject(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      handleAddSubject(selectedOffice);
                    }
                  }}
                />
                <button
                  className="add-subject-btn"
                  onClick={() => handleAddSubject(selectedOffice)}
                  disabled={!newSubject.trim()}
                  title={!newSubject.trim() ? 'Enter a subject to add' : undefined}
                >
                  <FaPlus /> Add Subject
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Delete Subject Confirmation Modal */}
      {confirmDeleteSubject && (
        <div
          className="delete-modal-overlay"
          onClick={() => setConfirmDeleteSubject(null)}
          role="presentation"
        >
          <div
            className="delete-modal-card"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-subject-title"
          >
            <div className="delete-modal-icon-wrap" aria-hidden="true">
              <FaExclamationTriangle className="delete-modal-warning-icon" />
            </div>
            <h3 id="delete-subject-title" className="delete-modal-title">Delete Subject</h3>
            <p className="delete-modal-message">
              Are you sure you want to remove <strong>"{confirmDeleteSubject.subject}"</strong> from{' '}
              <strong>{offices.find(o => o.id === confirmDeleteSubject.officeId)?.name || 'this'}</strong> office?
            </p>
            <p className="delete-modal-hint">
              This will remove the subject from students' choices once saved.
            </p>
            <div className="delete-modal-actions">
              <button
                type="button"
                className="delete-modal-cancel-btn"
                onClick={() => setConfirmDeleteSubject(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="delete-modal-confirm-btn"
                onClick={handleDeleteSubject}
              >
                <FaTrash aria-hidden="true" /> Delete Subject
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <Toast
          type={toast.type}
          message={toast.message}
          onClose={() => setToast(null)}
        />
      )}

      {saving && <LoadingSpinner message="Saving configuration..." fullScreen={true} />}
    </div>
  );
};

export default EditRequestForm;
