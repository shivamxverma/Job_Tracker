const fs = require('fs');

function addApiKey(filePath) {
  let content = fs.readFileSync(filePath, 'utf-8');
  
  // Find all instances of headers: { ... }
  // We use a regex that matches `headers: {` and we inject the key right after the brace
  // But we only inject if the block doesn't already contain X-API-Key
  const headerRegex = /headers:\s*\{([\s\S]*?)\}/g;
  
  content = content.replace(headerRegex, (match, innerProps) => {
    if (innerProps.includes('X-API-Key')) {
      return match;
    }
    
    // Inject X-API-Key
    return `headers: { "X-API-Key": process.env.NEXT_PUBLIC_OUTREACH_API_KEY || "hireflow_sec_key_2026_x92a8b",${innerProps}}`;
  });
  
  fs.writeFileSync(filePath, content);
  console.log(`Updated ${filePath}`);
}

['src/components/gmail-outreach.tsx', 'src/components/linkedin-outreach.tsx', 'src/components/outreach-board.tsx'].forEach(addApiKey);
