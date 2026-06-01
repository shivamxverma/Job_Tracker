const fs = require('fs');

const paths = [
  'src/app/page.tsx',
  'src/app/tracker/page.tsx',
  'src/app/queue/page.tsx',
  'src/app/gmail/page.tsx',
  'src/app/linkedin/page.tsx',
  'src/app/outreach/page.tsx'
];

for (const p of paths) {
  if (fs.existsSync(p)) {
    let content = fs.readFileSync(p, 'utf-8');
    
    // Replace page-shell
    content = content.replace(/className="page-shell"/g, 'className="container mx-auto px-4 py-8 md:px-8 flex flex-col gap-8"');
    
    if (p === 'src/app/page.tsx') {
      content = content.replace(
        /<header className="page-header">[\s\S]*?<\/header>/,
        `<header className="rounded-xl border bg-card text-card-foreground shadow-sm p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <p className="text-primary font-semibold text-sm uppercase tracking-wider">Live job listings</p>
          <h1 className="text-3xl font-bold mt-1 tracking-tight">Job board</h1>
          <p className="text-sm text-muted-foreground mt-2">Updated {new Date(fetchedAt).toLocaleString("en-US")}</p>
        </div>

        <div className="flex items-center gap-6" aria-label="Job board metrics">
          <span className="flex flex-col">
            <strong className="text-2xl font-bold">{jobs.length}</strong>
            <span className="text-sm text-muted-foreground uppercase font-medium tracking-wider">jobs</span>
          </span>
          <span className="flex flex-col">
            <strong className="text-2xl font-bold">{sourceCount}</strong>
            <span className="text-sm text-muted-foreground uppercase font-medium tracking-wider">sources</span>
          </span>
        </div>
      </header>`
      );
    }
    
    fs.writeFileSync(p, content);
  }
}
console.log("Pages fixed");
