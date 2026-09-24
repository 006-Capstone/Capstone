import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

// If no snapshot arrives within this window (e.g. the device is offline),
// resolve loading so the UI never gets stuck behind a full-screen spinner.
const SNAPSHOT_TIMEOUT_MS = 12000;

/**
 * useOfficeTickets — the single source of truth for every ticket in the
 * logged-in staff member's office.
 *
 * Both the Dashboard and the Analytics page consume this hook so they always
 * reflect the exact same live data (same Firestore query, same mapping, same
 * sorting). When a ticket is claimed, resolved, or cancelled, the snapshot
 * fires and every page using this hook re-renders with the new value — no
 * refetching, no divergence.
 *
 * @param {string} department The office name (e.g. 'Registrar')
 * @returns {{ tickets: Array, loading: boolean, error: Error|null }}
 */
export const useOfficeTickets = (department) => {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = () => setRefreshKey(k => k + 1);

  useEffect(() => {
    if (!department) {
      setTickets([]);
      setLoading(false);
      setError(null);
      return undefined;
    }

    setLoading(true);
    setError(null);

    const deptStr = String(department).trim();
    const deptLower = deptStr.toLowerCase();
    const deptTitle = deptLower.charAt(0).toUpperCase() + deptLower.slice(1);
    const deptUpper = deptStr.toUpperCase();
    const deptVariations = Array.from(new Set([deptStr, deptTitle, deptUpper, deptLower])).filter(Boolean);

    const q = deptVariations.length > 1
      ? query(collection(db, 'requests'), where('office', 'in', deptVariations))
      : query(collection(db, 'requests'), where('office', '==', deptStr));

    console.log('[useOfficeTickets] Querying requests for department variations:', deptVariations);

    // Safety net: if Firestore never responds on initial load (e.g. offline),
    // stop loading so the page renders cleanly and stays navigable.
    let initialLoadComplete = false;
    const timer = setTimeout(() => {
      if (!initialLoadComplete) {
        setError(new Error('Timed out while loading tickets. Check your connection.'));
        setLoading(false);
      }
    }, SNAPSHOT_TIMEOUT_MS);

    const unsubscribe = onSnapshot(
      q,
      { includeMetadataChanges: true },
      (querySnapshot) => {
        clearTimeout(timer);
        initialLoadComplete = true;

        if (querySnapshot.metadata.fromCache) {
          console.log('[useOfficeTickets] Snapshot from cache');
        } else {
          console.log('[useOfficeTickets] Snapshot from server');
        }

        console.log('[useOfficeTickets] Firestore snapshot received');
        console.log('[useOfficeTickets] Received', querySnapshot.docs.length, 'requests for', department);

        const ticketsData = querySnapshot.docs
          .map(doc => {
            const data = doc.data();
            let createdAtTimestamp = 0;
            if (data.createdAt?.toDate) {
              createdAtTimestamp = data.createdAt.toDate().getTime();
            } else if (data.createdAt) {
              const d = new Date(data.createdAt).getTime();
              createdAtTimestamp = isNaN(d) ? 0 : d;
            } else if (doc.metadata.hasPendingWrites) {
              createdAtTimestamp = Date.now();
            }

            console.log('[useOfficeTickets] Request:', data.requestId, 'Office:', data.office, 'Status:', data.status, 'IsGuest:', data.isGuest);
            return {
              firestoreId: doc.id,
              id: data.requestId,
              title: data.subject,
              student: data.studentName,
              studentId: data.studentId,
              status: data.status,
              assignedTo: data.assignedTo || null,
              assignedToStaff: data.assignedToStaff || null,
              ...data,
              createdAtTimestamp
            };
          })
          .filter(ticket => 
            !ticket.isGuest && 
            !ticket.isNewStudentInquiry && 
            !ticket.isAdmissionsInquiry &&
            ticket.targetRole !== 'superadmin' &&
            ticket.assignedToOffice !== 'Superadmin' &&
            ticket.office !== 'Superadmin' && 
            ticket.department !== 'Superadmin' &&
            ticket.category !== 'Admissions / Login Support'
          );

        // Newest first — same ordering the Dashboard always used
        ticketsData.sort((a, b) => b.createdAtTimestamp - a.createdAtTimestamp);

        console.log('[useOfficeTickets] Setting', ticketsData.length, 'tickets in state');
        console.log('[useOfficeTickets] Ticket statuses:', ticketsData.map(t => `${t.requestId}:${t.status}`).join(', '));
        
        setTickets(ticketsData);
        setError(null);
        setLoading(false);
      },
      (err) => {
        clearTimeout(timer);
        console.error('[Error] Error loading tickets:', err);
        setError(err);
        setLoading(false);
      }
    );

    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }, [department, refreshKey]);

  return { tickets, loading, error, refresh, setTickets };
};

export default useOfficeTickets;
