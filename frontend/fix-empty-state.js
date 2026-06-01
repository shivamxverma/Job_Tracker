const fs = require('fs');
let content = fs.readFileSync('src/components/jobs-board.tsx', 'utf-8');

content = content.replace(/className="empty-state"/g, 'className="flex flex-col items-center justify-center p-8 text-center border-2 border-dashed rounded-xl bg-card text-muted-foreground my-8"');

fs.writeFileSync('src/components/jobs-board.tsx', content);
console.log("Fixed empty-state");
