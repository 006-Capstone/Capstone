const fs = require('fs');
let css = fs.readFileSync('src/styles/SuperAdminSidebar.css', 'utf8');

const oldLogoutStrRegex = /\.logout-button {[\s\S]*?\.logout-icon {[\s\S]*?}/;

const newLogoutStr = `.logout-button {
  width: 100%;
  padding: 9px 12px;
  margin-top: 10px;
  background-color: #fef2f2;
  border: 1px solid #fee2e2;
  border-radius: 8px;
  color: #dc2626;
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transition: all 0.18s ease;
}

.logout-button:hover {
  background-color: #dc2626;
  color: #ffffff;
  border-color: #dc2626;
  transform: translateY(-1px);
  box-shadow: 0 4px 10px rgba(220, 38, 38, 0.22);
}

.logout-button:active {
  transform: translateY(0);
}

.logout-button:focus-visible {
  outline: 2px solid #fff;
  outline-offset: -2px;
  box-shadow: 0 0 0 4px var(--red-400);
}

.logout-icon {
  font-size: 14px;
}`;

css = css.replace(oldLogoutStrRegex, newLogoutStr);
fs.writeFileSync('src/styles/SuperAdminSidebar.css', css);
console.log('done');
