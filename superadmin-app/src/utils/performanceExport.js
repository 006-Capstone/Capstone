/**
 * Performance Export Utilities
 * Export performance data to CSV format for reporting and analysis
 */

/**
 * Convert data to CSV format
 * @param {array} data - Array of objects to convert
 * @param {array} headers - Array of header objects {key, label}
 * @returns {string} - CSV formatted string
 */
const convertToCSV = (data, headers) => {
  if (!data || data.length === 0) return '';
  
  // Create header row
  const headerRow = headers.map(h => `"${h.label}"`).join(',');
  
  // Create data rows
  const dataRows = data.map(item => {
    return headers.map(h => {
      const value = item[h.key];
      // Handle null/undefined
      if (value === null || value === undefined) return '""';
      // Escape quotes and wrap in quotes
      const stringValue = String(value).replace(/"/g, '""');
      return `"${stringValue}"`;
    }).join(',');
  });
  
  return [headerRow, ...dataRows].join('\n');
};

/**
 * Download CSV file
 * @param {string} csvContent - CSV formatted string
 * @param {string} filename - Name of the file to download
 */
const downloadCSV = (csvContent, filename) => {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

/**
 * Export staff performance data to CSV
 * @param {array} staffBottlenecks - Array of staff with performance metrics
 * @param {string} filename - Optional filename
 */
export const exportStaffPerformance = (staffBottlenecks, filename) => {
  const headers = [
    { key: 'name', label: 'Staff Name' },
    { key: 'department', label: 'Department' },
    { key: 'activeTickets', label: 'Active Tickets' },
    { key: 'overdueTickets', label: 'Overdue Tickets' },
    { key: 'riskScore', label: 'Risk Score (%)' },
    { key: 'onTimeRate', label: 'On-Time Rate (%)' },
    { key: 'warningStage', label: 'Warning Stage' },
    { key: 'stageName', label: 'Stage Name' }
  ];
  
  const data = staffBottlenecks.map(staff => ({
    name: staff.name,
    department: staff.department || staff.office,
    activeTickets: staff.activeTickets,
    overdueTickets: staff.overdueTickets,
    riskScore: staff.riskScore,
    onTimeRate: staff.performance?.onTimeRate || 0,
    warningStage: staff.warningStage?.stage || 0,
    stageName: staff.warningStage?.stageName || 'Good Standing'
  }));
  
  const csvContent = convertToCSV(data, headers);
  const defaultFilename = filename || `staff_performance_${new Date().toISOString().split('T')[0]}.csv`;
  
  downloadCSV(csvContent, defaultFilename);
};

/**
 * Export department health data to CSV
 * @param {array} departmentData - Array of department health metrics
 * @param {string} filename - Optional filename
 */
export const exportDepartmentHealth = (departmentData, filename) => {
  const headers = [
    { key: 'office', label: 'Department' },
    { key: 'staffCount', label: 'Staff Count' },
    { key: 'activeTickets', label: 'Active Tickets' },
    { key: 'overdueTickets', label: 'Overdue Tickets' },
    { key: 'atRiskTickets', label: 'At-Risk Tickets' },
    { key: 'onTimePercentage', label: 'On-Time Percentage (%)' },
    { key: 'status', label: 'Health Status' }
  ];
  
  const csvContent = convertToCSV(departmentData, headers);
  const defaultFilename = filename || `department_health_${new Date().toISOString().split('T')[0]}.csv`;
  
  downloadCSV(csvContent, defaultFilename);
};

/**
 * Export complete performance report (staff + departments)
 * @param {object} performanceData - Object containing all performance data
 */
export const exportCompleteReport = (performanceData) => {
  const {
    staffBottlenecks,
    departmentData,
    systemHealth,
    lastUpdated
  } = performanceData;
  
  // Create a comprehensive report
  const timestamp = new Date(lastUpdated).toISOString();
  const date = timestamp.split('T')[0];
  
  // System Overview Section
  const systemOverview = [
    ['ACADEMIA DE SAN JOSE - PERFORMANCE MONITORING REPORT'],
    ['Generated:', timestamp],
    [''],
    ['SYSTEM OVERVIEW'],
    ['Total Active Tickets:', systemHealth?.totalActive || 0],
    ['At-Risk Tickets:', systemHealth?.atRisk || 0],
    ['On-Track Percentage:', `${systemHealth?.onTrackPercentage || 0}%`],
    ['System Status:', systemHealth?.status?.toUpperCase() || 'UNKNOWN'],
    ['']
  ];
  
  // Department Health Section
  const deptHeaders = ['Department', 'Staff Count', 'Active Tickets', 'Overdue Tickets', 'On-Time %', 'Status'];
  const deptRows = departmentData.map(dept => [
    dept.office,
    dept.staffCount,
    dept.activeTickets,
    dept.overdueTickets,
    `${dept.onTimePercentage}%`,
    dept.status
  ]);
  
  const departmentSection = [
    ['DEPARTMENT HEALTH'],
    deptHeaders,
    ...deptRows,
    ['']
  ];
  
  // Staff Performance Section
  const staffHeaders = ['Staff Name', 'Department', 'Active Tickets', 'Overdue', 'Risk Score %', 'Warning Stage'];
  const staffRows = staffBottlenecks.map(staff => [
    staff.name,
    staff.department || staff.office,
    staff.activeTickets,
    staff.overdueTickets,
    `${staff.riskScore}%`,
    staff.warningStage?.stageName || 'Good Standing'
  ]);
  
  const staffSection = [
    ['STAFF PERFORMANCE - AT RISK'],
    staffHeaders,
    ...staffRows
  ];
  
  // Combine all sections
  const allRows = [
    ...systemOverview,
    ...departmentSection,
    ...staffSection
  ];
  
  // Convert to CSV
  const csvContent = allRows.map(row => 
    row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
  ).join('\n');
  
  downloadCSV(csvContent, `performance_report_${date}.csv`);
};

/**
 * Export performance history (trend data)
 * @param {array} historyData - Array of historical snapshots
 * @param {string} filename - Optional filename
 */
export const exportPerformanceHistory = (historyData, filename) => {
  const headers = [
    { key: 'date', label: 'Date' },
    { key: 'totalActiveTickets', label: 'Active Tickets' },
    { key: 'totalOverdueTickets', label: 'Overdue Tickets' },
    { key: 'totalAtRiskTickets', label: 'At-Risk Tickets' },
    { key: 'onTrackPercentage', label: 'On-Track %' },
    { key: 'criticalAlerts', label: 'Critical Alerts' },
    { key: 'staffAtRisk', label: 'Staff At Risk' }
  ];
  
  const data = historyData.map(snapshot => ({
    date: snapshot.date,
    totalActiveTickets: snapshot.systemMetrics?.totalActiveTickets || 0,
    totalOverdueTickets: snapshot.systemMetrics?.totalOverdueTickets || 0,
    totalAtRiskTickets: snapshot.systemMetrics?.totalAtRiskTickets || 0,
    onTrackPercentage: snapshot.systemMetrics?.onTrackPercentage || 0,
    criticalAlerts: snapshot.criticalAlerts || 0,
    staffAtRisk: snapshot.staffAtRisk || 0
  }));
  
  const csvContent = convertToCSV(data, headers);
  const defaultFilename = filename || `performance_history_${new Date().toISOString().split('T')[0]}.csv`;
  
  downloadCSV(csvContent, defaultFilename);
};

/**
 * Export staff performance trend for a single staff member
 * @param {array} trendData - Array of performance data points
 * @param {string} staffName - Staff member name
 * @param {string} filename - Optional filename
 */
export const exportStaffTrend = (trendData, staffName, filename) => {
  const headers = [
    { key: 'date', label: 'Date' },
    { key: 'riskScore', label: 'Risk Score (%)' },
    { key: 'activeTickets', label: 'Active Tickets' },
    { key: 'overdueTickets', label: 'Overdue Tickets' },
    { key: 'onTimeRate', label: 'On-Time Rate (%)' },
    { key: 'warningStage', label: 'Warning Stage' }
  ];
  
  const csvContent = convertToCSV(trendData, headers);
  const safeName = staffName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  const defaultFilename = filename || `${safeName}_trend_${new Date().toISOString().split('T')[0]}.csv`;
  
  downloadCSV(csvContent, defaultFilename);
};

export default {
  exportStaffPerformance,
  exportDepartmentHealth,
  exportCompleteReport,
  exportPerformanceHistory,
  exportStaffTrend
};
