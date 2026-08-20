import React, { useState, useEffect } from 'react';
import { FaPlus, FaDownload, FaUndo } from 'react-icons/fa';
import { collection, query, orderBy, onSnapshot, addDoc, deleteDoc, doc, where, getDocs, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../firebase';
import NotificationBell from './NotificationBell';
import LoadingSpinner from './LoadingSpinner';
import '../styles/Archive.css';

const Archive = () => {
  const [archivedAccounts, setArchivedAccounts] = useState([]);
  const [archivedRequests, setArchivedRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [archiveFilter, setArchiveFilter] = useState('All'); // 'All', 'Students', 'Staff'
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedAccounts, setSelectedAccounts] = useState([]);
  const [selectAll, setSelectAll] = useState(false);
  const [unarchiving, setUnarchiving] = useState(false);
  const [expandedAccountId, setExpandedAccountId] = useState(null); // Track which account is expanded
  const PAGE_SIZE = 10;

  // Load archived accounts and requests from Firestore
  useEffect(() => {
    const loadArchivedAccounts = () => {
      try {
        const archivedQuery = query(
          collection(db, 'archivedAccounts'),
          orderBy('archivedAt', 'desc')
        );
        
        const unsubscribe = onSnapshot(archivedQuery, (querySnapshot) => {
          const archivedData = querySnapshot.docs.map(doc => {
            const data = doc.data();
            
            // Safely format archivedAt
            let formattedArchivedAt = 'N/A';
            try {
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
              console.error('[Warning] Failed to format archivedAt:', err);
            }
            
            return {
              firestoreId: doc.id,
              ...data,
              archivedAt: formattedArchivedAt
            };
          });
          console.log('[Success] Loaded', archivedData.length, 'archived accounts');
          setArchivedAccounts(archivedData);
          setLoading(false);
        }, (error) => {
          console.error('[Error] loading archived accounts:', error);
          setLoading(false);
        });
        
        return unsubscribe;
      } catch (error) {
        console.error('[Error] setting up archived accounts listener:', error);
        setLoading(false);
      }
    };

    const loadArchivedRequests = () => {
      try {
        const requestsQuery = query(
          collection(db, 'archivedRequests'),
          orderBy('archivedAt', 'desc')
        );
        
        const unsubscribe = onSnapshot(requestsQuery, (querySnapshot) => {
          const requestsData = querySnapshot.docs.map(doc => {
            const data = doc.data();
            
            // Safely format dates
            let formattedArchivedAt = 'N/A';
            let formattedCreatedAt = 'N/A';
            
            try {
              if (data.archivedAt) {
                if (typeof data.archivedAt.toDate === 'function') {
                  formattedArchivedAt = data.archivedAt.toDate().toLocaleDateString('en-US', { 
                    month: 'short', 
                    day: 'numeric', 
                    year: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit'
                  });
                } else if (typeof data.archivedAt === 'string') {
                  formattedArchivedAt = data.archivedAt;
                }
              }
            } catch (err) {
              console.error('[Warning] Failed to format archivedAt:', err);
            }
            
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
              console.error('[Warning] Failed to format createdAt:', err);
            }
            
            return {
              firestoreId: doc.id,
              ...data,
              archivedAt: formattedArchivedAt,
              createdAt: formattedCreatedAt
            };
          });
          console.log('[Success] Loaded', requestsData.length, 'archived requests');
          setArchivedRequests(requestsData);
        }, (error) => {
          console.error('[Error] loading archived requests:', error);
        });
        
        return unsubscribe;
      } catch (error) {
        console.error('[Error] setting up archived requests listener:', error);
      }
    };

    const unsubscribeAccounts = loadArchivedAccounts();
    const unsubscribeRequests = loadArchivedRequests();
    
    return () => {
      if (unsubscribeAccounts) unsubscribeAccounts();
      if (unsubscribeRequests) unsubscribeRequests();
    };
  }, []);

  // Filter archived accounts
  const filteredAccounts = archivedAccounts.filter(account => {
    if (archiveFilter === 'All') return true;
    if (archiveFilter === 'Students') return account.accountType === 'student';
    if (archiveFilter === 'Staff') return account.accountType === 'staff';
    return true;
  });

  // Pagination
  const totalPages = Math.ceil(filteredAccounts.length / PAGE_SIZE);
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const paginatedAccounts = filteredAccounts.slice(startIndex, startIndex + PAGE_SIZE);

  // Reset pagination and selections when filter changes
  useEffect(() => {
    setCurrentPage(1);
    setSelectedAccounts([]);
    setSelectAll(false);
  }, [archiveFilter]);

  // Handle individual checkbox selection
  const handleSelectAccount = (id) => {
    setSelectedAccounts(prev =>
      prev.includes(id) ? prev.filter(aid => aid !== id) : [...prev, id]
    );
  };

  // Handle select all checkbox
  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedAccounts([]);
    } else {
      setSelectedAccounts(paginatedAccounts.map(a => a.firestoreId));
    }
    setSelectAll(!selectAll);
  };

  // Unarchive selected accounts
  const handleUnarchive = async () => {
    const accountsToRestore = archivedAccounts.filter(a => selectedAccounts.includes(a.firestoreId));
    
    if (accountsToRestore.length === 0) {
      alert('Please select accounts to unarchive');
      return;
    }

    const studentCount = accountsToRestore.filter(a => a.accountType === 'student').length;
    const staffCount = accountsToRestore.filter(a => a.accountType === 'staff').length;
    
    const confirmMessage = `Are you sure you want to unarchive ${accountsToRestore.length} account(s)?\n\n` +
      (studentCount > 0 ? `- ${studentCount} student(s) and their requests will be restored\n` : '') +
      (staffCount > 0 ? `- ${staffCount} staff member(s) will be restored\n` : '') +
      `\nRestored accounts will require a password reset for security.`;

    if (!window.confirm(confirmMessage)) {
      return;
    }

    setUnarchiving(true);
    try {
      const currentUser = auth.currentUser;
      const restoredBy = currentUser ? currentUser.email : 'unknown';

      for (const account of accountsToRestore) {
        // Prepare account data for restoration
        const { firestoreId, accountType, archivedAt, archivedReason, originalCollection, originalRequestId, ...accountData } = account;

        // Add restoration metadata
        const restoredAccountData = {
          ...accountData,
          restoredAt: serverTimestamp(),
          restoredBy: restoredBy,
          mustChangePassword: true, // Force password reset for security
          // Keep original isActive status or default to false for manual review
          isActive: accountData.isActive !== undefined ? accountData.isActive : false
        };

        // Restore account to original collection
        const targetCollection = accountType === 'student' ? 'students' : 'staff';
        await addDoc(collection(db, targetCollection), restoredAccountData);
        console.log(`[Success] Restored ${accountType} ${accountData.name} to ${targetCollection}`);

        // If student, restore their archived requests
        if (accountType === 'student' && accountData.uid) {
          const archivedRequestsQuery = query(
            collection(db, 'archivedRequests'),
            where('studentUid', '==', accountData.uid)
          );
          
          const archivedRequestsSnapshot = await getDocs(archivedRequestsQuery);
          console.log(`[Unarchive] Found ${archivedRequestsSnapshot.size} archived requests for student ${accountData.name}`);
          
          // Restore each request
          for (const requestDoc of archivedRequestsSnapshot.docs) {
            const { archivedAt, archivedReason, originalRequestId, ...requestData } = requestDoc.data();
            
            await addDoc(collection(db, 'requests'), {
              ...requestData,
              restoredAt: serverTimestamp(),
              restoredBy: restoredBy
            });
            
            // Delete from archived requests
            await deleteDoc(doc(db, 'archivedRequests', requestDoc.id));
          }
        }

        // Delete ALL archived copies with matching UID (in case of duplicates)
        const archivedAccountsQuery = query(
          collection(db, 'archivedAccounts'),
          where('uid', '==', accountData.uid)
        );
        
        const archivedAccountsSnapshot = await getDocs(archivedAccountsQuery);
        console.log(`[Unarchive] Found ${archivedAccountsSnapshot.size} archived account(s) for ${accountData.name}`);
        
        for (const archivedDoc of archivedAccountsSnapshot.docs) {
          await deleteDoc(doc(db, 'archivedAccounts', archivedDoc.id));
          console.log(`[Success] Deleted account ${accountData.name} (${archivedDoc.id}) from archive`);
        }
      }

      // Wait for Firestore real-time listeners to update
      await new Promise(resolve => setTimeout(resolve, 1000));

      const message = studentCount > 0 && staffCount > 0
        ? `Successfully unarchived ${studentCount} student(s) with their requests and ${staffCount} staff member(s)`
        : studentCount > 0
        ? `Successfully unarchived ${studentCount} student(s) and their related requests`
        : `Successfully unarchived ${staffCount} staff member(s)`;
      
      console.log('[Success] Unarchive complete:', message);
      alert(message + '\n\nRestored accounts will require password reset on next login.');
      setSelectedAccounts([]);
      setSelectAll(false);
      setExpandedAccountId(null); // Close any expanded rows
    } catch (error) {
      console.error('[Error] unarchiving accounts:', error);
      console.error('[Error details]:', error.message, error.code);
      if (error.code === 'permission-denied') {
        alert('Permission denied. Unable to delete from archive. Please check Firestore security rules.');
      } else {
        alert('Failed to unarchive accounts: ' + error.message);
      }
    } finally {
      setUnarchiving(false);
    }
  };

  // Get requests for a specific student
  const getStudentRequests = (studentUid) => {
    return archivedRequests.filter(req => req.studentUid === studentUid);
  };

  // Toggle expanded account
  const toggleExpandAccount = (accountId) => {
    setExpandedAccountId(expandedAccountId === accountId ? null : accountId);
  };
  const exportToCSV = () => {
    if (filteredAccounts.length === 0) {
      alert('No data to export');
      return;
    }

    // Create CSV content
    const headers = ['Account Type', 'Name', 'Email', 'ID/Username', 'Archived Date', 'Request Count'];
    const rows = filteredAccounts.map(account => {
      const idOrUsername = account.accountType === 'student' ? account.id : account.username;
      const requestCount = account.accountType === 'student' ? getStudentRequests(account.uid).length : 0;
      return [
        account.accountType,
        account.name || `${account.firstName || ''} ${account.lastName || ''}`.trim(),
        account.email || '',
        idOrUsername || '',
        account.archivedAt || '',
        requestCount
      ];
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    // Download CSV
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `archived_accounts_${archiveFilter}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="superadmin-page archive-container">
      <div className="page-header">
        <div>
          <h1 className="archive-title">Archive</h1>
          <p className="page-subtitle">View archived accounts and their requests</p>
        </div>
        <div className="header-actions">
          {selectedAccounts.length > 0 && (
            <button className="btn-unarchive" onClick={handleUnarchive} disabled={unarchiving}>
              <FaUndo aria-hidden="true" />
              Unarchive ({selectedAccounts.length})
            </button>
          )}
          <button className="btn-export" onClick={exportToCSV} disabled={filteredAccounts.length === 0}>
            <FaDownload aria-hidden="true" />
            Export to CSV
          </button>
          <NotificationBell />
        </div>
      </div>

      {/* Filter Buttons */}
      <div className="archive-filters-row">
        <div className="archive-filter-buttons">
          <button
            className={`filter-btn ${archiveFilter === 'All' ? 'active' : ''}`}
            onClick={() => setArchiveFilter('All')}
          >
            All Accounts
          </button>
          <button
            className={`filter-btn ${archiveFilter === 'Students' ? 'active' : ''}`}
            onClick={() => setArchiveFilter('Students')}
          >
            Students Only
          </button>
          <button
            className={`filter-btn ${archiveFilter === 'Staff' ? 'active' : ''}`}
            onClick={() => setArchiveFilter('Staff')}
          >
            Staff Only
          </button>
        </div>
        <div className="archive-count">
          {filteredAccounts.length} account{filteredAccounts.length === 1 ? '' : 's'}
        </div>
      </div>

      {/* Table */}
      <div className="table-section">
        {loading ? (
          <LoadingSpinner message="Loading archived accounts..." fullScreen={false} />
        ) : archivedAccounts.length === 0 ? (
          <div className="empty-state">
            <p>No archived accounts yet</p>
          </div>
        ) : filteredAccounts.length === 0 ? (
          <div className="empty-state">
            <p>No {archiveFilter.toLowerCase()} accounts in archive</p>
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
                      aria-label="Select all accounts"
                    />
                  </div>
                  <div className="table-cell">Type</div>
                  <div className="table-cell">ID/Username</div>
                  <div className="table-cell">Name</div>
                  <div className="table-cell">Email</div>
                  <div className="table-cell">Requests</div>
                  <div className="table-cell">Archived Date</div>
                </div>
                {paginatedAccounts.map((account) => {
                  const studentRequests = account.accountType === 'student' ? getStudentRequests(account.uid) : [];
                  const isExpanded = expandedAccountId === account.firestoreId;
                  
                  return (
                    <React.Fragment key={account.firestoreId}>
                      <div 
                        className={`table-row ${isExpanded ? 'expanded' : ''} ${account.accountType === 'student' && studentRequests.length > 0 ? 'clickable' : ''}`}
                        onClick={() => {
                          if (account.accountType === 'student') {
                            toggleExpandAccount(account.firestoreId);
                          }
                        }}
                      >
                        <div className="table-cell checkbox-cell" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selectedAccounts.includes(account.firestoreId)}
                            onChange={() => handleSelectAccount(account.firestoreId)}
                            aria-label={`Select ${account.name}`}
                          />
                        </div>
                        <div className="table-cell">
                          <span className={`account-type-badge ${account.accountType}`}>
                            {account.accountType === 'student' ? 'Student' : 'Staff'}
                          </span>
                        </div>
                        <div className="table-cell">{account.accountType === 'student' ? account.id : account.username}</div>
                        <div className="table-cell">{account.name || `${account.firstName || ''} ${account.lastName || ''}`.trim()}</div>
                        <div className="table-cell">{account.email}</div>
                        <div className="table-cell">
                          {account.accountType === 'student' ? (
                            <span className="request-count">
                              {studentRequests.length} {studentRequests.length === 1 ? 'request' : 'requests'}
                            </span>
                          ) : (
                            <span className="no-requests">N/A</span>
                          )}
                        </div>
                        <div className="table-cell">{account.archivedAt}</div>
                      </div>
                      
                      {/* Expanded Requests Section */}
                      {isExpanded && account.accountType === 'student' && (
                        <div className="expanded-requests">
                          {studentRequests.length === 0 ? (
                            <div className="no-requests-message">No archived requests for this student</div>
                          ) : (
                            <div className="requests-list">
                              <div className="requests-header">Archived Requests ({studentRequests.length})</div>
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
                                    <div>{request.subject || 'N/A'}</div>
                                    <div>{request.office || request.officeName || 'N/A'}</div>
                                    <div>
                                      <span className={`status-badge ${request.status}`}>
                                        {request.status || 'N/A'}
                                      </span>
                                    </div>
                                    <div>{request.createdAt}</div>
                                    <div>{request.archivedAt}</div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="pagination">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  aria-label="Previous page"
                >
                  ‹
                </button>
                <span className="pagination-info">
                  Page {currentPage} of {totalPages}
                </span>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((pg) => (
                  <button
                    key={pg}
                    className={currentPage === pg ? 'active' : ''}
                    onClick={() => setCurrentPage(pg)}
                    aria-label={`Page ${pg}`}
                    aria-current={currentPage === pg ? 'page' : undefined}
                  >
                    {pg}
                  </button>
                ))}
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  aria-label="Next page"
                >
                  ›
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default Archive;
 
