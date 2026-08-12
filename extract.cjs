const fs = require('fs');
const html = fs.readFileSync('C:/Users/user/.gemini/antigravity/scratch/destaksul-app/public/template.html', 'utf8');

// Find all occurrences of '.nav-link' in the script block
const scriptStart = html.indexOf('<script>/* Dashboard Destaksul');
const scriptContent = html.substring(scriptStart);

const lines = scriptContent.split('\n');
lines.forEach((line, index) => {
  if (line.includes('.nav-link') || line.includes('hash')) {
    console.log(`Line ${index + 1}: ${line.trim()}`);
  }
});
