const fs = require('fs');
let content = fs.readFileSync('src/components/outreach-board.tsx', 'utf-8');

// Add Plus import
if (!content.includes('Plus,')) {
  content = content.replace('import { Rocket', 'import { Plus, Rocket');
}

const standardButtonClass = 'className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 gap-2"';

// 1. Add Profiles
content = content.replace(
  /<button[\s\S]*?onClick={\(\) => setShowAddProfileModal\(true\)}[\s\S]*?style={{[\s\S]*?}}[\s\S]*?>[\s\S]*?➕ Add Profiles \/ Bulk Import[\s\S]*?<\/button>/m,
  `<button onClick={() => setShowAddProfileModal(true)} ${standardButtonClass}>\n              <Plus className="w-4 h-4" /> Add Profiles / Bulk Import\n            </button>`
);

// 2. Upload Resume
content = content.replace(
  /<button[\s\S]*?onClick={\(\) => setShowAddResumeModal\(true\)}[\s\S]*?style={{[\s\S]*?}}[\s\S]*?>[\s\S]*?➕ Upload Resume PDF[\s\S]*?<\/button>/m,
  `<button onClick={() => setShowAddResumeModal(true)} ${standardButtonClass}>\n              <Plus className="w-4 h-4" /> Upload Resume PDF\n            </button>`
);

// 3. Add Job
content = content.replace(
  /<button[\s\S]*?onClick={\(\) => setShowAddJobModal\(true\)}[\s\S]*?style={{[\s\S]*?}}[\s\S]*?>[\s\S]*?➕ Add Job Manually[\s\S]*?<\/button>/m,
  `<button onClick={() => setShowAddJobModal(true)} ${standardButtonClass}>\n              <Plus className="w-4 h-4" /> Add Job Manually\n            </button>`
);

// 4. Create Prompt Template
content = content.replace(
  /<button[\s\S]*?onClick={\(\) => setShowTemplateModal\(true\)}[\s\S]*?style={{[\s\S]*?}}[\s\S]*?>[\s\S]*?➕ Create Prompt Template[\s\S]*?<\/button>/m,
  `<button onClick={() => setShowTemplateModal(true)} ${standardButtonClass}>\n              <Plus className="w-4 h-4" /> Create Prompt Template\n            </button>`
);

fs.writeFileSync('src/components/outreach-board.tsx', content);
console.log("Fixed plus buttons");
