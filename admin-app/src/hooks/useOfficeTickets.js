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

  useEffect(() => {
    if (!department) {
      setTickets([]);
      setLoading(false);
      setError(null);
      return undefined;
    }

    setLoading(true);
    setError(null);

    const q = query(
      collection(db, 'requests'),
      where('office', '==', department)
    );

    console.log('[useOfficeTickets] Querying requests for department:', department);
    console.log('[useOfficeTickets] Query will match requests where office ==', department);

    // Safety net: if Firestore never responds, stop loading so the page
    // renders an (empty/error) state and stays fully navigable.
    let settled = false;
    const timer = setTimeout(() => {
      settled = true;
      setError(new Error('Timed out while loading tickets. Check your connection.'));
      setLoading(false);
    }, SNAPSHOT_TIMEOUT_MS);

    const finish = () => {
      clearTimeout(timer);
      settled = true;
    };

    const unsubscribe = onSnapshot(
      q,
      { includeMetadataChanges: true },
      (querySnapshot) => {
        if (settled) return;
        
        // Skip metadata-only changes
        if (querySnapshot.metadata.hasPendingWrites) {
          console.log('[useOfficeTickets] Skipping snapshot - has pending writes');
          return;
        }
        
        if (querySnapshot.metadata.fromCache) {
          console.log('[useOfficeTickets] Snapshot from cache');
        } else {
          console.log('[useOfficeTickets] Snapshot from server');
        }
        
        finish();

        console.log('[useOfficeTickets] Firestore snapshot received');
        console.log('[useOfficeTickets] Received', querySnapshot.docs.length, 'requests for', department);

        const ticketsData = querySnapshot.docs
          .map(doc => {
            const data = doc.data();
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
              createdAtTimestamp: data.createdAt?.toDate?.().getTime?.() || 0,
              ...data
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
        setLoading(false);
      },
      (err) => {
        if (settled) return;
        finish();
        console.error('[Error] Error loading tickets:', err);
        setError(err);
        setLoading(false);
      }
    );

    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }, [department]);

  return { tickets, loading, error };
};

export default useOfficeTickets;
