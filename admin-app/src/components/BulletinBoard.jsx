import React, { useState, useEffect, useRef } from 'react';
import { FaBell, FaPlus, FaCalendarAlt, FaTimes, FaUpload, FaTrash, FaEllipsisV, FaEdit, FaInfoCircle, FaChevronDown } from 'react-icons/fa';
import { collection, query, where, onSnapshot, addDoc, updateDoc, setDoc, serverTimestamp, deleteDoc, doc, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import Notifications from './Notifications';
import '../styles/BulletinBoard.css';

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const OFFICES = ['All Offices', 'Finance', 'Library', 'Registrar', 'Guidance'];
const ITEMS_PER_PAGE = 5;

// Featured (semestral) announcement shown in the green hero card
const DEFAULT_HERO_TITLE = 'Announcements & Deadlines';
const DEFAULT_HERO_BODY = 'Keep students informed with the latest updates and important dates.';

// Firestore caps documents at 1 MiB, so photos are compressed client-side to
// stay comfortably under the limit (resize to 1280px, JPEG, adaptive quality).
const MAX_IMAGE_DIMENSION = 1280;
const MAX_BASE64_LENGTH = 900 * 1024 * 1.37; // ~0.9 MiB raw -> base64 ceiling

const compressImage = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onerror = () => reject(new Error('Could not read the image file.'));
  reader.onload = () => {
    const img = new Image();
    img.onerror = () => reject(new Error('That file is not a valid image.'));
    img.onload = () => {
      const encode = (maxDim) => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const width = Math.max(1, Math.round(img.width * scale));
        const height = Math.max(1, Math.round(img.height * scale));

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);

        let quality = 0.82;
        let dataUrl = canvas.toDataURL('image/jpeg', quality);
        while (dataUrl.length > MAX_BASE64_LENGTH && quality > 0.35) {
          quality -= 0.1;
          dataUrl = canvas.toDataURL('image/jpeg', quality);
        }
        return dataUrl;
      };

      // Shrink the image progressively until it fits the 1 MiB doc limit
      let result = encode(MAX_IMAGE_DIMENSION);
      for (const dim of [1024, 800, 600]) {
        if (result.length <= MAX_BASE64_LENGTH) break;
        result = encode(dim);
      }
      resolve(result);
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
});

const formatPostedDate = (value) => {
  if (!value) return '';
  const date = value?.toDate ? value.toDate() : new Date(value);
  if (isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

function AdminAnnouncementCard({
  announcement,
  canDelete,
  onEdit,
  onDelete,
  openMenuId,
  setOpenMenuId
}) {
  const clampRef = useRef(null);
  const [expanded, setExpanded] = useState(false);
  const [canExpand, setCanExpand] = useState(false);
  const [fullHeight, setFullHeight] = useState(null);
  const expandedRef = useRef(expanded);
  expandedRef.current = expanded;

  useEffect(() => {
    const el = clampRef.current;
    if (!el || !announcement.body) {
      setCanExpand(false);
      return undefined;
    }

    let raf = null;
    const measure = () => {
      if (!el) return;
      setFullHeight(`${el.scrollHeight}px`);
      if (!expandedRef.current) {
        setCanExpand(el.scrollHeight > el.clientHeight + 1);
      }
    };
    const measureNextFrame = () => {
      raf = requestAnimationFrame(measure);
    };

    measure();
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(measure).catch(() => {});
    }
    window.addEventListener('load', measureNextFrame);
    window.addEventListener('resize', measure);
    return () => {
      window.removeEventListener('load', measureNextFrame);
      window.removeEventListener('resize', measure);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [announcement.body]);

  const isMenuOpen = openMenuId === announcement.id;

  return (
    <div className="announcement-card">
      {announcement.photo && (
        <div className="announcement-image">
          <img src={announcement.photo} alt="" className="announcement-photo" />
        </div>
      )}
      <div className="announcement-details">
        <div className="announcement-header-row">
          <span className="announcement-office">{announcement.department}</span>
          {canDelete && (
            <div className="announcement-menu">
              <button
                type="button"
                className="announcement-menu-trigger"
                onClick={() => setOpenMenuId(isMenuOpen ? null : announcement.id)}
                aria-label={`Actions for: ${announcement.title}`}
                aria-haspopup="true"
                aria-expanded={isMenuOpen}
              >
                <FaEllipsisV />
              </button>
              {isMenuOpen && (
                <div className="announcement-menu-dropdown" role="menu">
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => onEdit(announcement)}
                  >
                    <FaEdit /> Edit
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="danger"
                    onClick={() => onDelete(announcement.id)}
                  >
                    <FaTrash /> Delete
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
        <h4>{announcement.title}</h4>
        {announcement.body && (
          <div
            ref={clampRef}
            className={`announcement-clamp ${expanded ? 'expanded' : ''}`}
            style={{ maxHeight: expanded ? fullHeight : 'var(--clamp-height)' }}
          >
            <p>{announcement.body}</p>
          </div>
        )}
        {canExpand && (
          <button
            type="button"
            className={`announcement-toggle ${expanded ? 'expanded' : ''}`}
            onClick={() => setExpanded(!expanded)}
            aria-expanded={expanded}
          >
            {expanded ? 'See less' : 'See more'}
            <FaChevronDown className="announcement-toggle-icon" aria-hidden="true" />
          </button>
        )}
        <div className="announcement-footer">
          <span className="announcement-date">
            Posted {formatPostedDate(announcement.createdAt) || 'recently'}
          </span>
          {announcement.createdBy && (
            <span className="announcement-author">By {announcement.createdBy}</span>
          )}
        </div>
      </div>
    </div>
  );
}

const BulletinBoard = ({ department, onViewRequest }) => {
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [modalTab, setModalTab] = useState('announcements'); // 'announcements' | 'importantDates'
  const [openMenuId, setOpenMenuId] = useState(null); // announcement id whose ⋮ menu is open
  const [editingAnnouncement, setEditingAnnouncement] = useState(null);

  // Announcement form state
  const [announcementTitle, setAnnouncementTitle] = useState('');
  const [announcementBody, setAnnouncementBody] = useState('');
  const [announcementPhoto, setAnnouncementPhoto] = useState(''); // compressed data URL
  const [photoPreview, setPhotoPreview] = useState('');
  const [photoError, setPhotoError] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);

  // Important Date form state
  const [dateTitle, setDateTitle] = useState('');
  const [dateMonth, setDateMonth] = useState('');
  const [dateDay, setDateDay] = useState('');
  const [editingDate, setEditingDate] = useState(null);

  const [announcements, setAnnouncements] = useState([]);
  const [importantDates, setImportantDates] = useState([]);
  const [selectedOffice, setSelectedOffice] = useState('All Offices');
  const [currentPage, setCurrentPage] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [loadError, setLoadError] = useState('');

  // Featured (semestral) announcement — the big green hero card (read-only)
  const [hero, setHero] = useState({ title: DEFAULT_HERO_TITLE, body: DEFAULT_HERO_BODY });

  const fileInputRef = useRef(null);

  const resetAnnouncementForm = () => {
    setAnnouncementTitle('');
    setAnnouncementBody('');
    setAnnouncementPhoto('');
    setPhotoPreview('');
    setPhotoError('');
    setEditingAnnouncement(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const resetImportantDateForm = () => {
    setDateTitle('');
    setDateMonth('');
    setDateDay('');
    setEditingDate(null);
  };

  // Every modal close path goes through this so a cancelled edit never
  // leaves stale form/edit state behind.
  const closeCreateModal = () => {
    resetAnnouncementForm();
    resetImportantDateForm();
    setShowCreateModal(false);
    setOpenMenuId(null);
  };

  useEffect(() => {
    // School-wide announcements (viewed by every department)
    const annQ = query(collection(db, 'announcements'), orderBy('createdAt', 'desc'));
    const annUnsub = onSnapshot(
      annQ,
      (snap) => {
        setLoadError('');
        setAnnouncements(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      },
      (err) => {
        console.error('[Error] Error loading announcements:', err);
        setLoadError('Could not load announcements.');
      }
    );

    // Important dates across offices — sorted client-side by date
    const datesQ = query(collection(db, 'importantDates'));
    const datesUnsub = onSnapshot(
      datesQ,
      (snap) => {
        setLoadError('');
        const dates = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        dates.sort((a, b) => (a.dateValue || 0) - (b.dateValue || 0));
        setImportantDates(dates);
      },
      (err) => {
        console.error('[Error] Error loading important dates:', err);
        setLoadError('Could not load important dates.');
      }
    );

    // Featured (semestral) announcement — one doc per office
    let heroUnsub = null;
    if (department) {
      const heroRef = doc(db, 'bulletinHero', department);
      heroUnsub = onSnapshot(
        heroRef,
        (snap) => {
          if (snap.exists()) {
            const data = snap.data();
            setHero({
              title: data.title || DEFAULT_HERO_TITLE,
              body: data.body || DEFAULT_HERO_BODY
            });
          } else {
            setHero({ title: DEFAULT_HERO_TITLE, body: DEFAULT_HERO_BODY });
          }
        },
        (err) => {
          console.error('[Error] Error loading featured announcement:', err);
          setHero({ title: DEFAULT_HERO_TITLE, body: DEFAULT_HERO_BODY });
        }
      );
    }

    // Unread notification count
    let notifUnsub = null;
    try {
      const staffData = JSON.parse(localStorage.getItem('staffData'));
      if (staffData?.uid) {
        const nq = query(
          collection(db, 'notifications'),
          where('recipientId', '==', staffData.uid),
          where('recipientType', '==', 'staff')
        );
        notifUnsub = onSnapshot(
          nq,
          (snap) => {
            setUnreadCount(snap.docs.filter(doc => !doc.data().isRead).length);
          },
          (err) => console.error('[Error] Error loading notifications:', err)
        );
      }
    } catch (e) {
      console.error('[Error] Error reading staff data:', e);
    }

    return () => {
      annUnsub();
      datesUnsub();
      if (heroUnsub) heroUnsub();
      if (notifUnsub) notifUnsub();
    };
  }, [department]);

  // Close modals / notifications with Escape
  useEffect(() => {
    if (!showCreateModal && !showNotifications) return undefined;
    const handleKeyDown = (e) => {
      if (e.key !== 'Escape') return;
      if (showCreateModal) closeCreateModal();
      if (showNotifications) setShowNotifications(false);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showCreateModal, showNotifications]);

  // Close the ⋮ action menu on outside click / Escape
  useEffect(() => {
    if (!openMenuId) return undefined;
    const handlePointer = (e) => {
      if (!e.target.closest('.announcement-menu')) setOpenMenuId(null);
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setOpenMenuId(null);
    };
    document.addEventListener('mousedown', handlePointer);
    document.addEventListener('touchstart', handlePointer);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointer);
      document.removeEventListener('touchstart', handlePointer);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [openMenuId]);

  /* ---------- Photo upload ---------- */

  const processImageFile = async (file) => {
    setPhotoError('');
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setPhotoError('Please choose an image file (JPG or PNG).');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setPhotoError('Image is too large. Please choose one under 10 MB.');
      return;
    }
    try {
      const dataUrl = await compressImage(file);
      setAnnouncementPhoto(dataUrl);
      setPhotoPreview(dataUrl);
    } catch (err) {
      console.error('[Error] Error processing image:', err);
      setPhotoError(err.message || 'Could not process this image.');
    }
  };

  const handleFileSelect = (e) => {
    processImageFile(e.target.files && e.target.files[0]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    processImageFile(e.dataTransfer.files && e.dataTransfer.files[0]);
  };

  const handleRemovePhoto = () => {
    setAnnouncementPhoto('');
    setPhotoPreview('');
    setPhotoError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  /* ---------- Create / Edit ---------- */

  const handleCreateAnnouncement = async () => {
    if (!announcementTitle.trim()) {
      alert('Please enter an announcement title.');
      return;
    }
    if (!announcementBody.trim()) {
      alert('Please enter announcement content.');
      return;
    }

    try {
      setSubmitting(true);
      const staffData = JSON.parse(localStorage.getItem('staffData'));

      if (editingAnnouncement) {
        // Update the existing announcement (keep original author + created date)
        await updateDoc(doc(db, 'announcements', editingAnnouncement.id), {
          department,
          title: announcementTitle.trim(),
          body: announcementBody.trim(),
          photo: announcementPhoto || null,
          updatedAt: serverTimestamp()
        });
      } else {
        await addDoc(collection(db, 'announcements'), {
          department,
          title: announcementTitle.trim(),
          body: announcementBody.trim(),
          photo: announcementPhoto || null,
          createdBy: staffData?.name || 'Staff',
          createdAt: serverTimestamp()
        });
      }

      closeCreateModal();
    } catch (error) {
      console.error('[Error] Error saving announcement:', error);
      alert(editingAnnouncement
        ? 'Failed to update announcement. Please try again.'
        : 'Failed to create announcement. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditAnnouncement = (announcement) => {
    setEditingAnnouncement(announcement);
    setAnnouncementTitle(announcement.title || '');
    setAnnouncementBody(announcement.body || '');
    setAnnouncementPhoto(announcement.photo || '');
    setPhotoPreview(announcement.photo || '');
    setPhotoError('');
    setModalTab('announcements');
    setOpenMenuId(null);
    setShowCreateModal(true);
  };

  const handleEditImportantDate = (deadline) => {
    setEditingDate(deadline);
    setDateTitle(deadline.title || '');
    setDateMonth(deadline.month || '');
    setDateDay(String(parseInt(deadline.day, 10) || deadline.day || ''));
    setModalTab('importantDates');
    setShowCreateModal(true);
  };

  const handleCreateImportantDate = async () => {
    if (!dateTitle.trim()) {
      alert('Please enter a title.');
      return;
    }
    if (!dateMonth) {
      alert('Please select a month.');
      return;
    }

    const dayNum = parseInt(dateDay, 10);
    if (isNaN(dayNum) || dayNum < 1 || dayNum > 31) {
      alert('Please enter a valid day (1–31).');
      return;
    }
    const monthNum = MONTHS.indexOf(dateMonth) + 1;
    const daysInMonth = new Date(2000, monthNum, 0).getDate();
    if (dayNum > daysInMonth) {
      alert(`Please enter a valid day for ${dateMonth} (1–${daysInMonth}).`);
      return;
    }

    try {
      setSubmitting(true);
      const staffData = JSON.parse(localStorage.getItem('staffData'));
      const dateValue = parseInt(
        `${String(monthNum).padStart(2, '0')}${String(dayNum).padStart(2, '0')}`,
        10
      );

      if (editingDate) {
        await updateDoc(doc(db, 'importantDates', editingDate.id), {
          office: department,
          title: dateTitle.trim(),
          month: dateMonth,
          day: String(dayNum).padStart(2, '0'),
          dateValue,
          updatedBy: staffData?.name || 'Staff',
          updatedAt: serverTimestamp()
        });
      } else {
        await addDoc(collection(db, 'importantDates'), {
          office: department,
          title: dateTitle.trim(),
          month: dateMonth,
          day: String(dayNum).padStart(2, '0'),
          dateValue,
          createdBy: staffData?.name || 'Staff',
          createdAt: serverTimestamp()
        });
      }

      closeCreateModal();
    } catch (error) {
      console.error('[Error] Error saving important date:', error);
      alert(editingDate ? 'Failed to update important date. Please try again.' : 'Failed to create important date. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  /* ---------- Delete ---------- */

  const handleDeleteAnnouncement = async (announcementId) => {
    if (!window.confirm('Are you sure you want to delete this announcement?')) return;
    try {
      await deleteDoc(doc(db, 'announcements', announcementId));
    } catch (error) {
      console.error('[Error] Error deleting announcement:', error);
      alert('Failed to delete announcement.');
    }
  };

  const handleDeleteImportantDate = async (dateId) => {
    if (!window.confirm('Are you sure you want to delete this important date?')) return;
    try {
      await deleteDoc(doc(db, 'importantDates', dateId));
    } catch (error) {
      console.error('[Error] Error deleting important date:', error);
      alert('Failed to delete important date.');
    }
  };

  /* ---------- Form helpers ---------- */

  const openCreateModal = () => {
    resetAnnouncementForm();
    resetImportantDateForm();
    setModalTab('announcements');
    setShowCreateModal(true);
  };

  const canDeleteAnnouncement = (announcement) =>
    String(announcement.department || '').toLowerCase() === department.toLowerCase();

  const canDeleteImportantDate = (deadline) =>
    !deadline.office || String(deadline.office).toLowerCase() === String(department || '').toLowerCase();

  // Form validity — keeps the Confirm/Save buttons grayed out until every
  // required field is filled in (photos are optional).
  const isAnnouncementValid =
    announcementTitle.trim() !== '' && announcementBody.trim() !== '';

  // While editing, the Save Changes button also stays grayed out until
  // something actually differs from the original announcement.
  const hasAnnouncementChanges = !editingAnnouncement
    ? true
    : announcementTitle.trim() !== (editingAnnouncement.title || '').trim() ||
      announcementBody.trim() !== (editingAnnouncement.body || '').trim() ||
      announcementPhoto !== (editingAnnouncement.photo || '');

  const parsedDay = parseInt(dateDay, 10);
  const daysInSelectedMonth = dateMonth
    ? new Date(2000, MONTHS.indexOf(dateMonth) + 1, 0).getDate()
    : 0;
  const isImportantDateValid =
    dateTitle.trim() !== '' &&
    dateMonth !== '' &&
    !isNaN(parsedDay) &&
    parsedDay >= 1 &&
    parsedDay <= daysInSelectedMonth;

  const filteredAnnouncements = selectedOffice === 'All Offices'
    ? announcements
    : announcements.filter(a => {
        const dept = a.department?.toLowerCase();
        const sel = selectedOffice.toLowerCase();
        return dept === sel;
      });

  const totalPages = Math.max(1, Math.ceil(filteredAnnouncements.length / ITEMS_PER_PAGE));
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedAnnouncements = filteredAnnouncements.slice(startIndex, endIndex);

  return (
    <div className="bulletin-board-container">
      <div className="bulletin-header">
        <div>
          <h1 className="bulletin-title">Bulletin Board</h1>
          <p className="bulletin-subtitle">Announcements and updates for your students</p>
        </div>
        <div className="bulletin-header-actions">
          <button className="create-announcement-btn" onClick={openCreateModal}>
            <FaPlus />
            Create new announcement
          </button>
          <div className="notification-bell" onClick={() => setShowNotifications(true)}>
            <FaBell className="bell-icon" />
            {unreadCount > 0 && <span className="notification-badge">{unreadCount}</span>}
          </div>
        </div>
      </div>

      {loadError && (
        <div className="bulletin-error-banner" role="alert">
          {loadError} Check your connection and refresh.
        </div>
      )}

      <div className="hero-banner">
        <div className="hero-overlay">
          {department && (
            <span className="hero-kicker">{department} OFFICE</span>
          )}
          <h2 className="hero-title">{hero.title}</h2>
          <p className="hero-subtitle">{hero.body}</p>
        </div>
      </div>

      <div className="announcements-header">
        <h3>Announcements</h3>
        <div className="office-filters">
          {OFFICES.map((office) => (
            <button
              key={office}
              type="button"
              className={`filter-btn ${selectedOffice === office ? 'active' : ''}`}
              onClick={() => {
                setSelectedOffice(office);
                setCurrentPage(1);
              }}
            >
              {office}
            </button>
          ))}
        </div>
      </div>

      <div className="bulletin-content">
        <div className="announcements-section">
          {filteredAnnouncements.length === 0 ? (
            <div className="bulletin-empty">
              <p className="bulletin-empty-title">
                {selectedOffice === 'All Offices'
                  ? 'No announcements yet'
                  : `No announcements from ${selectedOffice} yet`}
              </p>
              <p className="bulletin-empty-text">
                Create an announcement to keep students informed.
              </p>
              <button className="create-announcement-btn" onClick={openCreateModal}>
                <FaPlus />
                Create announcement
              </button>
            </div>
          ) : (
            <>
              {paginatedAnnouncements.map((announcement) => (
                <AdminAnnouncementCard
                  key={announcement.id}
                  announcement={announcement}
                  canDelete={canDeleteAnnouncement(announcement)}
                  onEdit={handleEditAnnouncement}
                  onDelete={handleDeleteAnnouncement}
                  openMenuId={openMenuId}
                  setOpenMenuId={setOpenMenuId}
                />
              ))}

              {totalPages > 1 && (
                <div className="pagination">
                  <button
                    type="button"
                    className="pagination-btn"
                    onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                  >
                    ← Previous
                  </button>
                  <div className="pagination-info">
                    Page {currentPage} of {totalPages}
                  </div>
                  <button
                    type="button"
                    className="pagination-btn"
                    onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                  >
                    Next →
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        <div className="deadlines-section">
          <div className="deadlines-header">
            <span>📅</span>
            <h3>Important Deadlines</h3>
          </div>

          <div className="deadlines-list">
            {importantDates.length === 0 ? (
              <div className="empty-state-small">
                <p>No upcoming deadlines</p>
              </div>
            ) : (
              importantDates.map((deadline) => (
                <div key={deadline.id} className="deadline-item">
                  <div className="deadline-date">
                    <div className="month">{deadline.month}</div>
                    <div className="day">{parseInt(deadline.day, 10) || deadline.day}</div>
                  </div>
                  <div className="deadline-details">
                    <div className="deadline-title">{deadline.title}</div>
                    <div className="deadline-office">{deadline.office}</div>
                  </div>
                  <div className="deadline-actions">
                    <button
                      type="button"
                      className="edit-deadline-btn"
                      onClick={() => handleEditImportantDate(deadline)}
                      aria-label={`Edit deadline: ${deadline.title}`}
                      title="Edit deadline"
                    >
                      <FaEdit />
                    </button>
                    <button
                      type="button"
                      className="delete-deadline-btn"
                      onClick={() => handleDeleteImportantDate(deadline.id)}
                      aria-label={`Delete deadline: ${deadline.title}`}
                      title="Delete deadline"
                    >
                      <FaTrash />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Unified Create modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={closeCreateModal}>
          <div
            className="modal-content"
            role="dialog"
            aria-modal="true"
            aria-labelledby="bulletin-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-sidebar">
              <button
                className={`modal-tab ${modalTab === 'announcements' ? 'active' : ''}`}
                onClick={() => setModalTab('announcements')}
              >
                Announcements
              </button>
              <button
                className={`modal-tab ${modalTab === 'importantDates' ? 'active' : ''}`}
                onClick={() => setModalTab('importantDates')}
              >
                Important Dates
              </button>
            </div>

            <div className="modal-main">
              <button
                className="modal-close-btn"
                onClick={closeCreateModal}
                aria-label="Close dialog"
              >
                <FaTimes />
              </button>

              {modalTab === 'announcements' ? (
                <div className="announcement-form">
                  <h3 className="modal-title" id="bulletin-modal-title">
                    {editingAnnouncement ? 'Edit Announcement' : 'Create Announcement'}
                  </h3>

                  <div className="form-group">
                    <label htmlFor="announcement-title">Announcement Title</label>
                    <input
                      id="announcement-title"
                      type="text"
                      placeholder="Max. of 30 characters"
                      value={announcementTitle}
                      onChange={(e) => setAnnouncementTitle(e.target.value)}
                      maxLength={30}
                      className="form-input"
                    />
                    <span className="char-count">{announcementTitle.length}/30</span>
                  </div>

                  <div className="form-group">
                    <label htmlFor="announcement-body">Announcement Body</label>
                    <textarea
                      id="announcement-body"
                      placeholder="Type your announcement content here..."
                      value={announcementBody}
                      onChange={(e) => setAnnouncementBody(e.target.value)}
                      rows={6}
                      className="form-textarea"
                    />
                  </div>

                  <div className="form-group">
                    <label>Attach Photo (Optional)</label>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFileSelect}
                      style={{ display: 'none' }}
                    />

                    {photoPreview ? (
                      <div className="photo-preview-container">
                        <img src={photoPreview} alt="Announcement preview" className="photo-preview" />
                        <button className="remove-photo-btn" onClick={handleRemovePhoto}>
                          <FaTrash /> Remove
                        </button>
                      </div>
                    ) : (
                      <div
                        className={`file-upload-area${isDragOver ? ' dragging' : ''}`}
                        onClick={() => fileInputRef.current?.click()}
                        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                        onDragLeave={() => setIsDragOver(false)}
                        onDrop={handleDrop}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            fileInputRef.current?.click();
                          }
                        }}
                      >
                        <FaUpload className="upload-icon" />
                        <p>Click to upload or drag and drop</p>
                        <span className="upload-hint">JPG or PNG, up to 10 MB — resized automatically</span>
                      </div>
                    )}
                    {photoError && <p className="photo-error">{photoError}</p>}
                  </div>

                  <div className="modal-actions">
                    <button className="cancel-btn" onClick={closeCreateModal}>
                      Cancel
                    </button>
                    <button
                      className="confirm-btn"
                      onClick={handleCreateAnnouncement}
                      disabled={submitting || !isAnnouncementValid || !hasAnnouncementChanges}
                      title={
                        !isAnnouncementValid
                          ? 'Fill in the title and body to enable saving'
                          : !hasAnnouncementChanges
                            ? 'Make a change to enable saving'
                            : undefined
                      }
                    >
                      {submitting && <span className="btn-spinner"></span>}
                      {submitting
                        ? (editingAnnouncement ? 'Saving...' : 'Creating...')
                        : (editingAnnouncement ? 'Save Changes' : 'Confirm')}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="important-date-form">
                  <h3 className="modal-title" id="bulletin-modal-title">
                    {editingDate ? 'Edit Important Date' : 'Add Important Date'}
                  </h3>

                  <div className="form-group">
                    <label htmlFor="date-title">Title</label>
                    <input
                      id="date-title"
                      type="text"
                      placeholder="e.g., Graduation Fee Payment"
                      value={dateTitle}
                      onChange={(e) => setDateTitle(e.target.value)}
                      className="form-input"
                    />
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="date-month">Month</label>
                      <select
                        id="date-month"
                        value={dateMonth}
                        onChange={(e) => setDateMonth(e.target.value)}
                        className="form-select"
                      >
                        <option value="">Select month</option>
                        {MONTHS.map(month => (
                          <option key={month} value={month}>{month}</option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group">
                      <label htmlFor="date-day">Day</label>
                      <input
                        id="date-day"
                        type="number"
                        min="1"
                        max="31"
                        placeholder="Day"
                        value={dateDay}
                        onChange={(e) => setDateDay(e.target.value)}
                        className="form-input"
                      />
                    </div>
                  </div>

                  <div className="modal-actions">
                    <button className="cancel-btn" onClick={closeCreateModal}>
                      Cancel
                    </button>
                    <button
                      className="confirm-btn"
                      onClick={handleCreateImportantDate}
                      disabled={submitting || !isImportantDateValid}
                      title={!isImportantDateValid ? 'Fill in the title, month, and day to enable saving' : undefined}
                    >
                      {submitting && <span className="btn-spinner"></span>}
                      {submitting
                        ? (editingDate ? 'Saving...' : 'Adding...')
                        : (editingDate ? 'Save Changes' : 'Confirm')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <Notifications isOpen={showNotifications} onClose={() => setShowNotifications(false)} onViewRequest={onViewRequest} />
    </div>
  );
};

export default BulletinBoard;
