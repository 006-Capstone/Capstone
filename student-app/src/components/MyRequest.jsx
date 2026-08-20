import { useState, useEffect } from 'react';
import {
  MdSearch,
  MdClose,
  MdKeyboardArrowLeft,
  MdKeyboardArrowRight,
  MdInbox
} from 'react-icons/md';
import { db } from '../firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import LoadingSpinner from './LoadingSpinner';
import Breadcrumb from './Breadcrumb';
import StatusBadge from './StatusBadge';
import FilterDropdown from './FilterDropdown';
import '../styles/MyRequest.css';

// Same filter UI as the admin-app My Tickets page — status options cover every
// state a student's own request can actually be in (staff can return requests,
// so Returned / For Follow Up are included too).
const STATUS_OPTIONS = ['All Status', 'Pending', 'In Process', 'Resolved', 'Cancelled', 'Returned', 'For Follow Up'];
const OFFICE_OPTIONS = ['All Offices', 'Finance', 'Library', 'Registrar', 'Guidance'];
const PAGE_SIZE = 8;

function MyRequest({ onViewDetails, onNavigate, initialStatusFilter = 'All Status' }) {
  const [searchQuery, setSearchQuery] = useState('');
  // Seeded from the dashboard stat cards (Pending / In Process / Resolved),
  // otherwise defaults to showing every request.
  const [statusFilter, setStatusFilter] = useState(initialStatusFilter);
  const [officeFilter, setOfficeFilter] = useState('All Offices');
  const [currentPage, setCurrentPage] = useState(1);
  const [requests, setRequests] = useState([]);
  const [filteredRequests, setFilteredRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadRequests();
  }, []);

  useEffect(() => {
    // Filter requests based on search and filters
    filterRequests();
    // eslint-disable-next-line
  }, [searchQuery, statusFilter, officeFilter, requests]);

  const loadRequests = () => {
    try {
      setLoading(true);
      setError('');

      // Get student data from localStorage
      const studentData = localStorage.getItem('studentData');
      if (!studentData) {
        console.error('Student data not found');
        setLoading(false);
        return;
      }

      const student = JSON.parse(studentData);

      if (!student.uid) {
        console.error('Student UID not found');
        setError('Unable to load requests. Please log in again.');
        setLoading(false);
        return;
      }

      // Set up real-time listener using studentUid (most reliable)
      const requestsRef = collection(db, 'requests');
      const q = query(requestsRef, where('studentUid', '==', student.uid));

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const requestsData = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            firestoreId: doc.id,
            id: data.requestId,
            office: data.office,
            subject: data.subject,
            date: data.createdAt?.toDate().toLocaleDateString('en-US', {
              month: 'long',
              day: 'numeric',
              year: 'numeric'
            }) || 'N/A',
            status: data.status,
            createdAtTimestamp: data.createdAt?.toDate().getTime() || 0,
            ...data
          };
        });

        // Sort by date (newest first)
        requestsData.sort((a, b) => b.createdAtTimestamp - a.createdAtTimestamp);

        console.log('📥 Real-time update: Loaded', requestsData.length, 'requests');
        setRequests(requestsData);
        setLoading(false);
      }, (loadError) => {
        console.error('[Error] Error loading requests:', loadError);
        setError('Unable to load your requests. Please try again later.');
        setLoading(false);
      });

      // Cleanup listener on unmount
      return unsubscribe;
    } catch (loadError) {
      console.error('[Error] Error setting up listener:', loadError);
      setError('Unable to load your requests. Please try again later.');
      setLoading(false);
    }
  };

  const filterRequests = () => {
    let filtered = [...requests];

    // Search filter - search by subject OR office
    if (searchQuery) {
      filtered = filtered.filter(req =>
        req.subject?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        req.office?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Status filter
    if (statusFilter !== 'All Status') {
      filtered = filtered.filter(req => req.status === statusFilter);
    }

    // Office filter
    if (officeFilter !== 'All Offices') {
      filtered = filtered.filter(req => req.office === officeFilter);
    }

    setFilteredRequests(filtered);
    // Return to the first page whenever the filter results change
    setCurrentPage(1);
  };

  const hasActiveFilters = Boolean(searchQuery) || statusFilter !== 'All Status' || officeFilter !== 'All Offices';

  // Client-side pagination over the filtered results
  const totalPages = Math.max(1, Math.ceil(filteredRequests.length / PAGE_SIZE));
  const visibleRequests = filteredRequests.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  return (
    <div className="my-request">
      <Breadcrumb
        items={[
          { label: 'Request History', current: true },
          { label: 'New Request', onClick: () => onNavigate('new-request') }
        ]}
      />

      <div className="page-header">
        <h1>Request History</h1>
      </div>

      <div className="filters">
        <div className="search-box">
          <MdSearch aria-hidden="true" />
          <label htmlFor="request-search" className="sr-only">
            Search by subject or office
          </label>
          <input
            id="request-search"
            type="text"
            placeholder="Search by Subject or Office"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              type="button"
              className="search-clear-btn"
              onClick={() => setSearchQuery('')}
              aria-label="Clear search"
            >
              <MdClose aria-hidden="true" />
            </button>
          )}
        </div>

        <FilterDropdown
          label="Filter"
          sections={[
            {
              title: 'Status',
              options: STATUS_OPTIONS,
              value: statusFilter,
              onChange: setStatusFilter
            },
            {
              title: 'Office',
              options: OFFICE_OPTIONS,
              value: officeFilter,
              onChange: setOfficeFilter
            }
          ]}
        />
      </div>

      <div className="request-table">
        {loading ? (
          <LoadingSpinner message="Loading requests..." fullScreen={false} />
        ) : error ? (
          <div className="empty-state">
            <MdInbox className="empty-state-icon" aria-hidden="true" />
            <p>{error}</p>
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="empty-state">
            <MdInbox className="empty-state-icon" aria-hidden="true" />
            <p>
              No requests found.
              {hasActiveFilters
                ? ' Try adjusting your filters.'
                : ' Create your first request to get started!'}
            </p>
          </div>
        ) : (
          <>
            <div className="table-scroll">
              <table className="data-table">
              <caption className="sr-only">Request history</caption>
              <thead>
                <tr>
                  <th scope="col">REQUEST ID</th>
                  <th scope="col">OFFICE</th>
                  <th scope="col">SUBJECT</th>
                  <th scope="col">DATE SUBMITTED</th>
                  <th scope="col">STATUS</th>
                  <th scope="col">
                    <span className="sr-only">Details</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {visibleRequests.map((req, index) => (
                  <tr key={req.firestoreId || index} onClick={() => onViewDetails(req)}>
                    <td>#{req.id}</td>
                    <td>{req.office}</td>
                    <td>{req.subject}</td>
                    <td>{req.date}</td>
                    <td><StatusBadge status={req.status} /></td>
                    <td className="row-action">
                      <button
                        type="button"
                        className="row-action-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          onViewDetails(req);
                        }}
                        aria-label={`View details for request ${req.id || req.subject || index + 1}`}
                      >
                        <MdKeyboardArrowRight aria-hidden="true" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              </table>
            </div>

            {/* Results count — bottom-right corner of the table card */}
            <div className="table-footer">
              <p className="results-count">
                Showing <strong>{filteredRequests.length}</strong> of {requests.length} request
                {requests.length === 1 ? '' : 's'}
              </p>
            </div>
          </>
        )}
      </div>

      {totalPages > 1 && (
        <div className="pagination" aria-label="Pagination">
          <button
            type="button"
            className="page-btn"
            onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
            disabled={currentPage === 1}
            aria-label="Previous page"
          >
            <MdKeyboardArrowLeft aria-hidden="true" />
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
            <button
              type="button"
              key={page}
              className={`page-num ${currentPage === page ? 'active' : ''}`}
              onClick={() => setCurrentPage(page)}
              aria-current={currentPage === page ? 'page' : undefined}
            >
              {page}
            </button>
          ))}
          <button
            type="button"
            className="page-btn"
            onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
            disabled={currentPage === totalPages}
            aria-label="Next page"
          >
            <MdKeyboardArrowRight aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
}

export default MyRequest;
