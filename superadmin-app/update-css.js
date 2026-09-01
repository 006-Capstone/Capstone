const fs = require('fs');
let css = fs.readFileSync('src/styles/shared.css', 'utf8');

// Update button gradients to match admin-app
css = css.replace(/background-color: var\(--green-btn\);/g, 'background: linear-gradient(135deg, var(--green-800) 0%, var(--green-900) 100%); border: 1px solid rgba(255, 255, 255, 0.15); box-shadow: 0 2px 6px rgba(16, 94, 6, 0.25);');
css = css.replace(/\.btn-primary:hover:not\(:disabled\) {[\s\S]*?}/, '.btn-primary:hover:not(:disabled) {\n  background: linear-gradient(135deg, var(--green-750) 0%, var(--green-850) 100%);\n  transform: translateY(-1px);\n  box-shadow: 0 4px 12px rgba(16, 94, 6, 0.35);\n}');
css = css.replace(/\.btn-primary:active:not\(:disabled\) {[\s\S]*?}/, '.btn-primary:active:not(:disabled) {\n  transform: translateY(0);\n}');

// Update cards
css = css.replace(/\.card {[\s\S]*?}/, '.card {\n  background: var(--color-surface);\n  border: 1px solid var(--color-border-soft);\n  border-radius: var(--radius-md);\n  box-shadow: var(--shadow-sm);\n  overflow: hidden;\n}');

// Update table headers
css = css.replace(/\.data-table thead th {[\s\S]*?}/, '.data-table thead th {\n  text-align: left;\n  padding: 14px 20px;\n  background-color: var(--gray-50);\n  font-size: var(--font-size-2xs, 11px);\n  font-weight: var(--font-weight-bold);\n  color: var(--color-text-secondary, var(--gray-500));\n  text-transform: uppercase;\n  letter-spacing: 0.06em;\n  border-bottom: 1px solid var(--color-divider);\n  white-space: nowrap;\n}');
css = css.replace(/\.data-table tbody td {[\s\S]*?}/, '.data-table tbody td {\n  padding: 14px 20px;\n  font-size: var(--font-size-sm);\n  color: var(--color-text-body);\n  border-bottom: 1px solid var(--color-divider);\n  vertical-align: middle;\n}');

const startMarker = '/* ---- Status badges (Figma status colors) ---- */';
const endMarker = '/* ---- Empty & error states ---- */';
const newBadges = `/* ---- Status badges (Admin App Style) ---- */
.status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: var(--radius-pill);
  font-size: 12px;
  font-weight: 600;
  line-height: 1.4;
  white-space: nowrap;
  border: 1px solid transparent;
}

.status-active, .status-resolved {
  background-color: var(--status-resolved-bg, #ecfdf5);
  color: var(--status-resolved-text, #059669);
  border-color: var(--status-resolved-border, #a7f3d0);
}

.status-suspended, .status-cancelled {
  background-color: var(--status-cancelled-bg, #fef2f2);
  color: var(--status-cancelled-text, #dc2626);
  border-color: var(--status-cancelled-border, #fecaca);
}

.status-pending {
  background-color: var(--status-pending-bg, #eff6ff);
  color: var(--status-pending-text, #2563eb);
  border-color: var(--status-pending-border, #bfdbfe);
}

.status-in-process {
  background-color: var(--status-inprocess-bg, #fffbeb);
  color: var(--status-inprocess-text, #d97706);
  border-color: var(--status-inprocess-border, #fde68a);
}

.status-archived {
  background-color: #f3f4f6;
  color: #4b5563;
  border-color: #d1d5db;
}

`;

const startIdx = css.indexOf(startMarker);
const endIdx = css.indexOf(endMarker);
if (startIdx !== -1 && endIdx !== -1) {
  css = css.substring(0, startIdx) + newBadges + css.substring(endIdx);
}

fs.writeFileSync('src/styles/shared.css', css);
console.log('done');
