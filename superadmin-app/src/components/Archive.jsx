import React, { useState, useEffect, useMemo } from 'react';
import {
  FaSearch,
  FaTimes,
  FaDownload,
  FaUndo,
  FaExclamationTriangle,
  FaBoxOpen,
  FaChevronDown,
  FaChevronUp,
  FaListAlt,
  FaUserGraduate,
  FaUserTie
} from 'react-icons/fa';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  deleteDoc,
  doc,
  updateDoc,
  where,
  getDocs,
  serverTimestamp
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import NotificationBell from './NotificationBell';
import LoadingSpinner from './LoadingSpinner';
import Toast from './Toast';
import '../styles/Archive.css';

// Module-level flag to prevent concurrent restore operations
let isRestoreInProgress = false;

const Archive = ({ isEmbedded = false }) => {
  const [archivedAccounts, setArchivedAccounts] = useState([]);
  const [archivedRequests, setArchivedRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [archiveFilter, setArchiveFilter] = useState('All'); // 'All', 'Students', 'Staff'
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedAccounts, setSelectedAccounts] = useState([]);
  const [selectAll, setSelectAll] = useState(false);
  const [unarchiving, setUnarchiving] = useState(false);
  const [expandedAccountId, setExpandedAccountId] = useState(null);
  const [staffRequestsMap, setStaffRequestsMap] = useState({});
  const [loadingStaffRequests, setLoadingStaffRequests] = useState({});
  const [accountToUnarchive, setAccountToUnarchive] = useState(null); // null means bulk selection
  const [showConfirmUnarchive, setShowConfirmUnarchive] = useState(false);
  const [toast, setToast] = useState(null); // { message, type: 'success' | 'error' }
  const PAGE_SIZE = 10;

  const formatDate = (dateVal) => {
    if (!dateVal) return '—';
    try {
      if (typeof dateVal.toDate === 'function') {
        return dateVal.toDate().toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        });
      }
      if (typeof dateVal === 'string') return dateVal;
      if (dateVal instanceof Date) {
        return dateVal.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        });
      }
    } catch (err) {
      console.warn('Failed to format date:', err);
    }
    return '—';
  };

  const formatDateTime = (dateVal) => {
    if (!dateVal) return '—';
    try {
      if (typeof dateVal.toDate === 'function') {
        return dateVal.toDate().toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: 'numeric',
          minute: '2-digit'
        });
      }
      if (typeof dateVal === 'string') return dateVal;
    } catch (err) {
      console.warn('Failed to format datetime:', err);
    }
    return '—';
  };

  // Load archived accounts and requests from Firestore
  useEffect(() => {
    let accountsData = [];
    let staffArchivedData = [];

    const updateCombined = () => {
      const map = new Map();
      const duplicatesToDelete = []; // Track duplicates to delete
      
      // Deduplicate archivedAccounts by UID (keep most recent)
      accountsData.forEach((acc) => {
        if (acc.uid) {
          const existing = map.get(acc.uid);
          if (!existing) {
            map.set(acc.uid, acc);
          } else {
            // Keep the one with more recent archivedAt date
            const existingDate = existing.archivedAt ? new Date(existing.archivedAt) : new Date(0);
            const currentDate = acc.archivedAt ? new Date(acc.archivedAt) : new Date(0);
            if (currentDate > existingDate) {
              // Current is newer - mark old one for deletion
              duplicatesToDelete.push(existing.firestoreId);
              map.set(acc.uid, acc);
            } else {
              // Existing is newer - mark current for deletion
              duplicatesToDelete.push(acc.firestoreId);
            }
          }
        } else {
          // If no UID, use firestoreId as fallback
          map.set(acc.firestoreId, acc);
        }
      });
      
      // Delete duplicates from Firestore
      if (duplicatesToDelete.length > 0) {
        console.log('[Archive] Found', duplicatesToDelete.length, 'duplicate archived accounts to delete');
        duplicatesToDelete.forEach(async (docId) => {
          try {
            await deleteDoc(doc(db, 'archivedAccounts', docId));
            console.log('[Archive] Auto-deleted duplicate archived account:', docId);
          } catch (error) {
            console.error('[Archive] Failed to delete duplicate:', docId, error);
          }
        });
      }
      
      // Then add staff with isArchived == true if not already in map
      staffArchivedData.forEach((staff) => {
        if (staff.uid && !map.has(staff.uid)) {
          map.set(staff.uid, staff);
        } else if (!staff.uid) {
          const alreadyExists = Array.from(map.values()).some(
            (a) => a.accountType === 'staff' && (a.username === staff.username || (staff.email && a.email === staff.email))
          );
          if (!alreadyExists) {
            map.set(staff.firestoreId, staff);
          }
        }
      });
      
      setArchivedAccounts(Array.from(map.values()));
      setLoading(false);
    };

    // 1. Listen to archivedAccounts collection
    const archivedQuery = query(
      collection(db, 'archivedAccounts'),
      orderBy('archivedAt', 'desc')
    );
    const unsubAccounts = onSnapshot(archivedQuery, (snapshot) => {
      accountsData = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          firestoreId: d.id,
          ...data,
          archivedAt: formatDate(data.archivedAt),
          createdAt: formatDate(data.createdAt),
          isStaffCollectionDoc: false
        };
      });
      updateCombined();
    }, (err) => {
      console.error('[Archive] Error listening to archivedAccounts:', err);
      setLoading(false);
    });

    // 2. Listen to staff collection where isArchived is true
    const staffArchivedQuery = query(
      collection(db, 'staff'),
      where('isArchived', '==', true)
    );
    const unsubStaff = onSnapshot(staffArchivedQuery, (snapshot) => {
      staffArchivedData = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          firestoreId: d.id,
          ...data,
          accountType: 'staff',
          name: data.name || `${data.firstName || ''} ${data.lastName || ''}`.trim() || data.username,
          archivedAt: formatDate(data.archivedAt),
          createdAt: formatDate(data.createdAt),
          isStaffCollectionDoc: true
        };
      });
      updateCombined();
    }, (err) => {
      console.error('[Archive] Error listening to archived staff:', err);
    });

    // 3. Listen to archivedRequests collection
    const requestsQuery = query(
      collection(db, 'archivedRequests')
    );
    const unsubRequests = onSnapshot(requestsQuery, (snapshot) => {
      const reqs = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          firestoreId: d.id,
          ...data,
          archivedAt: formatDateTime(data.archivedAt),
          createdAt: formatDate(data.createdAt)
        };
      });
      setArchivedRequests(reqs);
    }, (err) => {
      console.error('[Archive] Error listening to archived requests:', err);
    });

    return () => {
      unsubAccounts();
      unsubStaff();
      unsubRequests();
    };
  }, []);

  // Filter archived accounts by tab & search query
  const filteredAccounts = useMemo(() => {
    return archivedAccounts.filter((account) => {
      if (archiveFilter === 'Students' && account.accountType !== 'student') return false;
      if (archiveFilter === 'Staff' && account.accountType !== 'staff') return false;

      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const name = String(account.name || `${account.firstName || ''} ${account.lastName || ''}`).toLowerCase();
        const idOrUsername = String(account.accountType === 'student' ? (account.id || '') : (account.username || '')).toLowerCase();
        const email = String(account.email || '').toLowerCase();
        const office = String(account.office || '').toLowerCase();
        return name.includes(q) || idOrUsername.includes(q) || email.includes(q) || office.includes(q);
      }
      return true;
    });
  }, [archivedAccounts, archiveFilter, searchQuery]);

  // Account counts for filter pills
  const studentCount = useMemo(() => archivedAccounts.filter((a) => a.accountType === 'student').length, [archivedAccounts]);
  const staffCount = useMemo(() => archivedAccounts.filter((a) => a.accountType === 'staff').length, [archivedAccounts]);
  const totalCount = archivedAccounts.length;

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredAccounts.length / PAGE_SIZE));
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const paginatedAccounts = filteredAccounts.slice(startIndex, startIndex + PAGE_SIZE);

  // Reset pagination and selections when filter or search changes
  useEffect(() => {
    setCurrentPage(1);
    setSelectedAccounts([]);
    setSelectAll(false);
  }, [archiveFilter, searchQuery]);

  // Handle individual checkbox selection
  const handleSelectAccount = (id) => {
    setSelectedAccounts((prev) =>
      prev.includes(id) ? prev.filter((aid) => aid !== id) : [...prev, id]
    );
  };

  // Handle select all checkbox on current page
  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedAccounts([]);
    } else {
      setSelectedAccounts(paginatedAccounts.map((a) => a.firestoreId));
    }
    setSelectAll(!selectAll);
  };

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 4000);
  };

  // Request unarchive for multiple selected accounts
  const requestBulkUnarchive = () => {
    const toRestore = archivedAccounts.filter((a) => selectedAccounts.includes(a.firestoreId));
    if (toRestore.length === 0) {
      showToast('Please select accounts to unarchive', 'error');
      return;
    }
    setAccountToUnarchive(null);
    setShowConfirmUnarchive(true);
  };

  // Request unarchive for a single account from row action
  const requestSingleUnarchive = (account) => {
    setAccountToUnarchive(account);
    setShowConfirmUnarchive(true);
  };

  // Execute restore
  const handleUnarchive = async () => {
    // Check module-level flag first (prevents ALL concurrent restores across component instances)
    if (isRestoreInProgress) {
      console.warn('[Archive] Another restore operation is already in progress (module-level check)');
      return;
    }
    
    const accountsToRestore = accountToUnarchive
      ? [accountToUnarchive]
      : archivedAccounts.filter((a) => selectedAccounts.includes(a.firestoreId));

    if (accountsToRestore.length === 0) return;

    // Check if user is authenticated
    if (!auth.currentUser) {
      console.error('[Archive] No authenticated user found');
      showToast('You must be logged in to restore accounts', 'error');
      return;
    }

    // Prevent multiple simultaneous restores (component-level check)
    if (unarchiving) {
      console.warn('[Archive] Restore already in progress (component-level check)');
      return;
    }

    console.log('[Archive] Current user:', auth.currentUser.email);
    console.log('[Archive] Accounts to restore:', accountsToRestore.length);

    // Set both flags
    isRestoreInProgress = true;
    setShowConfirmUnarchive(false);
    setUnarchiving(true);
    
    let restoredCount = 0;
    let skippedCount = 0;
    const processedUids = new Set(); // Track processed UIDs to avoid duplicates
    
    try {
      const currentUser = auth.currentUser;
      const restoredBy = currentUser ? currentUser.email : 'Super Admin';

      for (const account of accountsToRestore) {
        // Skip if we've already processed this UID (prevents duplicate processing)
        if (account.uid && processedUids.has(account.uid)) {
          console.log('[Archive] Skipping duplicate UID:', account.uid);
          continue;
        }
        
        console.log('[Archive] Restoring account:', account.name, 'ID:', account.firestoreId);
        
        // Mark this UID as processed
        if (account.uid) {
          processedUids.add(account.uid);
        }
        
        // Check for duplicate archived accounts with same UID
        if (account.uid) {
          const duplicatesQuery = query(
            collection(db, 'archivedAccounts'),
            where('uid', '==', account.uid)
          );
          const duplicatesSnapshot = await getDocs(duplicatesQuery);
          
          if (duplicatesSnapshot.docs.length > 1) {
            console.warn('[Archive] Found', duplicatesSnapshot.docs.length, 'duplicate archived accounts for UID:', account.uid);
            // Delete all duplicates except the one we're currently processing
            for (const dupDoc of duplicatesSnapshot.docs) {
              if (dupDoc.id !== account.firestoreId) {
                console.log('[Archive] Deleting duplicate archived account:', dupDoc.id);
                await deleteDoc(doc(db, 'archivedAccounts', dupDoc.id));
              }
            }
          }
        }
        
        if (account.isStaffCollectionDoc) {
          // If staff document in 'staff' collection with isArchived: true
          console.log('[Archive] Updating staff document in staff collection');
          await updateDoc(doc(db, 'staff', account.firestoreId), {
            isArchived: false,
            restoredAt: serverTimestamp(),
            restoredBy: restoredBy
          });
          console.log('[Archive] Staff document updated successfully');
          restoredCount++;
        } else {
          // If in archivedAccounts collection
          const {
            firestoreId,
            accountType,
            archivedAt,
            archivedReason,
            originalCollection,
            originalRequestId,
            isStaffCollectionDoc,
            source,
            ...accountData
          } = account;

          console.log('[Archive] Restoring from archivedAccounts to', accountType === 'student' ? 'students' : 'staff');
          
          const targetCollection = accountType === 'student' ? 'students' : 'staff';
          
          // Check if account already exists in target collection to prevent duplicates
          if (accountData.uid) {
            const existingQuery = query(
              collection(db, targetCollection),
              where('uid', '==', accountData.uid)
            );
            const existingSnapshot = await getDocs(existingQuery);
            
            if (!existingSnapshot.empty) {
              console.log('[Archive] Account already exists in', targetCollection, '- updating it and deleting archived copies');
              
              // UPDATE the existing account to ensure it's active and properly restored
              const existingDocId = existingSnapshot.docs[0].id;
              await updateDoc(doc(db, targetCollection, existingDocId), {
                isArchived: false,
                isActive: true,
                restoredAt: serverTimestamp(),
                restoredBy: restoredBy,
                mustChangePassword: true
              });
              console.log('[Archive] Updated existing account in', targetCollection, ':', existingDocId);
              
              // Delete ALL archived copies of this account
              const allArchivedQuery = query(
                collection(db, 'archivedAccounts'),
                where('uid', '==', accountData.uid)
              );
              const allArchivedSnapshot = await getDocs(allArchivedQuery);
              
              console.log('[Archive] Found', allArchivedSnapshot.docs.length, 'archived document(s) with UID:', accountData.uid);
              
              for (const archivedDoc of allArchivedSnapshot.docs) {
                try {
                  console.log('[Archive] Deleting archived document ID:', archivedDoc.id);
                  await deleteDoc(doc(db, 'archivedAccounts', archivedDoc.id));
                  console.log('[Archive] ✓ Successfully deleted:', archivedDoc.id);
                } catch (deleteError) {
                  console.error('[Archive] ✗ Failed to delete:', archivedDoc.id, deleteError);
                }
              }
              
              // ALSO explicitly try to delete the current firestoreId if not already deleted
              if (firestoreId) {
                const wasDeleted = allArchivedSnapshot.docs.some(d => d.id === firestoreId);
                if (!wasDeleted) {
                  try {
                    console.log('[Archive] Current firestoreId not in UID query results, deleting explicitly:', firestoreId);
                    await deleteDoc(doc(db, 'archivedAccounts', firestoreId));
                    console.log('[Archive] ✓ Successfully deleted current document:', firestoreId);
                  } catch (deleteError) {
                    console.error('[Archive] ✗ Failed to delete current document:', firestoreId, deleteError);
                  }
                } else {
                  console.log('[Archive] Current document already deleted via UID query:', firestoreId);
                }
              }
              
              console.log('[Archive] ✓ Completed deletion of all archived copies for UID:', accountData.uid);
              restoredCount++; // Count as restored since we updated the existing account
              continue; // Skip to next account - DO NOT create new document
            }
          }
          
          const restoredAccountData = {
            ...accountData,
            restoredAt: serverTimestamp(),
            restoredBy: restoredBy,
            mustChangePassword: true,
            isActive: accountData.isActive !== undefined ? accountData.isActive : true
          };
          
          const restoredDoc = await addDoc(collection(db, targetCollection), restoredAccountData);
          console.log('[Archive] Account restored to', targetCollection, 'with ID:', restoredDoc.id);
          restoredCount++;
          
          // Delete ALL archived copies with the same UID (not just the current one)
          if (accountData.uid) {
            console.log('[Archive] Deleting ALL archived copies for UID:', accountData.uid);
            const allArchivedQuery = query(
              collection(db, 'archivedAccounts'),
              where('uid', '==', accountData.uid)
            );
            const allArchivedSnapshot = await getDocs(allArchivedQuery);
            console.log('[Archive] Found', allArchivedSnapshot.docs.length, 'archived copies to delete');
            
            for (const archivedDoc of allArchivedSnapshot.docs) {
              try {
                console.log('[Archive] Deleting archived copy:', archivedDoc.id);
                await deleteDoc(doc(db, 'archivedAccounts', archivedDoc.id));
                console.log('[Archive] ✓ Deleted:', archivedDoc.id);
              } catch (deleteError) {
                console.error('[Archive] ✗ Failed to delete:', archivedDoc.id, deleteError);
              }
            }
          } else {
            // No UID - just delete the current document
            console.log('[Archive] Deleting current document (no UID):', firestoreId);
            try {
              await deleteDoc(doc(db, 'archivedAccounts', firestoreId));
              console.log('[Archive] ✓ Deleted:', firestoreId);
            } catch (deleteError) {
              console.error('[Archive] ✗ Failed to delete:', firestoreId, deleteError);
            }
          }

          // If student, restore their archived requests (ONCE)
          if (accountType === 'student' && accountData.uid) {
            console.log('[Archive] Checking for archived requests for student UID:', accountData.uid);
            const archivedRequestsQuery = query(
              collection(db, 'archivedRequests'),
              where('studentUid', '==', accountData.uid)
            );
            const archivedRequestsSnapshot = await getDocs(archivedRequestsQuery);
            console.log('[Archive] Found', archivedRequestsSnapshot.docs.length, 'archived requests for UID:', accountData.uid);
            
            const restoredRequestIds = new Set(); // Track restored request IDs
            
            for (const requestDoc of archivedRequestsSnapshot.docs) {
              // Skip if we've already processed this request ID
              if (restoredRequestIds.has(requestDoc.id)) {
                console.log('[Archive] Skipping duplicate request:', requestDoc.id);
                continue;
              }
              
              restoredRequestIds.add(requestDoc.id);
              
              const {
                archivedAt: reqArchivedAt,
                archivedReason: reqReason,
                originalRequestId: origId,
                ...requestData
              } = requestDoc.data();

              try {
                await addDoc(collection(db, 'requests'), {
                  ...requestData,
                  restoredAt: serverTimestamp(),
                  restoredBy: restoredBy
                });

                await deleteDoc(doc(db, 'archivedRequests', requestDoc.id));
                console.log('[Archive] Restored and deleted archived request:', requestDoc.id);
              } catch (reqError) {
                console.error('[Archive] Failed to restore request:', requestDoc.id, reqError);
                // Continue with other requests even if one fails
              }
            }
            
            console.log('[Archive] Finished restoring', restoredRequestIds.size, 'requests for UID:', accountData.uid);
          }
          
          // NOTE: Archived documents already deleted above (all copies by UID or current firestoreId)
        }
      }

      // Show appropriate success message
      if (restoredCount > 0 && skippedCount > 0) {
        showToast(`Restored ${restoredCount} account${restoredCount === 1 ? '' : 's'}. ${skippedCount} already existed and ${skippedCount === 1 ? 'was' : 'were'} removed from archive.`);
      } else if (restoredCount > 0) {
        showToast(`Successfully restored ${restoredCount} account${restoredCount === 1 ? '' : 's'}.`);
      } else if (skippedCount > 0) {
        showToast(`${skippedCount} account${skippedCount === 1 ? '' : 's'} already existed and ${skippedCount === 1 ? 'was' : 'were'} removed from archive.`);
      } else {
        showToast('No accounts were restored.');
      }
      
      setSelectedAccounts([]);
      setSelectAll(false);
      setAccountToUnarchive(null);
      setExpandedAccountId(null);
    } catch (error) {
      console.error('[Archive] Error during unarchive:', error);
      console.error('[Archive] Error details:', {
        code: error.code,
        message: error.message,
        stack: error.stack
      });
      showToast('An error occurred while unarchiving. Please try again. Error: ' + error.message, 'error');
    } finally {
      setUnarchiving(false);
      isRestoreInProgress = false; // Reset module-level flag
    }
  };

  // Get requests for a specific student
  const getStudentRequests = (studentUid) => {
    if (!studentUid) return [];
    return archivedRequests.filter((req) => req.studentUid === studentUid);
  };

  // Load handled requests for a staff member on demand
  const loadStaffHandledRequests = async (staff) => {
    const staffId = staff.firestoreId;
    if (staffRequestsMap[staffId]) return;
    setLoadingStaffRequests((prev) => ({ ...prev, [staffId]: true }));
    try {
      const queries = [];
      if (staff.name) {
        queries.push(
          query(collection(db, 'requests'), where('assignedTo', '==', staff.name)),
          query(collection(db, 'requests'), where('claimedBy', '==', staff.name))
        );
      }
      const snapshots = await Promise.all(queries.map((q) => getDocs(q)));
      const merged = new Map();
      snapshots.forEach((snapshot) => {
        snapshot.docs.forEach((reqDoc) => {
          merged.set(reqDoc.id, { firestoreId: reqDoc.id, ...reqDoc.data() });
        });
      });
      const list = Array.from(merged.values()).map((r) => ({
        ...r,
        createdAt: formatDate(r.createdAt),
        archivedAt: formatDate(r.archivedAt)
      }));
      setStaffRequestsMap((prev) => ({ ...prev, [staffId]: list }));
    } catch (err) {
      console.error('[Archive] Failed to load staff requests:', err);
    } finally {
      setLoadingStaffRequests((prev) => ({ ...prev, [staffId]: false }));
    }
  };

  // Toggle expanded account row
  const toggleExpandAccount = (account) => {
    const targetId = account.firestoreId;
    if (expandedAccountId === targetId) {
      setExpandedAccountId(null);
    } else {
      setExpandedAccountId(targetId);
      if (account.accountType === 'staff') {
        loadStaffHandledRequests(account);
      }
    }
  };

  // Export to CSV
  const exportToCSV = () => {
    if (filteredAccounts.length === 0) {
      showToast('No data to export', 'error');
      return;
    }

    const headers = ['Account Type', 'Name', 'Email', 'ID / Username', 'Office', 'Archived Date', 'Requests'];
    const rows = filteredAccounts.map((account) => {
      const isStudent = account.accountType === 'student';
      const idOrUsername = isStudent ? (account.id || '—') : (account.username || '—');
      const reqCount = isStudent
        ? getStudentRequests(account.uid).length
        : (staffRequestsMap[account.firestoreId]?.length || 0);
      return [
        isStudent ? 'Student' : 'Staff',
        account.name || `${account.firstName || ''} ${account.lastName || ''}`.trim(),
        account.email || '',
        idOrUsername,
        account.office || 'N/A',
        account.archivedAt || '',
        reqCount
      ];
    });

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `archived_accounts_${archiveFilter.toLowerCase()}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className={isEmbedded ? "archive-container archive-embedded" : "superadmin-page archive-container"}>
      {!isEmbedded && (
        <div className="page-header">
          <div>
            <h1 className="archive-title">Archive</h1>
            <p className="page-subtitle">View and restore archived student and staff accounts and their request history</p>
          </div>
          <div className="header-actions">
            <NotificationBell />
          </div>
        </div>
      )}

      {/* Controls Bar: Filter Pills, Search Bar, and Actions */}
      <div className="archive-controls-bar">
        <div className="archive-filter-pills" role="tablist" aria-label="Filter archived accounts">
          <button
            type="button"
            role="tab"
            aria-selected={archiveFilter === 'All'}
            className={`filter-pill ${archiveFilter === 'All' ? 'active' : ''}`}
            onClick={() => setArchiveFilter('All')}
          >
            All Accounts
            <span className="pill-badge">{totalCount}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={archiveFilter === 'Students'}
            className={`filter-pill ${archiveFilter === 'Students' ? 'active' : ''}`}
            onClick={() => setArchiveFilter('Students')}
          >
            <FaUserGraduate className="pill-icon" aria-hidden="true" />
            Students
            <span className="pill-badge">{studentCount}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={archiveFilter === 'Staff'}
            className={`filter-pill ${archiveFilter === 'Staff' ? 'active' : ''}`}
            onClick={() => setArchiveFilter('Staff')}
          >
            <FaUserTie className="pill-icon" aria-hidden="true" />
            Staff
            <span className="pill-badge">{staffCount}</span>
          </button>
        </div>

        <div className="archive-actions-group">
          <div className="search-bar archive-search">
            <FaSearch className="search-icon" aria-hidden="true" />
            <input
              type="search"
              placeholder="Search by name, ID, email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Search archived accounts"
            />
            {searchQuery && (
              <button
                type="button"
                className="search-clear-btn"
                onClick={() => setSearchQuery('')}
                aria-label="Clear search query"
              >
                <FaTimes aria-hidden="true" />
              </button>
            )}
          </div>

          <button
            type="button"
            className="btn-export"
            onClick={exportToCSV}
            disabled={filteredAccounts.length === 0}
            title="Download archived accounts as CSV"
          >
            <FaDownload aria-hidden="true" />
            <span>Export CSV</span>
          </button>

          {selectedAccounts.length > 0 && (
            <button
              type="button"
              className="btn-unarchive-bulk"
              onClick={requestBulkUnarchive}
              disabled={unarchiving}
              title={`Restore ${selectedAccounts.length} selected account(s)`}
            >
              <FaUndo aria-hidden="true" />
              <span>Restore ({selectedAccounts.length})</span>
            </button>
          )}
        </div>
      </div>

      {/* Table Section Card */}
      <div className="card archive-table-card">
        {loading ? (
          <LoadingSpinner message="Loading archive..." fullScreen={false} />
        ) : archivedAccounts.length === 0 ? (
          <div className="empty-state">
            <FaBoxOpen className="empty-state-icon" aria-hidden="true" />
            <p>No archived accounts yet</p>
            <span className="empty-state-hint">Accounts archived from the Students or Staff tabs will appear here.</span>
          </div>
        ) : filteredAccounts.length === 0 ? (
          <div className="empty-state">
            <FaSearch className="empty-state-icon" aria-hidden="true" />
            <p>No archived accounts match your search or filter</p>
            {(searchQuery || archiveFilter !== 'All') && (
              <button
                type="button"
                className="btn-clear-filter"
                onClick={() => {
                  setSearchQuery('');
                  setArchiveFilter('All');
                }}
              >
                Reset Filters
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="table-container">
              <div className="archive-table">
                <div className="table-header">
                  <div className="table-cell checkbox-cell">
                    <input
                      type="checkbox"
                      checked={selectAll}
                      onChange={handleSelectAll}
                      aria-label="Select all accounts on current page"
                    />
                  </div>
                  <div className="table-cell">Type</div>
                  <div className="table-cell">ID / Username</div>
                  <div className="table-cell">Name</div>
                  <div className="table-cell">Email</div>
                  <div className="table-cell">Requests</div>
                  <div className="table-cell">Archived Date</div>
                  <div className="table-cell action-cell">Action</div>
                </div>

                {paginatedAccounts.map((account) => {
                  const isStudent = account.accountType === 'student';
                  const studentRequests = isStudent ? getStudentRequests(account.uid) : [];
                  const staffRequests = !isStudent ? (staffRequestsMap[account.firestoreId] || []) : [];
                  const isExpanded = expandedAccountId === account.firestoreId;
                  const reqCount = isStudent ? studentRequests.length : (staffRequests.length || 0);

                  return (
                    <React.Fragment key={account.firestoreId}>
                      <div
                        className={`table-row ${isExpanded ? 'expanded' : ''} clickable`}
                        onClick={() => toggleExpandAccount(account)}
                      >
                        <div className="table-cell checkbox-cell" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selectedAccounts.includes(account.firestoreId)}
                            onChange={() => handleSelectAccount(account.firestoreId)}
                            aria-label={`Select ${account.name || 'account'}`}
                          />
                        </div>

                        <div className="table-cell">
                          <span className={`account-type-badge ${account.accountType}`}>
                            {isStudent ? 'Student' : 'Staff'}
                          </span>
                        </div>

                        <div className="table-cell account-id-cell">
                          {isStudent ? account.id : account.username}
                        </div>

                        <div className="table-cell account-name-cell">
                          <span className="account-name-text">
                            {account.name || `${account.firstName || ''} ${account.lastName || ''}`.trim() || '—'}
                          </span>
                          {account.office && <span className="account-office-badge">{account.office}</span>}
                        </div>

                        <div className="table-cell account-email-cell" title={account.email}>
                          {account.email || '—'}
                        </div>

                        <div className="table-cell requests-cell" onClick={(e) => { e.stopPropagation(); toggleExpandAccount(account); }}>
                          <span className={`request-count-badge ${isExpanded ? 'expanded' : ''}`} title="Click to view requests">
                            <FaListAlt className="req-icon" aria-hidden="true" />
                            <span>{isStudent ? `${studentRequests.length} reqs` : (reqCount > 0 ? `${reqCount} reqs` : 'View')}</span>
                            {isExpanded ? (
                              <FaChevronUp className="chevron-mini" aria-hidden="true" />
                            ) : (
                              <FaChevronDown className="chevron-mini" aria-hidden="true" />
                            )}
                          </span>
                        </div>

                        <div className="table-cell date-cell">
                          {account.archivedAt}
                        </div>

                        <div className="table-cell action-cell" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            className="table-action-btn restore"
                            onClick={() => requestSingleUnarchive(account)}
                            title="Restore this account to active status"
                          >
                            <FaUndo aria-hidden="true" />
                            <span>Restore</span>
                          </button>
                        </div>
                      </div>

                      {/* Expanded Requests Section */}
                      {isExpanded && (
                        <div className="expanded-requests">
                          {isStudent ? (
                            studentRequests.length === 0 ? (
                              <div className="no-requests-message">No archived requests associated with this student account.</div>
                            ) : (
                              <div className="requests-list">
                                <div className="requests-header">
                                  <span>Archived Requests ({studentRequests.length})</span>
                                </div>
                                <div className="requests-table">
                                  <div className="requests-table-header">
                                    <div>Subject</div>
                                    <div>Office</div>
                                    <div>Status</div>
                                    <div>Created</div>
                                    <div>Archived</div>
                                  </div>
                                  {studentRequests.map((request) => (
                                    <div key={request.firestoreId} className="requests-table-row">
                                      <div className="req-subject-cell">{request.subject || 'Untitled Request'}</div>
                                      <div>{request.office || request.officeName || '—'}</div>
                                      <div>
                                        <span className={`status status-${(request.status || 'pending').toLowerCase().replace(/\s+/g, '-')}`}>
                                          {request.status || 'Pending'}
                                        </span>
                                      </div>
                                      <div>{request.createdAt}</div>
                                      <div>{request.archivedAt}</div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )
                          ) : (
                            loadingStaffRequests[account.firestoreId] ? (
                              <div className="no-requests-message">Loading requests handled by this staff member...</div>
                            ) : staffRequests.length === 0 ? (
                              <div className="no-requests-message">No requests were assigned to or handled by this staff member.</div>
                            ) : (
                              <div className="requests-list">
                                <div className="requests-header">
                                  <span>Handled Requests ({staffRequests.length})</span>
                                </div>
                                <div className="requests-table">
                                  <div className="requests-table-header staff-requests">
                                    <div>Request ID</div>
                                    <div>Subject</div>
                                    <div>Office</div>
                                    <div>Status</div>
                                    <div>Date</div>
                                  </div>
                                  {staffRequests.map((request) => (
                                    <div key={request.firestoreId} className="requests-table-row staff-requests">
                                      <div className="req-id-code">#{request.requestId || request.firestoreId?.slice(0, 6) || '—'}</div>
                                      <div className="req-subject-cell">{request.subject || request.title || 'Untitled Request'}</div>
                                      <div>{request.office || '—'}</div>
                                      <div>
                                        <span className={`status status-${(request.status || 'pending').toLowerCase().replace(/\s+/g, '-')}`}>
                                          {request.status || 'Pending'}
                                        </span>
                                      </div>
                                      <div>{request.createdAt}</div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )
                          )}
                        </div>
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
            </div>

            {/* Pagination Controls */}
            <div className="pagination">
              <span className="pagination-info">
                Showing {filteredAccounts.length === 0 ? 0 : startIndex + 1}–{Math.min(filteredAccounts.length, startIndex + PAGE_SIZE)} of {filteredAccounts.length} account{filteredAccounts.length === 1 ? '' : 's'}
              </span>
              {totalPages > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    aria-label="Previous page"
                  >
                    ‹
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((pg) => (
                    <button
                      key={pg}
                      type="button"
                      className={currentPage === pg ? 'active' : ''}
                      onClick={() => setCurrentPage(pg)}
                      aria-label={`Page ${pg}`}
                      aria-current={currentPage === pg ? 'page' : undefined}
                    >
                      {pg}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    aria-label="Next page"
                  >
                    ›
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </div>

      {/* Confirmation Modal for Unarchive */}
      {showConfirmUnarchive && (
        <div className="archive-modal-backdrop" onClick={() => !unarchiving && setShowConfirmUnarchive(false)}>
          <div
            className="archive-confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Confirm restore"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="archive-confirm-icon-wrap">
              <FaExclamationTriangle className="archive-confirm-icon" aria-hidden="true" />
            </div>
            <h3 className="archive-confirm-title">
              {accountToUnarchive ? 'Restore Account' : 'Restore Selected Accounts'}
            </h3>
            <p className="archive-confirm-message">
              {accountToUnarchive ? (
                <>
                  Are you sure you want to restore <strong>{accountToUnarchive.name || accountToUnarchive.username}</strong> ({accountToUnarchive.accountType === 'student' ? 'Student' : 'Staff'}) to active status?
                  {accountToUnarchive.accountType === 'student' && ' Their archived requests will also be restored.'}
                </>
              ) : (
                <>
                  Are you sure you want to restore <strong>{selectedAccounts.length}</strong> selected account{selectedAccounts.length === 1 ? '' : 's'}?
                  Any student requests linked to these accounts will also be restored.
                </>
              )}
            </p>
            <div className="archive-confirm-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setShowConfirmUnarchive(false)}
                disabled={unarchiving}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-restore-confirm"
                onClick={handleUnarchive}
                disabled={unarchiving}
              >
                {unarchiving ? (
                  <span>Restoring...</span>
                ) : (
                  <>
                    <FaUndo aria-hidden="true" />
                    <span>Confirm Restore</span>
                  </>
                )}
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
    </div>
  );
};

export default Archive;
