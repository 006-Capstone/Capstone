import React, { useState, useRef } from 'react';
import {
  FaTimes,
  FaFileImport,
  FaFileExcel,
  FaFileCsv,
  FaDownload,
  FaUpload,
  FaCheckCircle,
  FaExclamationTriangle,
  FaTimesCircle,
  FaSpinner,
  FaUserGraduate,
  FaUserTie,
  FaInfoCircle
} from 'react-icons/fa';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { db, getSecondaryAuth } from '../firebase';
import '../styles/ImportUsersModal.css';

const DEFAULT_OFFICES = [
  { id: 'finance', name: 'Finance' },
  { id: 'library', name: 'Library' },
  { id: 'guidance', name: 'Guidance' },
  { id: 'registrar', name: 'Registrar' }
];

const generatePassword = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let password = '';
  for (let i = 0; i < 8; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
};

// Normalize keys to camelCase / standard format
const normalizeRowKeys = (row) => {
  const normalized = {};
  for (const rawKey of Object.keys(row)) {
    const key = rawKey
      .toLowerCase()
      .trim()
      .replace(/[\s_-]+/g, ''); // removes spaces, underscores, dashes
    normalized[key] = typeof row[rawKey] === 'string' ? row[rawKey].trim() : (row[rawKey] ?? '');
  }
  return normalized;
};

const ImportUsersModal = ({
  initialType = 'students', // 'students' or 'staff'
  existingStudents = [],
  existingStaff = [],
  offices = DEFAULT_OFFICES,
  onClose,
  onSuccess
}) => {
  const [userType, setUserType] = useState(initialType);
  const [file, setFile] = useState(null);
  const [parsedData, setParsedData] = useState([]);
  const [validationResults, setValidationResults] = useState([]);
  const [isParsing, setIsParsing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0, percent: 0 });
  const [importSummary, setImportSummary] = useState(null);
  const [sendEmails, setSendEmails] = useState(true);
  const [skipInvalid, setSkipInvalid] = useState(true);
  const [filterView, setFilterView] = useState('all'); // 'all', 'valid', 'error'
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef(null);

  // Handle template download
  const handleDownloadTemplate = (format = 'xlsx') => {
    let headers = [];
    let sampleData = [];
    let filename = '';

    if (userType === 'students') {
      headers = [
        'Student ID',
        'First Name',
        'Last Name',
        'Middle Name',
        'Suffix',
        'Grade Level',
        'Section',
        'Email'
      ];
      sampleData = [
        ['1001', 'Juan', 'Dela Cruz', 'Santos', '', 'Grade 7', 'Diamond', 'juan.delacruz@example.com'],
        ['1002', 'Maria', 'Santos', 'Reyes', '', 'Grade 8', 'Emerald', 'maria.santos@example.com'],
        ['1003', 'Jose', 'Rizal', 'Protacio', 'Jr.', 'Grade 9', 'Ruby', 'jose.rizal@example.com']
      ];
      filename = `students_template.${format}`;
    } else {
      headers = [
        'First Name',
        'Last Name',
        'Middle Name',
        'Suffix',
        'Email',
        'Username',
        'Office'
      ];
      sampleData = [
        ['Carlos', 'Mendoza', 'Gomez', '', 'carlos.mendoza@example.com', 'cmendoza', 'Finance'],
        ['Elena', 'Torres', 'Cruz', '', 'elena.torres@example.com', 'etorres', 'Registrar'],
        ['Ramon', 'Bautista', 'Lopez', '', 'ramon.bautista@example.com', 'rbautista', 'Guidance']
      ];
      filename = `staff_template.${format}`;
    }

    if (format === 'csv') {
      const csvRows = [headers.join(','), ...sampleData.map(row => row.map(cell => `"${(cell || '').replace(/"/g, '""')}"`).join(','))];
      const blob = new Blob([csvRows.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } else {
      // Excel XLSX format using SheetJS
      const wsData = [headers, ...sampleData];
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      
      // Auto column widths
      ws['!cols'] = headers.map(() => ({ wch: 18 }));

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, userType === 'students' ? 'Students' : 'Staff');
      XLSX.writeFile(wb, filename);
    }
  };

  // Validate student row
  const validateStudentRow = (normalized, index, seenIds, seenEmails) => {
    const errors = [];

    const id = normalized.studentid || normalized.id || normalized.studentnumber || '';
    const firstName = normalized.firstname || normalized.fname || normalized.first || '';
    const lastName = normalized.lastname || normalized.lname || normalized.last || '';
    const middleName = normalized.middlename || normalized.mname || normalized.middle || '';
    const suffix = normalized.suffix || '';
    const gradeLevel = normalized.gradelevel || normalized.grade || normalized.level || '';
    const section = normalized.section || normalized.sec || '';
    const email = (normalized.email || normalized.emailaddress || '').toLowerCase();

    // Student ID checks
    if (!id) {
      errors.push('Missing Student ID');
    } else if (!/^\d{4}$/.test(id)) {
      errors.push('Student ID must be exactly 4 digits');
    } else if (seenIds.has(id)) {
      errors.push(`Duplicate Student ID (${id}) found in this file`);
    } else if (existingStudents.some(s => String(s.id).trim() === id)) {
      errors.push(`Student ID (${id}) already exists in system`);
    }

    // Name checks
    if (!firstName) errors.push('Missing First Name');
    if (!lastName) errors.push('Missing Last Name');

    // Grade and Section checks
    if (!gradeLevel) errors.push('Missing Grade Level');
    if (!section) errors.push('Missing Section');

    // Email checks
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email) {
      errors.push('Missing Email');
    } else if (!emailRegex.test(email)) {
      errors.push('Invalid email format');
    } else if (seenEmails.has(email)) {
      errors.push(`Duplicate email (${email}) in this file`);
    } else if (existingStudents.some(s => (s.email || '').toLowerCase() === email)) {
      errors.push(`Email (${email}) already registered to a student`);
    }

    if (id && /^\d{4}$/.test(id)) seenIds.add(id);
    if (email && emailRegex.test(email)) seenEmails.add(email);

    return {
      rowIndex: index + 1,
      rawData: normalized,
      data: {
        id,
        firstName,
        lastName,
        middleName,
        suffix,
        gradeLevel,
        section,
        email
      },
      isValid: errors.length === 0,
      errors
    };
  };

  // Validate staff row
  const validateStaffRow = (normalized, index, seenUsernames, seenEmails) => {
    const errors = [];

    const firstName = normalized.firstname || normalized.fname || normalized.first || '';
    const lastName = normalized.lastname || normalized.lname || normalized.last || '';
    const middleName = normalized.middlename || normalized.mname || normalized.middle || '';
    const suffix = normalized.suffix || '';
    const email = (normalized.email || normalized.emailaddress || '').toLowerCase();
    const username = (normalized.username || normalized.user || '').toLowerCase();
    const officeNameRaw = normalized.office || normalized.department || '';

    if (!firstName) errors.push('Missing First Name');
    if (!lastName) errors.push('Missing Last Name');

    // Username checks
    if (!username) {
      errors.push('Missing Username');
    } else if (seenUsernames.has(username)) {
      errors.push(`Duplicate username (${username}) in this file`);
    } else if (existingStaff.some(s => (s.username || '').toLowerCase() === username)) {
      errors.push(`Username (${username}) already in use`);
    }

    // Email checks
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email) {
      errors.push('Missing Email');
    } else if (!emailRegex.test(email)) {
      errors.push('Invalid email format');
    } else if (seenEmails.has(email)) {
      errors.push(`Duplicate email (${email}) in this file`);
    } else if (existingStaff.some(s => (s.email || '').toLowerCase() === email)) {
      errors.push(`Email (${email}) already registered to staff`);
    }

    // Office check
    let matchedOffice = null;
    if (!officeNameRaw) {
      errors.push('Missing Office');
    } else {
      matchedOffice = offices.find(
        o => o.name.toLowerCase() === officeNameRaw.toLowerCase() || o.id.toLowerCase() === officeNameRaw.toLowerCase()
      );
      if (!matchedOffice) {
        const allowedOffices = offices.map(o => o.name).join(', ');
        errors.push(`Unknown Office '${officeNameRaw}' (Allowed: ${allowedOffices})`);
      }
    }

    if (username) seenUsernames.add(username);
    if (email && emailRegex.test(email)) seenEmails.add(email);

    return {
      rowIndex: index + 1,
      rawData: normalized,
      data: {
        firstName,
        lastName,
        middleName,
        suffix,
        email,
        username,
        office: matchedOffice ? matchedOffice.name : officeNameRaw,
        officeId: matchedOffice ? matchedOffice.id : ''
      },
      isValid: errors.length === 0,
      errors
    };
  };

  // Process raw rows after parsing
  const processRawRows = (rows) => {
    const seenSet1 = new Set();
    const seenSet2 = new Set();
    const validated = [];

    rows.forEach((row, idx) => {
      // Skip completely empty rows
      const hasAnyValue = Object.values(row).some(v => v !== null && v !== undefined && String(v).trim() !== '');
      if (!hasAnyValue) return;

      const normalized = normalizeRowKeys(row);
      if (userType === 'students') {
        validated.push(validateStudentRow(normalized, idx, seenSet1, seenSet2));
      } else {
        validated.push(validateStaffRow(normalized, idx, seenSet1, seenSet2));
      }
    });

    setParsedData(rows);
    setValidationResults(validated);
  };

  // Parse uploaded file
  const handleFileUpload = (selectedFile) => {
    if (!selectedFile) return;

    setFile(selectedFile);
    setIsParsing(true);
    setValidationResults([]);
    setImportSummary(null);

    const ext = selectedFile.name.split('.').pop().toLowerCase();

    if (ext === 'csv') {
      Papa.parse(selectedFile, {
        header: true,
        skipEmptyLines: 'greedy',
        complete: (results) => {
          processRawRows(results.data);
          setIsParsing(false);
        },
        error: (err) => {
          console.error('CSV Parse Error:', err);
          alert('Failed to parse CSV file: ' + err.message);
          setIsParsing(false);
        }
      });
    } else if (['xlsx', 'xls'].includes(ext)) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
          processRawRows(jsonData);
        } catch (err) {
          console.error('Excel Parse Error:', err);
          alert('Failed to parse Excel file: ' + err.message);
        } finally {
          setIsParsing(false);
        }
      };
      reader.readAsArrayBuffer(selectedFile);
    } else {
      alert('Unsupported file type. Please upload a .csv or .xlsx file.');
      setIsParsing(false);
    }
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleTypeSwitch = (type) => {
    if (type === userType) return;
    setUserType(type);
    setFile(null);
    setParsedData([]);
    setValidationResults([]);
    setImportSummary(null);
  };

  // Perform import
  const handleStartImport = async () => {
    const toImport = validationResults.filter(r => (skipInvalid ? r.isValid : true));
    if (toImport.length === 0) {
      alert('No valid accounts to import.');
      return;
    }

    if (!skipInvalid && validationResults.some(r => !r.isValid)) {
      alert('Please fix the errors or enable "Skip rows with errors" before proceeding.');
      return;
    }

    setIsImporting(true);
    setImportProgress({ current: 0, total: toImport.length, percent: 0 });

    const secondaryAuth = getSecondaryAuth();
    const createdList = [];
    const failedList = [];
    let emailsSent = 0;

    const studentPortalUrl = process.env.VITE_STUDENT_APP_URL || process.env.REACT_APP_STUDENT_APP_URL;
    const apiUrl = studentPortalUrl
      ? `${studentPortalUrl.replace(/\/$/, '')}/api/send-temporary-password`
      : (process.env.NODE_ENV === 'production'
          ? '/api/send-temporary-password'
          : 'http://localhost:5000/api/send-temporary-password');

    for (let i = 0; i < toImport.length; i++) {
      const row = toImport[i];
      const { data } = row;
      const temporaryPassword = generatePassword();

      try {
        if (userType === 'students') {
          // 1. Create auth user with secondary auth (preserves superadmin session!)
          const userCredential = await createUserWithEmailAndPassword(secondaryAuth, data.email, temporaryPassword);
          const authUser = userCredential.user;

          // Sign out immediately from secondary auth so it remains clean
          try {
            await signOut(secondaryAuth);
          } catch (_) {}

          // 2. Build full name
          const middleInitial = data.middleName ? data.middleName.charAt(0).toUpperCase() + '.' : '';
          const fullName = `${data.firstName} ${middleInitial} ${data.lastName}${data.suffix ? ' ' + data.suffix : ''}`.replace(/\s+/g, ' ').trim();

          // 3. Save to Firestore
          await addDoc(collection(db, 'students'), {
            id: data.id,
            uid: authUser.uid,
            firstName: data.firstName.trim(),
            lastName: data.lastName.trim(),
            middleName: data.middleName.trim(),
            middleInitial: data.middleName ? data.middleName.charAt(0).toUpperCase() : '',
            suffix: data.suffix.trim(),
            gradeLevel: data.gradeLevel.trim(),
            section: data.section.trim(),
            name: fullName,
            fullName: fullName,
            email: data.email.trim(),
            role: 'student',
            createdAt: serverTimestamp(),
            isActive: true,
            mustChangePassword: true
          });

          // 4. Send email credentials if requested
          if (sendEmails) {
            try {
              const res = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  email: data.email.trim(),
                  userName: fullName,
                  temporaryPassword: temporaryPassword,
                  role: 'student'
                })
              });
              if (res.ok) emailsSent++;
            } catch (err) {
              console.warn(`[Import] Failed to email student ${data.email}:`, err);
            }
          }

          createdList.push({ ...data, name: fullName, temporaryPassword });

        } else {
          // Staff Import
          const userCredential = await createUserWithEmailAndPassword(secondaryAuth, data.email, temporaryPassword);
          const authUser = userCredential.user;

          try {
            await signOut(secondaryAuth);
          } catch (_) {}

          const middleInitial = data.middleName ? data.middleName.charAt(0).toUpperCase() + '.' : '';
          const fullName = `${data.firstName} ${middleInitial} ${data.lastName}${data.suffix ? ' ' + data.suffix : ''}`.replace(/\s+/g, ' ').trim();

          await addDoc(collection(db, 'staff'), {
            uid: authUser.uid,
            firstName: data.firstName.trim(),
            lastName: data.lastName.trim(),
            middleName: data.middleName.trim(),
            middleInitial: data.middleName ? data.middleName.charAt(0).toUpperCase() : '',
            suffix: data.suffix.trim(),
            name: fullName,
            fullName: fullName,
            email: data.email.trim(),
            username: data.username.trim(),
            office: data.office,
            officeId: data.officeId,
            role: 'staff',
            createdAt: serverTimestamp(),
            isActive: true,
            mustChangePassword: true
          });

          if (sendEmails) {
            try {
              const res = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  email: data.email.trim(),
                  userName: fullName,
                  temporaryPassword: temporaryPassword,
                  role: 'admin',
                  office: data.office
                })
              });
              if (res.ok) emailsSent++;
            } catch (err) {
              console.warn(`[Import] Failed to email staff ${data.email}:`, err);
            }
          }

          createdList.push({ ...data, name: fullName, temporaryPassword });
        }
      } catch (err) {
        console.error(`[Import] Error importing row ${row.rowIndex}:`, err);
        failedList.push({
          row: row.rowIndex,
          identifier: userType === 'students' ? data.id || data.email : data.username || data.email,
          error: err.message || 'Creation failed'
        });
      }

      const current = i + 1;
      setImportProgress({
        current,
        total: toImport.length,
        percent: Math.round((current / toImport.length) * 100)
      });
    }

    // Add activity log to Firestore
    try {
      await addDoc(collection(db, 'activityLogs'), {
        action: `Batch Import (${userType === 'students' ? 'Students' : 'Staff Members'})`,
        category: 'import',
        details: `Successfully imported ${createdList.length} ${userType} account(s)${failedList.length ? ` (${failedList.length} failed)` : ''}.`,
        status: createdList.length > 0 ? 'Success' : 'Failed',
        timestamp: serverTimestamp()
      });
    } catch (auditErr) {
      console.warn('Failed to record import audit log:', auditErr);
    }

    setIsImporting(false);
    setImportSummary({
      totalProcessed: toImport.length,
      successCount: createdList.length,
      failCount: failedList.length,
      emailsSent,
      failedRows: failedList,
      createdAccounts: createdList
    });
  };

  // Download import results report
  const handleDownloadReport = () => {
    if (!importSummary) return;

    const rows = [
      ['Import Type', userType === 'students' ? 'Students' : 'Staff Members'],
      ['Total Processed', importSummary.totalProcessed],
      ['Successfully Created', importSummary.successCount],
      ['Failed / Errors', importSummary.failCount],
      ['Emails Dispatched', importSummary.emailsSent],
      [''],
      ['--- Successfully Created Accounts ---'],
      ...(userType === 'students'
        ? [
            ['Student ID', 'Full Name', 'Email', 'Grade Level', 'Section', 'Temp Password'],
            ...importSummary.createdAccounts.map(a => [a.id, a.name, a.email, a.gradeLevel, a.section, a.temporaryPassword])
          ]
        : [
            ['Username', 'Full Name', 'Email', 'Office', 'Temp Password'],
            ...importSummary.createdAccounts.map(a => [a.username, a.name, a.email, a.office, a.temporaryPassword])
          ]),
      [''],
      ...(importSummary.failedRows.length > 0
        ? [
            ['--- Failed Rows ---'],
            ['Row #', 'Identifier', 'Error Message'],
            ...importSummary.failedRows.map(f => [f.row, f.identifier, f.error])
          ]
        : [])
    ];

    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Import Summary');
    XLSX.writeFile(wb, `import_summary_${userType}_${Date.now()}.xlsx`);
  };

  const validCount = validationResults.filter(r => r.isValid).length;
  const errorCount = validationResults.filter(r => !r.isValid).length;

  const displayedRows = validationResults.filter(r => {
    if (filterView === 'valid') return r.isValid;
    if (filterView === 'error') return !r.isValid;
    return true;
  });

  return (
    <div className="import-modal-overlay">
      <div className="import-modal-container">
        {/* Modal Header */}
        <div className="import-modal-header">
          <div className="import-header-title-wrap">
            <div className="import-icon-badge">
              <FaFileImport />
            </div>
            <div>
              <h2 className="import-modal-title">Bulk Import Accounts</h2>
              <p className="import-modal-subtitle">
                Import multiple student or staff accounts from CSV or Excel spreadsheets
              </p>
            </div>
          </div>
          <button className="import-close-btn" onClick={onClose} disabled={isImporting} title="Close">
            <FaTimes />
          </button>
        </div>

        {/* Modal Body */}
        <div className="import-modal-body">
          {/* User Type Switcher */}
          {!importSummary && (
            <div className="import-type-selector">
              <button
                type="button"
                className={`type-btn ${userType === 'students' ? 'active' : ''}`}
                onClick={() => handleTypeSwitch('students')}
                disabled={isImporting || isParsing}
              >
                <FaUserGraduate /> Students
              </button>
              <button
                type="button"
                className={`type-btn ${userType === 'staff' ? 'active' : ''}`}
                onClick={() => handleTypeSwitch('staff')}
                disabled={isImporting || isParsing}
              >
                <FaUserTie /> Staff Members
              </button>
            </div>
          )}

          {/* Import Summary View (After completion) */}
          {importSummary ? (
            <div className="import-summary-container">
              <div className="summary-status-header">
                <div className={`summary-status-circle ${importSummary.failCount === 0 ? 'success' : 'partial'}`}>
                  {importSummary.failCount === 0 ? <FaCheckCircle /> : <FaExclamationTriangle />}
                </div>
                <h3>
                  {importSummary.failCount === 0 ? 'Import Completed Successfully!' : 'Import Completed with Notices'}
                </h3>
                <p>
                  Processed <strong>{importSummary.totalProcessed}</strong> records from file.
                </p>
              </div>

              <div className="summary-metrics-grid">
                <div className="summary-metric-card metric-success">
                  <span className="metric-number">{importSummary.successCount}</span>
                  <span className="metric-label">Created Accounts</span>
                </div>
                <div className="summary-metric-card metric-error">
                  <span className="metric-number">{importSummary.failCount}</span>
                  <span className="metric-label">Failed / Skipped</span>
                </div>
                <div className="summary-metric-card metric-email">
                  <span className="metric-number">{importSummary.emailsSent}</span>
                  <span className="metric-label">Emails Dispatched</span>
                </div>
              </div>

              {importSummary.failedRows.length > 0 && (
                <div className="summary-error-list">
                  <h4>Failed Rows</h4>
                  <ul>
                    {importSummary.failedRows.map((f, i) => (
                      <li key={i}>
                        <strong>Row {f.row}</strong> ({f.identifier}): {f.error}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="summary-actions-row">
                <button
                  type="button"
                  className="btn-download-report"
                  onClick={handleDownloadReport}
                >
                  <FaDownload /> Download Audit Report (.xlsx)
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => {
                    if (onSuccess) onSuccess();
                    onClose();
                  }}
                >
                  <FaCheckCircle /> Finish & View Updated List
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Step 1: Download Templates Guidance */}
              <div className="template-download-box">
                <div className="template-info">
                  <FaInfoCircle className="template-info-icon" />
                  <div>
                    <strong>Need the correct column format?</strong>
                    <p>Download our pre-structured template, paste your records, and upload it back here.</p>
                  </div>
                </div>
                <div className="template-btn-group">
                  <button
                    type="button"
                    className="template-btn"
                    onClick={() => handleDownloadTemplate('xlsx')}
                    title="Download Excel Template"
                  >
                    <FaFileExcel className="icon-excel" /> Download Excel (.xlsx)
                  </button>
                  <button
                    type="button"
                    className="template-btn"
                    onClick={() => handleDownloadTemplate('csv')}
                    title="Download CSV Template"
                  >
                    <FaFileCsv className="icon-csv" /> Download CSV
                  </button>
                </div>
              </div>

              {/* Step 2: Dropzone */}
              {!validationResults.length && !isParsing && (
                <div
                  className={`dropzone-box ${dragActive ? 'drag-active' : ''}`}
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current && fileInputRef.current.click()}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                    style={{ display: 'none' }}
                    onChange={(e) => e.target.files && handleFileUpload(e.target.files[0])}
                  />
                  <div className="dropzone-icon">
                    <FaUpload />
                  </div>
                  <h4 className="dropzone-title">Click to upload or drag & drop</h4>
                  <p className="dropzone-hint">
                    Supports <strong>.xlsx</strong> and <strong>.csv</strong> spreadsheets
                  </p>
                </div>
              )}

              {/* Parsing Indicator */}
              {isParsing && (
                <div className="parsing-indicator">
                  <FaSpinner className="spinner-icon rotating" />
                  <p>Analyzing spreadsheet and checking data validity...</p>
                </div>
              )}

              {/* Step 3: Validation Preview Table */}
              {validationResults.length > 0 && !isParsing && (
                <div className="validation-preview-wrapper">
                  <div className="preview-top-bar">
                    <div className="file-info-pill">
                      <FaFileExcel />
                      <span>{file?.name}</span>
                      <button
                        type="button"
                        className="change-file-btn"
                        onClick={() => {
                          setFile(null);
                          setValidationResults([]);
                        }}
                        disabled={isImporting}
                      >
                        Change file
                      </button>
                    </div>

                    <div className="validation-stats-pills">
                      <button
                        type="button"
                        className={`stat-pill pill-all ${filterView === 'all' ? 'active' : ''}`}
                        onClick={() => setFilterView('all')}
                      >
                        All ({validationResults.length})
                      </button>
                      <button
                        type="button"
                        className={`stat-pill pill-valid ${filterView === 'valid' ? 'active' : ''}`}
                        onClick={() => setFilterView('valid')}
                      >
                        <FaCheckCircle /> Valid ({validCount})
                      </button>
                      <button
                        type="button"
                        className={`stat-pill pill-error ${filterView === 'error' ? 'active' : ''}`}
                        onClick={() => setFilterView('error')}
                      >
                        <FaTimesCircle /> Errors ({errorCount})
                      </button>
                    </div>
                  </div>

                  {/* Preview Table */}
                  <div className="preview-table-container">
                    <table className="preview-table">
                      <thead>
                        <tr>
                          <th>#</th>
                          {userType === 'students' ? (
                            <>
                              <th>Student ID</th>
                              <th>Name</th>
                              <th>Grade & Section</th>
                              <th>Email</th>
                            </>
                          ) : (
                            <>
                              <th>Username</th>
                              <th>Name</th>
                              <th>Office</th>
                              <th>Email</th>
                            </>
                          )}
                          <th>Status</th>
                          <th>Validation Notes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {displayedRows.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="empty-preview-row">
                              No rows match this filter.
                            </td>
                          </tr>
                        ) : (
                          displayedRows.map((r, i) => (
                            <tr key={i} className={r.isValid ? 'row-valid' : 'row-invalid'}>
                              <td className="cell-row-num">{r.rowIndex}</td>
                              {userType === 'students' ? (
                                <>
                                  <td>
                                    <span className="code-badge">{r.data.id || '—'}</span>
                                  </td>
                                  <td>
                                    {r.data.firstName} {r.data.lastName}
                                  </td>
                                  <td>
                                    {r.data.gradeLevel} - {r.data.section}
                                  </td>
                                  <td className="cell-email">{r.data.email}</td>
                                </>
                              ) : (
                                <>
                                  <td>
                                    <span className="code-badge">{r.data.username || '—'}</span>
                                  </td>
                                  <td>
                                    {r.data.firstName} {r.data.lastName}
                                  </td>
                                  <td>
                                    <span className="office-badge">{r.data.office || '—'}</span>
                                  </td>
                                  <td className="cell-email">{r.data.email}</td>
                                </>
                              )}
                              <td>
                                {r.isValid ? (
                                  <span className="status-badge valid">
                                    <FaCheckCircle /> Valid
                                  </span>
                                ) : (
                                  <span className="status-badge error">
                                    <FaTimesCircle /> Error
                                  </span>
                                )}
                              </td>
                              <td className="cell-errors">
                                {r.isValid ? (
                                  <span className="ready-text">Ready to import</span>
                                ) : (
                                  <ul className="error-bullets">
                                    {r.errors.map((err, errIdx) => (
                                      <li key={errIdx}>{err}</li>
                                    ))}
                                  </ul>
                                )}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Options & Settings */}
                  <div className="import-options-bar">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={sendEmails}
                        onChange={(e) => setSendEmails(e.target.checked)}
                        disabled={isImporting}
                      />
                      <span>Send credentials email with temporary password</span>
                    </label>

                    {errorCount > 0 && (
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={skipInvalid}
                          onChange={(e) => setSkipInvalid(e.target.checked)}
                          disabled={isImporting}
                        />
                        <span>Skip invalid rows and import {validCount} valid accounts</span>
                      </label>
                    )}
                  </div>

                  {/* Progress Indicator during import */}
                  {isImporting && (
                    <div className="import-progress-box">
                      <div className="progress-labels">
                        <span>Creating accounts in database...</span>
                        <span>
                          {importProgress.current} / {importProgress.total} ({importProgress.percent}%)
                        </span>
                      </div>
                      <div className="progress-bar-bg">
                        <div
                          className="progress-bar-fill"
                          style={{ width: `${importProgress.percent}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal Footer */}
        {!importSummary && (
          <div className="import-modal-footer">
            <button
              type="button"
              className="btn-secondary"
              onClick={onClose}
              disabled={isImporting}
            >
              Cancel
            </button>
            {validationResults.length > 0 && (
              <button
                type="button"
                className="btn-primary"
                onClick={handleStartImport}
                disabled={isImporting || (skipInvalid ? validCount === 0 : errorCount > 0)}
              >
                {isImporting ? (
                  <>
                    <FaSpinner className="rotating" /> Importing...
                  </>
                ) : (
                  <>
                    <FaUpload /> Import {skipInvalid ? validCount : validationResults.length} Account
                    {(skipInvalid ? validCount : validationResults.length) === 1 ? '' : 's'}
                  </>
                )}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ImportUsersModal;
