const fs = require('fs');
let content = fs.readFileSync('src/components/outreach-board.tsx', 'utf-8');

if (!content.includes('Plus,')) {
  content = content.replace('import { Rocket', 'import { Plus, Rocket');
}

const standardButtonClass = 'className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 gap-2"';

// 1. Add Profiles button
content = content.replace(
  /onClick={\(\) => setShowAddProfileModal\(true\)}\n\s*style={{[\s\S]*?}}\n\s*>\n\s*➕ Add Profiles \/ Bulk Import/g,
  `onClick={() => setShowAddProfileModal(true)}\n              ${standardButtonClass}\n            >\n              <Plus className="w-4 h-4" /> Add Profiles / Bulk Import`
);

// 2. Upload Resume PDF
content = content.replace(
  /onClick={\(\) => setShowAddResumeModal\(true\)}\n\s*style={{[\s\S]*?}}\n\s*>\n\s*➕ Upload Resume PDF/g,
  `onClick={() => setShowAddResumeModal(true)}\n              ${standardButtonClass}\n            >\n              <Plus className="w-4 h-4" /> Upload Resume PDF`
);

// 3. Add Job Manually
content = content.replace(
  /onClick={\(\) => setShowAddJobModal\(true\)}\n\s*style={{[\s\S]*?}}\n\s*>\n\s*➕ Add Job Manually/g,
  `onClick={() => setShowAddJobModal(true)}\n              ${standardButtonClass}\n            >\n              <Plus className="w-4 h-4" /> Add Job Manually`
);

// 4. Create Prompt Template
content = content.replace(
  /onClick={\(\) => setShowTemplateModal\(true\)}\n\s*style={{[\s\S]*?}}\n\s*>\n\s*➕ Create Prompt Template/g,
  `onClick={() => setShowTemplateModal(true)}\n              ${standardButtonClass}\n            >\n              <Plus className="w-4 h-4" /> Create Prompt Template`
);

fs.writeFileSync('src/components/outreach-board.tsx', content);
console.log("Fixed plus buttons safely");
