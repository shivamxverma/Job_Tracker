const fs = require('fs');
let content = fs.readFileSync('src/components/jobs-board.tsx', 'utf-8');

// Import lucide icons
if (!content.includes('import { Plus, ExternalLink, ChevronDown, Pencil, Wand2 }')) {
  content = content.replace(
    'import { Button } from "@/components/ui/button";',
    'import { Button } from "@/components/ui/button";\nimport { Plus, ExternalLink, ChevronDown, Pencil, Wand2 } from "lucide-react";'
  );
}

// Replace raw SVGs with Lucide components
content = content.replace(
  /<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">\s*<line x1="12" y1="5" x2="12" y2="19" \/>\s*<line x1="5" y1="12" x2="19" y2="12" \/>\s*<\/svg>/g,
  '<Plus className="w-4 h-4 mr-2" />'
);

content = content.replace(
  /<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">\s*<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" \/>\s*<polyline points="15 3 21 3 21 9" \/>\s*<line x1="10" y1="14" x2="21" y2="3" \/>\s*<\/svg>/g,
  '<ExternalLink className="w-3.5 h-3.5" />'
);

content = content.replace(
  /<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">\s*<polyline points="6 9 12 15 18 9" \/>\s*<\/svg>/g,
  '<ChevronDown className="w-3.5 h-3.5 ml-1" />'
);

content = content.replace(
  /<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">\s*<path d="M12 20h9"\/>\s*<path d="M16\.5 3\.5a2\.121 2\.121 0 0 1 3 3L7 19l-4 1 1-4L16\.5 3\.5z"\/>\s*<\/svg>/g,
  '<Pencil className="w-4 h-4 text-muted-foreground hover:text-primary transition-colors cursor-pointer" />'
);

content = content.replace(
  /<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#a5b4fc" strokeWidth="2">\s*<path d="M12 2v20M17 5H9\.5a3\.5 3\.5 0 0 0 0 7h5a3\.5 3\.5 0 0 1 0 7H6" \/>\s*<\/svg>/g,
  '<Wand2 className="w-7 h-7 text-indigo-300" />'
);

fs.writeFileSync('src/components/jobs-board.tsx', content);
console.log("Replaced SVGs in jobs-board.tsx");
