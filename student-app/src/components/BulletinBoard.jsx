import { useState, useEffect } from 'react';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import LoadingSpinner from './LoadingSpinner';
import AnnouncementCard from './AnnouncementCard';
import '../styles/BulletinBoard.css';

// Default hero shown until an office saves a featured announcement
const DEFAULT_HERO = {
  office: '',
  title: 'Welcome to the Bulletin Board',
  body: 'Stay updated with the latest announcements and important deadlines'
};

const ITEMS_PER_PAGE = 5;

function BulletinBoard() {
  const [announcements, setAnnouncements] = useState([]);
  const [deadlines, setDeadlines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hero, setHero] = useState(DEFAULT_HERO);
  const [selectedOffice, setSelectedOffice] = useState('All Offices');
  const [currentPage, setCurrentPage] = useState(1);

  const offices = ['All Offices', 'Finance', 'Library', 'Registrar', 'Guidance'];

  // Filter announcements by selected office (check department field - case-insensitive)
  const filteredAnnouncements = selectedOffice === 'All Offices'
    ? announcements
    : announcements.filter(a => {
        const department = a.department?.toLowerCase();
        const selectedLower = selectedOffice.toLowerCase();
        return department === selectedLower;
      });

  // Pagination
  const totalPages = Math.ceil(filteredAnnouncements.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedAnnouncements = filteredAnnouncements.slice(startIndex, endIndex);

  // Reset to page 1 when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedOffice]);

  useEffect(() => {
    let unsubscribeAnnouncements = null;
    let unsubscribeDeadlines = null;
    let unsubscribeHero = null;

    try {
      // Load all announcements (from all offices)
      const announcementsQuery = query(
        collection(db, 'announcements'),
        orderBy('createdAt', 'desc')
      );

      unsubscribeAnnouncements = onSnapshot(announcementsQuery, (querySnapshot) => {
        const announcementsData = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setAnnouncements(announcementsData);
        setLoading(false);
      }, (error) => {
        console.error('[Error] Error loading announcements:', error);
        setLoading(false);
      });

      // Load all important dates (from all offices) - students see all deadlines.
      // No orderBy in the query so no composite index is required — sorted
      // client-side instead (matches the admin app).
      const deadlinesQuery = query(
        collection(db, 'importantDates')
      );

      unsubscribeDeadlines = onSnapshot(deadlinesQuery, (querySnapshot) => {
        const deadlinesData = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        deadlinesData.sort((a, b) => (a.dateValue || 0) - (b.dateValue || 0));
        setDeadlines(deadlinesData);
      }, (error) => {
        console.error('[Error] Error loading deadlines:', error);
      });

      // Featured (semestral) announcement — the most recently updated one
      // across all offices, shown as the hero banner.
      unsubscribeHero = onSnapshot(collection(db, 'bulletinHero'), (querySnapshot) => {
        const heroes = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        heroes.sort((a, b) => {
          const aTime = a.updatedAt?.toDate ? a.updatedAt.toDate().getTime() : 0;
          const bTime = b.updatedAt?.toDate ? b.updatedAt.toDate().getTime() : 0;
          return bTime - aTime;
        });
        const latest = heroes[0];
        if (latest && (latest.title || latest.body)) {
          setHero({
            office: latest.office || '',
            title: latest.title || DEFAULT_HERO.title,
            body: latest.body || DEFAULT_HERO.body
          });
        } else {
          setHero(DEFAULT_HERO);
        }
      }, (error) => {
        console.error('[Error] Error loading featured announcement:', error);
        setHero(DEFAULT_HERO);
      });
    } catch (error) {
      console.error('[Error] Error loading bulletin data:', error);
      setLoading(false);
    }

    return () => {
      if (unsubscribeAnnouncements) unsubscribeAnnouncements();
      if (unsubscribeDeadlines) unsubscribeDeadlines();
      if (unsubscribeHero) unsubscribeHero();
    };
  }, []);

  // Mark announcements as read when user views the bulletin board
  useEffect(() => {
    if (announcements.length > 0) {
      const announcementIds = announcements.map(a => a.id);
      localStorage.setItem('readAnnouncements', JSON.stringify(announcementIds));
    }
  }, [announcements]);

  return (
    <div className="bulletin-board-page">
      <div className="page-header">
        <h1>Bulletin Board</h1>
      </div>

      <div className="hero-banner">
        <div className="hero-overlay">
          {hero.office && (
            <span className="hero-kicker">{hero.office} OFFICE</span>
          )}
          <h2 className="hero-title">{hero.title}</h2>
          <p className="hero-subtitle">{hero.body}</p>
        </div>
      </div>

      <div className="bulletin-content">
        <div className="announcements-section">
          <div className="announcements-header">
            <h3>Announcements</h3>
            <div className="office-filters">
              {offices.map(office => (
                <button
                  key={office}
                  className={`filter-btn ${selectedOffice === office ? 'active' : ''}`}
                  onClick={() => setSelectedOffice(office)}
                >
                  {office}
                </button>
              ))}
            </div>
          </div>
          
          {loading ? (
            <LoadingSpinner message="Loading announcements..." fullScreen={false} />
          ) : filteredAnnouncements.length === 0 ? (
            <div className="empty-state">
              <p>
                {selectedOffice === 'All Offices' 
                  ? 'No announcements at this time. Check back later for updates!' 
                  : `No announcements from ${selectedOffice} at this time.`}
              </p>
            </div>
          ) : (
            <>
              {paginatedAnnouncements.map((announcement) => (
                <AnnouncementCard key={announcement.id} announcement={announcement} />
              ))}
              
              {totalPages > 1 && (
                <div className="pagination">
                  <button
                    className="pagination-btn"
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                  >
                    ← Previous
                  </button>
                  
                  <div className="pagination-info">
                    Page {currentPage} of {totalPages}
                  </div>
                  
                  <button
                    className="pagination-btn"
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
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
          
          {deadlines.length === 0 ? (
            <div className="empty-state-small">
              <p>No upcoming deadlines</p>
            </div>
          ) : (
            deadlines.map((deadline) => (
              <div key={deadline.id} className="deadline-item">
                <div className="deadline-date">
                  <div className="month">{deadline.month}</div>
                  <div className="day">{parseInt(deadline.day, 10) || deadline.day}</div>
                </div>
                <div className="deadline-details">
                  <div className="deadline-title">{deadline.title}</div>
                  <div className="deadline-office">{deadline.office}</div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default BulletinBoard;
