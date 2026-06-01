const fs = require('fs');

// gmail
let gm = fs.readFileSync('src/components/gmail-outreach.tsx', 'utf-8');
if (!gm.includes('import { Mail, RefreshCw, LogOut }')) {
  gm = gm.replace('import React', 'import React');
  gm = gm.replace('import { useSession } from "next-auth/react";', 'import { useSession } from "next-auth/react";\nimport { Mail, RefreshCw, LogOut, Send } from "lucide-react";');
  gm = gm.replace('>Generate Gmail Draft<', '><Mail className="w-4 h-4 mr-2" />Generate Gmail Draft<');
  gm = gm.replace('>Sign in with Google<', '><LogOut className="w-4 h-4 mr-2" />Sign in with Google<');
  gm = gm.replace('>Connect Gmail<', '><Mail className="w-4 h-4 mr-2" />Connect Gmail<');
  fs.writeFileSync('src/components/gmail-outreach.tsx', gm);
}

// linkedin
let li = fs.readFileSync('src/components/linkedin-outreach.tsx', 'utf-8');
if (!li.includes('import { Linkedin, Send }')) {
  li = li.replace('import React', 'import { Linkedin, Send } from "lucide-react";\nimport React');
  li = li.replace('>Generate Connection Message<', '><Linkedin className="w-4 h-4 mr-2" />Generate Connection Message<');
  fs.writeFileSync('src/components/linkedin-outreach.tsx', li);
}

console.log("Outreach icons added");
