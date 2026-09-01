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
const STAT_CARDS = [
  {
    id: 'total',
    top: 'TOTAL REQUESTS',
    title: 'All Requests',
    icon: <MdConfirmationNumber aria-hidden="true" />,
    getValue: (s) => s.total,
    filter: 'All Status'
  },
  {
    id: 'submitted',
    top: 'AWAITING REVIEW',
    title: 'Pending',
    icon: <HiOutlineDocumentAdd aria-hidden="true" />,
    getValue: (s) => s.pending,
    filter: 'Pending'
  },
  {
    id: 'active',
    top: 'IN PROGRESS',
    title: 'Processing',
    icon: <HiOutlineDocumentText aria-hidden="true" />,
    getValue: (s) => s.inProgress,
    filter: 'In Process'
  },
  {
    id: 'complete',
    top: 'COMPLETED',
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
    const studentData = localStorage.getItem('studentData');
    if (studentData) {
      const student = JSON.parse(studentData);
      const fullName = student.firstName && student.lastName
        ? `${student.firstName} ${student.lastName}`
        : student.name || 'Student';
      setStudentName(fullName);

      const identifier = student.studentId || student.id || student.uid;
      loadRequests(identifier, student.uid);
    }
  }, []);

  const loadRequests = async (studentId, studentUid) => {
    try {
      setLoading(true);
      setError('');

      const requestsRef = collection(db, 'requests');
      let q = query(
        requestsRef,
        where('studentId', '==', studentId)
      );

      let querySnapshot = await getDocs(q);

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
            month: 'short',
            day: 'numeric',
            year: 'numeric'
          }) || 'N/A',
          status: data.status,
          createdAtTimestamp: data.createdAt?.toDate().getTime() || 0,
          ...data
        };
      });

      allRequests.sort((a, b) => b.createdAtTimestamp - a.createdAtTimestamp);

      const newStats = {
        total: allRequests.length,
        pending: allRequests.filter(r => r.status === 'Pending').length,
        inProgress: allRequests.filter(r => r.status === 'In Process').length,
        resolved: allRequests.filter(r => r.status === 'Resolved').length
      };

      setStats(newStats);
      setRequests(allRequests.slice(0, 5));
    } catch (loadError) {
      console.error('[Error] Error loading dashboard:', loadError);
      setError('Unable to load your requests. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const currentDateFormatted = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  return (
    <div className="dashboard">
      <div className="page-header dashboard-header">
        <div className="dashboard-welcome">
          <span className="dashboard-date-badge">{currentDateFormatted}</span>
          <h1>Welcome back, {studentName}</h1>
          <p className="page-header-subtitle">Track your requests, check office announcements, and submit feedback.</p>
        </div>
        <button type="button" className="create-btn" onClick={() => onNavigate('new-request')}>
          <MdAdd aria-hidden="true" />
          <span>CREATE NEW REQUEST</span>
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
            <div className="stat-card-top-row">
              <span className="stat-card-label">{card.top}</span>
              <div className="stat-card-action-icon" aria-hidden="true">
                <MdKeyboardArrowRight />
              </div>
            </div>
            <div className="stat-card-body">
              <div className="icon">{card.icon}</div>
              <div className="stat-card-numbers">
                <div className="number">{card.getValue(stats)}</div>
                <h2>{card.title}</h2>
              </div>
            </div>
          </button>
        ))}
      </div>

      <section className="recent-requests" aria-labelledby="recent-requests-title">
        <div className="section-header">
          <div className="section-header-title-group">
            <h2 id="recent-requests-title">Recent Requests</h2>
            <span className="section-header-chip">{requests.length} of {stats.total}</span>
          </div>
          <button type="button" className="view-all-btn" onClick={() => onNavigate('request')}>
            <span>View All Requests</span>
            <MdKeyboardArrowRight aria-hidden="true" />
          </button>
        </div>

        <div className="table-container">
          {loading ? (
            <LoadingSpinner message="Loading requests..." fullScreen={false} />
          ) : error ? (
            <div className="empty-state">
              <MdInbox className="empty-state-icon" aria-hidden="true" />
              <h3>Could not load requests</h3>
              <p>{error}</p>
            </div>
          ) : requests.length === 0 ? (
            <div className="empty-state">
              <MdInbox className="empty-state-icon" aria-hidden="true" />
              <h3>No Requests Yet</h3>
              <p>You haven't submitted any requests yet. Click the button above to create your first academic request.</p>
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
