/**
 * Notice to Explain (NTE) Generator
 * Automated generation of formal NTE documents for staff at Stage 3 (Serious Warning) or higher
 */

import { collection, addDoc, serverTimestamp, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';

/**
 * Generate NTE document for a staff member
 * @param {object} staffData - Staff member data with performance metrics
 * @param {array} violations - Array of specific violations/issues
 * @returns {object} - Generated NTE document
 */
export const generateNTE = async (staffData, violations = []) => {
  const {
    uid,
    name,
    email,
    department,
    office,
    riskScore,
    activeTickets,
    overdueTickets,
    warningStage
  } = staffData;

  // Determine severity based on warning stage
  const severityMap = {
    3: { level: 'Stage 3', action: 'Serious Warning', nextStep: 'Suspension' },
    4: { level: 'Stage 4', action: 'Final Warning', nextStep: 'Termination' }
  };

  const severity = severityMap[warningStage?.stage] || severityMap[3];
  const currentDate = new Date().toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });

  // Build violations list
  const violationsList = violations.length > 0 ? violations : [
    `Currently handling ${activeTickets} active tickets with a risk score of ${riskScore}%`,
    `${overdueTickets} tickets are currently overdue`,
    'Consistently failing to meet on-time resolution rate targets',
    'Performance metrics indicate sustained underperformance over the monitoring period'
  ];

  // Generate the NTE document
  const nteDocument = {
    // Metadata
    staffUid: uid,
    staffName: name,
    staffEmail: email,
    department: department || office,
    generatedDate: currentDate,
    generatedTimestamp: new Date(),
    warningStage: warningStage?.stage || 3,
    stageName: warningStage?.stageName || 'Serious Warning',
    status: 'pending_response', // pending_response, under_review, resolved, escalated
    
    // Performance metrics at time of NTE
    metricsSnapshot: {
      riskScore,
      activeTickets,
      overdueTickets,
      onTimeRate: staffData.performance?.onTimeRate || 0,
      avgResponseTime: staffData.performance?.avgResponseTime || 0
    },

    // Document content
    subject: `NOTICE TO EXPLAIN - ${severity.action}`,
    
    // Main body sections
    sections: {
      opening: `Dear ${name},

This Notice to Explain (NTE) is being issued to you regarding your recent job performance as a ${department || office} staff member at Academia de San Jose.`,

      concernsRaised: `Our performance monitoring system has identified the following concerns regarding your work performance:

${violationsList.map((v, i) => `${i + 1}. ${v}`).join('\n')}

These issues have been consistently tracked through our automated performance monitoring system and represent a ${severity.level} performance concern.`,

      explanation: `You are hereby required to submit a written explanation within five (5) working days from receipt of this notice, addressing:

1. The circumstances that led to the above-mentioned performance issues
2. Any mitigating factors or challenges you have faced
3. Your proposed corrective action plan to improve performance
4. Any support or resources you believe would help you meet performance standards`,

      consequences: `Please be advised that failure to submit a satisfactory explanation or failure to improve your performance may result in further disciplinary action, up to and including ${severity.nextStep}.

This notice is issued in accordance with the progressive discipline policy of Academia de San Jose and applicable labor laws.`,

      responseInstructions: `Please submit your written explanation to the Human Resources Department or the Superadmin office within the specified timeframe. You may also request a meeting to discuss this matter in person.`,

      closing: `We value your service to Academia de San Jose and hope that this matter can be resolved through your cooperation and commitment to improvement.

Respectfully,

Superadmin Office
Academia de San Jose
Performance Monitoring System`
    },

    // Response tracking
    responseDeadline: calculateResponseDeadline(),
    responseReceived: null,
    responseText: null,
    hrReview: null,
    resolution: null
  };

  return nteDocument;
};

/**
 * Calculate response deadline (5 working days)
 * @returns {Date} - Deadline date
 */
const calculateResponseDeadline = () => {
  const deadline = new Date();
  let daysAdded = 0;
  
  while (daysAdded < 5) {
    deadline.setDate(deadline.getDate() + 1);
    // Skip weekends (0 = Sunday, 6 = Saturday)
    if (deadline.getDay() !== 0 && deadline.getDay() !== 6) {
      daysAdded++;
    }
  }
  
  return deadline;
};

/**
 * Save NTE to Firestore
 * @param {object} nteDocument - Generated NTE document
 * @returns {string} - Document ID
 */
export const saveNTE = async (nteDocument) => {
  try {
    const docRef = await addDoc(collection(db, 'nte_notices'), {
      ...nteDocument,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    
    console.log('NTE saved with ID:', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('Error saving NTE:', error);
    throw error;
  }
};

/**
 * Generate and save NTE for a staff member
 * @param {object} staffData - Staff member data
 * @param {array} violations - Optional custom violations
 * @returns {object} - Saved NTE with ID
 */
export const createNTE = async (staffData, violations = []) => {
  const nteDocument = await generateNTE(staffData, violations);
  const nteId = await saveNTE(nteDocument);
  
  return {
    id: nteId,
    ...nteDocument
  };
};

/**
 * Get all NTEs for a staff member
 * @param {string} staffUid - Staff member UID
 * @returns {array} - Array of NTE documents
 */
export const getStaffNTEs = async (staffUid) => {
  try {
    const q = query(
      collection(db, 'nte_notices'),
      where('staffUid', '==', staffUid),
      orderBy('generatedTimestamp', 'desc')
    );
    
    const snapshot = await getDocs(q);
    const ntes = [];
    
    snapshot.forEach(doc => {
      ntes.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    return ntes;
  } catch (error) {
    console.error('Error fetching staff NTEs:', error);
    return [];
  }
};

/**
 * Check if staff already has a pending NTE
 * @param {string} staffUid - Staff member UID
 * @returns {boolean} - True if pending NTE exists
 */
export const hasPendingNTE = async (staffUid) => {
  try {
    const q = query(
      collection(db, 'nte_notices'),
      where('staffUid', '==', staffUid),
      where('status', '==', 'pending_response'),
      orderBy('generatedTimestamp', 'desc'),
      limit(1)
    );
    
    const snapshot = await getDocs(q);
    return !snapshot.empty;
  } catch (error) {
    console.error('Error checking pending NTE:', error);
    return false;
  }
};

/**
 * Format NTE as plain text for download/printing
 * @param {object} nteDocument - NTE document
 * @returns {string} - Formatted text document
 */
export const formatNTEAsText = (nteDocument) => {
  const { sections, subject, generatedDate, staffName, department, responseDeadline } = nteDocument;
  
  return `
════════════════════════════════════════════════════════════════
ACADEMIA DE SAN JOSE
${subject}
════════════════════════════════════════════════════════════════

Date Issued: ${generatedDate}
To: ${staffName}
Department: ${department}
Response Deadline: ${new Date(responseDeadline).toLocaleDateString('en-US', { 
  year: 'numeric', month: 'long', day: 'numeric' 
})}

────────────────────────────────────────────────────────────────

${sections.opening}

────────────────────────────────────────────────────────────────
CONCERNS RAISED
────────────────────────────────────────────────────────────────

${sections.concernsRaised}

────────────────────────────────────────────────────────────────
EXPLANATION REQUIRED
────────────────────────────────────────────────────────────────

${sections.explanation}

────────────────────────────────────────────────────────────────
POTENTIAL CONSEQUENCES
────────────────────────────────────────────────────────────────

${sections.consequences}

────────────────────────────────────────────────────────────────
RESPONSE INSTRUCTIONS
────────────────────────────────────────────────────────────────

${sections.responseInstructions}

────────────────────────────────────────────────────────────────

${sections.closing}

════════════════════════════════════════════════════════════════
This is an automated notice generated by the Performance Monitoring System.
Document ID: ${nteDocument.id || 'PENDING'}
Generated: ${new Date().toISOString()}
════════════════════════════════════════════════════════════════
`.trim();
};

/**
 * Download NTE as text file
 * @param {object} nteDocument - NTE document
 */
export const downloadNTE = (nteDocument) => {
  const textContent = formatNTEAsText(nteDocument);
  const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  const filename = `NTE_${nteDocument.staffName.replace(/\s+/g, '_')}_${
    nteDocument.generatedDate.replace(/\s+/g, '_')
  }.txt`;
  
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

/**
 * Auto-generate NTEs for eligible staff (Stage 3+)
 * @param {array} staffList - Array of staff with performance data
 * @returns {array} - Array of generated NTE IDs
 */
export const autoGenerateNTEs = async (staffList) => {
  const generatedNTEs = [];
  
  for (const staff of staffList) {
    // Only generate for Stage 3 (Serious Warning) and Stage 4 (Critical)
    if (!staff.warningStage || staff.warningStage.stage < 3) {
      continue;
    }
    
    // Check if already has pending NTE
    const hasPending = await hasPendingNTE(staff.uid);
    if (hasPending) {
      console.log(`Staff ${staff.name} already has a pending NTE, skipping...`);
      continue;
    }
    
    try {
      console.log(`Generating NTE for ${staff.name} (Stage ${staff.warningStage.stage})...`);
      const nte = await createNTE(staff);
      generatedNTEs.push({
        staffName: staff.name,
        nteId: nte.id,
        stage: staff.warningStage.stage
      });
    } catch (error) {
      console.error(`Failed to generate NTE for ${staff.name}:`, error);
    }
  }
  
  return generatedNTEs;
};

export default {
  generateNTE,
  saveNTE,
  createNTE,
  getStaffNTEs,
  hasPendingNTE,
  formatNTEAsText,
  downloadNTE,
  autoGenerateNTEs
};
