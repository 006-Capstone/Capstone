import { useState, useEffect } from 'react';
import {
  MdAdd,
  MdConfirmationNumber,
  MdKeyboardArrowRight,
  MdInbox
} from 'react-icons/md';
import {
  HiOutlineDocumentAdd,
  HiOutlineDocumentText,
  HiOutlineCheckCircle
} from 'react-icons/hi';
import { db } from '../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import LoadingSpinner from './LoadingSpinner';
import StatusBadge from './StatusBadge';
import '../styles/Dashboard.css';

// Each card opens Request History pre-filtered to the matching status
// ('All Status' = no filter). Values match the MyRequest dropdown options.
const STAT_CARDS = [
  {
    id: 'total',
    top: 'TOTAL',
    title: 'All Request',
    icon: <MdConfirmationNumber aria-hidden="true" />,
    getValue: (s) => s.total,
    filter: 'All Status'
  },
  {
    id: 'submitted',
    top: 'SUBMITTED',
    title: 'Pending Request',
    icon: <HiOutlineDocumentAdd aria-hidden="true" />,
    getValue: (s) => s.pending,
    filter: 'Pending'
  },
  {
    id: 'active',
    top: 'ACTIVE',
    title: 'In Progress',
    icon: <HiOutlineDocumentText aria-hidden="true" />,
    getValue: (s) => s.inProgress,
    filter: 'In Process'
  },
  {
    id: 'complete',
    top: 'COMPLETE',
    title: 'Resolved',
    icon: <HiOutlineCheckCircle aria-hidden="true" />,
    getValue: (s) => s.resolved,
    filter: 'Resolved'
  }
];

function Dashboard({ onNavigate, onViewDetails, onViewRequests }) {
  const [studentName, setStudentName] = useState('');
  const [requests, setRequests] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    inProgress: 0,
    resolved: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    // Get student info from localStorage
    const studentData = localStorage.getItem('studentData');
    if (studentData) {
      const student = JSON.parse(studentData);
      const fullName = student.firstName && student.lastName
        ? `${student.firstName} ${student.lastName}`
        : student.name || 'Student';
      setStudentName(fullName);

      // Use studentId, fallback to id or uid
      const identifier = student.studentId || student.id || student.uid;
      loadRequests(identifier, student.uid);
    }
  }, []);

  const loadRequests = async (studentId, studentUid) => {
    try {
      setLoading(true);
      setError('');

      // Query all requests for this student
      const requestsRef = collection(db, 'requests');
      let q = query(
        requestsRef,
        where('studentId', '==', studentId)
      );

      let querySnapshot = await getDocs(q);

      // If no results, try with studentUid
      if (querySnapshot.empty && studentUid) {
        q = query(
          requestsRef,
          where('studentUid', '==', studentUid)
        );
        querySnapshot = await getDocs(q);
      }

      const allRequests = querySnapshot.docs.map(doc => {
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

      // Sort by date manually (newest first)
      allRequests.sort((a, b) => b.createdAtTimestamp - a.createdAtTimestamp);

      // Calculate stats
      const newStats = {
        total: allRequests.length,
        pending: allRequests.filter(r => r.status === 'Pending').length,
        inProgress: allRequests.filter(r => r.status === 'In Process').length,
        resolved: allRequests.filter(r => r.status === 'Resolved').length
      };

      setStats(newStats);

      // Get recent 5 requests
      setRequests(allRequests.slice(0, 5));
    } catch (loadError) {
      console.error('[Error] Error loading dashboard:', loadError);
      setError('Unable to load your requests. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dashboard">
      <div className="page-header">
        <h1>Welcome back, {studentName}</h1>
        <button type="button" className="create-btn" onClick={() => onNavigate('new-request')}>
          <MdAdd aria-hidden="true" />
          CREATE NEW REQUEST
        </button>
      </div>

      <div className="stats" role="group" aria-label="Request summary">
        {STAT_CARDS.map((card) => (
          <button
            key={card.id}
            type="button"
            className={`stat-card ${card.id}`}
            onClick={() => onViewRequests?.(card.filter)}
            aria-label={`View ${card.title} in Request History`}
          >
            <span className="stat-card-label">{card.top}</span>
            <div className="icon">{card.icon}</div>
            <h2>{card.title}</h2>
            <div className="number">{card.getValue(stats)}</div>
          </button>
        ))}
      </div>

      <section className="recent-requests" aria-labelledby="recent-requests-title">
        <div className="section-header">
          <h2 id="recent-requests-title">Recent Request</h2>
          <button type="button" className="view-all-btn" onClick={() => onNavigate('request')}>
            View all My Request
            <MdKeyboardArrowRight aria-hidden="true" />
          </button>
        </div>

        <div className="table-container">
          {loading ? (
            <LoadingSpinner message="Loading requests..." fullScreen={false} />
          ) : error ? (
            <div className="empty-state">
              <MdInbox className="empty-state-icon" aria-hidden="true" />
              <p>{error}</p>
            </div>
          ) : requests.length === 0 ? (
            <div className="empty-state">
              <MdInbox className="empty-state-icon" aria-hidden="true" />
              <p>No requests yet. Create your first request to get started!</p>
            </div>
          ) : (
            <table className="data-table">
              <caption className="sr-only">Your recent requests</caption>
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
                {requests.map((req, index) => (
                  <tr key={req.firestoreId || index} onClick={() => onViewDetails?.(req)}>
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
                          onViewDetails?.(req);
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
          )}
        </div>
      </section>
    </div>
  );
}

export default Dashboard;
