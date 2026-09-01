const fs = require('fs');
let css = fs.readFileSync('src/styles/SuperAdminSidebar.css', 'utf8');

css = css.replace(/\.superadmin-sidebar {[\s\S]*?}/, `.superadmin-sidebar {
  width: 230px;
  background-color: #ffffff;
  padding: 12px 0 16px;
  display: flex;
  flex-direction: column;
  height: 100vh;
  height: 100dvh;
  border-right: 1px solid #e5e7eb;
  flex-shrink: 0;
  position: relative;
  box-sizing: border-box;
  z-index: 40;
}`);

css = css.replace(/\.sidebar-logo {[\s\S]*?}/, `.sidebar-logo {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 4px 16px 12px;
  border-bottom: 1px solid #f3f4f6;
  margin-bottom: 8px;
}`);

css = css.replace(/\.sidebar-logo img {[\s\S]*?}/, `.sidebar-logo img {
  width: 96px;
  height: 96px;
  object-fit: contain;
  margin-bottom: 8px;
}`);

css = css.replace(/\.sidebar-menu {[\s\S]*?}/, `.sidebar-menu {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px 12px;
  overflow-y: auto;
}`);

fs.writeFileSync('src/styles/SuperAdminSidebar.css', css);
console.log('done');
