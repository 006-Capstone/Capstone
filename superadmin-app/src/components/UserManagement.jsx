import React, { useState, useEffect, useRef } from 'react';
import {
  FaEnvelope,
  FaKey,
  FaBan,
  FaPlus,
  FaUserPlus,
  FaCheck,
  FaSearch,
  FaFilter,
  FaSortAlphaDown,
  FaSort,
  FaSortUp,
  FaSortDown,
  FaBuilding,
  FaChevronDown,
  FaTimes,
  FaArchive,
  FaUndo,
  FaListAlt,
  FaBoxOpen,
  FaCalendarAlt,
  FaShieldAlt,
  FaSchool,
  FaCopy,
  FaCheckCircle,
  FaUserGraduate,
  FaIdCard,
  FaClock,
  FaTicketAlt,
  FaHistory,
  FaDownload,
  FaExternalLinkAlt,
  FaInfoCircle,
  FaArrowLeft,
  FaTrashAlt,
  FaLock
} from 'react-icons/fa';
import { db, auth } from '../firebase';
import { collection, addDoc, getDocs, query, orderBy, serverTimestamp, doc, updateDoc, deleteDoc, where, onSnapshot, limit } from 'firebase/firestore';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';
import NotificationBell from './NotificationBell';
import Archive from './Archive';
import { DataTableSkeleton } from './common/Skeleton';
import ChangePasswordModal from './ChangePasswordModal';
import Toast from './Toast';
import '../styles/UserManagement.css';

const DATE_PRESET_OPTIONS = [
  { id: 'all', label: 'All Dates' },
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: '7days', label: 'Past 7 Days' },
  { id: '30days', label: 'Past 30 Days' },
  { id: 'thisMonth', label: 'This Month' }
];

const UserManagement = () => {
  const [activeTab, setActiveTab] = useState('students'); // 'students' or 'staff'
  const [showCreateForm, setShowCreateForm] = useState(false);
  
  // Selection state for archiving
  const [selectedStudentIds, setSelectedStudentIds] = useState([]);
  const [selectedStaffIds, setSelectedStaffIds] = useState([]);
  const [selectAllStudents, setSelectAllStudents] = useState(false);
  const [selectAllStaff, setSelectAllStaff] = useState(false);
  
  const [studentId, setStudentId] = useState('');
  const [studentFirstName, setStudentFirstName] = useState('');
  const [studentLastName, setStudentLastName] = useState('');
  const [studentMiddleName, setStudentMiddleName] = useState('');
  const [studentSuffix, setStudentSuffix] = useState('');
  const [studentGradeLevel, setStudentGradeLevel] = useState('');
  const [studentSection, setStudentSection] = useState('');
  const [studentEmail, setStudentEmail] = useState('');
  
  // Staff form fields
  const [staffFirstName, setStaffFirstName] = useState('');
  const [staffLastName, setStaffLastName] = useState('');
  const [staffMiddleName, setStaffMiddleName] = useState('');
  const [staffSuffix, setStaffSuffix] = useState('');
  const [staffEmail, setStaffEmail] = useState('');
  const [staffOffice, setStaffOffice] = useState('finance');
  const [staffUsername, setStaffUsername] = useState('');
  const [usernameError, setUsernameError] = useState('');
  const [usernameChecking, setUsernameChecking] = useState(false);
  
  const [generatedPassword, setGeneratedPassword] = useState('');
  const [error, setError] = useState('');
  const [students, setStudents] = useState([]);
  const [staffMembers, setStaffMembers] = useState([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [createdStudent, setCreatedStudent] = useState(null);
  const [createdStaff, setCreatedStaff] = useState(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [isBulkAction, setIsBulkAction] = useState(false);
  const [bulkSuspendTargetState, setBulkSuspendTargetState] = useState(false);

  // User Profile Modal State
  const [showUserProfileModal, setShowUserProfileModal] = useState(false);
  const [selectedUserProfile, setSelectedUserProfile] = useState(null);
  const [userActivityLogs, setUserActivityLogs] = useState([]);
  const [loadingUserProfile, setLoadingUserProfile] = useState(false);
  const [staffStats, setStaffStats] = useState({ totalTickets: 0, avgResponseTime: 'N/A' });
  const [studentStats, setStudentStats] = useState({ totalTickets: 0 });
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [userToChangePassword, setUserToChangePassword] = useState(null);
  const [copiedField, setCopiedField] = useState('');
  const [showAllLogs, setShowAllLogs] = useState(false);
  const [activitySearchTerm, setActivitySearchTerm] = useState('');
  const [activityCategoryFilter, setActivityCategoryFilter] = useState('all');
  const [showFullAuditModal, setShowFullAuditModal] = useState(false);

  // Archiving state
  const [actionLoading, setActionLoading] = useState(false);
  const [toast, setToast] = useState(null); // { message, type: 'success' | 'error', ... }
  const [archiveRequestsStaff, setArchiveRequestsStaff] = useState(null);
  const [handledRequests, setHandledRequests] = useState([]);
  const [requestsLoading, setRequestsLoading] = useState(false);

  // Frontend-only search + filter + sort + pagination state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [officeFilter, setOfficeFilter] = useState('All'); // staff tab only
  const [sortOrder, setSortOrder] = useState('recent'); // 'recent' | 'az' | 'za'
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isOfficeOpen, setIsOfficeOpen] = useState(false);
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [dateFilter, setDateFilter] = useState({ preset: 'all', from: '', to: '' });
  const [isDateOpen, setIsDateOpen] = useState(false);
  const filterWrapRef = useRef(null);
  const officeWrapRef = useRef(null);
  const sortWrapRef = useRef(null);
  const dateWrapRef = useRef(null);
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 10;

  const resetPagination = () => setCurrentPage(1);

  const getPageNumbers = (current, total) => {
    if (total <= 7) {
      return Array.from({ length: total }, (_, i) => i + 1);
    }
    const pages = [];
    if (current <= 4) {
      for (let i = 1; i <= 5; i++) pages.push(i);
      pages.push('ellipsis');
      pages.push(total);
    } else if (current >= total - 3) {
      pages.push(1);
      pages.push('ellipsis');
      for (let i = total - 4; i <= total; i++) pages.push(i);
    } else {
      pages.push(1);
      pages.push('ellipsis');
      pages.push(current - 1);
      pages.push(current);
      pages.push(current + 1);
      pages.push('ellipsis');
      pages.push(total);
    }
    return pages;
  };

  const toLocalIsoDate = (d) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const isDateFilterActive = dateFilter.preset !== 'all' || Boolean(dateFilter.from || dateFilter.to);

  const getDateTriggerLabel = () => {
    if (!isDateFilterActive) return 'Date Created';
    if (dateFilter.preset === 'today') return 'Today';
    if (dateFilter.preset === 'yesterday') return 'Yesterday';
    if (dateFilter.preset === '7days') return 'Past 7 Days';
    if (dateFilter.preset === '30days') return 'Past 30 Days';
    if (dateFilter.preset === 'thisMonth') return 'This Month';
    if (dateFilter.from && dateFilter.to) {
      if (dateFilter.from === dateFilter.to) return dateFilter.from;
      return `${dateFilter.from} to ${dateFilter.to}`;
    }
    if (dateFilter.from) return `From ${dateFilter.from}`;
    if (dateFilter.to) return `Until ${dateFilter.to}`;
    return 'Date Created';
  };

  const handleSelectDatePreset = (presetId) => {
    const today = new Date();
    resetPagination();

    if (presetId === 'all') {
      setDateFilter({ preset: 'all', from: '', to: '' });
      setIsDateOpen(false);
      return;
    }

    let fromStr = '';
    let toStr = toLocalIsoDate(today);

    if (presetId === 'today') {
      fromStr = toStr;
    } else if (presetId === 'yesterday') {
      const yesterday = new Date(today);
      yesterday.setDate(today.getDate() - 1);
      fromStr = toLocalIsoDate(yesterday);
      toStr = fromStr;
    } else if (presetId === '7days') {
      const past7 = new Date(today);
      past7.setDate(today.getDate() - 6);
      fromStr = toLocalIsoDate(past7);
    } else if (presetId === '30days') {
      const past30 = new Date(today);
      past30.setDate(today.getDate() - 29);
      fromStr = toLocalIsoDate(past30);
    } else if (presetId === 'thisMonth') {
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      fromStr = toLocalIsoDate(startOfMonth);
    }

    setDateFilter({ preset: presetId, from: fromStr, to: toStr });
    setIsDateOpen(false);
  };

  const handleCustomDateChange = (field, val) => {
    resetPagination();
    setDateFilter((prev) => ({
      ...prev,
      preset: 'custom',
      [field]: val
    }));
  };

  const handleClearDateFilter = () => {
    resetPagination();
    setDateFilter({ preset: 'all', from: '', to: '' });
    setIsDateOpen(false);
  };

  const filterList = (items) => {
    const q = searchQuery.trim().toLowerCase();
    return items.filter((item) => {
      // Status filter (All / Active / Suspended)
      // If isActive is undefined, default to true (active)
      const isActive = item.isActive !== false;
      if (statusFilter === 'Active' && !isActive) return false;
      if (statusFilter === 'Suspended' && isActive) return false;

      // Date of creation filter (students tab)
      if (activeTab === 'students' && (dateFilter.from || dateFilter.to)) {
        const itemTime = item.rawCreatedAt;
        if (!itemTime) return false;

        if (dateFilter.from) {
          const fromTime = new Date(dateFilter.from + 'T00:00:00').getTime();
          if (itemTime < fromTime) return false;
        }

        if (dateFilter.to) {
          const toTime = new Date(dateFilter.to + 'T23:59:59.999').getTime();
          if (itemTime > toTime) return false;
        }
      }

      // Office filter (staff tab only)
      if (officeFilter !== 'All' && item.office !== officeFilter) return false;
      // Search — students match by name, student ID or email, staff by name, username, email, or office
      if (!q) return true;
      const searchFields =
        activeTab === 'students'
          ? [item.name, item.firstName, item.lastName, item.id, item.email]
          : [item.name, item.firstName, item.lastName, item.username, item.email, item.office];
      return searchFields
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(q));
    });
  };

  // Close the status / office / sort / date dropdowns when clicking outside or pressing Escape
  useEffect(() => {
    if (!isFilterOpen && !isOfficeOpen && !isSortOpen && !isDateOpen) return undefined;

    const handleClickOutside = (e) => {
      if (filterWrapRef.current && !filterWrapRef.current.contains(e.target)) {
        setIsFilterOpen(false);
      }
      if (officeWrapRef.current && !officeWrapRef.current.contains(e.target)) {
        setIsOfficeOpen(false);
      }
      if (sortWrapRef.current && !sortWrapRef.current.contains(e.target)) {
        setIsSortOpen(false);
      }
      if (dateWrapRef.current && !dateWrapRef.current.contains(e.target)) {
        setIsDateOpen(false);
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsFilterOpen(false);
        setIsOfficeOpen(false);
        setIsSortOpen(false);
        setIsDateOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isFilterOpen, isOfficeOpen, isSortOpen, isDateOpen]);

  const getItemIdNumber = (item) => {
    return String(item.id || item.studentId || item.idNumber || '').trim();
  };

  const sortList = (items) => {
    if (sortOrder === 'recent') {
      return [...items].sort((a, b) => (b.rawCreatedAt || 0) - (a.rawCreatedAt || 0));
    }
    if (sortOrder === 'idAsc') {
      return [...items].sort((a, b) => {
        const idA = getItemIdNumber(a);
        const idB = getItemIdNumber(b);
        if (!idA && !idB) return 0;
        if (!idA) return 1;
        if (!idB) return -1;
        const cmp = idA.localeCompare(idB, undefined, { numeric: true, sensitivity: 'base' });
        if (cmp !== 0) return cmp;
        return String(a.name || '').localeCompare(String(b.name || ''), undefined, { sensitivity: 'base' });
      });
    }
    if (sortOrder === 'idDesc') {
      return [...items].sort((a, b) => {
        const idA = getItemIdNumber(a);
        const idB = getItemIdNumber(b);
        if (!idA && !idB) return 0;
        if (!idA) return 1;
        if (!idB) return -1;
        const cmp = idB.localeCompare(idA, undefined, { numeric: true, sensitivity: 'base' });
        if (cmp !== 0) return cmp;
        return String(b.name || '').localeCompare(String(a.name || ''), undefined, { sensitivity: 'base' });
      });
    }
    const sorted = [...items].sort((a, b) => {
      const cmp = String(a.name || '').localeCompare(String(b.name || ''), undefined, { sensitivity: 'base' });
      if (cmp !== 0) return cmp;
      return (b.rawCreatedAt || 0) - (a.rawCreatedAt || 0);
    });
    return sortOrder === 'az' ? sorted : sorted.reverse();
  };

  const paginate = (items) => {
    const totalItems = items.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
    const safePage = Math.min(Math.max(1, currentPage), totalPages);
    const start = (safePage - 1) * PAGE_SIZE;
    return {
      pageItems: items.slice(start, start + PAGE_SIZE),
      totalPages,
      totalItems,
      startItem: totalItems === 0 ? 0 : start + 1,
      endItem: Math.min(totalItems, start + PAGE_SIZE)
    };
  };

  const renderPagination = (paginationData, itemLabel) => {
    const { totalItems, startItem, endItem, totalPages, currentPage: activePage = currentPage } = paginationData;
    if (totalItems === 0) return null;

    const pageNumbers = getPageNumbers(activePage, totalPages);

    return (
      <div className="pagination">
        <span className="pagination-info">
          Showing <strong>{startItem}–{endItem}</strong> of <strong>{totalItems}</strong> {itemLabel}{totalItems === 1 ? '' : 's'}
        </span>
        {totalPages > 1 && (
          <div className="pagination-controls">
            <button
              type="button"
              className="pagination-nav-btn"
              onClick={() => setCurrentPage(1)}
              disabled={activePage === 1}
              aria-label="First page"
              title="First page"
            >
              «
            </button>
            <button
              type="button"
              className="pagination-nav-btn"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={activePage === 1}
              aria-label="Previous page"
              title="Previous page"
            >
              ‹
            </button>
            {pageNumbers.map((pg, idx) =>
              pg === 'ellipsis' ? (
                <span key={`ellipsis-${idx}`} className="pagination-ellipsis" aria-hidden="true">
                  …
                </span>
              ) : (
                <button
                  key={pg}
                  type="button"
                  className={`pagination-num-btn ${activePage === pg ? 'active' : ''}`}
                  onClick={() => setCurrentPage(pg)}
                  aria-label={`Page ${pg}`}
                  aria-current={activePage === pg ? 'page' : undefined}
                >
                  {pg}
                </button>
              )
            )}
            <button
              type="button"
              className="pagination-nav-btn"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={activePage === totalPages}
              aria-label="Next page"
              title="Next page"
            >
              ›
            </button>
            <button
              type="button"
              className="pagination-nav-btn"
              onClick={() => setCurrentPage(totalPages)}
              disabled={activePage === totalPages}
              aria-label="Last page"
              title="Last page"
            >
              »
            </button>
          </div>
        )}
      </div>
    );
  };

  const activeStaffMembers = staffMembers.filter((s) => s.isArchived !== true);
  const archivedStaffMembers = staffMembers.filter((s) => s.isArchived === true);

  const visibleStudents = paginate(sortList(filterList(students)));
  const visibleStaff = paginate(sortList(filterList(activeStaffMembers)));
  const visibleArchivedStaff = paginate(sortList(filterList(archivedStaffMembers)));

  // Create Account buttons stay grayed out until every required field is
  // filled in (middle name and suffix are optional).
  const isStudentFormValid =
    studentId.length === 4 &&
    studentFirstName.trim() !== '' &&
    studentLastName.trim() !== '' &&
    studentEmail.trim() !== '' &&
    studentGradeLevel.trim() !== '' &&
    studentSection.trim() !== '';

  const isStaffFormValid =
    staffFirstName.trim() !== '' &&
    staffLastName.trim() !== '' &&
    staffEmail.trim() !== '' &&
    staffUsername.trim() !== '';

  const offices = [
    { id: 'finance', name: 'Finance' },
    { id: 'library', name: 'Library' },
    { id: 'guidance', name: 'Guidance' },
    { id: 'registrar', name: 'Registrar' }
  ];

  // Load students and staff from Firestore on component mount with real-time listeners
  useEffect(() => {
    const unsubscribeStudents = loadStudents();
    const unsubscribeStaff = loadStaff();
    
    // Cleanup listeners on unmount
    return () => {
      if (unsubscribeStudents) unsubscribeStudents();
      if (unsubscribeStaff) unsubscribeStaff();
    };
  }, []);

  const loadStaff = () => {
    try {
      const setupListener = (useOrderBy = true) => {
        const staffQuery = useOrderBy
          ? query(collection(db, 'staff'), orderBy('createdAt', 'desc'))
          : collection(db, 'staff');

        return onSnapshot(staffQuery, (querySnapshot) => {
          const staffData = querySnapshot.docs.map((docSnap) => {
            const data = docSnap.data();
            let formattedCreatedAt = 'N/A';
            let formattedArchivedAt = 'N/A';

            try {
              if (data.createdAt) {
                if (typeof data.createdAt.toDate === 'function') {
                  formattedCreatedAt = data.createdAt.toDate().toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                  });
                } else if (typeof data.createdAt === 'string') {
                  formattedCreatedAt = data.createdAt;
                }
              }
              if (data.archivedAt) {
                if (typeof data.archivedAt.toDate === 'function') {
                  formattedArchivedAt = data.archivedAt.toDate().toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                  });
                } else if (typeof data.archivedAt === 'string') {
                  formattedArchivedAt = data.archivedAt;
                }
              }
            } catch (err) {
              console.warn('[Warning] Failed to format staff dates:', err);
            }

            return {
              firestoreId: docSnap.id,
              ...data,
              name: data.name || `${data.firstName || ''} ${data.lastName || ''}`.trim() || data.username || '—',
              createdAt: formattedCreatedAt,
              archivedAt: formattedArchivedAt,
              archivedBy: data.archivedBy || '—',
              rawCreatedAt: data.createdAt?.toDate ? data.createdAt.toDate().getTime() : (data.createdAt ? new Date(data.createdAt).getTime() : 0)
            };
          });
          setStaffMembers(staffData);
          setInitialLoading(false);
        }, (error) => {
          console.error('[Error] loading staff:', error);
          if (useOrderBy) {
            console.warn('[Fallback] Retrying staff listener without orderBy...');
            setupListener(false);
          }
        });
      };

      return setupListener(true);
    } catch (error) {
      console.error('Error setting up staff listener:', error);
    }
  };

  const loadStudents = () => {
    try {
      const setupListener = (useOrderBy = true) => {
        const studentsQuery = useOrderBy
          ? query(collection(db, 'students'), orderBy('createdAt', 'desc'))
          : collection(db, 'students');

        return onSnapshot(studentsQuery, (querySnapshot) => {
          const studentsData = querySnapshot.docs.map((docSnap) => {
            const data = docSnap.data();
            let formattedCreatedAt = 'N/A';

            try {
              if (data.createdAt) {
                if (typeof data.createdAt.toDate === 'function') {
                  formattedCreatedAt = data.createdAt.toDate().toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                  });
                } else if (typeof data.createdAt === 'string') {
                  formattedCreatedAt = data.createdAt;
                }
              }
            } catch (err) {
              console.warn('[Warning] Failed to format student createdAt:', err);
            }

            return {
              firestoreId: docSnap.id,
              ...data,
              name: data.name || `${data.firstName || ''} ${data.lastName || ''}`.trim() || '—',
              createdAt: formattedCreatedAt,
              rawCreatedAt: data.createdAt?.toDate ? data.createdAt.toDate().getTime() : (data.createdAt ? new Date(data.createdAt).getTime() : 0)
            };
          });
          console.log('[Success] Loaded', studentsData.length, 'students');
          setStudents(studentsData);
          setInitialLoading(false);
        }, (error) => {
          console.error('[Error] loading students:', error);
          if (useOrderBy) {
            console.warn('[Fallback] Retrying students listener without orderBy...');
            setupListener(false);
          }
        });
      };

      return setupListener(true);
    } catch (error) {
      console.error('Error setting up students listener:', error);
    }
  };

  // Handle individual checkbox selection for students
  const handleSelectAccount = (id) => {
    setSelectedStudentIds((prev) =>
      prev.includes(id) ? prev.filter((sid) => sid !== id) : [...prev, id]
    );
  };

  // Handle select all checkbox (toggles current page visible items)
  const handleSelectAll = () => {
    if (activeTab === 'students') {
      const pageIds = visibleStudents.pageItems.map((s) => s.firestoreId).filter(Boolean);
      if (pageIds.length === 0) return;

      const isAllPageSelected = pageIds.every((id) => selectedStudentIds.includes(id));
      if (isAllPageSelected) {
        setSelectedStudentIds((prev) => prev.filter((id) => !pageIds.includes(id)));
        setSelectAllStudents(false);
      } else {
        setSelectedStudentIds((prev) => Array.from(new Set([...prev, ...pageIds])));
        setSelectAllStudents(true);
      }
    }
  };

  // Open bulk suspend/activate modal
  const handleOpenBulkSuspend = () => {
    const selectedList = students.filter((s) => selectedStudentIds.includes(s.firestoreId));
    if (selectedList.length === 0) {
      showToast('Please select at least one student account.', 'error');
      return;
    }
    const shouldSuspend = selectedList.some((s) => s.isActive !== false);
    setBulkSuspendTargetState(!shouldSuspend); // true = activate, false = suspend
    setIsBulkAction(true);
    setSelectedStudent(null);
    setSelectedStaff(null);
    setConfirmAction('suspend');
    setShowConfirmModal(true);
  };

  // Open bulk archive modal
  const handleOpenBulkArchive = () => {
    const selectedList = students.filter((s) => selectedStudentIds.includes(s.firestoreId));
    if (selectedList.length === 0) {
      showToast('Please select at least one student account.', 'error');
      return;
    }
    setIsBulkAction(true);
    setSelectedStudent(null);
    setSelectedStaff(null);
    setConfirmAction('archive');
    setShowConfirmModal(true);
  };

  // Open bulk delete modal
  const handleOpenBulkDelete = () => {
    const selectedList = students.filter((s) => selectedStudentIds.includes(s.firestoreId));
    if (selectedList.length === 0) {
      showToast('Please select at least one student account.', 'error');
      return;
    }
    setIsBulkAction(true);
    setSelectedStudent(null);
    setSelectedStaff(null);
    setConfirmAction('delete');
    setShowConfirmModal(true);
  };

  // Execute the confirmed bulk action
  const handleConfirmBulkAction = async () => {
    const selectedList = students.filter((s) => selectedStudentIds.includes(s.firestoreId));
    if (selectedList.length === 0) {
      cancelConfirm();
      return;
    }

    setActionLoading(true);
    try {
      if (confirmAction === 'suspend') {
        const newStatus = bulkSuspendTargetState;
        const bulkPayload = {
          isActive: newStatus
        };
        if (newStatus) {
          bulkPayload.reactivatedAt = serverTimestamp();
          bulkPayload.reactivatedBy = auth?.currentUser?.email || 'Super Admin';
        } else {
          bulkPayload.suspendedAt = serverTimestamp();
          bulkPayload.suspendedBy = auth?.currentUser?.email || 'Super Admin';
        }
        await Promise.all(
          selectedList.map((student) =>
            updateDoc(doc(db, 'students', student.firestoreId), bulkPayload)
          )
        );
        showToast(`Successfully ${newStatus ? 'activated' : 'suspended'} ${selectedList.length} student account(s).`);
      } else if (confirmAction === 'archive') {
        for (const account of selectedList) {
          // If student has a uid, archive their requests
          if (account.uid) {
            const requestsQuery = query(
              collection(db, 'requests'),
              where('studentUid', '==', account.uid)
            );
            const requestsSnapshot = await getDocs(requestsQuery);
            for (const requestDoc of requestsSnapshot.docs) {
              const requestData = requestDoc.data();
              await addDoc(collection(db, 'archivedRequests'), {
                ...requestData,
                archivedAt: serverTimestamp(),
                archivedReason: 'Student account archived',
                originalRequestId: requestDoc.id
              });
              await deleteDoc(doc(db, 'requests', requestDoc.id));
            }
          }

          // Add student to archived accounts
          await addDoc(collection(db, 'archivedAccounts'), {
            ...account,
            accountType: 'student',
            archivedAt: serverTimestamp(),
            originalCollection: 'students'
          });

          // Delete from students collection
          await deleteDoc(doc(db, 'students', account.firestoreId));
        }
        showToast(`Successfully archived ${selectedList.length} student account(s) and their requests.`);
      } else if (confirmAction === 'delete') {
        for (const account of selectedList) {
          await deleteDoc(doc(db, 'students', account.firestoreId));
        }
        showToast(`Successfully deleted ${selectedList.length} student account(s) from database.`);
      }

      setSelectedStudentIds([]);
      setSelectAllStudents(false);
      cancelConfirm();
    } catch (error) {
      console.error('Error executing bulk action:', error);
      showToast('Failed to execute bulk action: ' + error.message, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Generate random password (8 characters: letters + numbers)
  const generatePassword = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let password = '';
    for (let i = 0; i < 8; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  };

  const handleStudentIdChange = (e) => {
    const value = e.target.value;
    // Only allow digits and max 4 characters
    if (/^\d{0,4}$/.test(value)) {
      setStudentId(value);
      setError('');
    }
  };

  const handleCreateStudent = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Validate student ID
      if (!studentId || studentId.length !== 4) {
        setError('Student ID must be exactly 4 digits');
        setLoading(false);
        return;
      }

      // Check if student ID already exists
      if (students.some(s => s.id === studentId)) {
        setError('Student ID already exists');
        setLoading(false);
        return;
      }

      if (!studentFirstName.trim()) {
        setError('Please enter student first name');
        setLoading(false);
        return;
      }

      if (!studentLastName.trim()) {
        setError('Please enter student last name');
        setLoading(false);
        return;
      }

      if (!studentEmail.trim()) {
        setError('Please enter student email');
        setLoading(false);
        return;
      }

      if (!studentGradeLevel.trim()) {
        setError('Please select grade level');
        setLoading(false);
        return;
      }

      if (!studentSection.trim()) {
        setError('Please enter section');
        setLoading(false);
        return;
      }

      // Generate random password
      const password = generatePassword();
      setGeneratedPassword(password);

      // Create Firebase Authentication account
      const userCredential = await createUserWithEmailAndPassword(auth, studentEmail, password);
      const user = userCredential.user;

      // Build full name
      const middleInitial = studentMiddleName ? studentMiddleName.charAt(0).toUpperCase() + '.' : '';
      const fullName = `${studentFirstName} ${middleInitial} ${studentLastName}${studentSuffix ? ' ' + studentSuffix : ''}`.replace(/\s+/g, ' ').trim();

      // Save student data to Firestore
      await addDoc(collection(db, 'students'), {
        id: studentId,
        uid: user.uid,
        firstName: studentFirstName.trim(),
        lastName: studentLastName.trim(),
        middleName: studentMiddleName.trim(),
        middleInitial: studentMiddleName ? studentMiddleName.charAt(0).toUpperCase() : '',
        suffix: studentSuffix.trim(),
        gradeLevel: studentGradeLevel.trim(),
        section: studentSection.trim(),
        name: fullName,
        fullName: fullName,
        email: studentEmail.trim(),
        role: 'student',
        createdAt: serverTimestamp(),
        isActive: true,
        mustChangePassword: true // Force password change on first login
      });

      // Send credentials via email
      let emailFailed = false;
      try {
        const studentPortalUrl = process.env.VITE_STUDENT_APP_URL || process.env.REACT_APP_STUDENT_APP_URL;
        const apiUrl = studentPortalUrl 
          ? `${studentPortalUrl.replace(/\/$/, '')}/api/send-temporary-password`
          : (process.env.NODE_ENV === 'production' 
              ? '/api/send-temporary-password' 
              : 'http://localhost:5000/api/send-temporary-password');
          
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: studentEmail.trim(),
            userName: fullName,
            temporaryPassword: password,
            role: 'student'
          })
        });

        if (!response.ok) {
          let errorMsg = `Server error ${response.status}`;
          try {
            const errData = await response.json();
            errorMsg = errData.error || errData.message || errorMsg;
          } catch {
            const text = await response.text();
            if (text) errorMsg = text.slice(0, 120);
          }
          throw new Error(errorMsg);
        }

        const result = await response.json();
        
        if (result.success) {
          console.log('[Success] Email sent successfully to:', studentEmail);
        } else {
          throw new Error(result.error || 'Failed to send email');
        }
      } catch (emailError) {
        console.error('[Error] Failed to send email:', emailError);
        // Continue anyway - account was created successfully
        emailFailed = true;
        showToast('Account created but email failed to send. Please manually share credentials with student:\nStudent ID: ' + studentId + '\nPassword: ' + password, 'warning', {
          autoDismiss: 0,
          closeOnOverlayClick: false
        });
      }

      // Reload students list (real-time listener will update automatically)
      // await loadStudents(); // No longer needed - real-time listener handles this

      // Wait a moment for Firestore real-time listeners to update
      await new Promise(resolve => setTimeout(resolve, 500));

      // Show simple success message only if email sent successfully
      if (!emailFailed) {
        setCreatedStudent({
          id: studentId,
          name: fullName,
          email: studentEmail.trim()
        });
        setShowSuccessModal(true);
      }
      setShowCreateForm(false);
      setStudentId('');
      setStudentFirstName('');
      setStudentLastName('');
      setStudentMiddleName('');
      setStudentSuffix('');
      setStudentGradeLevel('');
      setStudentSection('');
      setStudentEmail('');
      setLoading(false);

    } catch (error) {
      console.error('Error creating student:', error);
      if (error.code === 'auth/email-already-in-use') {
        setError('Email address is already in use');
      } else if (error.code === 'auth/invalid-email') {
        setError('Invalid email address');
      } else if (error.code === 'auth/weak-password') {
        setError('Password is too weak');
      } else {
        setError('Failed to create student account: ' + error.message);
      }
      setLoading(false);
    }
  };

  const handleCloseSuccessModal = () => {
    setShowSuccessModal(false);
    setCreatedStudent(null);
    setCreatedStaff(null);
  };

  const handleNewStudent = () => {
    setActiveTab('students');
    setShowCreateForm(true);
    setStudentId('');
    setStudentFirstName('');
    setStudentLastName('');
    setStudentMiddleName('');
    setStudentSuffix('');
    setStudentGradeLevel('');
    setStudentSection('');
    setStudentEmail('');
    setGeneratedPassword('');
    setError('');
  };

  const handleNewStaff = () => {
    setActiveTab('staff');
    setShowCreateForm(true);
    setStaffFirstName('');
    setStaffLastName('');
    setStaffMiddleName('');
    setStaffSuffix('');
    setStaffEmail('');
    setStaffOffice('finance');
    setStaffUsername('');
    setGeneratedPassword('');
    setError('');
  };

  const handleCloseCreateForm = () => {
    setShowCreateForm(false);
    setError('');
    setUsernameError('');
    setStaffUsername('');
  };

  // Check username uniqueness when user stops typing
  const checkUsernameAvailability = async (username) => {
    if (!username.trim()) {
      setUsernameError('');
      return;
    }

    setUsernameChecking(true);
    
    try {
      const staffQuery = query(collection(db, 'staff'), where('username', '==', username.trim()));
      const existingStaff = await getDocs(staffQuery);
      
      if (!existingStaff.empty) {
        setUsernameError('⚠ Username already exists');
      } else {
        setUsernameError('');
      }
    } catch (error) {
      console.error('Error checking username:', error);
    } finally {
      setUsernameChecking(false);
    }
  };

  // Debounce username check
  useEffect(() => {
    if (!staffUsername) {
      setUsernameError('');
      return;
    }

    const timeoutId = setTimeout(() => {
      checkUsernameAvailability(staffUsername);
    }, 500); // Wait 500ms after user stops typing

    return () => clearTimeout(timeoutId);
  }, [staffUsername]);

  const handleCreateStaff = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (!staffFirstName.trim()) {
        setError('Please enter staff first name');
        setLoading(false);
        return;
      }

      if (!staffLastName.trim()) {
        setError('Please enter staff last name');
        setLoading(false);
        return;
      }

      if (!staffEmail.trim()) {
        setError('Please enter staff email');
        setLoading(false);
        return;
      }

      if (!staffUsername.trim()) {
        setError('Please enter username');
        setLoading(false);
        return;
      }

      // Check if username is already showing an error
      if (usernameError) {
        setError(usernameError);
        setLoading(false);
        return;
      }

      // Check if username already exists
      const staffQuery = query(collection(db, 'staff'), where('username', '==', staffUsername.trim()));
      const existingStaff = await getDocs(staffQuery);
      
      if (!existingStaff.empty) {
        setError('Username already exists. Please choose a different username.');
        setLoading(false);
        return;
      }

      // Generate random password
      const password = generatePassword();
      setGeneratedPassword(password);

      // Create Firebase Authentication account
      const userCredential = await createUserWithEmailAndPassword(auth, staffEmail, password);
      const user = userCredential.user;

      const selectedOffice = offices.find(o => o.id === staffOffice);

      // Build full name
      const middleInitial = staffMiddleName ? staffMiddleName.charAt(0).toUpperCase() + '.' : '';
      const fullName = `${staffFirstName} ${middleInitial} ${staffLastName}${staffSuffix ? ' ' + staffSuffix : ''}`.replace(/\s+/g, ' ').trim();

      // Save staff data to Firestore
      await addDoc(collection(db, 'staff'), {
        uid: user.uid,
        firstName: staffFirstName.trim(),
        lastName: staffLastName.trim(),
        middleName: staffMiddleName.trim(),
        middleInitial: staffMiddleName ? staffMiddleName.charAt(0).toUpperCase() : '',
        suffix: staffSuffix.trim(),
        name: fullName,
        fullName: fullName,
        email: staffEmail.trim(),
        username: staffUsername.trim(),
        office: selectedOffice.name,
        officeId: staffOffice,
        role: 'staff',
        createdAt: serverTimestamp(),
        isActive: true,
        mustChangePassword: true // Force password change on first login
      });

      // Send credentials via email
      let emailFailed = false;
      try {
        const studentPortalUrl = process.env.VITE_STUDENT_APP_URL || process.env.REACT_APP_STUDENT_APP_URL;
        const apiUrl = studentPortalUrl 
          ? `${studentPortalUrl.replace(/\/$/, '')}/api/send-temporary-password`
          : (process.env.NODE_ENV === 'production' 
              ? '/api/send-temporary-password' 
              : 'http://localhost:5000/api/send-temporary-password');
          
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: staffEmail.trim(),
            userName: fullName,
            temporaryPassword: password,
            role: 'admin',
            office: selectedOffice.name
          })
        });

        if (!response.ok) {
          let errorMsg = `Server error ${response.status}`;
          try {
            const errData = await response.json();
            errorMsg = errData.error || errData.message || errorMsg;
          } catch {
            const text = await response.text();
            if (text) errorMsg = text.slice(0, 120);
          }
          throw new Error(errorMsg);
        }

        const result = await response.json();
        
        if (result.success) {
          console.log('[Success] Email sent successfully to:', staffEmail);
        } else {
          throw new Error(result.error || 'Failed to send email');
        }
      } catch (emailError) {
        console.error('[Error] Failed to send email:', emailError);
        // Continue anyway - account was created successfully
        emailFailed = true;
        showToast('Account created but email failed to send. Please manually share credentials with staff:\nUsername: ' + staffUsername + '\nPassword: ' + password, 'warning', {
          autoDismiss: 0,
          closeOnOverlayClick: false
        });
      }

      // Reload staff list (real-time listener will update automatically)
      // await loadStaff(); // No longer needed - real-time listener handles this

      // Wait a moment for Firestore real-time listeners to update
      await new Promise(resolve => setTimeout(resolve, 500));

      // Show success message only if email sent successfully
      if (!emailFailed) {
        setCreatedStaff({
          name: fullName,
          email: staffEmail.trim(),
          username: staffUsername.trim(),
          office: selectedOffice.name
        });
        setShowSuccessModal(true);
      }
      setShowCreateForm(false);
      setStaffFirstName('');
      setStaffLastName('');
      setStaffMiddleName('');
      setStaffSuffix('');
      setStaffEmail('');
      setStaffUsername('');
      setUsernameError('');
      setLoading(false);

    } catch (error) {
      console.error('Error creating staff:', error);
      if (error.code === 'auth/email-already-in-use') {
        setError('Email address is already in use');
      } else if (error.code === 'auth/invalid-email') {
        setError('Invalid email address');
      } else if (error.code === 'auth/weak-password') {
        setError('Password is too weak');
      } else {
        setError('Failed to create staff account: ' + error.message);
      }
      setLoading(false);
    }
  };

  const handleSuspendStudent = (student) => {
    setSelectedStudent(student);
    setConfirmAction('suspend');
    setShowConfirmModal(true);
  };

  const handleDeleteStudent = (student) => {
    setSelectedStudent(student);
    setConfirmAction('delete');
    setShowConfirmModal(true);
  };

  // Handle clicking anywhere on a student or staff row
  const handleRowClick = (e, user, userType) => {
    // Do not trigger profile opening if clicked on interactive controls (checkbox, action buttons)
    if (
      e.target.closest('button') ||
      e.target.closest('input') ||
      e.target.closest('.checkbox-cell') ||
      e.target.closest('.table-cell:last-child')
    ) {
      return;
    }
    handleOpenUserProfile(user, userType);
  };

  // Open User Profile Modal
  const handleOpenUserProfile = async (user, userType) => {
    setSelectedUserProfile({ ...user, userType });
    setShowUserProfileModal(true);
    setLoadingUserProfile(true);
    setActivitySearchTerm('');
    setActivityCategoryFilter('all');
    setShowFullAuditModal(false);
    
    try {
      const rawCompiledLogs = [];

      // 1. Fetch activity logs from Firestore collection if present
      try {
        const logsRef = collection(db, 'activityLogs');
        const logsQuery = query(
          logsRef,
          where('userId', '==', user.uid || user.firestoreId)
        );
        const logsSnapshot = await getDocs(logsQuery);
        logsSnapshot.docs.forEach(doc => {
          const data = doc.data();
          rawCompiledLogs.push({
            id: doc.id,
            action: data.action || 'System activity recorded',
            category: data.category || 'general',
            details: data.details || data.description || '',
            status: data.status || 'Success',
            timestamp: data.timestamp?.toDate?.() || (data.timestamp ? new Date(data.timestamp) : new Date())
          });
        });
      } catch (logErr) {
        console.warn('[ActivityLog] Firestore activityLogs query skipped:', logErr);
      }

      // 2. If staff, fetch their ticket statistics & interactions
      if (userType === 'staff') {
        try {
          const requestsRef = collection(db, 'requests');
          const allRequestsSnapshot = await getDocs(requestsRef);
          
          const staffRequests = allRequestsSnapshot.docs.filter(doc => {
            const data = doc.data();
            const assigned = (data.assignedTo || data.claimedBy || '').toLowerCase();
            const assignedToStaff = data.assignedToStaff || '';
            
            return (
              (assigned && assigned === (user.name || '').toLowerCase()) ||
              (user.uid && assignedToStaff === user.uid) ||
              (user.firestoreId && assignedToStaff === user.firestoreId)
            );
          });
          
          const totalTickets = staffRequests.length;
          const resolvedTickets = staffRequests.filter(doc => {
            const data = doc.data();
            return data.status === 'Resolved' && data.createdAt && data.resolvedAt;
          });
          
          let avgResponseTime = 'N/A';
          if (resolvedTickets.length > 0) {
            const totalMs = resolvedTickets.reduce((sum, doc) => {
              const data = doc.data();
              const created = data.createdAt?.toDate?.() || new Date(data.createdAt);
              const resolved = data.resolvedAt?.toDate?.() || new Date(data.resolvedAt);
              return sum + (resolved - created);
            }, 0);
            
            const avgMs = totalMs / resolvedTickets.length;
            const totalHours = Math.floor(avgMs / (1000 * 60 * 60));
            const totalMinutes = Math.floor((avgMs % (1000 * 60 * 60)) / (1000 * 60));
            avgResponseTime = `${totalHours}h ${totalMinutes}m`;
          }
          setStaffStats({ totalTickets, avgResponseTime });

          // Synthesize ticket audit events for staff
          staffRequests.forEach(doc => {
            const data = doc.data();
            const reqCode = data.requestId || doc.id.slice(0, 8).toUpperCase();
            const reqCreated = data.createdAt?.toDate?.() || (data.createdAt ? new Date(data.createdAt) : null);
            const reqResolved = data.resolvedAt?.toDate?.() || (data.resolvedAt ? new Date(data.resolvedAt) : null);

            if (reqCreated && !isNaN(reqCreated.getTime())) {
              rawCompiledLogs.push({
                id: `stf-claim-${doc.id}`,
                action: `Claimed Ticket #${reqCode} - "${data.subject || 'Student Request'}"`,
                category: 'tickets',
                details: `Office: ${data.office || user.office || 'Assigned Office'} • Student: ${data.studentName || data.name || 'Student'}`,
                status: data.status || 'Assigned',
                timestamp: reqCreated
              });
            }

            if (reqResolved && !isNaN(reqResolved.getTime()) && data.status === 'Resolved') {
              rawCompiledLogs.push({
                id: `stf-resolve-${doc.id}`,
                action: `Resolved Ticket #${reqCode} for student`,
                category: 'tickets',
                details: `Resolution confirmed by staff member`,
                status: 'Resolved',
                timestamp: reqResolved
              });
            }
          });
        } catch (statsError) {
          console.error('[Error] Failed to load staff statistics:', statsError);
          setStaffStats({ totalTickets: 0, avgResponseTime: 'N/A' });
        }
      }

      // 3. If student, fetch their ticket statistics & submissions
      if (userType === 'student') {
        try {
          const requestsRef = collection(db, 'requests');
          const studentRequests = query(
            requestsRef,
            where('studentEmail', '==', user.email)
          );
          const requestsSnapshot = await getDocs(studentRequests);
          const totalTickets = requestsSnapshot.size;
          setStudentStats({ totalTickets });

          // Synthesize ticket audit events for student
          requestsSnapshot.docs.forEach(doc => {
            const data = doc.data();
            const reqCode = data.requestId || doc.id.slice(0, 8).toUpperCase();
            const reqCreated = data.createdAt?.toDate?.() || (data.createdAt ? new Date(data.createdAt) : null);
            const reqResolved = data.resolvedAt?.toDate?.() || (data.resolvedAt ? new Date(data.resolvedAt) : null);

            if (reqCreated && !isNaN(reqCreated.getTime())) {
              rawCompiledLogs.push({
                id: `stu-req-${doc.id}`,
                action: `Submitted Request #${reqCode} - "${data.subject || data.topic || 'School Inquiry'}"`,
                category: 'tickets',
                details: `Target Office: ${data.office || 'General'} • Priority: ${data.priority || 'Normal'}`,
                status: data.status || 'Pending',
                timestamp: reqCreated
              });
            }

            if (reqResolved && !isNaN(reqResolved.getTime()) && data.status === 'Resolved') {
              rawCompiledLogs.push({
                id: `stu-res-${doc.id}`,
                action: `Request #${reqCode} marked as Resolved`,
                category: 'tickets',
                details: `Office resolution completed`,
                status: 'Resolved',
                timestamp: reqResolved
              });
            }
          });
        } catch (statsError) {
          console.error('[Error] Failed to load student statistics:', statsError);
          setStudentStats({ totalTickets: 0 });
        }
      }

      // 4. Synthesize registration / directory entry
      const userCreated = user.createdAt?.toDate?.() || (user.createdAt ? new Date(user.createdAt) : null);
      if (userCreated && !isNaN(userCreated.getTime())) {
        rawCompiledLogs.push({
          id: `user-init-${user.id || user.uid || 'entry'}`,
          action: `Account registered in School Directory`,
          category: 'security',
          details: `Enrolled as ${userType === 'student' ? 'Student' : 'Staff Member'} with verified credentials`,
          status: 'Authorized',
          timestamp: userCreated
        });
      }

      // 5. Account Suspension Events (if currently suspended or recorded in history)
      const suspendedDate = user.suspendedAt?.toDate?.() || (user.suspendedAt ? new Date(user.suspendedAt) : null);
      if (user.isActive === false || (suspendedDate && !isNaN(suspendedDate.getTime()))) {
        rawCompiledLogs.push({
          id: `user-suspend-${user.id || user.uid || 'entry'}`,
          action: `Account access suspended`,
          category: 'security',
          details: `Portal login authorization suspended by ${user.suspendedBy || 'Administrator'}. Access to school services restricted.`,
          status: 'Suspended',
          timestamp: (suspendedDate && !isNaN(suspendedDate.getTime())) ? suspendedDate : (user.updatedAt?.toDate?.() || (user.updatedAt ? new Date(user.updatedAt) : new Date()))
        });
      }
      if (user.reactivatedAt) {
        const reactivatedDate = user.reactivatedAt?.toDate?.() || new Date(user.reactivatedAt);
        if (!isNaN(reactivatedDate.getTime())) {
          rawCompiledLogs.push({
            id: `user-reactivate-${user.id || user.uid || 'entry'}`,
            action: `Account access reactivated`,
            category: 'security',
            details: `Suspension lifted by ${user.reactivatedBy || 'Administrator'}. Full portal privileges restored.`,
            status: 'Active',
            timestamp: reactivatedDate
          });
        }
      }

      // 6. Account Archive Events (if archived or recorded in history)
      const archivedDate = user.archivedAt?.toDate?.() || (user.archivedAt ? new Date(user.archivedAt) : null);
      if (user.isArchived === true || (archivedDate && !isNaN(archivedDate.getTime()))) {
        rawCompiledLogs.push({
          id: `user-archive-${user.id || user.uid || 'entry'}`,
          action: `Account moved to Archive Directory`,
          category: 'admin',
          details: `Account archived by ${user.archivedBy || 'Administrator'}${user.archivedReason ? ` (${user.archivedReason})` : ''}; removed from active roster.`,
          status: 'Archived',
          timestamp: (archivedDate && !isNaN(archivedDate.getTime())) ? archivedDate : (user.updatedAt?.toDate?.() || (user.updatedAt ? new Date(user.updatedAt) : new Date()))
        });
      }
      if (user.restoredAt) {
        const restoredDate = user.restoredAt?.toDate?.() || new Date(user.restoredAt);
        if (!isNaN(restoredDate.getTime())) {
          rawCompiledLogs.push({
            id: `user-restore-${user.id || user.uid || 'entry'}`,
            action: `Account restored to School Directory`,
            category: 'admin',
            details: `Account restored from Archive by ${user.restoredBy || 'Administrator'} into active directory.`,
            status: 'Restored',
            timestamp: restoredDate
          });
        }
      }

      // 7. Password Changes & Credential Lifecycle Events
      if (user.passwordChangedAt) {
        const pwdChangeDate = user.passwordChangedAt?.toDate?.() || new Date(user.passwordChangedAt);
        if (!isNaN(pwdChangeDate.getTime())) {
          rawCompiledLogs.push({
            id: `user-pwd-change-${user.id || user.uid || 'entry'}`,
            action: `Account password changed & verified`,
            category: 'security',
            details: `User successfully changed and confirmed new personal password credentials`,
            status: 'Secured',
            timestamp: pwdChangeDate
          });
        }
      } else if (user.mustChangePassword === false && userCreated) {
        const pwdInitDate = user.updatedAt?.toDate?.() || (user.updatedAt ? new Date(user.updatedAt) : new Date(userCreated.getTime() + 60000));
        rawCompiledLogs.push({
          id: `user-pwd-verified-${user.id || user.uid || 'entry'}`,
          action: `Account password changed & verified`,
          category: 'security',
          details: `Initial temporary default password changed to verified personal credentials`,
          status: 'Secured',
          timestamp: pwdInitDate
        });
      }

      if (user.mustChangePassword === true) {
        rawCompiledLogs.push({
          id: `user-pwd-pending-${user.id || user.uid || 'entry'}`,
          action: `Password change required on next login`,
          category: 'security',
          details: `Default temporary credentials assigned; mandatory password change required upon first sign-in`,
          status: 'Pending',
          timestamp: userCreated || new Date()
        });
      }

      if (user.passwordResetAt) {
        const resetDate = user.passwordResetAt?.toDate?.() || new Date(user.passwordResetAt);
        if (!isNaN(resetDate.getTime())) {
          rawCompiledLogs.push({
            id: `user-pwd-reset-${user.id || user.uid || 'entry'}`,
            action: `Password reset email dispatched`,
            category: 'security',
            details: `Password reset recovery link generated and dispatched to ${user.email} by ${user.passwordResetBy || 'Administrator'}`,
            status: 'Dispatched',
            timestamp: resetDate
          });
        }
      }

      // Sort chronological descending (latest first)
      const sortedLogs = rawCompiledLogs.sort((a, b) => b.timestamp - a.timestamp);
      setUserActivityLogs(sortedLogs);
    } catch (error) {
      console.error('[Error] Failed to load activity logs:', error);
      setUserActivityLogs([]);
    } finally {
      setLoadingUserProfile(false);
    }
  };

  const handleCloseUserProfile = () => {
    setShowUserProfileModal(false);
    setSelectedUserProfile(null);
    setUserActivityLogs([]);
    setStaffStats({ totalTickets: 0, avgResponseTime: 'N/A' });
    setStudentStats({ totalTickets: 0 });
    setCopiedField('');
    setShowAllLogs(false);
    setActivitySearchTerm('');
    setActivityCategoryFilter('all');
    setShowFullAuditModal(false);
  };

  const formatActivityTimestamp = (ts) => {
    if (!ts) return { dateStr: 'N/A', relativeStr: '' };
    const d = ts instanceof Date ? ts : (ts?.toDate ? ts.toDate() : new Date(ts));
    if (isNaN(d.getTime())) return { dateStr: 'N/A', relativeStr: '' };

    const now = new Date();
    const diffMs = now - d;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHours = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHours / 24);

    let relativeStr = '';
    if (diffSec < 60) relativeStr = 'Just now';
    else if (diffMin < 60) relativeStr = `${diffMin}m ago`;
    else if (diffHours < 24) relativeStr = `${diffHours}h ago`;
    else if (diffDays === 1) relativeStr = 'Yesterday';
    else if (diffDays < 7) relativeStr = `${diffDays}d ago`;
    else relativeStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    const dateStr = d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    return { dateStr, relativeStr };
  };

  const handleExportAuditCSV = () => {
    if (!userActivityLogs || userActivityLogs.length === 0) return;
    const targetLogs = userActivityLogs.filter((log) => {
      const matchesCat =
        activityCategoryFilter === 'all' || (log.category || 'general') === activityCategoryFilter;
      const term = activitySearchTerm.toLowerCase().trim();
      const matchesTerm =
        !term ||
        (log.action && log.action.toLowerCase().includes(term)) ||
        (log.details && log.details.toLowerCase().includes(term)) ||
        (log.status && log.status.toLowerCase().includes(term)) ||
        (log.id && log.id.toLowerCase().includes(term));
      return matchesCat && matchesTerm;
    });

    const headers = ['Event ID', 'Timestamp', 'Category', 'Action', 'Details', 'Status'];
    const rows = targetLogs.map(l => {
      const ts = l.timestamp instanceof Date ? l.timestamp.toISOString() : String(l.timestamp || '');
      return [
        `"${l.id || ''}"`,
        `"${ts}"`,
        `"${l.category || 'general'}"`,
        `"${(l.action || '').replace(/"/g, '""')}"`,
        `"${(l.details || '').replace(/"/g, '""')}"`,
        `"${l.status || 'Success'}"`
      ].join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    const safeName = (selectedUserProfile?.name || 'user').replace(/\s+/g, '_').toLowerCase();
    link.setAttribute('download', `audit_trail_${safeName}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const renderActivityCategoryIcon = (category) => {
    switch (category) {
      case 'tickets':
        return <FaTicketAlt className="cat-icon tickets" />;
      case 'security':
        return <FaKey className="cat-icon security" />;
      case 'admin':
        return <FaShieldAlt className="cat-icon admin" />;
      default:
        return <FaCheckCircle className="cat-icon general" />;
    }
  };

  const filteredActivityLogs = userActivityLogs.filter((log) => {
    const matchesCategory =
      activityCategoryFilter === 'all' || (log.category || 'general') === activityCategoryFilter;
    const term = activitySearchTerm.toLowerCase().trim();
    const matchesSearch =
      !term ||
      (log.action && log.action.toLowerCase().includes(term)) ||
      (log.details && log.details.toLowerCase().includes(term)) ||
      (log.status && log.status.toLowerCase().includes(term)) ||
      (log.id && log.id.toLowerCase().includes(term));
    return matchesCategory && matchesSearch;
  });

  const countTickets = userActivityLogs.filter(l => l.category === 'tickets').length;
  const countSecurity = userActivityLogs.filter(l => l.category === 'security').length;
  const countAdmin = userActivityLogs.filter(l => l.category === 'admin').length;

  const handleCopyText = (text, fieldName) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(''), 2000);
  };

  const handleModalSuspendAction = () => {
    if (!selectedUserProfile) return;
    const profile = selectedUserProfile;
    if (profile.userType === 'student') {
      setSelectedStudent(profile);
      setConfirmAction('suspend');
      setShowConfirmModal(true);
    } else {
      setSelectedStaff(profile);
      setConfirmAction('suspend');
      setShowConfirmModal(true);
    }
  };

  const handleModalArchiveAction = () => {
    if (!selectedUserProfile) return;
    const profile = selectedUserProfile;
    if (profile.userType === 'student') {
      handleArchiveStudent(profile);
    } else {
      handleArchiveStaff(profile);
    }
  };

  const handleModalDeleteAction = () => {
    if (!selectedUserProfile) return;
    const profile = selectedUserProfile;
    if (profile.userType === 'student') {
      setSelectedStudent(profile);
      setSelectedStaff(null);
    } else {
      setSelectedStaff(profile);
      setSelectedStudent(null);
    }
    setConfirmAction('delete');
    setShowConfirmModal(true);
  };

  const confirmSuspendOrDelete = async () => {
    const target = selectedStudent || selectedStaff;
    const isStudent = !!selectedStudent;
    const collectionName = isStudent ? 'students' : 'staff';
    
    if (!target) return;

    try {
      if (confirmAction === 'suspend') {
        // Toggle suspension status
        const newStatus = !target.isActive;
        const updatePayload = {
          isActive: newStatus
        };
        if (newStatus) {
          updatePayload.reactivatedAt = serverTimestamp();
          updatePayload.reactivatedBy = auth?.currentUser?.email || 'Super Admin';
        } else {
          updatePayload.suspendedAt = serverTimestamp();
          updatePayload.suspendedBy = auth?.currentUser?.email || 'Super Admin';
        }
        await updateDoc(doc(db, collectionName, target.firestoreId), updatePayload);
        if (selectedUserProfile) {
          setSelectedUserProfile((prev) => (prev ? { ...prev, ...updatePayload } : null));
        }
        
        // Wait a moment for Firestore real-time listeners to update
        await new Promise(resolve => setTimeout(resolve, 500));
        showToast(`Account ${newStatus ? 'activated' : 'suspended'} successfully!`);
      } else if (confirmAction === 'delete') {
        // Delete from Firestore
        await deleteDoc(doc(db, collectionName, target.firestoreId));
        if (selectedUserProfile) {
          handleCloseUserProfile();
        }
        
        // Wait a moment for Firestore real-time listeners to update
        await new Promise(resolve => setTimeout(resolve, 500));
        showToast('Account deleted successfully from database!');
      }
      setShowConfirmModal(false);
      setSelectedStudent(null);
      setSelectedStaff(null);
      setConfirmAction(null);
    } catch (error) {
      console.error('Error:', error);
      showToast('Failed to perform action: ' + error.message, 'error');
    }
  };

  const cancelConfirm = () => {
    setShowConfirmModal(false);
    setSelectedStudent(null);
    setSelectedStaff(null);
    setIsBulkAction(false);
    setConfirmAction(null);
  };

  const showToast = (message, type = 'success', options = {}) => {
    setToast({
      message,
      type,
      title: options.title,
      confirmText: options.confirmText || 'OK'
    });
  };

  const handleCloseToast = () => {
    setToast(null);
  };

  const formatRequestDate = (ts) => {
    if (ts && typeof ts.toDate === 'function') {
      return ts.toDate().toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    }
    return '—';
  };

  const handleArchiveStaff = (staff) => {
    setSelectedStaff(staff);
    setSelectedStudent(null);
    setConfirmAction('archive');
    setShowConfirmModal(true);
  };

  const handleArchiveStudent = (student) => {
    setSelectedStudent(student);
    setSelectedStaff(null);
    setConfirmAction('archive');
    setShowConfirmModal(true);
  };

  const handleRestoreStaff = (staff) => {
    setSelectedStaff(staff);
    setSelectedStudent(null);
    setConfirmAction('restore');
    setShowConfirmModal(true);
  };

  const confirmArchiveOrRestore = async () => {
    const target = selectedStudent || selectedStaff;
    if (!target) return;

    setActionLoading(true);
    try {
      if (confirmAction === 'archive') {
        if (selectedStudent) {
          // Archive student account & student requests
          const requestsQuery = query(
            collection(db, 'requests'),
            where('studentUid', '==', target.uid)
          );
          const requestsSnapshot = await getDocs(requestsQuery);
          for (const requestDoc of requestsSnapshot.docs) {
            const requestData = requestDoc.data();
            await addDoc(collection(db, 'archivedRequests'), {
              ...requestData,
              archivedAt: serverTimestamp(),
              archivedReason: 'Student account archived',
              originalRequestId: requestDoc.id
            });
            await deleteDoc(doc(db, 'requests', requestDoc.id));
          }

          await addDoc(collection(db, 'archivedAccounts'), {
            ...target,
            accountType: 'student',
            archivedAt: serverTimestamp(),
            originalCollection: 'students'
          });

          await deleteDoc(doc(db, 'students', target.firestoreId));
          showToast(`${target.name} has been archived and moved to Archive.`);
        } else {
          // Archive a staff member — purely additive fields. Their Firestore doc
          // and request history are left untouched (no delete).
          const actorName = auth?.currentUser?.email || 'Super Admin';
          await updateDoc(doc(db, 'staff', target.firestoreId), {
            isArchived: true,
            archivedAt: serverTimestamp(),
            archivedBy: actorName
          });
          await loadStaff();
          showToast(`${target.name} has been archived and moved to Archive.`);
        }
        if (selectedUserProfile) {
          handleCloseUserProfile();
        }
      } else if (confirmAction === 'restore') {
        // Restore the member back to Active Staff. Request history is unchanged.
        await updateDoc(doc(db, 'staff', target.firestoreId), {
          isArchived: false,
          restoredAt: serverTimestamp()
        });
        await loadStaff();
        showToast(`${target.name} has been restored to Active Staff.`);
      }
      setShowConfirmModal(false);
      setSelectedStudent(null);
      setSelectedStaff(null);
      setConfirmAction(null);
    } catch (error) {
      console.error('Error performing archive action:', error);
      showToast('Failed to perform action: ' + error.message, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const openStaffRequests = async (staff) => {
    setArchiveRequestsStaff(staff);
    setHandledRequests([]);
    setRequestsLoading(true);
    try {
      // Find requests previously assigned to / claimed by this staff member.
      const queries = [];
      if (staff.name) {
        queries.push(
          query(collection(db, 'requests'), where('assignedTo', '==', staff.name)),
          query(collection(db, 'requests'), where('claimedBy', '==', staff.name))
        );
      }

      if (queries.length === 0) {
        setHandledRequests([]);
        return;
      }

      const snapshots = await Promise.all(queries.map((q) => getDocs(q)));
      const merged = new Map();
      snapshots.forEach((snapshot) => {
        snapshot.docs.forEach((requestDoc) => {
          merged.set(requestDoc.id, { firestoreId: requestDoc.id, ...requestDoc.data() });
        });
      });

      const list = Array.from(merged.values()).sort((a, b) => {
        const at = a.createdAt?.toDate?.() || 0;
        const bt = b.createdAt?.toDate?.() || 0;
        return new Date(bt) - new Date(at);
      });
      setHandledRequests(list);
    } catch (error) {
      console.error('Error loading request history:', error);
      showToast('Could not load request history for this staff member.', 'error');
    } finally {
      setRequestsLoading(false);
    }
  };

  const confirmBtnLabel =
    actionLoading
      ? (confirmAction === 'archive' ? 'Archiving...' : confirmAction === 'delete' ? 'Deleting...' : 'Processing...')
      : isBulkAction
        ? (confirmAction === 'suspend'
            ? `${bulkSuspendTargetState ? 'Activate' : 'Suspend'} (${selectedStudentIds.length})`
            : confirmAction === 'delete'
              ? `Delete (${selectedStudentIds.length})`
              : `Archive (${selectedStudentIds.length})`)
        : confirmAction === 'suspend'
          ? ((selectedStudent?.isActive || selectedStaff?.isActive) ? 'Suspend' : 'Activate')
          : confirmAction === 'delete'
            ? 'Delete'
            : confirmAction === 'archive'
              ? 'Archive'
              : 'Restore';

  const isActivatingAccount =
    confirmAction === 'suspend' &&
    (isBulkAction
      ? bulkSuspendTargetState
      : !(selectedStudent?.isActive || selectedStaff?.isActive));

  const confirmBtnClass =
    confirmAction === 'delete' ? 'delete-confirm-btn'
      : confirmAction === 'archive' ? 'archive-confirm-btn'
        : confirmAction === 'restore' || isActivatingAccount ? 'restore-confirm-btn'
          : 'suspend-confirm-btn';

  // Render User Profile as a dedicated subpage within User Management
  if (selectedUserProfile) {
    return (
      <div className="superadmin-page user-management-container user-detail-view-container">
        {/* Navigation Header */}
        <div className="user-detail-header-nav">
          <button
            type="button"
            className="user-detail-back-btn"
            onClick={handleCloseUserProfile}
            title={`Return to ${selectedUserProfile.userType === 'student' ? 'Students' : 'Staff'} list`}
          >
            <FaArrowLeft className="back-btn-icon" />
            <span>Back to {selectedUserProfile.userType === 'student' ? 'Students' : 'Staff'}</span>
          </button>
          <div className="user-detail-header-actions">
            <NotificationBell />
          </div>
        </div>

        {/* User Profile Subpage Body */}
        <div className="user-profile-page-card">
          <div className="user-profile-container subpage-mode">
            {/* Left Panel: Profile Identity & Administrative Controls */}
            <div className="user-profile-left">
              {/* Avatar Section */}
              <div className="user-avatar-section">
                <div className="user-avatar-placeholder">
                  {selectedUserProfile.name?.charAt(0)?.toUpperCase() || '?'}
                </div>
                <h2 id="profile-subpage-user-name" className="user-profile-name">
                  {selectedUserProfile.name}
                </h2>
                <div className="user-profile-badges">
                  <span className="user-role-badge">
                    {selectedUserProfile.userType === 'student' ? (
                      <>
                        <FaUserGraduate className="badge-icon" /> Student
                      </>
                    ) : (
                      <>
                        <FaBuilding className="badge-icon" /> Staff
                      </>
                    )}
                  </span>
                  <span className={`profile-status-pill ${selectedUserProfile.isArchived ? 'archived' : selectedUserProfile.isActive !== false ? 'active' : 'suspended'}`}>
                    <span className="status-indicator-dot" />
                    {selectedUserProfile.isArchived ? 'Archived Account' : selectedUserProfile.isActive !== false ? 'Active Account' : 'Suspended Account'}
                  </span>
                </div>
              </div>

              {/* User Info Details */}
              <div className="user-info-section">
                {selectedUserProfile.userType === 'staff' && (
                  <div className="user-info-item">
                    <div className="user-info-icon-wrap">
                      <FaIdCard className="user-info-icon" />
                    </div>
                    <div className="user-info-content">
                      <label>STAFF USERNAME</label>
                      <div className="info-val-row">
                        <p>@{selectedUserProfile.username || 'N/A'}</p>
                        {selectedUserProfile.username && (
                          <button
                            type="button"
                            className="copy-mini-btn"
                            onClick={() => handleCopyText(selectedUserProfile.username, 'username')}
                            title="Copy Staff Username"
                          >
                            {copiedField === 'username' ? <FaCheck className="copied-check" /> : <FaCopy />}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {selectedUserProfile.userType === 'student' && (
                  <div className="user-info-item">
                    <div className="user-info-icon-wrap">
                      <FaIdCard className="user-info-icon" />
                    </div>
                    <div className="user-info-content">
                      <label>STUDENT ID</label>
                      <div className="info-val-row">
                        <p>{selectedUserProfile.id || 'N/A'}</p>
                        {selectedUserProfile.id && (
                          <button
                            type="button"
                            className="copy-mini-btn"
                            onClick={() => handleCopyText(selectedUserProfile.id, 'id')}
                            title="Copy Student ID"
                          >
                            {copiedField === 'id' ? <FaCheck className="copied-check" /> : <FaCopy />}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                <div className="user-info-item">
                  <div className="user-info-icon-wrap">
                    <FaEnvelope className="user-info-icon" />
                  </div>
                  <div className="user-info-content">
                    <label>EMAIL ADDRESS</label>
                    <div className="info-val-row">
                      <p title={selectedUserProfile.email}>{selectedUserProfile.email || 'N/A'}</p>
                      {selectedUserProfile.email && (
                        <button
                          type="button"
                          className="copy-mini-btn"
                          onClick={() => handleCopyText(selectedUserProfile.email, 'email')}
                          title="Copy email address"
                        >
                          {copiedField === 'email' ? <FaCheck className="copied-check" /> : <FaCopy />}
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {selectedUserProfile.userType === 'staff' && (
                  <div className="user-info-item">
                    <div className="user-info-icon-wrap">
                      <FaBuilding className="user-info-icon" />
                    </div>
                    <div className="user-info-content">
                      <label>ASSIGNED OFFICE</label>
                      <p>{selectedUserProfile.office || 'N/A'}</p>
                    </div>
                  </div>
                )}

                <div className="user-info-item">
                  <div className="user-info-icon-wrap">
                    <FaCalendarAlt className="user-info-icon" />
                  </div>
                  <div className="user-info-content">
                    <label>MEMBER SINCE</label>
                    <p>{selectedUserProfile.createdAt || 'N/A'}</p>
                  </div>
                </div>
              </div>

              {/* Administrative Action Section */}
              <div className="admin-action-section">
                <div className="admin-action-header">
                  <FaShieldAlt className="admin-action-shield" />
                  <span>ADMINISTRATIVE ACTIONS</span>
                </div>

                <div className="admin-action-buttons">
                  <button 
                    type="button"
                    className="admin-action-btn change-pw"
                    onClick={() => {
                      setUserToChangePassword(selectedUserProfile);
                      setShowChangePasswordModal(true);
                    }}
                  >
                    <FaKey /> Change Password
                  </button>

                  <button 
                    type="button"
                    className={`admin-action-btn ${selectedUserProfile.isActive !== false ? 'suspend' : 'activate'}`}
                    onClick={handleModalSuspendAction}
                  >
                    {selectedUserProfile.isActive !== false ? (
                      <>
                        <FaBan /> Suspend Account
                      </>
                    ) : (
                      <>
                        <FaCheck /> Activate Account
                      </>
                    )}
                  </button>

                  <button 
                    type="button"
                    className="admin-action-btn archive"
                    onClick={handleModalArchiveAction}
                  >
                    <FaArchive /> Archive User
                  </button>

                  <button 
                    type="button"
                    className="admin-action-btn delete"
                    onClick={handleModalDeleteAction}
                  >
                    <FaTrashAlt /> Delete Account
                  </button>
                </div>
              </div>
            </div>

            {/* Right Panel: Analytics, Cards & Activity History */}
            <div className="user-profile-right">
              <div className="user-profile-right-header">
                <div>
                  <h3 className="profile-overview-title">Account Overview & Insights</h3>
                  <p className="profile-overview-desc">Performance metrics, status overview, and system audit trail.</p>
                </div>
              </div>

              {/* Stats Cards Grid */}
              <div className="user-stats-grid">
                {selectedUserProfile.userType === 'staff' ? (
                  <>
                    <div className="user-stat-card stat-handled">
                      <div className="stat-card-top">
                        <span className="stat-card-label">TICKETS HANDLED</span>
                        <div className="stat-card-icon-wrap">
                          <FaTicketAlt className="stat-icon" />
                        </div>
                      </div>
                      <div className="stat-value">{staffStats.totalTickets}</div>
                      <p className="stat-period">All-time handled tickets</p>
                    </div>

                    <div className="user-stat-card stat-time">
                      <div className="stat-card-top">
                        <span className="stat-card-label">AVG. RESOLUTION</span>
                        <div className="stat-card-icon-wrap">
                          <FaClock className="stat-icon" />
                        </div>
                      </div>
                      <div className="stat-value text-xl">{staffStats.avgResponseTime}</div>
                      <p className="stat-period">Resolution efficiency</p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="user-stat-card stat-handled">
                      <div className="stat-card-top">
                        <span className="stat-card-label">TOTAL REQUESTS</span>
                        <div className="stat-card-icon-wrap">
                          <FaTicketAlt className="stat-icon" />
                        </div>
                      </div>
                      <div className="stat-value">{studentStats.totalTickets}</div>
                      <p className="stat-period">All-time request submissions</p>
                    </div>

                    <div className="user-stat-card stat-status">
                      <div className="stat-card-top">
                        <span className="stat-card-label">PORTAL ACCESS</span>
                        <div className="stat-card-icon-wrap">
                          <FaShieldAlt className="stat-icon" />
                        </div>
                      </div>
                      <div className="stat-value text-lg">
                        {selectedUserProfile.isActive !== false ? 'Permitted' : 'Restricted'}
                      </div>
                      <p className="stat-period">Student login authorization</p>
                    </div>
                  </>
                )}

                {/* Account Standing: Active / Suspended / Archived */}
                <div className={`user-stat-card stat-lifecycle ${
                  selectedUserProfile.isArchived 
                    ? 'is-archived' 
                    : selectedUserProfile.isActive === false 
                    ? 'is-suspended' 
                    : 'is-active'
                }`}>
                  <div className="stat-card-top">
                    <span className="stat-card-label">ACCOUNT STANDING</span>
                    <div className="stat-card-icon-wrap">
                      {selectedUserProfile.isArchived ? (
                        <FaArchive className="stat-icon" />
                      ) : selectedUserProfile.isActive === false ? (
                        <FaBan className="stat-icon" />
                      ) : (
                        <FaCheckCircle className="stat-icon" />
                      )}
                    </div>
                  </div>
                  <div className="stat-value text-lg">
                    {selectedUserProfile.isArchived 
                      ? 'Archived' 
                      : selectedUserProfile.isActive === false 
                      ? 'Suspended' 
                      : 'Active'}
                  </div>
                  <p className="stat-period">
                    {selectedUserProfile.isArchived 
                      ? 'Moved to school archive' 
                      : selectedUserProfile.isActive === false 
                      ? 'Account access disabled' 
                      : selectedUserProfile.restoredAt 
                      ? 'Restored to directory' 
                      : 'Active in directory'}
                  </p>
                </div>

                {/* Password & Credential Security */}
                <div className="user-stat-card stat-security">
                  <div className="stat-card-top">
                    <span className="stat-card-label">PASSWORD STATUS</span>
                    <div className="stat-card-icon-wrap">
                      <FaKey className="stat-icon" />
                    </div>
                  </div>
                  <div className="stat-value text-lg">
                    {selectedUserProfile.mustChangePassword === true
                      ? 'Pending Change'
                      : (selectedUserProfile.passwordChangedAt || selectedUserProfile.mustChangePassword === false)
                      ? 'Changed & Secured'
                      : 'Active Credentials'}
                  </div>
                  <p className="stat-period">
                    {selectedUserProfile.mustChangePassword === true
                      ? 'Temporary default password'
                      : selectedUserProfile.passwordChangedAt
                      ? 'User updated password'
                      : selectedUserProfile.mustChangePassword === false
                      ? 'Verified credentials set'
                      : 'Security credentials active'}
                  </p>
                </div>
              </div>

              {/* Activity History Timeline & Audit Trail */}
              <div className="activity-history-section">
                <div className="activity-history-header">
                  <div className="activity-title-wrap">
                    <FaHistory className="history-icon" />
                    <div>
                      <h4>System Activity History & Audit Trail</h4>
                      <p className="activity-header-sub">Chronological event log and security audit trail</p>
                    </div>
                  </div>
                  <div className="activity-header-actions">
                    <span className="activity-count-badge">
                      {filteredActivityLogs.length} of {userActivityLogs.length} {userActivityLogs.length === 1 ? 'event' : 'events'}
                    </span>
                  </div>
                </div>

                {/* Filter & Search Toolbar */}
                <div className="activity-toolbar">
                  <div className="activity-search-box">
                    <FaSearch className="activity-search-icon" />
                    <input
                      type="text"
                      className="activity-search-input"
                      placeholder="Search logs by action, ticket ID, or date..."
                      value={activitySearchTerm}
                      onChange={(e) => setActivitySearchTerm(e.target.value)}
                    />
                    {activitySearchTerm && (
                      <button 
                        type="button" 
                        className="activity-clear-search-btn"
                        onClick={() => setActivitySearchTerm('')}
                        aria-label="Clear search"
                      >
                        <FaTimes />
                      </button>
                    )}
                  </div>

                  <div className="activity-category-pills">
                    <button
                      type="button"
                      className={`activity-pill ${activityCategoryFilter === 'all' ? 'active' : ''}`}
                      onClick={() => setActivityCategoryFilter('all')}
                    >
                      All ({userActivityLogs.length})
                    </button>
                    <button
                      type="button"
                      className={`activity-pill ${activityCategoryFilter === 'tickets' ? 'active' : ''}`}
                      onClick={() => setActivityCategoryFilter('tickets')}
                    >
                      Requests ({countTickets})
                    </button>
                    <button
                      type="button"
                      className={`activity-pill ${activityCategoryFilter === 'security' ? 'active' : ''}`}
                      onClick={() => setActivityCategoryFilter('security')}
                    >
                      Security ({countSecurity})
                    </button>
                    <button
                      type="button"
                      className={`activity-pill ${activityCategoryFilter === 'admin' ? 'active' : ''}`}
                      onClick={() => setActivityCategoryFilter('admin')}
                    >
                      Admin ({countAdmin})
                    </button>
                  </div>
                </div>
                
                {loadingUserProfile ? (
                  <DataTableSkeleton columns={5} rows={4} hasPagination={false} />
                ) : filteredActivityLogs.length === 0 ? (
                  <div className="activity-empty">
                    <div className="empty-icon-wrap">
                      <FaHistory />
                    </div>
                    <p className="empty-primary">
                      {activitySearchTerm || activityCategoryFilter !== 'all'
                        ? 'No matching activity logs found'
                        : 'No recent activity logs recorded yet'}
                    </p>
                    <p className="empty-secondary">
                      {activitySearchTerm || activityCategoryFilter !== 'all'
                        ? 'Try clearing your search query or selecting a different category filter.'
                        : 'Ticket submissions, resolutions, password updates, and administrative changes for this account will appear here.'}
                    </p>
                    {(activitySearchTerm || activityCategoryFilter !== 'all') && (
                      <button
                        type="button"
                        className="activity-reset-filters-btn"
                        onClick={() => {
                          setActivitySearchTerm('');
                          setActivityCategoryFilter('all');
                        }}
                      >
                        Reset Filters
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="activity-log-list">
                    {(showAllLogs ? filteredActivityLogs : filteredActivityLogs.slice(0, 5)).map((log, idx) => {
                      const { dateStr, relativeStr } = formatActivityTimestamp(log.timestamp);
                      return (
                        <div key={log.id || idx} className={`activity-log-item cat-${log.category || 'general'}`}>
                          <div className="activity-timeline-marker">
                            <div className={`activity-icon-bubble ${log.category || 'general'}`}>
                              {renderActivityCategoryIcon(log.category)}
                            </div>
                            {idx < (showAllLogs ? filteredActivityLogs.length - 1 : Math.min(filteredActivityLogs.length, 5) - 1) && (
                              <div className="activity-timeline-line" />
                            )}
                          </div>
                          <div className="activity-details">
                            <div className="activity-action-row">
                              <p className="activity-action">{log.action || 'System activity recorded'}</p>
                              {relativeStr && <span className="activity-relative-pill">{relativeStr}</span>}
                            </div>
                            {log.details && (
                              <p className="activity-sub-detail">{log.details}</p>
                            )}
                            <div className="activity-meta-row">
                              <span className="activity-time" title={dateStr}>
                                <FaClock className="meta-icon" /> {dateStr}
                              </span>
                              {log.status && (
                                <span className={`activity-status-chip ${log.status.toLowerCase()}`}>
                                  {log.status}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    <div className="activity-footer-controls">
                      {filteredActivityLogs.length > 5 && (
                        <button 
                          type="button" 
                          className="toggle-logs-btn"
                          onClick={() => setShowAllLogs(prev => !prev)}
                        >
                          <FaListAlt /> {showAllLogs ? 'Show Less' : `View All (${filteredActivityLogs.length}) Logs`}
                        </button>
                      )}
                      <button
                        type="button"
                        className="toggle-logs-btn secondary"
                        onClick={() => setShowFullAuditModal(true)}
                      >
                        <FaExternalLinkAlt /> Full Audit Explorer
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Dedicated Full Audit Log Explorer Modal */}
        {showFullAuditModal && selectedUserProfile && (
          <div 
            className="create-student-modal full-audit-modal-backdrop"
            onClick={(e) => { if (e.target === e.currentTarget) setShowFullAuditModal(false); }}
          >
            <div className="modal-content-super full-audit-modal" role="dialog" aria-modal="true" aria-labelledby="full-audit-title-sub">
              {/* Modal Header */}
              <div className="full-audit-header">
                <div className="full-audit-header-title-group">
                  <div className="audit-header-icon-wrap">
                    <FaHistory />
                  </div>
                  <div>
                    <h3 id="full-audit-title-sub" className="full-audit-title">Audit Trail & System Activity Explorer</h3>
                    <p className="full-audit-subtitle">
                      Complete audit records for <strong>{selectedUserProfile.name}</strong> • {selectedUserProfile.email || selectedUserProfile.id || 'N/A'}
                    </p>
                  </div>
                </div>
                <div className="full-audit-header-actions">
                  <button
                    type="button"
                    className="full-audit-export-btn"
                    onClick={handleExportAuditCSV}
                    disabled={filteredActivityLogs.length === 0}
                    title="Export audit log to CSV"
                  >
                    <FaDownload /> <span>Export CSV</span>
                  </button>
                  <button
                    type="button"
                    className="modal-close-btn full-audit-close-btn"
                    onClick={() => setShowFullAuditModal(false)}
                    aria-label="Close audit explorer"
                  >
                    <FaTimes />
                  </button>
                </div>
              </div>

              {/* Summary Metrics Strip */}
              <div className="audit-metrics-strip">
                <div className="audit-metric-tile">
                  <span className="audit-metric-label">TOTAL EVENTS</span>
                  <span className="audit-metric-val">{userActivityLogs.length}</span>
                </div>
                <div className="audit-metric-tile">
                  <span className="audit-metric-label">TICKETS & REQUESTS</span>
                  <span className="audit-metric-val">{countTickets}</span>
                </div>
                <div className="audit-metric-tile">
                  <span className="audit-metric-label">SECURITY & ACCESS</span>
                  <span className="audit-metric-val">{countSecurity}</span>
                </div>
                <div className="audit-metric-tile">
                  <span className="audit-metric-label">ACCOUNT STATUS</span>
                  <span className={`audit-metric-pill ${selectedUserProfile.isArchived ? 'archived' : selectedUserProfile.isActive !== false ? 'active' : 'suspended'}`}>
                    {selectedUserProfile.isArchived ? 'Archived' : selectedUserProfile.isActive !== false ? 'Active' : 'Suspended'}
                  </span>
                </div>
              </div>

              {/* Filter & Search Bar */}
              <div className="full-audit-filter-bar">
                <div className="full-audit-search-wrap">
                  <FaSearch className="audit-search-icon" />
                  <input
                    type="text"
                    className="full-audit-search-input"
                    placeholder="Filter logs by keyword, ticket reference, action type, or date..."
                    value={activitySearchTerm}
                    onChange={(e) => setActivitySearchTerm(e.target.value)}
                  />
                  {activitySearchTerm && (
                    <button 
                      type="button" 
                      className="activity-clear-search-btn"
                      onClick={() => setActivitySearchTerm('')}
                    >
                      <FaTimes />
                    </button>
                  )}
                </div>

                <div className="full-audit-pills">
                  <button
                    type="button"
                    className={`full-audit-pill ${activityCategoryFilter === 'all' ? 'active' : ''}`}
                    onClick={() => setActivityCategoryFilter('all')}
                  >
                    All ({userActivityLogs.length})
                  </button>
                  <button
                    type="button"
                    className={`full-audit-pill ${activityCategoryFilter === 'tickets' ? 'active' : ''}`}
                    onClick={() => setActivityCategoryFilter('tickets')}
                  >
                    Requests ({countTickets})
                  </button>
                  <button
                    type="button"
                    className={`full-audit-pill ${activityCategoryFilter === 'security' ? 'active' : ''}`}
                    onClick={() => setActivityCategoryFilter('security')}
                  >
                    Security ({countSecurity})
                  </button>
                  <button
                    type="button"
                    className={`full-audit-pill ${activityCategoryFilter === 'admin' ? 'active' : ''}`}
                    onClick={() => setActivityCategoryFilter('admin')}
                  >
                    Administrative ({countAdmin})
                  </button>
                </div>
              </div>

              {/* Audit Logs Table / Feed */}
              <div className="full-audit-body">
                {filteredActivityLogs.length === 0 ? (
                  <div className="full-audit-empty">
                    <div className="empty-icon-wrap">
                      <FaHistory />
                    </div>
                    <p className="empty-primary">No audit records found</p>
                    <p className="empty-secondary">
                      {activitySearchTerm || activityCategoryFilter !== 'all'
                        ? 'No events match the current filter criteria.'
                        : 'No activity logs have been recorded for this user yet.'}
                    </p>
                    {(activitySearchTerm || activityCategoryFilter !== 'all') && (
                      <button
                        type="button"
                        className="activity-reset-filters-btn"
                        onClick={() => {
                          setActivitySearchTerm('');
                          setActivityCategoryFilter('all');
                        }}
                      >
                        Reset Filters
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="full-audit-table-wrapper">
                    <table className="full-audit-table">
                      <thead>
                        <tr>
                          <th style={{ width: '130px' }}>TIMESTAMP</th>
                          <th style={{ width: '120px' }}>CATEGORY</th>
                          <th>ACTION & DETAILS</th>
                          <th style={{ width: '110px' }}>STATUS</th>
                          <th style={{ width: '110px' }}>EVENT ID</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredActivityLogs.map((log, idx) => {
                          const { dateStr, relativeStr } = formatActivityTimestamp(log.timestamp);
                          return (
                            <tr key={log.id || idx}>
                              <td className="audit-cell-time">
                                <div className="time-primary">{relativeStr}</div>
                                <div className="time-secondary">{dateStr}</div>
                              </td>
                              <td>
                                <span className={`audit-cat-tag ${log.category || 'general'}`}>
                                  {renderActivityCategoryIcon(log.category)}
                                  <span>{log.category === 'tickets' ? 'Request' : log.category === 'security' ? 'Security' : log.category === 'admin' ? 'Admin' : 'General'}</span>
                                </span>
                              </td>
                              <td className="audit-cell-desc">
                                <div className="audit-action-title">{log.action || 'System activity'}</div>
                                {log.details && (
                                  <div className="audit-action-details">{log.details}</div>
                                )}
                              </td>
                              <td>
                                <span className={`audit-status-badge ${log.status ? log.status.toLowerCase() : 'success'}`}>
                                  {log.status || 'Logged'}
                                </span>
                              </td>
                              <td>
                                <code className="audit-event-id">
                                  {log.id ? String(log.id).slice(0, 10) : `evt-${idx}`}
                                </code>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="full-audit-footer">
                <span className="audit-footer-info">
                  Showing {filteredActivityLogs.length} of {userActivityLogs.length} total recorded events for this account.
                </span>
                <button
                  type="button"
                  className="full-audit-close-footer-btn"
                  onClick={() => setShowFullAuditModal(false)}
                >
                  Close Explorer
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Change Password Modal */}
        {showChangePasswordModal && userToChangePassword && (
          <ChangePasswordModal
            user={userToChangePassword}
            onClose={() => {
              setShowChangePasswordModal(false);
              setUserToChangePassword(null);
            }}
            onPasswordChanged={() => {
              setShowChangePasswordModal(false);
              setUserToChangePassword(null);
              showToast('Password updated successfully!');
            }}
          />
        )}

        {/* Confirmation Modal (Suspend / Archive / Delete triggered in profile) */}
        {showConfirmModal && (selectedStudent || selectedStaff || isBulkAction) && (
          <div className="create-student-modal">
            <div className="modal-content confirm-modal">
              {confirmAction === 'archive' || confirmAction === 'restore' ? (
                confirmAction === 'archive' ? (
                  <FaArchive className="confirm-icon archive-icon" aria-hidden="true" />
                ) : (
                  <FaUndo className="confirm-icon" aria-hidden="true" />
                )
              ) : confirmAction === 'delete' ? (
                <FaKey className="confirm-icon" aria-hidden="true" />
              ) : isActivatingAccount ? (
                <FaCheck className="confirm-icon" aria-hidden="true" />
              ) : (
                <FaBan className="confirm-icon suspend-icon" aria-hidden="true" />
              )}
              <h2 className="confirm-title">
                {confirmAction === 'archive'
                  ? `Archive ${selectedStudent ? 'Student' : 'Staff'} Account?`
                  : confirmAction === 'delete'
                    ? `Delete ${selectedStudent ? 'Student' : 'Staff'} Account?`
                    : confirmAction === 'restore'
                      ? 'Restore Staff Account?'
                      : `${(selectedStudent?.isActive || selectedStaff?.isActive) ? 'Suspend' : 'Activate'} ${selectedStudent ? 'Student' : 'Staff'} Account?`}
              </h2>
              <div className="confirm-body">
                <p>
                  {confirmAction === 'archive'
                    ? selectedStudent
                      ? `Archiving will remove ${selectedStudent.name} from the active student directory and archive their submitted requests. This can be viewed in the Archive tab.`
                      : `Archiving will mark ${selectedStaff?.name} as archived. Their past handled requests remain intact and they can be restored at any time.`
                    : confirmAction === 'delete'
                      ? `Are you sure you want to permanently delete this account? This action cannot be undone.`
                      : confirmAction === 'restore'
                        ? `Restoring will re-enable ${selectedStaff?.name}'s account and return them to the active staff list.`
                        : `Are you sure you want to ${(selectedStudent?.isActive || selectedStaff?.isActive) ? 'suspend' : 'activate'} this account?`}
                </p>
                <div className="confirm-user-info">
                  {selectedStudent ? (
                    <>
                      <p><strong>Student ID:</strong> {selectedStudent.id}</p>
                      <p><strong>Name:</strong> {selectedStudent.name}</p>
                      <p><strong>Email:</strong> {selectedStudent.email}</p>
                    </>
                  ) : (
                    <>
                      <p><strong>Name:</strong> {selectedStaff?.name}</p>
                      <p><strong>Email:</strong> {selectedStaff?.email}</p>
                      {selectedStaff?.office && <p><strong>Office:</strong> {selectedStaff?.office}</p>}
                    </>
                  )}
                </div>
              </div>
              <div className="modal-actions">
                <button className="cancel-btn-super" onClick={cancelConfirm} disabled={actionLoading}>
                  Cancel
                </button>
                <button
                  className={confirmBtnClass}
                  onClick={confirmAction === 'archive' || confirmAction === 'restore' ? confirmArchiveOrRestore : confirmSuspendOrDelete}
                  disabled={actionLoading}
                >
                  {actionLoading ? 'Processing...' : confirmBtnLabel}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Toast modal notification */}
        {toast && (
          <Toast
            type={toast.type}
            message={toast.message}
            title={toast.title}
            confirmText={toast.confirmText}
            onClose={handleCloseToast}
          />
        )}
      </div>
    );
  }

  return (
    <div className="superadmin-page user-management-container">
      <div className="page-header">
        <div className="page-header-title-group">
          <h1 className="user-management-title">User Management</h1>
          <p className="page-subtitle">
            {activeTab === 'archive'
              ? 'View and restore archived student and staff accounts and their request history'
              : 'Create, suspend, or remove student and staff accounts'}
          </p>
        </div>
        <div className="header-actions">
          {(activeTab === 'students' || activeTab === 'staff') && (
            <button className="btn-primary create-student-btn" onClick={activeTab === 'students' ? handleNewStudent : handleNewStaff}>
              <FaUserPlus aria-hidden="true" />
              {activeTab === 'students' ? 'Create Student Account' : 'Create Staff Account'}
            </button>
          )}
          <NotificationBell />
        </div>
      </div>

      {/* Tabs */}
      <div className="user-tabs-row">
        <div className="user-tabs">
          <button
            className={`user-tab ${activeTab === 'students' ? 'active' : ''}`}
            onClick={() => { setActiveTab('students'); resetPagination(); setSelectedStudentIds([]);setSelectAllStudents(false); }}
          >
            Students
          </button>
          <button
            className={`user-tab ${activeTab === 'staff' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('staff');
              resetPagination();
              setSelectedStaffIds([]);
              setSelectAllStaff(false);
              if (sortOrder === 'idAsc' || sortOrder === 'idDesc') setSortOrder('recent');
            }}
          >
            Staff Members
          </button>
          <button
            className={`user-tab ${activeTab === 'archive' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('archive');
              resetPagination();
              if (sortOrder === 'idAsc' || sortOrder === 'idDesc') setSortOrder('recent');
            }}
          >
            Archive
          </button>
        </div>
      </div>

      {activeTab === 'archive' ? (
        <Archive isEmbedded={true} />
      ) : (
        <>
          {/* Search + filter */}
          <div className="user-filters-row">
            <div className="search-bar">
              <FaSearch className="search-icon" aria-hidden="true" />
              <input
                type="search"
                name="account-search"
                placeholder={activeTab === 'students' ? 'Search by student name or ID...' : 'Search by staff name or username...'}
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); resetPagination(); }}
            aria-label="Search accounts"
          />
        </div>

        <div className="status-filter-wrap" ref={filterWrapRef}>
          <button
            type="button"
            className={`filter-trigger ${statusFilter !== 'All' ? 'active' : ''}`}
            onClick={() => setIsFilterOpen((prev) => !prev)}
            aria-haspopup="listbox"
            aria-expanded={isFilterOpen}
            aria-label="Filter accounts by status"
          >
            <FaFilter className="filter-icon" aria-hidden="true" />
            Status
            {statusFilter !== 'All' && <span className="filter-active-dot" aria-hidden="true" />}
            <FaChevronDown className={`filter-chevron ${isFilterOpen ? 'open' : ''}`} aria-hidden="true" />
          </button>

          {isFilterOpen && (
            <div className="filter-dropdown-panel" role="listbox" aria-label="Filter by status">
              <div className="filter-dropdown-title">Filter by status</div>
              {['All', 'Active', 'Suspended'].map((option) => (
                <button
                  key={option}
                  type="button"
                  role="option"
                  aria-selected={statusFilter === option}
                  className={`status-option ${statusFilter === option ? 'selected' : ''}`}
                  onClick={() => { setStatusFilter(option); setIsFilterOpen(false); resetPagination(); }}
                >
                  <span className="status-option-check">
                    {statusFilter === option && <FaCheck aria-hidden="true" />}
                  </span>
                  {option}
                </button>
              ))}
              {statusFilter !== 'All' && (
                <div className="filter-dropdown-actions">
                  <button
                    type="button"
                    className="filter-clear-btn"
                    onClick={() => { setStatusFilter('All'); setIsFilterOpen(false); resetPagination(); }}
                  >
                    <FaTimes aria-hidden="true" /> Clear
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {activeTab === 'students' && (
          <div className="status-filter-wrap date-filter-wrap" ref={dateWrapRef}>
            <button
              type="button"
              className={`filter-trigger ${isDateFilterActive ? 'active' : ''}`}
              onClick={() => setIsDateOpen((prev) => !prev)}
              aria-haspopup="dialog"
              aria-expanded={isDateOpen}
              aria-label="Filter students by date of creation"
            >
              <FaCalendarAlt className="filter-icon" aria-hidden="true" />
              {getDateTriggerLabel()}
              {isDateFilterActive && <span className="filter-active-dot" aria-hidden="true" />}
              <FaChevronDown className={`filter-chevron ${isDateOpen ? 'open' : ''}`} aria-hidden="true" />
            </button>

            {isDateOpen && (
              <div className="filter-dropdown-panel date-filter-panel" role="dialog" aria-label="Filter by date of creation">
                <div className="filter-dropdown-title">Filter by Date of Creation</div>

                <div className="date-presets-list">
                  {DATE_PRESET_OPTIONS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      className={`status-option ${dateFilter.preset === preset.id ? 'selected' : ''}`}
                      onClick={() => handleSelectDatePreset(preset.id)}
                    >
                      <span className="status-option-check">
                        {dateFilter.preset === preset.id && <FaCheck aria-hidden="true" />}
                      </span>
                      {preset.label}
                    </button>
                  ))}
                </div>

                <div className="custom-date-range-section">
                  <div className="custom-date-range-header">Custom Date Range</div>
                  <div className="date-filter-field">
                    <label htmlFor="student-date-from">From</label>
                    <input
                      id="student-date-from"
                      type="date"
                      value={dateFilter.from}
                      max={dateFilter.to || undefined}
                      onChange={(e) => handleCustomDateChange('from', e.target.value)}
                    />
                  </div>
                  <div className="date-filter-field">
                    <label htmlFor="student-date-to">To</label>
                    <input
                      id="student-date-to"
                      type="date"
                      value={dateFilter.to}
                      min={dateFilter.from || undefined}
                      onChange={(e) => handleCustomDateChange('to', e.target.value)}
                    />
                  </div>
                </div>

                {isDateFilterActive && (
                  <div className="filter-dropdown-actions">
                    <button
                      type="button"
                      className="filter-clear-btn"
                      onClick={handleClearDateFilter}
                    >
                      <FaTimes aria-hidden="true" /> Clear Date Filter
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'staff' || activeTab === 'archivedStaff' ? (
          <div className="status-filter-wrap" ref={officeWrapRef}>
            <button
              type="button"
              className={`filter-trigger ${officeFilter !== 'All' ? 'active' : ''}`}
              onClick={() => setIsOfficeOpen((prev) => !prev)}
              aria-haspopup="listbox"
              aria-expanded={isOfficeOpen}
              aria-label="Filter staff by office"
            >
              <FaBuilding className="filter-icon" aria-hidden="true" />
              Office
              {officeFilter !== 'All' && <span className="filter-active-dot" aria-hidden="true" />}
              <FaChevronDown className={`filter-chevron ${isOfficeOpen ? 'open' : ''}`} aria-hidden="true" />
            </button>

            {isOfficeOpen && (
              <div className="filter-dropdown-panel" role="listbox" aria-label="Filter by office">
                <div className="filter-dropdown-title">Filter by office</div>
                {['All', ...offices.map((o) => o.name)].map((option) => (
                  <button
                    key={option}
                    type="button"
                    role="option"
                    aria-selected={officeFilter === option}
                    className={`status-option ${officeFilter === option ? 'selected' : ''}`}
                    onClick={() => { setOfficeFilter(option); setIsOfficeOpen(false); resetPagination(); }}
                  >
                    <span className="status-option-check">
                      {officeFilter === option && <FaCheck aria-hidden="true" />}
                    </span>
                    {option}
                  </button>
                ))}
                {officeFilter !== 'All' && (
                  <div className="filter-dropdown-actions">
                    <button
                      type="button"
                      className="filter-clear-btn"
                      onClick={() => { setOfficeFilter('All'); setIsOfficeOpen(false); resetPagination(); }}
                    >
                      <FaTimes aria-hidden="true" /> Clear
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : null}

        <div className="status-filter-wrap" ref={sortWrapRef}>
          <button
            type="button"
            className={`filter-trigger ${sortOrder !== 'recent' ? 'active' : ''}`}
            onClick={() => setIsSortOpen((prev) => !prev)}
            aria-haspopup="listbox"
            aria-expanded={isSortOpen}
            aria-label="Sort accounts"
          >
            <FaSortAlphaDown className="filter-icon" aria-hidden="true" />
            Sort
            {sortOrder !== 'recent' && <span className="filter-active-dot" aria-hidden="true" />}
            <FaChevronDown className={`filter-chevron ${isSortOpen ? 'open' : ''}`} aria-hidden="true" />
          </button>

          {isSortOpen && (
            <div className="filter-dropdown-panel" role="listbox" aria-label="Sort accounts">
              <div className="filter-dropdown-title">
                {activeTab === 'students' ? 'Sort students' : 'Sort staff'}
              </div>
              {(activeTab === 'students'
                ? [
                    { value: 'recent', label: 'Recently Created' },
                    { value: 'idAsc', label: 'ID Number (Ascending)' },
                    { value: 'idDesc', label: 'ID Number (Descending)' },
                    { value: 'az', label: 'Name (A to Z)' },
                    { value: 'za', label: 'Name (Z to A)' }
                  ]
                : [
                    { value: 'recent', label: 'Recently Created' },
                    { value: 'az', label: 'Name (A to Z)' },
                    { value: 'za', label: 'Name (Z to A)' }
                  ]
              ).map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={sortOrder === option.value}
                  className={`status-option ${sortOrder === option.value ? 'selected' : ''}`}
                  onClick={() => { setSortOrder(option.value); setIsSortOpen(false); resetPagination(); }}
                >
                  <span className="status-option-check">
                    {sortOrder === option.value && <FaCheck aria-hidden="true" />}
                  </span>
                  {option.label}
                </button>
              ))}
              {sortOrder !== 'recent' && (
                <div className="filter-dropdown-actions">
                  <button
                    type="button"
                    className="filter-clear-btn"
                    onClick={() => { setSortOrder('recent'); setIsSortOpen(false); resetPagination(); }}
                  >
                    <FaTimes aria-hidden="true" /> Clear
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {showConfirmModal && (selectedStudent || selectedStaff || isBulkAction) && (
        <div className="create-student-modal">
          <div className="modal-content confirm-modal">
            {confirmAction === 'archive' || confirmAction === 'restore' ? (
              confirmAction === 'archive' ? (
                <FaArchive className="confirm-icon archive-icon" aria-hidden="true" />
              ) : (
                <FaUndo className="confirm-icon" aria-hidden="true" />
              )
            ) : confirmAction === 'delete' ? (
              <FaKey className="confirm-icon" aria-hidden="true" />
            ) : isActivatingAccount ? (
              <FaCheck className="confirm-icon" aria-hidden="true" />
            ) : (
              <FaBan className="confirm-icon suspend-icon" aria-hidden="true" />
            )}
            <h2 className="confirm-title">
              {isBulkAction
                ? (confirmAction === 'archive'
                    ? `Archive ${selectedStudentIds.length} Student Accounts?`
                    : confirmAction === 'delete'
                      ? `Delete ${selectedStudentIds.length} Student Accounts?`
                      : `${bulkSuspendTargetState ? 'Activate' : 'Suspend'} ${selectedStudentIds.length} Student Accounts?`)
                : confirmAction === 'archive'
                  ? `Archive ${selectedStudent ? 'Student' : 'Staff'} Account?`
                  : confirmAction === 'restore'
                    ? 'Restore Staff Account?'
                    : confirmAction === 'suspend'
                      ? ((selectedStudent?.isActive || selectedStaff?.isActive) ? 'Suspend Account?' : 'Activate Account?')
                      : 'Delete Account?'}
            </h2>
            <p className="confirm-message">
              {isBulkAction
                ? (confirmAction === 'archive'
                    ? `Are you sure you want to archive ${selectedStudentIds.length} selected student account(s)? Their accounts and related requests will be moved to Archive.`
                    : confirmAction === 'delete'
                      ? `Are you sure you want to permanently delete ${selectedStudentIds.length} selected student account(s) from the database? This action cannot be undone.`
                      : `Are you sure you want to ${bulkSuspendTargetState ? 'activate' : 'suspend'} ${selectedStudentIds.length} selected student account(s)? ${bulkSuspendTargetState ? 'They will be able to log in again.' : 'They will not be able to log in until reactivated.'}`)
                : confirmAction === 'archive'
                  ? (selectedStudent
                      ? `Are you sure you want to archive ${selectedStudent.name}'s account? Their account and related requests will be moved to Archive.`
                      : `Are you sure you want to archive ${selectedStaff?.name}'s account? They will be moved to Archive and will no longer be able to log in. Their request history will be kept unchanged.`)
                  : confirmAction === 'restore'
                    ? `Are you sure you want to restore ${selectedStaff?.name} to Active Staff? They will be able to log in again and their request history stays intact.`
                    : confirmAction === 'suspend'
                      ? ((selectedStudent?.isActive || selectedStaff?.isActive)
                          ? `Are you sure you want to suspend ${(selectedStudent || selectedStaff).name}'s account? They will not be able to log in until reactivated.`
                          : `Are you sure you want to activate ${(selectedStudent || selectedStaff).name}'s account? They will be able to log in again.`)
                      : `Are you sure you want to permanently delete ${(selectedStudent || selectedStaff).name}'s account? This action cannot be undone.`}
            </p>
            <div className="student-info-box">
              {isBulkAction ? (
                <div className="bulk-confirm-preview">
                  <div className="bulk-confirm-subtitle">
                    Selected Students ({selectedStudentIds.length}):
                  </div>
                  <div className="bulk-confirm-tags">
                    {students
                      .filter((s) => selectedStudentIds.includes(s.firestoreId))
                      .slice(0, 6)
                      .map((s) => (
                        <span key={s.firestoreId} className="bulk-confirm-tag">
                          {s.name} ({s.id})
                        </span>
                      ))}
                    {selectedStudentIds.length > 6 && (
                      <span className="bulk-confirm-tag more">
                        +{selectedStudentIds.length - 6} more
                      </span>
                    )}
                  </div>
                </div>
              ) : selectedStudent ? (
                <>
                  <p><strong>Student ID:</strong> {selectedStudent.id}</p>
                  <p><strong>Name:</strong> {selectedStudent.name}</p>
                  <p><strong>Email:</strong> {selectedStudent.email}</p>
                </>
              ) : (
                <>
                  <p><strong>Name:</strong> {selectedStaff?.name}</p>
                  <p><strong>Email:</strong> {selectedStaff?.email}</p>
                  {selectedStaff?.office && <p><strong>Office:</strong> {selectedStaff?.office}</p>}
                </>
              )}
            </div>
            <div className="modal-actions">
              <button className="cancel-btn-super" onClick={cancelConfirm} disabled={actionLoading}>
                Cancel
              </button>
              <button
                className={confirmBtnClass}
                onClick={
                  isBulkAction
                    ? handleConfirmBulkAction
                    : (confirmAction === 'archive' || confirmAction === 'restore' ? confirmArchiveOrRestore : confirmSuspendOrDelete)
                }
                disabled={actionLoading}
              >
                {confirmBtnLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      {showSuccessModal && (createdStudent || createdStaff) && (
        <div className="create-student-modal">
          <div className="modal-content success-modal">
            <div className="success-header">
              <FaCheck className="success-icon" />
              <h2 className="success-title">Account Created Successfully!</h2>
            </div>
            
            <p className="success-message">
              The {createdStudent ? 'student' : 'staff'} account has been created and login credentials have been sent to the email address.
            </p>

            <div className="credentials-box">
              {createdStudent ? (
                <>
                  <div className="credential-row">
                    <label className="credential-label">Student ID:</label>
                    <span className="credential-value">{createdStudent.id}</span>
                  </div>
                  
                  <div className="credential-row">
                    <label className="credential-label">Full Name:</label>
                    <span className="credential-value">{createdStudent.name}</span>
                  </div>
                  
                  <div className="credential-row">
                    <label className="credential-label">Email Sent To:</label>
                    <span className="credential-value">{createdStudent.email}</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="credential-row">
                    <label className="credential-label">Full Name:</label>
                    <span className="credential-value">{createdStaff.name}</span>
                  </div>
                  
                  <div className="credential-row">
                    <label className="credential-label">Username:</label>
                    <span className="credential-value">{createdStaff.username}</span>
                  </div>
                  
                  <div className="credential-row">
                    <label className="credential-label">Office:</label>
                    <span className="credential-value">{createdStaff.office}</span>
                  </div>
                  
                  <div className="credential-row">
                    <label className="credential-label">Email Sent To:</label>
                    <span className="credential-value">{createdStaff.email}</span>
                  </div>
                </>
              )}
            </div>

            <div className="success-warning">
              <FaEnvelope className="warning-icon" />
              <p>The {createdStudent ? 'student' : 'staff member'} should receive an email with their login credentials shortly. Please ask them to check their inbox (and spam folder).</p>
            </div>

            <div className="modal-actions">
              <button className="success-close-btn" onClick={handleCloseSuccessModal}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {archiveRequestsStaff && (
        <div className="create-student-modal">
          <div className="modal-content requests-modal">
            <div className="requests-modal-header">
              <div className="requests-modal-heading">
                <h2 className="modal-title">Request History</h2>
                <p className="modal-subtitle">
                  Requests previously handled by <strong>{archiveRequestsStaff.name}</strong>
                </p>
              </div>
              <button
                type="button"
                className="requests-modal-close"
                onClick={() => setArchiveRequestsStaff(null)}
                aria-label="Close request history"
              >
                <FaTimes aria-hidden="true" />
              </button>
            </div>

            {requestsLoading ? (
              <DataTableSkeleton columns={5} rows={3} hasPagination={false} />
            ) : handledRequests.length === 0 ? (
              <div className="empty-state">
                <FaBoxOpen className="empty-state-icon" aria-hidden="true" />
                <p>No requests were assigned to this staff member. Their existing request history is kept unchanged.</p>
              </div>
            ) : (
              <ul className="requests-list">
                {handledRequests.map((r) => (
                  <li key={r.firestoreId || r.requestId || r.id} className="request-item">
                    <div className="request-item-main">
                      <span className="request-id">#{r.requestId || '—'}</span>
                      <span className="request-subject">{r.subject || r.title || 'Untitled request'}</span>
                      <span className="request-meta">
                        {r.office || '—'} · {formatRequestDate(r.createdAt)}
                      </span>
                    </div>
                    <span
                      className={`status status-${(r.status || 'Pending').toLowerCase().replace(/\s+/g, '-')}`}
                    >
                      {r.status || 'Pending'}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            <div className="modal-actions">
              <button className="cancel-btn-super" onClick={() => setArchiveRequestsStaff(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <Toast
          type={toast.type}
          message={toast.message}
          title={toast.title}
          confirmText={toast.confirmText}
          onClose={handleCloseToast}
        />
      )}

      {showCreateForm && activeTab === 'students' && (
        <div 
          className="create-student-modal"
          onClick={(e) => { if (e.target === e.currentTarget) handleCloseCreateForm(); }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-student-title"
        >
          <div className="modal-content create-account-modal">
            <div className="create-modal-header">
              <div className="create-modal-title-wrap">
                <div className="create-modal-icon" aria-hidden="true">
                  <FaUserPlus />
                </div>
                <div>
                  <h2 id="create-student-title" className="modal-title">Create New Student Account</h2>
                  <p className="modal-subtitle">Enter student information to generate account credentials</p>
                </div>
              </div>
              <button
                type="button"
                className="create-modal-close"
                onClick={handleCloseCreateForm}
                aria-label="Close modal"
              >
                <FaTimes aria-hidden="true" />
              </button>
            </div>

            {error && (
              <div className="error-message-super">
                {error}
              </div>
            )}

            <form onSubmit={handleCreateStudent} className="create-student-form">
              <div className="form-row-super">
                <div className="form-group-super">
                  <label className="form-label-super">
                    Student ID (4 digits) <span className="required-star">*</span>
                  </label>
                  <input
                    type="text"
                    className="form-input-super"
                    value={studentId}
                    onChange={handleStudentIdChange}
                    placeholder="e.g., 1234"
                    maxLength="4"
                    required
                  />
                </div>

                <div className="form-group-super">
                  <label className="form-label-super">
                    Email Address <span className="required-star">*</span>
                  </label>
                  <input
                    type="email"
                    className="form-input-super"
                    value={studentEmail}
                    onChange={(e) => setStudentEmail(e.target.value)}
                    placeholder="student@asj.edu"
                    required
                  />
                </div>
              </div>

              <div className="form-row-super">
                <div className="form-group-super">
                  <label className="form-label-super">
                    First Name <span className="required-star">*</span>
                  </label>
                  <input
                    type="text"
                    className="form-input-super"
                    value={studentFirstName}
                    onChange={(e) => setStudentFirstName(e.target.value)}
                    placeholder="First name"
                    required
                  />
                </div>

                <div className="form-group-super">
                  <label className="form-label-super">
                    Last Name <span className="required-star">*</span>
                  </label>
                  <input
                    type="text"
                    className="form-input-super"
                    value={studentLastName}
                    onChange={(e) => setStudentLastName(e.target.value)}
                    placeholder="Last name"
                    required
                  />
                </div>
              </div>

              <div className="form-row-super">
                <div className="form-group-super">
                  <label className="form-label-super">
                    Middle Name <span className="optional-text">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    className="form-input-super"
                    value={studentMiddleName}
                    onChange={(e) => setStudentMiddleName(e.target.value)}
                    placeholder="Middle name"
                  />
                </div>

                <div className="form-group-super small-input">
                  <label className="form-label-super">
                    Suffix <span className="optional-text">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    className="form-input-super"
                    value={studentSuffix}
                    onChange={(e) => setStudentSuffix(e.target.value)}
                    placeholder="Jr, Sr, III"
                    maxLength="10"
                  />
                </div>
              </div>

              <div className="form-row-super">
                <div className="form-group-super">
                  <label className="form-label-super">
                    Grade Level <span className="required-star">*</span>
                  </label>
                  <select
                    className={`form-input-super ${!studentGradeLevel ? 'is-placeholder' : ''}`}
                    value={studentGradeLevel}
                    onChange={(e) => setStudentGradeLevel(e.target.value)}
                    required
                  >
                    <option value="" disabled hidden>Select grade level</option>
                    <option value="Grade 7">Grade 7</option>
                    <option value="Grade 8">Grade 8</option>
                    <option value="Grade 9">Grade 9</option>
                    <option value="Grade 10">Grade 10</option>
                    <option value="Grade 11">Grade 11</option>
                    <option value="Grade 12">Grade 12</option>
                  </select>
                </div>

                <div className="form-group-super">
                  <label className="form-label-super">
                    Section <span className="required-star">*</span>
                  </label>
                  <select
                    className="form-input-super"
                    value={studentSection}
                    onChange={(e) => setStudentSection(e.target.value)}
                    required
                  >
                    <option value="">Select section</option>
                    <option value="A">A</option>
                    <option value="B">B</option>
                    <option value="C">C</option>
                  </select>
                </div>
              </div>

              <div className="password-info-box">
                <FaKey className="password-info-icon" />
                <p>A random password will be generated automatically for this account upon creation.</p>
              </div>

              <div className="modal-actions">
                <button 
                  type="button" 
                  className="cancel-btn-super" 
                  onClick={handleCloseCreateForm}
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="create-btn-super"
                  disabled={loading || !isStudentFormValid}
                  title={!isStudentFormValid ? 'Fill in all required fields to create the account' : undefined}
                >
                  <FaPlus />
                  {loading ? 'Creating...' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showCreateForm && activeTab === 'staff' && (
        <div 
          className="create-student-modal"
          onClick={(e) => { if (e.target === e.currentTarget) handleCloseCreateForm(); }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-staff-title"
        >
          <div className="modal-content create-account-modal">
            <div className="create-modal-header">
              <div className="create-modal-title-wrap">
                <div className="create-modal-icon" aria-hidden="true">
                  <FaUserPlus />
                </div>
                <div>
                  <h2 id="create-staff-title" className="modal-title">Create New Staff Account</h2>
                  <p className="modal-subtitle">Enter staff information to generate account credentials</p>
                </div>
              </div>
              <button
                type="button"
                className="create-modal-close"
                onClick={handleCloseCreateForm}
                aria-label="Close modal"
              >
                <FaTimes aria-hidden="true" />
              </button>
            </div>

            {error && (
              <div className="error-message-super">
                {error}
              </div>
            )}

            <form onSubmit={handleCreateStaff} className="create-student-form">
              <div className="form-row-super">
                <div className="form-group-super">
                  <label className="form-label-super">
                    First Name <span className="required-star">*</span>
                  </label>
                  <input
                    type="text"
                    className="form-input-super"
                    value={staffFirstName}
                    onChange={(e) => setStaffFirstName(e.target.value)}
                    placeholder="First name"
                    required
                  />
                </div>

                <div className="form-group-super">
                  <label className="form-label-super">
                    Last Name <span className="required-star">*</span>
                  </label>
                  <input
                    type="text"
                    className="form-input-super"
                    value={staffLastName}
                    onChange={(e) => setStaffLastName(e.target.value)}
                    placeholder="Last name"
                    required
                  />
                </div>
              </div>

              <div className="form-row-super">
                <div className="form-group-super">
                  <label className="form-label-super">
                    Middle Name <span className="optional-text">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    className="form-input-super"
                    value={staffMiddleName}
                    onChange={(e) => setStaffMiddleName(e.target.value)}
                    placeholder="Middle name"
                  />
                </div>

                <div className="form-group-super small-input">
                  <label className="form-label-super">
                    Suffix <span className="optional-text">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    className="form-input-super"
                    value={staffSuffix}
                    onChange={(e) => setStaffSuffix(e.target.value)}
                    placeholder="Jr, Sr, III"
                    maxLength="10"
                  />
                </div>
              </div>

              <div className="form-row-super">
                <div className="form-group-super">
                  <label className="form-label-super">
                    Email Address <span className="required-star">*</span>
                  </label>
                  <input
                    type="email"
                    className="form-input-super"
                    value={staffEmail}
                    onChange={(e) => setStaffEmail(e.target.value)}
                    placeholder="staff@asj.edu"
                    required
                  />
                </div>

                <div className="form-group-super">
                  <label className="form-label-super">
                    Username <span className="required-star">*</span>
                  </label>
                  <input
                    type="text"
                    className={`form-input-super ${usernameError ? 'input-error' : ''}`}
                    value={staffUsername}
                    onChange={(e) => setStaffUsername(e.target.value)}
                    placeholder="Enter username for login"
                    required
                  />
                  {usernameChecking && (
                    <small className="field-status-note checking">
                      Checking availability...
                    </small>
                  )}
                  {usernameError && (
                    <small className="field-status-note error">
                      {usernameError}
                    </small>
                  )}
                  {!usernameError && staffUsername && !usernameChecking && (
                    <small className="field-status-note success">
                      ✓ Username available
                    </small>
                  )}
                </div>
              </div>

              <div className="form-group-super">
                <label className="form-label-super">
                  Assign to Office <span className="required-star">*</span>
                </label>
                <select
                  className="form-input-super"
                  value={staffOffice}
                  onChange={(e) => setStaffOffice(e.target.value)}
                  required
                >
                  {offices.map((office) => (
                    <option key={office.id} value={office.id}>
                      {office.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="password-info-box">
                <FaKey className="password-info-icon" />
                <p>A random password will be generated automatically for this account upon creation.</p>
              </div>

              <div className="modal-actions">
                <button 
                  type="button" 
                  className="cancel-btn-super" 
                  onClick={handleCloseCreateForm}
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="create-btn-super"
                  disabled={loading || !isStaffFormValid || usernameError}
                  title={!isStaffFormValid ? 'Fill in all required fields to create the account' : usernameError ? 'Username already exists' : undefined}
                >
                  <FaPlus />
                  {loading ? 'Creating...' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {activeTab === 'students' ? (
        <div className="card students-list-section">
          <div className="students-list-header-row">
            <h2 className="section-title-super">Student Accounts</h2>

            {selectedStudentIds.length > 0 && (
              <div className="bulk-actions-toolbar" role="toolbar" aria-label="Student bulk actions">
                <span className="bulk-actions-count">
                  <strong>{selectedStudentIds.length}</strong> {selectedStudentIds.length === 1 ? 'student' : 'students'} selected
                </span>
                <div className="bulk-actions-buttons">
                  <button
                    type="button"
                    className={`bulk-action-btn ${students.filter(s => selectedStudentIds.includes(s.firestoreId)).some(s => s.isActive !== false) ? 'suspend' : 'activate'}`}
                    onClick={handleOpenBulkSuspend}
                    title={
                      students.filter(s => selectedStudentIds.includes(s.firestoreId)).some(s => s.isActive !== false)
                        ? `Suspend ${selectedStudentIds.length} selected student(s)`
                        : `Activate ${selectedStudentIds.length} selected student(s)`
                    }
                  >
                    {students.filter(s => selectedStudentIds.includes(s.firestoreId)).some(s => s.isActive !== false) ? (
                      <FaBan aria-hidden="true" />
                    ) : (
                      <FaCheck aria-hidden="true" />
                    )}
                    <span>
                      {students.filter(s => selectedStudentIds.includes(s.firestoreId)).some(s => s.isActive !== false)
                        ? 'Suspend'
                        : 'Activate'}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="bulk-action-btn archive"
                    onClick={handleOpenBulkArchive}
                    title={`Archive ${selectedStudentIds.length} selected student(s)`}
                  >
                    <FaArchive aria-hidden="true" />
                    <span>Archive</span>
                  </button>
                  <button
                    type="button"
                    className="bulk-action-btn delete"
                    onClick={handleOpenBulkDelete}
                    title={`Delete ${selectedStudentIds.length} selected student(s)`}
                  >
                    <FaKey aria-hidden="true" />
                    <span>Delete</span>
                  </button>
                  <button
                    type="button"
                    className="bulk-action-btn clear"
                    onClick={() => { setSelectedStudentIds([]); setSelectAllStudents(false); }}
                    title="Deselect all"
                    aria-label="Deselect all"
                  >
                    <FaTimes aria-hidden="true" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {initialLoading ? (
            <DataTableSkeleton columns={6} rows={8} hasCheckbox={true} hasPagination={true} />
          ) : visibleStudents.pageItems.length === 0 ? (
            <div className="empty-state">
              <FaSearch className="empty-state-icon" aria-hidden="true" />
              <p>{students.length === 0 ? 'No student accounts yet. Click "Create Student Account" to add one.' : 'No students match your search or filter.'}</p>
            </div>
          ) : (
            <>
              <div className="table-container">
                <div className="students-table">
                  <div className="table-header">
                    <div className="table-cell checkbox-cell">
                      <input 
                        type="checkbox" 
                        checked={
                          visibleStudents.pageItems.length > 0 &&
                          visibleStudents.pageItems.every((s) => selectedStudentIds.includes(s.firestoreId))
                        } 
                        onChange={handleSelectAll}
                        aria-label="Select all students on current page"
                      />
                    </div>
                    <div
                      className={`table-cell sortable ${sortOrder === 'idAsc' || sortOrder === 'idDesc' ? 'sorted' : ''}`}
                      onClick={() => {
                        resetPagination();
                        setSortOrder((prev) => (prev === 'idAsc' ? 'idDesc' : 'idAsc'));
                      }}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          resetPagination();
                          setSortOrder((prev) => (prev === 'idAsc' ? 'idDesc' : 'idAsc'));
                        }
                      }}
                      aria-label={`Sort by Student ID ${sortOrder === 'idAsc' ? 'descending' : 'ascending'}`}
                      title={`Sort by Student ID (${sortOrder === 'idAsc' ? 'Descending' : 'Ascending'})`}
                    >
                      <span>Student ID</span>
                      <span className="sort-col-icon">
                        {sortOrder === 'idAsc' ? (
                          <FaSortUp aria-hidden="true" />
                        ) : sortOrder === 'idDesc' ? (
                          <FaSortDown aria-hidden="true" />
                        ) : (
                          <FaSort aria-hidden="true" />
                        )}
                      </span>
                    </div>
                    <div
                      className={`table-cell sortable ${sortOrder === 'az' || sortOrder === 'za' ? 'sorted' : ''}`}
                      onClick={() => {
                        resetPagination();
                        setSortOrder((prev) => (prev === 'az' ? 'za' : 'az'));
                      }}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          resetPagination();
                          setSortOrder((prev) => (prev === 'az' ? 'za' : 'az'));
                        }
                      }}
                      aria-label={`Sort by Name ${sortOrder === 'az' ? 'Z to A' : 'A to Z'}`}
                      title={`Sort by Name (${sortOrder === 'az' ? 'Z to A' : 'A to Z'})`}
                    >
                      <span>Name</span>
                      <span className="sort-col-icon">
                        {sortOrder === 'az' ? (
                          <FaSortUp aria-hidden="true" />
                        ) : sortOrder === 'za' ? (
                          <FaSortDown aria-hidden="true" />
                        ) : (
                          <FaSort aria-hidden="true" />
                        )}
                      </span>
                    </div>
                    <div className="table-cell">Email</div>
                    <div className="table-cell">Created</div>
                    <div className="table-cell">Actions</div>
                  </div>
                  {visibleStudents.pageItems.map((student) => (
                    <div
                      key={student.firestoreId || student.id}
                      className={`table-row clickable-user-row ${selectedStudentIds.includes(student.firestoreId) ? 'row-selected' : ''}`}
                      onClick={(e) => handleRowClick(e, student, 'student')}
                      title={`Click to view profile & activity history for ${student.name}`}
                    >
                      <div className="table-cell checkbox-cell">
                        <input 
                          type="checkbox" 
                          checked={selectedStudentIds.includes(student.firestoreId)} 
                          onChange={() => handleSelectAccount(student.firestoreId)}
                          aria-label={`Select ${student.name}`}
                        />
                      </div>
                      <div className="table-cell student-id-cell">
                        {student.id}
                      </div>
                      <div className="table-cell user-name-cell">
                        <span className="user-name-text">{student.name}</span>
                        {!student.isActive && <span className="status status-suspended">Suspended</span>}
                      </div>
                      <div className="table-cell">
                        {student.email}
                      </div>
                      <div className="table-cell">
                        {student.createdAt}
                      </div>
                      <div className="table-cell">
                        <button
                          className={`table-action-btn ${student.isActive ? 'suspend' : 'activate'}`}
                          onClick={() => handleSuspendStudent(student)}
                          title={student.isActive ? 'Suspend' : 'Activate'}
                        >
                          {student.isActive ? <FaBan aria-hidden="true" /> : <FaCheck aria-hidden="true" />}
                          {student.isActive ? 'Suspend' : 'Activate'}
                        </button>
                        <button
                          className="table-action-btn archive"
                          onClick={() => handleArchiveStudent(student)}
                          title="Archive this student"
                        >
                          <FaArchive aria-hidden="true" />
                          Archive
                        </button>
                        <button
                          className="table-action-btn delete"
                          onClick={() => handleDeleteStudent(student)}
                          title="Delete this student"
                        >
                          <FaKey aria-hidden="true" />
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              {renderPagination(visibleStudents, 'student')}
            </>
          )}
        </div>
      ) : activeTab === 'archivedStaff' ? (
        <div className="card students-list-section">
          <h2 className="section-title-super">Archived Staff Accounts</h2>
          {initialLoading ? (
            <DataTableSkeleton columns={7} rows={8} hasCheckbox={false} hasPagination={true} />
          ) : visibleArchivedStaff.pageItems.length === 0 ? (
            <div className="empty-state">
              <FaBoxOpen className="empty-state-icon" aria-hidden="true" />
              <p>{archivedStaffMembers.length === 0 ? 'No archived staff yet. Archiving a staff member moves them here while keeping their request history intact.' : 'No archived staff match your search.'}</p>
            </div>
          ) : (
            <>
              <div className="table-container">
                <div className="students-table archived-table">
                  <div className="table-header">
                    <div
                      className={`table-cell sortable ${sortOrder === 'az' || sortOrder === 'za' ? 'sorted' : ''}`}
                      onClick={() => {
                        resetPagination();
                        setSortOrder((prev) => (prev === 'az' ? 'za' : 'az'));
                      }}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          resetPagination();
                          setSortOrder((prev) => (prev === 'az' ? 'za' : 'az'));
                        }
                      }}
                      aria-label={`Sort by Name ${sortOrder === 'az' ? 'Z to A' : 'A to Z'}`}
                      title={`Sort by Name (${sortOrder === 'az' ? 'Z to A' : 'A to Z'})`}
                    >
                      <span>Name</span>
                      <span className="sort-col-icon">
                        {sortOrder === 'az' ? (
                          <FaSortUp aria-hidden="true" />
                        ) : sortOrder === 'za' ? (
                          <FaSortDown aria-hidden="true" />
                        ) : (
                          <FaSort aria-hidden="true" />
                        )}
                      </span>
                    </div>
                    <div className="table-cell">Username</div>
                    <div className="table-cell">Email</div>
                    <div className="table-cell">Office</div>
                    <div className="table-cell">Archived On</div>
                    <div className="table-cell">Archived By</div>
                    <div className="table-cell">Requests</div>
                    <div className="table-cell">Actions</div>
                  </div>
                  {visibleArchivedStaff.pageItems.map((staff) => (
                    <div key={staff.firestoreId} className="table-row">
                      <div className="table-cell">
                        {staff.name}
                        <span className="status status-archived">Archived</span>
                      </div>
                      <div className="table-cell">{staff.username}</div>
                      <div className="table-cell">{staff.email}</div>
                      <div className="table-cell">{staff.office}</div>
                      <div className="table-cell">{staff.archivedAt}</div>
                      <div className="table-cell">{staff.archivedBy}</div>
                      <div className="table-cell">
                        <button
                          className="table-action-btn"
                          onClick={() => openStaffRequests(staff)}
                          title="View requests previously handled by this staff member"
                        >
                          <FaListAlt aria-hidden="true" />
                          View Requests
                        </button>
                      </div>
                      <div className="table-cell">
                        <button
                          className="table-action-btn reset"
                          onClick={() => handleRestoreStaff(staff)}
                          title="Restore this staff member to Active Staff"
                        >
                          <FaUndo aria-hidden="true" />
                          Restore
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              {renderPagination(visibleArchivedStaff, 'archived staff member')}
            </>
          )}
        </div>
      ) : (
        <div className="card students-list-section">
          <h2 className="section-title-super">Staff Accounts</h2>
          {initialLoading ? (
            <DataTableSkeleton columns={6} rows={8} hasCheckbox={false} hasPagination={true} />
          ) : visibleStaff.pageItems.length === 0 ? (
            <div className="empty-state">
              <FaSearch className="empty-state-icon" aria-hidden="true" />
              <p>{staffMembers.length === 0 ? 'No staff accounts yet. Click "Create Staff Account" to add one.' : 'No staff match your search.'}</p>
            </div>
          ) : (
            <>
              <div className="table-container">
                <div className="students-table staff-table">
                  <div className="table-header">
                    <div className="table-cell">Username</div>
                    <div
                      className={`table-cell sortable ${sortOrder === 'az' || sortOrder === 'za' ? 'sorted' : ''}`}
                      onClick={() => {
                        resetPagination();
                        setSortOrder((prev) => (prev === 'az' ? 'za' : 'az'));
                      }}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          resetPagination();
                          setSortOrder((prev) => (prev === 'az' ? 'za' : 'az'));
                        }
                      }}
                      aria-label={`Sort by Name ${sortOrder === 'az' ? 'Z to A' : 'A to Z'}`}
                      title={`Sort by Name (${sortOrder === 'az' ? 'Z to A' : 'A to Z'})`}
                    >
                      <span>Name</span>
                      <span className="sort-col-icon">
                        {sortOrder === 'az' ? (
                          <FaSortUp aria-hidden="true" />
                        ) : sortOrder === 'za' ? (
                          <FaSortDown aria-hidden="true" />
                        ) : (
                          <FaSort aria-hidden="true" />
                        )}
                      </span>
                    </div>
                    <div className="table-cell">Email</div>
                    <div className="table-cell">Office</div>
                    <div className="table-cell">Created</div>
                    <div className="table-cell">Actions</div>
                  </div>
                  {visibleStaff.pageItems.map((staff) => (
                    <div 
                      key={staff.firestoreId} 
                      className="table-row clickable-user-row"
                      onClick={(e) => handleRowClick(e, staff, 'staff')}
                      title={`Click to view profile & activity history for ${staff.name}`}
                    >
                      <div className="table-cell staff-username-cell">
                        {staff.username}
                      </div>
                      <div className="table-cell user-name-cell">
                        <span className="user-name-text">{staff.name}</span>
                        {!staff.isActive && <span className="status status-suspended">Suspended</span>}
                      </div>
                      <div className="table-cell">
                        {staff.email}
                      </div>
                      <div className="table-cell">
                        {staff.office}
                      </div>
                      <div className="table-cell">{staff.createdAt}</div>
                      <div className="table-cell">
                        <button
                          className={`table-action-btn ${staff.isActive ? 'suspend' : 'activate'}`}
                          onClick={() => {
                            setSelectedStaff(staff);
                            setConfirmAction('suspend');
                            setShowConfirmModal(true);
                          }}
                          title={staff.isActive ? 'Suspend' : 'Activate'}
                        >
                          {staff.isActive ? <FaBan aria-hidden="true" /> : <FaCheck aria-hidden="true" />}
                          {staff.isActive ? 'Suspend' : 'Activate'}
                        </button>
                        <button
                          className="table-action-btn archive"
                          onClick={() => handleArchiveStaff(staff)}
                          title="Archive this staff member"
                        >
                          <FaArchive aria-hidden="true" />
                          Archive
                        </button>
                        <button
                          className="table-action-btn delete"
                          onClick={() => {
                            setSelectedStaff(staff);
                            setConfirmAction('delete');
                            setShowConfirmModal(true);
                          }}
                          title="Delete this staff member"
                        >
                          <FaKey aria-hidden="true" />
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              {renderPagination(visibleStaff, 'staff member')}
            </>
          )}
        </div>
      )}
      </>
      )}



      {/* Dedicated Full Audit Log Explorer Modal */}
      {showFullAuditModal && selectedUserProfile && (
        <div 
          className="create-student-modal full-audit-modal-backdrop"
          onClick={(e) => { if (e.target === e.currentTarget) setShowFullAuditModal(false); }}
        >
          <div className="modal-content-super full-audit-modal" role="dialog" aria-modal="true" aria-labelledby="full-audit-title">
            {/* Modal Header */}
            <div className="full-audit-header">
              <div className="full-audit-header-title-group">
                <div className="audit-header-icon-wrap">
                  <FaHistory />
                </div>
                <div>
                  <h3 id="full-audit-title" className="full-audit-title">Audit Trail & System Activity Explorer</h3>
                  <p className="full-audit-subtitle">
                    Complete audit records for <strong>{selectedUserProfile.name}</strong> • {selectedUserProfile.email || selectedUserProfile.id || 'N/A'}
                  </p>
                </div>
              </div>
              <div className="full-audit-header-actions">
                <button
                  type="button"
                  className="full-audit-export-btn"
                  onClick={handleExportAuditCSV}
                  disabled={filteredActivityLogs.length === 0}
                  title="Export audit log to CSV"
                >
                  <FaDownload /> <span>Export CSV</span>
                </button>
                <button
                  type="button"
                  className="modal-close-btn full-audit-close-btn"
                  onClick={() => setShowFullAuditModal(false)}
                  aria-label="Close audit explorer"
                >
                  <FaTimes />
                </button>
              </div>
            </div>

            {/* Summary Metrics Strip */}
            <div className="audit-metrics-strip">
              <div className="audit-metric-tile">
                <span className="audit-metric-label">TOTAL EVENTS</span>
                <span className="audit-metric-val">{userActivityLogs.length}</span>
              </div>
              <div className="audit-metric-tile">
                <span className="audit-metric-label">TICKETS & REQUESTS</span>
                <span className="audit-metric-val">{countTickets}</span>
              </div>
              <div className="audit-metric-tile">
                <span className="audit-metric-label">SECURITY & ACCESS</span>
                <span className="audit-metric-val">{countSecurity}</span>
              </div>
              <div className="audit-metric-tile">
                <span className="audit-metric-label">ACCOUNT STATUS</span>
                <span className={`audit-metric-pill ${selectedUserProfile.isActive !== false ? 'active' : 'suspended'}`}>
                  {selectedUserProfile.isActive !== false ? 'Active' : 'Suspended'}
                </span>
              </div>
            </div>

            {/* Filter & Search Bar */}
            <div className="full-audit-filter-bar">
              <div className="full-audit-search-wrap">
                <FaSearch className="audit-search-icon" />
                <input
                  type="text"
                  className="full-audit-search-input"
                  placeholder="Filter logs by keyword, ticket reference, action type, or date..."
                  value={activitySearchTerm}
                  onChange={(e) => setActivitySearchTerm(e.target.value)}
                />
                {activitySearchTerm && (
                  <button 
                    type="button" 
                    className="activity-clear-search-btn"
                    onClick={() => setActivitySearchTerm('')}
                  >
                    <FaTimes />
                  </button>
                )}
              </div>

              <div className="full-audit-pills">
                <button
                  type="button"
                  className={`full-audit-pill ${activityCategoryFilter === 'all' ? 'active' : ''}`}
                  onClick={() => setActivityCategoryFilter('all')}
                >
                  All ({userActivityLogs.length})
                </button>
                <button
                  type="button"
                  className={`full-audit-pill ${activityCategoryFilter === 'tickets' ? 'active' : ''}`}
                  onClick={() => setActivityCategoryFilter('tickets')}
                >
                  Requests ({countTickets})
                </button>
                <button
                  type="button"
                  className={`full-audit-pill ${activityCategoryFilter === 'security' ? 'active' : ''}`}
                  onClick={() => setActivityCategoryFilter('security')}
                >
                  Security ({countSecurity})
                </button>
                <button
                  type="button"
                  className={`full-audit-pill ${activityCategoryFilter === 'admin' ? 'active' : ''}`}
                  onClick={() => setActivityCategoryFilter('admin')}
                >
                  Administrative ({countAdmin})
                </button>
              </div>
            </div>

            {/* Audit Logs Table / Feed */}
            <div className="full-audit-body">
              {filteredActivityLogs.length === 0 ? (
                <div className="full-audit-empty">
                  <div className="empty-icon-wrap">
                    <FaHistory />
                  </div>
                  <p className="empty-primary">No audit records found</p>
                  <p className="empty-secondary">
                    {activitySearchTerm || activityCategoryFilter !== 'all'
                      ? 'No events match the current filter criteria.'
                      : 'No activity logs have been recorded for this user yet.'}
                  </p>
                  {(activitySearchTerm || activityCategoryFilter !== 'all') && (
                    <button
                      type="button"
                      className="activity-reset-filters-btn"
                      onClick={() => {
                        setActivitySearchTerm('');
                        setActivityCategoryFilter('all');
                      }}
                    >
                      Reset Filters
                    </button>
                  )}
                </div>
              ) : (
                <div className="full-audit-table-wrapper">
                  <table className="full-audit-table">
                    <thead>
                      <tr>
                        <th style={{ width: '130px' }}>TIMESTAMP</th>
                        <th style={{ width: '120px' }}>CATEGORY</th>
                        <th>ACTION & DETAILS</th>
                        <th style={{ width: '110px' }}>STATUS</th>
                        <th style={{ width: '110px' }}>EVENT ID</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredActivityLogs.map((log, idx) => {
                        const { dateStr, relativeStr } = formatActivityTimestamp(log.timestamp);
                        return (
                          <tr key={log.id || idx}>
                            <td className="audit-cell-time">
                              <div className="time-primary">{relativeStr}</div>
                              <div className="time-secondary">{dateStr}</div>
                            </td>
                            <td>
                              <span className={`audit-cat-tag ${log.category || 'general'}`}>
                                {renderActivityCategoryIcon(log.category)}
                                <span>{log.category === 'tickets' ? 'Request' : log.category === 'security' ? 'Security' : log.category === 'admin' ? 'Admin' : 'General'}</span>
                              </span>
                            </td>
                            <td className="audit-cell-desc">
                              <div className="audit-action-title">{log.action || 'System activity'}</div>
                              {log.details && (
                                <div className="audit-action-details">{log.details}</div>
                              )}
                            </td>
                            <td>
                              <span className={`audit-status-badge ${log.status ? log.status.toLowerCase() : 'success'}`}>
                                {log.status || 'Logged'}
                              </span>
                            </td>
                            <td>
                              <code className="audit-event-id">
                                {log.id ? String(log.id).slice(0, 10) : `evt-${idx}`}
                              </code>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="full-audit-footer">
              <span className="audit-footer-info">
                Showing {filteredActivityLogs.length} of {userActivityLogs.length} total recorded events for this account.
              </span>
              <button
                type="button"
                className="full-audit-close-footer-btn"
                onClick={() => setShowFullAuditModal(false)}
              >
                Close Explorer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Change Password Modal */}
      {showChangePasswordModal && userToChangePassword && (
        <ChangePasswordModal
          user={userToChangePassword}
          onClose={() => {
            setShowChangePasswordModal(false);
            setUserToChangePassword(null);
          }}
          onPasswordChanged={() => {
            setShowChangePasswordModal(false);
            setUserToChangePassword(null);
            handleCloseUserProfile();
          }}
        />
      )}
    </div>
  );
};



export default UserManagement;
