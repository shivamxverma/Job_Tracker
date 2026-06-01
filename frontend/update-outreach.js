const fs = require('fs');
let content = fs.readFileSync('src/components/gmail-outreach.tsx', 'utf-8');

// Replace layout classes
content = content.replace(/className="outreach-container"/g, 'className="w-full flex flex-col gap-6"');
content = content.replace(/className="outreach-header"/g, 'className="bg-card text-card-foreground border rounded-xl shadow-sm p-6"');
content = content.replace(/className="header-kicker"/g, 'className="text-primary font-semibold text-sm uppercase tracking-wider"');
content = content.replace(/className="outreach-actions"/g, 'className="flex items-center gap-3 mt-4"');
content = content.replace(/className="btn-primary"/g, 'className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"');
content = content.replace(/className="btn-secondary"/g, 'className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2"');

content = content.replace(/className="outreach-card"/g, 'className="rounded-xl border bg-card text-card-foreground shadow-sm p-6"');
content = content.replace(/className="outreach-table-container"/g, 'className="rounded-md border mt-4 overflow-hidden"');
content = content.replace(/className="outreach-table"/g, 'className="w-full caption-bottom text-sm"');
content = content.replace(/className="form-group"/g, 'className="flex flex-col space-y-2 mb-4"');
content = content.replace(/className="form-row"/g, 'className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4"');
content = content.replace(/<input\s+type="text"/g, '<input type="text" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"');
content = content.replace(/<input\s+type="email"/g, '<input type="email" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"');
content = content.replace(/<textarea/g, '<textarea className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"');
content = content.replace(/<select/g, '<select className="flex h-10 items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"');

// Modals
content = content.replace(/className="glass-modal-overlay"/g, 'className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center"');
content = content.replace(/className="glass-modal-content"/g, 'className="w-full max-w-lg border bg-background p-6 shadow-lg sm:rounded-lg relative"');
content = content.replace(/className="glass-modal-header"/g, 'className="flex flex-col space-y-1.5 text-center sm:text-left mb-4"');
content = content.replace(/className="modal-kicker"/g, 'className="text-sm text-muted-foreground font-semibold uppercase tracking-wider"');
content = content.replace(/className="modal-subtitle"/g, 'className="text-sm text-muted-foreground mt-1"');
content = content.replace(/className="modal-close-btn"/g, 'className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100"');
content = content.replace(/className="modal-form"/g, 'className="flex flex-col gap-4"');
content = content.replace(/className="modal-actions"/g, 'className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 mt-4"');


fs.writeFileSync('src/components/gmail-outreach.tsx', content);

let liContent = fs.readFileSync('src/components/linkedin-outreach.tsx', 'utf-8');
liContent = liContent.replace(/className="outreach-container"/g, 'className="w-full flex flex-col gap-6"');
liContent = liContent.replace(/className="outreach-header"/g, 'className="bg-card text-card-foreground border rounded-xl shadow-sm p-6"');
liContent = liContent.replace(/className="header-kicker"/g, 'className="text-primary font-semibold text-sm uppercase tracking-wider"');
liContent = liContent.replace(/className="outreach-actions"/g, 'className="flex items-center gap-3 mt-4"');
liContent = liContent.replace(/className="btn-primary"/g, 'className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"');
liContent = liContent.replace(/className="btn-secondary"/g, 'className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2"');
liContent = liContent.replace(/className="outreach-card"/g, 'className="rounded-xl border bg-card text-card-foreground shadow-sm p-6"');
liContent = liContent.replace(/className="outreach-table-container"/g, 'className="rounded-md border mt-4 overflow-hidden"');
liContent = liContent.replace(/className="outreach-table"/g, 'className="w-full caption-bottom text-sm"');
liContent = liContent.replace(/className="form-group"/g, 'className="flex flex-col space-y-2 mb-4"');
liContent = liContent.replace(/className="form-row"/g, 'className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4"');
liContent = liContent.replace(/<input\s+type="text"/g, '<input type="text" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"');
liContent = liContent.replace(/<input\s+type="url"/g, '<input type="url" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"');
liContent = liContent.replace(/<textarea/g, '<textarea className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"');
liContent = liContent.replace(/<select/g, '<select className="flex h-10 items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"');

fs.writeFileSync('src/components/linkedin-outreach.tsx', liContent);

let obContent = fs.readFileSync('src/components/outreach-board.tsx', 'utf-8');
obContent = obContent.replace(/className="board-tabs"/g, 'className="flex items-center gap-2 border-b pb-4 mb-6"');
obContent = obContent.replace(/className={`board-tab-btn/g, 'className={`inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm hover:bg-muted/50');

fs.writeFileSync('src/components/outreach-board.tsx', obContent);

console.log("Updated outreach components");
