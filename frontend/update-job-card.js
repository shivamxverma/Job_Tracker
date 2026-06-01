const fs = require('fs');
let content = fs.readFileSync('src/components/job-card.tsx', 'utf-8');

// Replace layout classes with Tailwind equivalents
content = content.replace(/className="job-card"/g, 'className="rounded-xl border bg-card text-card-foreground shadow-sm p-5 hover:shadow-md transition-shadow relative"');
content = content.replace(/className="job-card-header"/g, 'className="flex flex-col gap-2 mb-4"');
content = content.replace(/className="job-company"/g, 'className="text-sm font-medium text-muted-foreground"');
content = content.replace(/className="job-title"/g, 'className="text-lg font-bold leading-tight"');
content = content.replace(/className="job-metadata"/g, 'className="flex flex-wrap items-center gap-2 text-xs font-medium text-muted-foreground mb-4"');
content = content.replace(/className="job-tags"/g, 'className="flex flex-wrap gap-2 mb-5"');
content = content.replace(/className="job-footer"/g, 'className="flex items-center justify-between border-t pt-4 mt-auto"');
content = content.replace(/className="job-footer-text"/g, 'className="text-xs text-muted-foreground"');
content = content.replace(/className="btn-primary"/g, 'className="inline-flex items-center justify-center rounded-md text-xs font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-8 px-3 py-1"');
content = content.replace(/className="btn-secondary"/g, 'className="inline-flex items-center justify-center rounded-md text-xs font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-8 px-3 py-1"');

// Tags and platform badges
content = content.replace(/className={\`platform-pill/g, 'className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2');
content = content.replace(/className="badge"/g, 'className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 bg-secondary text-secondary-foreground hover:bg-secondary/80"');

fs.writeFileSync('src/components/job-card.tsx', content);
console.log("Updated job-card.tsx");
