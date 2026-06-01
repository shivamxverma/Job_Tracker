const fs = require('fs');
let content = fs.readFileSync('src/components/jobs-board.tsx', 'utf-8');

// Import Button and Input
if (!content.includes('import { Button }')) {
  content = content.replace(
    'import { LinkedinOutreach } from "@/components/linkedin-outreach";',
    'import { LinkedinOutreach } from "@/components/linkedin-outreach";\nimport { Button } from "@/components/ui/button";\nimport { Input } from "@/components/ui/input";'
  );
}

// Replace layout classes
content = content.replace(/className="jobs-board-wrapper"/g, 'className="w-full flex flex-col gap-6"');
content = content.replace(/className="jobs-section"/g, 'className="flex flex-col gap-6"');
content = content.replace(/className="jobs-section__header"/g, 'className="bg-card text-card-foreground border rounded-xl shadow-sm p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4"');
content = content.replace(/className="section-kicker"/g, 'className="text-primary font-semibold text-sm uppercase tracking-wider"');
content = content.replace(/<h2>Fresh scraped roles<\/h2>/g, '<h2 className="text-2xl font-bold mt-1">Fresh scraped roles</h2>');
content = content.replace(/<h2>Your Job Tracker<\/h2>/g, '<h2 className="text-2xl font-bold mt-1">Your Job Tracker</h2>');
content = content.replace(/<h2>Auto-Apply Queue<\/h2>/g, '<h2 className="text-2xl font-bold mt-1">Auto-Apply Queue</h2>');
content = content.replace(/className="jobs-toolbar"/g, 'className="flex flex-col sm:flex-row gap-3 w-full md:w-auto"');
content = content.replace(/className="jobs-toolbar-controls"/g, 'className="flex items-center gap-3"');
content = content.replace(/className="search-input"/g, 'className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"');

// Checkboxes and Filters
content = content.replace(/className="checkbox-filter"/g, 'className="flex items-center gap-2 text-sm font-medium cursor-pointer"');
content = content.replace(/className="tracker-filters"/g, 'className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto"');
content = content.replace(/className="filter-select"/g, 'className="flex h-10 items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"');
content = content.replace(/className="btn-primary"/g, 'className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"');
content = content.replace(/className="btn-secondary"/g, 'className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2"');

// Grid and tables
content = content.replace(/className="jobs-grid"/g, 'className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"');
content = content.replace(/className="tracker-table-container"/g, 'className="rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden overflow-x-auto"');
content = content.replace(/className="tracker-table"/g, 'className="w-full caption-bottom text-sm"');
content = content.replace(/className="tracker-row"/g, 'className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted"');

// Modals
content = content.replace(/className="glass-modal-overlay"/g, 'className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 flex items-center justify-center"');
content = content.replace(/className="glass-modal-content"/g, 'className="fixed z-50 grid w-full max-w-lg scale-100 gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1\/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1\/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg"');
content = content.replace(/className="glass-modal-header"/g, 'className="flex flex-col space-y-1.5 text-center sm:text-left mb-4"');
content = content.replace(/className="modal-kicker"/g, 'className="text-sm text-muted-foreground font-semibold uppercase tracking-wider"');
content = content.replace(/<h3>/g, '<h3 className="text-lg font-semibold leading-none tracking-tight">');
content = content.replace(/className="modal-subtitle"/g, 'className="text-sm text-muted-foreground mt-1"');
content = content.replace(/className="modal-close-btn"/g, 'className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground"');
content = content.replace(/className="modal-form"/g, 'className="flex flex-col gap-4"');
content = content.replace(/className="form-group"/g, 'className="flex flex-col space-y-2"');
content = content.replace(/className="form-row"/g, 'className="grid grid-cols-2 gap-4"');
content = content.replace(/className="modal-actions"/g, 'className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 mt-4"');

fs.writeFileSync('src/components/jobs-board.tsx', content);
console.log("Updated jobs-board.tsx");
