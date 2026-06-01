const fs = require('fs');

const paths = [
  'src/app/tracker/page.tsx',
  'src/app/queue/page.tsx',
  'src/app/gmail/page.tsx',
  'src/app/linkedin/page.tsx',
  'src/app/outreach/page.tsx'
];

for (const p of paths) {
  if (fs.existsSync(p)) {
    let content = fs.readFileSync(p, 'utf-8');
    
    // Replace page-header
    content = content.replace(/className="page-header"/g, 'className="rounded-xl border bg-card text-card-foreground shadow-sm p-6 flex flex-col gap-1"');
    content = content.replace(/className="page-kicker"/g, 'className="text-primary font-semibold text-sm uppercase tracking-wider"');
    content = content.replace(/<h1>/g, '<h1 className="text-3xl font-bold tracking-tight">');
    
    fs.writeFileSync(p, content);
  }
}
console.log("Headers fixed");
