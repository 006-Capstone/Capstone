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
  FaBuilding,
  FaChevronDown,
  FaTimes,
  FaArchive,
  FaUndo,
  FaListAlt,
  FaBoxOpen,
  FaCalendarAlt
} from 'react-icons/fa';
import { db, auth } from '../firebase';
import { collection, addDoc, getDocs, query, orderBy, serverTimestamp, doc, updateDoc, deleteDoc, where, onSnapshot } from 'firebase/firestore';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import NotificationBell from './NotificationBell';
import Archive from './Archive';
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

  // Archiving state
  const [actionLoading, setActionLoading] = useState(false);
  const [toast, setToast] = useState(null); // { message, type: 'success' | 'error' }
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

  const sortList = (items) => {
    if (sortOrder === 'recent') {
      return [...items].sort((a, b) => (b.rawCreatedAt || 0) - (a.rawCreatedAt || 0));
    }
    const sorted = [...items].sort((a, b) =>
      String(a.name || '').localeCompare(String(b.name || ''), undefined, { sensitivity: 'base' })
    );
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
        await Promise.all(
          selectedList.map((student) =>
            updateDoc(doc(db, 'students', student.firestoreId), {
              isActive: newStatus
            })
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
      try {
        const apiUrl = process.env.NODE_ENV === 'production' 
          ? '/api/send-student-email'
          : 'http://localhost:5000/api/send-credentials';
          
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: studentEmail.trim(),
            studentId: studentId,
            password: password,
            studentName: fullName
          })
        });

        const result = await response.json();
        
        if (result.success) {
          console.log('[Success] Email sent successfully to:', studentEmail);
        } else {
          throw new Error(result.error || 'Failed to send email');
        }
      } catch (emailError) {
        console.error('[Error] Failed to send email:', emailError);
        // Continue anyway - account was created successfully
        alert('Account created but email failed to send. Please manually share credentials with student:\nStudent ID: ' + studentId + '\nPassword: ' + password);
      }

      // Reload students list (real-time listener will update automatically)
      // await loadStudents(); // No longer needed - real-time listener handles this

      // Wait a moment for Firestore real-time listeners to update
      await new Promise(resolve => setTimeout(resolve, 500));

      // Show simple success message
      setCreatedStudent({
        id: studentId,
        name: fullName,
        email: studentEmail.trim()
      });
      setShowSuccessModal(true);
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
      try {
        const apiUrl = process.env.NODE_ENV === 'production'
          ? '/api/send-staff-email'
          : 'http://localhost:5000/api/send-staff-credentials';
          
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: staffEmail.trim(),
            staffName: fullName,
            username: staffUsername.trim(),
            password: password,
            office: selectedOffice.name
          })
        });

        const result = await response.json();
        
        if (result.success) {
          console.log('[Success] Email sent successfully to:', staffEmail);
        } else {
          throw new Error(result.error || 'Failed to send email');
        }
      } catch (emailError) {
        console.error('[Error] Failed to send email:', emailError);
        // Continue anyway - account was created successfully
        alert('Account created but email failed to send. Please manually share credentials with staff:\nUsername: ' + staffUsername + '\nPassword: ' + password);
      }

      // Reload staff list (real-time listener will update automatically)
      // await loadStaff(); // No longer needed - real-time listener handles this

      // Wait a moment for Firestore real-time listeners to update
      await new Promise(resolve => setTimeout(resolve, 500));

      // Show success message
      setCreatedStaff({
        name: fullName,
        email: staffEmail.trim(),
        username: staffUsername.trim(),
        office: selectedOffice.name
      });
      setShowSuccessModal(true);
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

  const confirmSuspendOrDelete = async () => {
    const target = selectedStudent || selectedStaff;
    const isStudent = !!selectedStudent;
    const collectionName = isStudent ? 'students' : 'staff';
    
    if (!target) return;

    try {
      if (confirmAction === 'suspend') {
        // Toggle suspension status
        const newStatus = !target.isActive;
        await updateDoc(doc(db, collectionName, target.firestoreId), {
          isActive: newStatus
        });
        // Real-time listener will update the list automatically
        // No need to manually reload
        
        // Wait a moment for Firestore real-time listeners to update
        await new Promise(resolve => setTimeout(resolve, 500));
        showToast(`Account ${newStatus ? 'activated' : 'suspended'} successfully!`);
      } else if (confirmAction === 'delete') {
        // Delete from Firestore
        // Note: User will remain in Firebase Auth but cannot login without Firestore document
        await deleteDoc(doc(db, collectionName, target.firestoreId));
        // Real-time listener will update the list automatically
        // No need to manually reload
        
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

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 4000);
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

  const confirmBtnClass =
    confirmAction === 'delete' ? 'delete-confirm-btn'
      : confirmAction === 'archive' ? 'archive-confirm-btn'
        : confirmAction === 'restore' ? 'restore-confirm-btn'
          : 'suspend-confirm-btn';

  return (
    <div className="superadmin-page user-management-container">
      <div className="page-header">
        <div>
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
            onClick={() => { setActiveTab('staff'); resetPagination(); setSelectedStaffIds([]); setSelectAllStaff(false); }}
          >
            Staff Members
          </button>
          <button
            className={`user-tab ${activeTab === 'archive' ? 'active' : ''}`}
            onClick={() => { setActiveTab('archive'); resetPagination(); }}
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
              <div className="filter-dropdown-title">Sort by name</div>
              {[
                { value: 'recent', label: 'Recently Created' },
                { value: 'az', label: 'Name (A to Z)' },
                { value: 'za', label: 'Name (Z to A)' }
              ].map((option) => (
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
                <FaArchive className="confirm-icon" aria-hidden="true" />
              ) : (
                <FaUndo className="confirm-icon" aria-hidden="true" />
              )
            ) : confirmAction === 'delete' ? (
              <FaKey className="confirm-icon" aria-hidden="true" />
            ) : (
              <FaBan className="confirm-icon" aria-hidden="true" />
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
              <div className="requests-loading">
                <span className="requests-spinner" aria-hidden="true" />
                Loading request history...
              </div>
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
        <div className={`action-toast ${toast.type === 'error' ? 'error' : 'success'}`} role="status">
          <span className="action-toast-message">
            {toast.type === 'error' ? <FaBan className="action-toast-icon" aria-hidden="true" /> : <FaCheck className="action-toast-icon" aria-hidden="true" />}
            {toast.message}
          </span>
          <button
            type="button"
            className="action-toast-close"
            onClick={() => setToast(null)}
            aria-label="Dismiss notification"
          >
            <FaTimes aria-hidden="true" />
          </button>
        </div>
      )}

      {showCreateForm && activeTab === 'students' && (
        <div className="create-student-modal">
          <div className="modal-content">
            <h2 className="modal-title">Create New Student Account</h2>
            <p className="modal-subtitle">Enter student information to generate account credentials</p>

            {error && (
              <div className="error-message-super">
                {error}
              </div>
            )}

            <form onSubmit={handleCreateStudent} className="create-student-form">
              <div className="form-group-super">
                <label className="form-label-super">Student ID (4 digits)</label>
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

              <div className="form-row-super">
                <div className="form-group-super">
                  <label className="form-label-super">First Name *</label>
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
                  <label className="form-label-super">Last Name *</label>
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
                  <label className="form-label-super">Middle Name</label>
                  <input
                    type="text"
                    className="form-input-super"
                    value={studentMiddleName}
                    onChange={(e) => setStudentMiddleName(e.target.value)}
                    placeholder="Middle name (optional)"
                  />
                </div>

                <div className="form-group-super small-input">
                  <label className="form-label-super">Suffix</label>
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
                  <label className="form-label-super">Grade Level *</label>
                  <select
                    className="form-input-super"
                    value={studentGradeLevel}
                    onChange={(e) => setStudentGradeLevel(e.target.value)}
                    required
                  >
                    <option value="">Select grade level</option>
                    <option value="Grade 7">Grade 7</option>
                    <option value="Grade 8">Grade 8</option>
                    <option value="Grade 9">Grade 9</option>
                    <option value="Grade 10">Grade 10</option>
                    <option value="Grade 11">Grade 11</option>
                    <option value="Grade 12">Grade 12</option>
                  </select>
                </div>

                <div className="form-group-super">
                  <label className="form-label-super">Section *</label>
                  <input
                    type="text"
                    className="form-input-super"
                    value={studentSection}
                    onChange={(e) => setStudentSection(e.target.value)}
                    placeholder="e.g., Einstein, Newton"
                    required
                  />
                </div>
              </div>

              <div className="form-group-super">
                <label className="form-label-super">Email Address</label>
                <input
                  type="email"
                  className="form-input-super"
                  value={studentEmail}
                  onChange={(e) => setStudentEmail(e.target.value)}
                  placeholder="student@asj.edu"
                  required
                />
              </div>

              <div className="password-info-box">
                <FaKey className="password-info-icon" />
                <p>A random password will be generated automatically for this account</p>
              </div>

              <div className="modal-actions">
                <button 
                  type="button" 
                  className="cancel-btn-super" 
                  onClick={() => setShowCreateForm(false)}
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
        <div className="create-student-modal">
          <div className="modal-content">
            <h2 className="modal-title">Create New Staff Account</h2>
            <p className="modal-subtitle">Enter staff information to generate account credentials</p>

            {error && (
              <div className="error-message-super">
                {error}
              </div>
            )}

            <form onSubmit={handleCreateStaff} className="create-student-form">
              <div className="form-row-super">
                <div className="form-group-super">
                  <label className="form-label-super">First Name *</label>
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
                  <label className="form-label-super">Last Name *</label>
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
                  <label className="form-label-super">Middle Name</label>
                  <input
                    type="text"
                    className="form-input-super"
                    value={staffMiddleName}
                    onChange={(e) => setStaffMiddleName(e.target.value)}
                    placeholder="Middle name (optional)"
                  />
                </div>

                <div className="form-group-super small-input">
                  <label className="form-label-super">Suffix</label>
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

              <div className="form-group-super">
                <label className="form-label-super">Email Address</label>
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
                <label className="form-label-super">Username</label>
                <input
                  type="text"
                  className={`form-input-super ${usernameError ? 'input-error' : ''}`}
                  value={staffUsername}
                  onChange={(e) => setStaffUsername(e.target.value)}
                  placeholder="Enter username for login"
                  required
                />
                {usernameChecking && (
                  <small style={{ color: '#666', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                    Checking availability...
                  </small>
                )}
                {usernameError && (
                  <small style={{ color: '#c33', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                    {usernameError}
                  </small>
                )}
                {!usernameError && staffUsername && !usernameChecking && (
                  <small style={{ color: '#28a745', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                    ✓ Username available
                  </small>
                )}
              </div>

              <div className="form-group-super">
                <label className="form-label-super">Assign to Office</label>
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
                <p>A random password will be generated automatically for this account</p>
              </div>

              <div className="modal-actions">
                <button 
                  type="button" 
                  className="cancel-btn-super" 
                  onClick={() => {
                    setShowCreateForm(false);
                    setUsernameError('');
                    setStaffUsername('');
                  }}
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
                    className="bulk-action-btn suspend"
                    onClick={handleOpenBulkSuspend}
                    title={
                      students.filter(s => selectedStudentIds.includes(s.firestoreId)).some(s => s.isActive !== false)
                        ? `Suspend ${selectedStudentIds.length} selected student(s)`
                        : `Activate ${selectedStudentIds.length} selected student(s)`
                    }
                  >
                    <FaBan aria-hidden="true" />
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

          {visibleStudents.pageItems.length === 0 ? (
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
                    <div className="table-cell">Student ID</div>
                    <div className="table-cell">Name</div>
                    <div className="table-cell">Email</div>
                    <div className="table-cell">Created</div>
                    <div className="table-cell">Actions</div>
                  </div>
                  {visibleStudents.pageItems.map((student) => (
                    <div
                      key={student.firestoreId || student.id}
                      className={`table-row ${selectedStudentIds.includes(student.firestoreId) ? 'row-selected' : ''}`}
                    >
                      <div className="table-cell checkbox-cell">
                        <input 
                          type="checkbox" 
                          checked={selectedStudentIds.includes(student.firestoreId)} 
                          onChange={() => handleSelectAccount(student.firestoreId)}
                          aria-label={`Select ${student.name}`}
                        />
                      </div>
                      <div className="table-cell">{student.id}</div>
                      <div className="table-cell">
                        {student.name}
                        {!student.isActive && <span className="status status-suspended">Suspended</span>}
                      </div>
                      <div className="table-cell">{student.email}</div>
                      <div className="table-cell">{student.createdAt}</div>
                      <div className="table-cell">
                        <button
                          className="table-action-btn reset"
                          onClick={() => handleSuspendStudent(student)}
                          title={student.isActive ? 'Suspend' : 'Activate'}
                        >
                          <FaBan aria-hidden="true" />
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
          {visibleArchivedStaff.pageItems.length === 0 ? (
            <div className="empty-state">
              <FaBoxOpen className="empty-state-icon" aria-hidden="true" />
              <p>{archivedStaffMembers.length === 0 ? 'No archived staff yet. Archiving a staff member moves them here while keeping their request history intact.' : 'No archived staff match your search.'}</p>
            </div>
          ) : (
            <>
              <div className="table-container">
                <div className="students-table archived-table">
                  <div className="table-header">
                    <div className="table-cell">Name</div>
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
          {visibleStaff.pageItems.length === 0 ? (
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
                    <div className="table-cell">Name</div>
                    <div className="table-cell">Email</div>
                    <div className="table-cell">Office</div>
                    <div className="table-cell">Created</div>
                    <div className="table-cell">Actions</div>
                  </div>
                  {visibleStaff.pageItems.map((staff) => (
                    <div key={staff.firestoreId} className="table-row">
                      <div className="table-cell">{staff.username}</div>
                      <div className="table-cell">
                        {staff.name}
                        {!staff.isActive && <span className="status status-suspended">Suspended</span>}
                      </div>
                      <div className="table-cell">{staff.email}</div>
                      <div className="table-cell">{staff.office}</div>
                      <div className="table-cell">{staff.createdAt}</div>
                      <div className="table-cell">
                        <button
                          className="table-action-btn reset"
                          onClick={() => {
                            setSelectedStaff(staff);
                            setConfirmAction('suspend');
                            setShowConfirmModal(true);
                          }}
                          title={staff.isActive ? 'Suspend' : 'Activate'}
                        >
                          <FaBan aria-hidden="true" />
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
    </div>
  );
};

export default UserManagement;
