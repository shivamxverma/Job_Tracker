/**
 * Helper to check if a job title matches the allowed roles:
 * - FullStack Developer
 * - Backend Developer
 * - Software Developer
 * - Software Engineer
 * - AI Engineer
 * 
 * Supports both Full Time and Intern/Internship types, while excluding
 * unrelated roles like purely Frontend, DevOps, QA, Product Management, and non-tech positions.
 */
export function isAllowedRole(title: string | null | undefined): boolean {
  if (!title) {
    return false;
  }

  const lowerTitle = title.toLowerCase().trim();

  // 1. Check if the job matches any of the 5 allowed roles
  const isFullStack = 
    lowerTitle.includes("fullstack") || 
    lowerTitle.includes("full stack") || 
    lowerTitle.includes("full-stack");

  const isBackend = 
    lowerTitle.includes("backend") || 
    lowerTitle.includes("back end") || 
    lowerTitle.includes("back-end");

  const isSoftwareDev = 
    lowerTitle.includes("software developer") || 
    lowerTitle.includes("software dev");

  const isSoftwareEng = 
    lowerTitle.includes("software engineer");

  const isAiEngineer = 
    lowerTitle.includes("ai engineer") || 
    lowerTitle.includes("ml engineer") || 
    lowerTitle.includes("machine learning") || 
    lowerTitle.includes("artificial intelligence") || 
    lowerTitle.includes("deep learning");

  const matchesAllowedRole = isFullStack || isBackend || isSoftwareDev || isSoftwareEng || isAiEngineer;

  if (!matchesAllowedRole) {
    return false;
  }

  // 2. Filter out pure Frontend roles (unless they also specify Full Stack or Backend)
  const isFrontend = 
    lowerTitle.includes("frontend") || 
    lowerTitle.includes("front end") || 
    lowerTitle.includes("front-end") || 
    lowerTitle.includes("ui developer");
  
  if (isFrontend && !isFullStack && !isBackend && !isSoftwareEng && !isSoftwareDev) {
    return false;
  }

  // 3. Filter out DevOps / SRE / SysAdmin roles (unless they specify Software Dev / Backend)
  const isDevOpsOrSre = 
    lowerTitle.includes("devops") || 
    lowerTitle.includes("dev ops") || 
    lowerTitle.includes("sre") || 
    lowerTitle.includes("site reliability") || 
    lowerTitle.includes("infrastructure engineer") || 
    lowerTitle.includes("system administrator");

  if (isDevOpsOrSre && !isBackend && !isSoftwareEng && !isSoftwareDev) {
    return false;
  }

  // 4. Filter out QA / Testing / Automation Tester roles
  const isQaOrTesting = 
    lowerTitle.includes("qa") || 
    lowerTitle.includes("quality assurance") || 
    lowerTitle.includes("testing") || 
    lowerTitle.includes("tester");

  if (isQaOrTesting && !isSoftwareEng && !isSoftwareDev) {
    return false;
  }

  // 5. Filter out Product / Project Management
  const isManagement = 
    lowerTitle.includes("product manager") || 
    lowerTitle.includes("project manager") || 
    lowerTitle.includes("scrum master");

  if (isManagement) {
    return false;
  }

  // 6. Filter out other non-technical or unrelated roles
  const blacklistedTerms = [
    "recruiter",
    "sales",
    "marketing",
    "business analyst",
    "data analyst",
    "financial analyst",
    "content writer",
    "designer",
    "ui/ux",
    "graphic",
    "support specialist",
    "help desk"
  ];

  if (blacklistedTerms.some((term) => lowerTitle.includes(term))) {
    return false;
  }

  return true;
}
