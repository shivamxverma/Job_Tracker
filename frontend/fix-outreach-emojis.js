const fs = require('fs');
let content = fs.readFileSync('src/components/outreach-board.tsx', 'utf-8');

// Add imports
if (!content.includes('import { Rocket')) {
  content = content.replace('import { useState, useEffect, useMemo } from "react";', 'import { useState, useEffect, useMemo } from "react";\nimport { Rocket, RefreshCw, Lock, BarChart, Users, FileText, Briefcase, PenTool, Sparkles, Send, CheckCircle2, Copy } from "lucide-react";');
}

// Fix header OutreachFlow MVP
content = content.replace(/<span>🚀<\/span> OutreachFlow <span style={{.*?}}>MVP<\/span>/g, '<Rocket className="w-5 h-5 text-primary" /> <span className="font-bold text-lg">OutreachFlow</span> <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-primary/10 text-primary">MVP</span>');

// Fix buttons Sync Data, Lock
content = content.replace(/<button style={{ background: "rgba\(255,255,255,0\.8\)",.*?}}>[\s]*🔄 Sync Data[\s]*<\/button>/g, '<button onClick={loadAllData} className="inline-flex items-center justify-center rounded-md text-sm font-medium border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-3 gap-2"><RefreshCw className="w-3.5 h-3.5" /> Sync Data</button>');

content = content.replace(/<button style={{ background: "#fee2e2",.*?}}>[\s]*🔒 Lock[\s]*<\/button>/g, '<button onClick={handleSignOut} className="inline-flex items-center justify-center rounded-md text-sm font-medium border border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive hover:text-destructive-foreground h-9 px-3 gap-2"><Lock className="w-3.5 h-3.5" /> Lock</button>');

// Fix tabs
content = content.replace(/{ key: "analytics", label: "📊 Overview" }/g, '{ key: "analytics", label: "Overview", icon: <BarChart className="w-4 h-4 mr-2" /> }');
content = content.replace(/{ key: "profiles", label: "👥 Target Profiles" }/g, '{ key: "profiles", label: "Target Profiles", icon: <Users className="w-4 h-4 mr-2" /> }');
content = content.replace(/{ key: "resumes", label: "📄 Resumes" }/g, '{ key: "resumes", label: "Resumes", icon: <FileText className="w-4 h-4 mr-2" /> }');
content = content.replace(/{ key: "jobs", label: "💼 Target Jobs" }/g, '{ key: "jobs", label: "Target Jobs", icon: <Briefcase className="w-4 h-4 mr-2" /> }');
content = content.replace(/{ key: "templates", label: "✍️ Templates" }/g, '{ key: "templates", label: "Templates", icon: <PenTool className="w-4 h-4 mr-2" /> }');
content = content.replace(/{ key: "generation", label: "✨ Gen Queue" }/g, '{ key: "generation", label: "Gen Queue", icon: <Sparkles className="w-4 h-4 mr-2" /> }');
content = content.replace(/{ key: "outbox", label: "✉️ Outbox Outbox" }/g, '{ key: "outbox", label: "Outbox", icon: <Send className="w-4 h-4 mr-2" /> }');

// We also need to update the tab renderer to render the icon if available
content = content.replace(/{tab\.label}/g, '{tab.icon}{tab.label}');

// Fix purple gradient tutorial widget
content = content.replace(
  /<div style={{ background: "linear-gradient\(135deg, #1e1b4b, #311042\)",.*?}}>([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>\s*<\/div>/,
  `<div className="rounded-xl border bg-card text-card-foreground shadow-sm p-6 flex flex-col justify-between gap-6">
              <div>
                <h3 className="text-xl font-bold tracking-tight">OutreachFlow Campaign Pipeline</h3>
                <p className="text-sm text-muted-foreground mt-1">Four simple steps to double your referral response rates:</p>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="bg-muted/50 p-4 rounded-lg flex flex-col gap-1.5">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold mb-1">1</span>
                  <span><strong>Upload Resume</strong>: Upload parsed PDFs to extract skill profiles.</span>
                </div>
                <div className="bg-muted/50 p-4 rounded-lg flex flex-col gap-1.5">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold mb-1">2</span>
                  <span><strong>Import Profiles</strong>: Paste CSV lists of target employees.</span>
                </div>
                <div className="bg-muted/50 p-4 rounded-lg flex flex-col gap-1.5">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold mb-1">3</span>
                  <span><strong>Approve drafts</strong>: Review contextual AI messages in the approval queue.</span>
                </div>
                <div className="bg-muted/50 p-4 rounded-lg flex flex-col gap-1.5">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold mb-1">4</span>
                  <span><strong>SMTP Dispatch</strong>: Sequentially send approved emails.</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}`
);

// Any other stray emojis in UI?
// "Sign In with OAuth 🚀"
content = content.replace(/Sign In with OAuth 🚀/g, 'Sign In with OAuth');
content = content.replace(/No background jobs enqueued\. Go to the &quot;Target Profiles&quot; tab/g, 'No background jobs enqueued. Go to the "Target Profiles" tab');

fs.writeFileSync('src/components/outreach-board.tsx', content);
console.log("Cleaned Outreach Board emojis");
