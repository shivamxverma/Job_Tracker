const fs = require('fs');

let content = fs.readFileSync('src/components/jobs-board.tsx', 'utf-8');

// Replace Tracker layout classes
content = content.replace(/className="tracker-section"/g, 'className="flex flex-col gap-6"');
content = content.replace(/className="tracker-metrics-grid"/g, 'className="grid grid-cols-2 lg:grid-cols-4 gap-4"');
content = content.replace(/className="metric-card .*?"/g, 'className="rounded-xl border bg-card text-card-foreground shadow-sm p-5 relative overflow-hidden"');
content = content.replace(/className="metric-card-inner"/g, 'className="flex flex-col gap-1"');
content = content.replace(/className="metric-label"/g, 'className="text-sm font-medium text-muted-foreground"');
content = content.replace(/className="metric-val"/g, 'className="text-3xl font-bold"');
content = content.replace(/className="metric-val text-blue"/g, 'className="text-3xl font-bold text-blue-600 dark:text-blue-400"');
content = content.replace(/className="metric-val text-green"/g, 'className="text-3xl font-bold text-emerald-600 dark:text-emerald-400"');
content = content.replace(/className="metric-val text-red"/g, 'className="text-3xl font-bold text-red-600 dark:text-red-400"');
content = content.replace(/<div className="metric-card-accent" \/>/g, '<div className="absolute inset-x-0 bottom-0 h-1 bg-primary/20" />');

content = content.replace(/className="tracker-toolbar-container"/g, 'className="bg-card text-card-foreground border rounded-xl shadow-sm p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4"');
content = content.replace(/className="tracker-toolbar-left"/g, 'className="flex flex-col"');
content = content.replace(/<h2>My Applications<\/h2>/g, '<h2 className="text-xl font-bold">My Applications</h2>');
content = content.replace(/className="tracker-toolbar-sub"/g, 'className="text-sm text-muted-foreground"');
content = content.replace(/className="tracker-toolbar-right"/g, 'className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto"');
content = content.replace(/className="tracker-search-box"/g, 'className="w-full sm:w-auto"');
content = content.replace(/className="tracker-status-filter"/g, 'className="w-full sm:w-auto"');
content = content.replace(/className="add-app-btn"/g, 'className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 w-full sm:w-auto whitespace-nowrap"');

// Inputs inside tracker right toolbar
content = content.replace(/<input\s*type="text"\s*placeholder="Filter by company, role\.\.\."/g, '<input type="text" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50" placeholder="Filter by company, role..."');
content = content.replace(/<select value={statusFilter}/g, '<select className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50" value={statusFilter}');

// Table cells
content = content.replace(/<td className="company-col">/g, '<td className="p-4 align-middle">');
content = content.replace(/<td className="role-col">/g, '<td className="p-4 align-middle flex items-center gap-2">');
content = content.replace(/<td className="platform-col">/g, '<td className="p-4 align-middle">');
content = content.replace(/<td className="status-col">/g, '<td className="p-4 align-middle">');
content = content.replace(/<td className="notes-col">/g, '<td className="p-4 align-middle">');

content = content.replace(/<div className="notes-display">/g, '<div className="flex items-center justify-between gap-2 max-w-[200px]">');
content = content.replace(/<span className="notes-text"/g, '<span className="truncate text-sm text-muted-foreground"');
content = content.replace(/<span className="no-notes-placeholder">/g, '<span className="text-sm text-muted-foreground/50 italic">');
content = content.replace(/<button\s*className="edit-notes-icon-btn"/g, '<button className="shrink-0"');

// Dropdowns inside table
content = content.replace(/className="status-select-container"/g, 'className="relative"');
content = content.replace(/className="status-dropdown-trigger"/g, 'className="inline-flex items-center px-2 py-0.5 rounded-full font-semibold shadow-sm text-[0.68rem] transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"');
content = content.replace(/className="status-floating-menu"/g, 'className="absolute z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md top-full mt-1 left-0 flex flex-col p-1 animate-in fade-in-0 zoom-in-95"');
content = content.replace(/<button\s*onClick={\(\) => {/g, '<button className="relative flex w-full cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50" onClick={() => {');

// Fix TH
content = content.replace(/<th>/g, '<th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">');


fs.writeFileSync('src/components/jobs-board.tsx', content);
console.log("Fixed tracker UI");
