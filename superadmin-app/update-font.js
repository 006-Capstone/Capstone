const fs = require('fs');
let css = fs.readFileSync('src/styles/design-tokens.css', 'utf8');
const importStmt = "@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');\n";
if (!css.includes('fonts.googleapis.com')) {
  css = importStmt + css;
}

// Ensure the body actually uses the font
const bodyStyle = `
body {
  font-family: var(--font-family);
  background-color: var(--color-bg);
  color: var(--color-text);
  margin: 0;
  padding: 0;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
`;

if (!css.includes('body {')) {
  css = css + '\n' + bodyStyle;
} else if (!css.includes('font-family: var(--font-family)')) {
  css = css.replace(/body {/, 'body {\n  font-family: var(--font-family);');
}

fs.writeFileSync('src/styles/design-tokens.css', css);
console.log('done');
