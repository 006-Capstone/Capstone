/**
 * Performance Snapshot System
 * Automatically captures and stores daily performance metrics for historical tracking
 */

import { collection, addDoc, getDocs, query, where, orderBy, limit, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import {
  calculateStaffRiskScore,
  calculate30DayPerformance,
  determineWarningStage,
  analyzeDepartmentHealth,
  calculateTicketRisk
} from './performanceAnalytics';

/**
 * Capture and store a daily performance snapshot
 * Should be run once per day (ideally at midnight or early morning)
 * @returns {Promise<string>} - Snapshot ID
 */
export const capturePerformanceSnapshot = async () => {
  try {
    // Load all current data
    const requestsSnapshot = await getDocs(collection(db, 'requests'));
    const staffSnapshot = await getDocs(collection(db, 'staff'));
    
    const allRequests = requestsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    const allStaff = staffSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    // Calculate system-wide metrics
    const activeRequests = allRequests.filter(r => 
      r.status !== 'Resolved' && r.status !== 'Cancelled'
    );
    
    const atRiskRequests = activeRequests.filter(r => {
      const { atRisk } = calculateTicketRisk(r);
      return atRisk;
    });
    
    const overdueRequests = activeRequests.filter(r => {
      const { isOverdue } = calculateTicketRisk(r);
      return isOverdue;
    });
    
    // Analyze each department
    const offices = ['Finance', 'Guidance', 'Library', 'Registrar'];
    const departmentMetrics = {};
    
    for (const office of offices) {
      const officeRequests = allRequests.filter(r => r.office === office);
      const officeStaff = allStaff.filter(s => s.office === office);
      
      const health = analyzeDepartmentHealth(officeRequests, officeStaff);
      
      departmentMetrics[office] = {
        activeTickets: health.activeTickets,
        overdueTickets: health.overdueTickets,
        atRiskTickets: health.atRiskTickets,
        onTimePercentage: health.onTimePercentage,
        status: health.status,
        staffCount: officeStaff.length
      };
    }
    
    // Analyze staff performance
    const staffMetrics = [];
    
    for (const staff of allStaff) {
      const staffRequests = allRequests.filter(r => {
        const assigned = (r.assignedTo || r.claimedBy || '').toLowerCase();
        return assigned === staff.name.toLowerCase();
      });
      
      const activeTickets = staffRequests.filter(r => 
        r.status !== 'Resolved' && r.status !== 'Cancelled'
      ).length;
      
      const overdueTickets = staffRequests.filter(r => {
        const { isOverdue } = calculateTicketRisk(r);
        return isOverdue && r.status !== 'Resolved';
      }).length;
      
      const performance = calculate30DayPerformance(staffRequests);
      const riskScore = calculateStaffRiskScore({
        tickets: staffRequests,
        activeTickets,
        overdueTickets,
        avgResolutionTime: 36
      });
      
      const warningStage = determineWarningStage({
        overdueRate: performance.overdueRate,
        consecutivePoorDays: riskScore > 50 ? 30 : 0
      });
      
      staffMetrics.push({
        staffId: staff.id,
        staffName: staff.name,
        office: staff.office,
        activeTickets,
        overdueTickets,
        riskScore,
        onTimeRate: performance.onTimeRate,
        warningStage: warningStage.stage,
        warningStageName: warningStage.stageName
      });
    }
    
    // Create snapshot document
    const snapshot = {
      capturedAt: serverTimestamp(),
      date: new Date().toISOString().split('T')[0], // YYYY-MM-DD format
      systemMetrics: {
        totalActiveTickets: activeRequests.length,
        totalOverdueTickets: overdueRequests.length,
        totalAtRiskTickets: atRiskRequests.length,
        onTrackPercentage: activeRequests.length > 0 
          ? Math.round(((activeRequests.length - atRiskRequests.length) / activeRequests.length) * 100)
          : 100,
        totalStaff: allStaff.length
      },
      departmentMetrics,
      staffMetrics,
      criticalAlerts: staffMetrics.filter(s => s.riskScore >= 70).length,
      staffAtRisk: staffMetrics.filter(s => s.riskScore >= 40).length
    };
    
    // Store in Firestore
    const docRef = await addDoc(collection(db, 'performance_snapshots'), snapshot);
    
    console.log('Performance snapshot captured:', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('Error capturing performance snapshot:', error);
    throw error;
  }
};

/**
 * Get performance snapshots for a date range
 * @param {number} days - Number of days to retrieve (default: 30)
 * @returns {Promise<array>} - Array of snapshots
 */
export const getPerformanceHistory = async (days = 30) => {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    const cutoffString = cutoffDate.toISOString().split('T')[0];
    
    const snapshotsQuery = query(
      collection(db, 'performance_snapshots'),
      where('date', '>=', cutoffString),
      orderBy('date', 'desc'),
      limit(days)
    );
    
    const snapshotsSnapshot = await getDocs(snapshotsQuery);
    
    return snapshotsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error fetching performance history:', error);
    return [];
  }
};

/**
 * Get performance trend for a specific staff member
 * @param {string} staffId - Staff member ID
 * @param {number} days - Number of days to retrieve
 * @returns {Promise<array>} - Array of performance data points
 */
export const getStaffPerformanceTrend = async (staffId, days = 30) => {
  try {
    const history = await getPerformanceHistory(days);
    
    return history.map(snapshot => {
      const staffData = snapshot.staffMetrics?.find(s => s.staffId === staffId);
      
      return {
        date: snapshot.date,
        riskScore: staffData?.riskScore || 0,
        activeTickets: staffData?.activeTickets || 0,
        overdueTickets: staffData?.overdueTickets || 0,
        onTimeRate: staffData?.onTimeRate || 100,
        warningStage: staffData?.warningStage || 0
      };
    }).reverse(); // Chronological order
  } catch (error) {
    console.error('Error fetching staff performance trend:', error);
    return [];
  }
};

/**
 * Get department performance trend
 * @param {string} department - Department name
 * @param {number} days - Number of days to retrieve
 * @returns {Promise<array>} - Array of performance data points
 */
export const getDepartmentPerformanceTrend = async (department, days = 30) => {
  try {
    const history = await getPerformanceHistory(days);
    
    return history.map(snapshot => {
      const deptData = snapshot.departmentMetrics?.[department];
      
      return {
        date: snapshot.date,
        activeTickets: deptData?.activeTickets || 0,
        overdueTickets: deptData?.overdueTickets || 0,
        atRiskTickets: deptData?.atRiskTickets || 0,
        onTimePercentage: deptData?.onTimePercentage || 100,
        status: deptData?.status || 'healthy'
      };
    }).reverse(); // Chronological order
  } catch (error) {
    console.error('Error fetching department performance trend:', error);
    return [];
  }
};

/**
 * Check if a snapshot has already been captured today
 * @returns {Promise<boolean>} - True if snapshot exists for today
 */
export const hasSnapshotToday = async () => {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    const todayQuery = query(
      collection(db, 'performance_snapshots'),
      where('date', '==', today),
      limit(1)
    );
    
    const todaySnapshot = await getDocs(todayQuery);
    
    return !todaySnapshot.empty;
  } catch (error) {
    console.error('Error checking today snapshot:', error);
    return false;
  }
};

/**
 * Automated daily snapshot capture (call this once per day)
 * Checks if today's snapshot exists, if not, creates one
 */
export const runDailySnapshot = async () => {
  try {
    const hasToday = await hasSnapshotToday();
    
    if (!hasToday) {
      console.log('No snapshot for today, capturing...');
      const snapshotId = await capturePerformanceSnapshot();
      console.log('Daily snapshot captured:', snapshotId);
      return snapshotId;
    } else {
      console.log('Snapshot already exists for today');
      return null;
    }
  } catch (error) {
    console.error('Error running daily snapshot:', error);
    throw error;
  }
};

export default {
  capturePerformanceSnapshot,
  getPerformanceHistory,
  getStaffPerformanceTrend,
  getDepartmentPerformanceTrend,
  hasSnapshotToday,
  runDailySnapshot
};
