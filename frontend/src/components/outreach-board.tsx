"use client";

import { useState, useEffect, useMemo } from "react";

interface MessageDraft {
  id: string;
  profileId: string;
  channel: string;
  subject: string;
  content: string;
  status: string; // DRAFT, APPROVED, REJECTED, EDITED, SENT, FAILED
  sentAt: string | null;
  profile: Profile;
}

interface Profile {
  id: string;
  name: string;
  role: string;
  company: string;
  linkedinUrl: string | null;
  email: string | null;
  notes: string | null;
  source: string;
  tags: string[];
  createdAt: string;
  outboundMessages?: MessageDraft[];
}

interface Resume {
  id: string;
  title: string;
  parsedText: string;
  skills: string[];
  createdAt: string;
}

interface ManualJob {
  id: string;
  title: string;
  company: string;
  description: string | null;
  applyUrl: string | null;
  platform: string;
}

interface PromptTemplate {
  id: string;
  name: string;
  type: string; // REFERRAL, NETWORKING, FEEDBACK, FOUNDER
  prompt: string;
  active: boolean;
}

interface GenQueueJob {
  id: string;
  profileId: string;
  status: string; // PENDING, GENERATING, COMPLETED, FAILED
  generatedSubject: string | null;
  generatedMessage: string | null;
  error: string | null;
  createdAt: string;
  profile: Profile;
  template: PromptTemplate;
}

interface AnalyticsStats {
  totalProfiles: number;
  totalGenerated: number;
  approvedCount: number;
  sentCount: number;
  failedCount: number;
  repliesCount: number;
  positiveReplies: number;
  replyRate: number;
  positiveReplyRate: number;
  referralsReceived: number;
  interviewsScheduled: number;
}

export function OutreachBoard() {
  // Navigation tabs
  const [activeTab, setActiveTab] = useState<"analytics" | "profiles" | "resumes" | "jobs" | "templates" | "generation" | "outbox">("analytics");

  // Core Entity States
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [manualJobs, setManualJobs] = useState<ManualJob[]>([]);
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [genQueueJobs, setGenQueueJobs] = useState<GenQueueJob[]>([]);
  const [approvalQueue, setApprovalQueue] = useState<MessageDraft[]>([]);
  const [outboxMessages, setOutboxMessages] = useState<MessageDraft[]>([]);
  
  // Analytics
  const [stats, setStats] = useState<AnalyticsStats>({
    totalProfiles: 0,
    totalGenerated: 0,
    approvedCount: 0,
    sentCount: 0,
    failedCount: 0,
    repliesCount: 0,
    positiveReplies: 0,
    replyRate: 0,
    positiveReplyRate: 0,
    referralsReceived: 0,
    interviewsScheduled: 0,
  });

  // UI / Form States
  const [loading, setLoading] = useState(false);
  const [selectedProfileIds, setSelectedProfileIds] = useState<Set<string>>(new Set());
  const [activeResumeId, setActiveResumeId] = useState<string>("");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [selectedJobId, setSelectedJobId] = useState<string>("");

  // Drawer & Modal States
  const [showAddProfileModal, setShowAddProfileModal] = useState(false);
  const [showAddResumeModal, setShowAddResumeModal] = useState(false);
  const [showAddJobModal, setShowAddJobModal] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);

  // Form inputs
  const [profileName, setProfileName] = useState("");
  const [profileRole, setProfileRole] = useState("");
  const [profileCompany, setProfileCompany] = useState("");
  const [profileLinkedin, setProfileLinkedin] = useState("");
  const [profileEmail, setProfileEmail] = useState("");
  const [profileNotes, setProfileNotes] = useState("");
  const [profileTagsInput, setProfileTagsInput] = useState("");
  const [profileBulkInput, setProfileBulkInput] = useState("");
  const [importFormat, setImportFormat] = useState<"csv" | "json">("csv");

  const [resumeTitle, setResumeTitle] = useState("");
  const [resumeFile, setResumeFile] = useState<File | null>(null);

  const [jobTitleInput, setJobTitleInput] = useState("");
  const [jobCompanyInput, setJobCompanyInput] = useState("");
  const [jobDescriptionInput, setJobDescriptionInput] = useState("");
  const [jobLinkInput, setJobLinkInput] = useState("");

  const [templateName, setTemplateName] = useState("");
  const [templateType, setTemplateType] = useState("REFERRAL");
  const [templatePrompt, setTemplatePrompt] = useState("");
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);

  // Editing approval queue draft inline
  const [editingDraftId, setEditingDraftId] = useState<string | null>(null);
  const [editingSubject, setEditingSubject] = useState("");
  const [editingContent, setEditingContent] = useState("");

  // Search & filter
  const [profileSearchQuery, setProfileSearchQuery] = useState("");
  const [profileFilterCompany, setProfileFilterCompany] = useState("");

  // Passcode Authentication State
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [passcodeInput, setPasscodeInput] = useState("");
  const [authError, setAuthError] = useState("");
  const [showPasscodeText, setShowPasscodeText] = useState(false);

  const API_BASE = "http://localhost:3000";

  // Load API key from env or localStorage
  const getApiKey = () => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("outreach_api_key") || process.env.NEXT_PUBLIC_OUTREACH_API_KEY || "";
    }
    return process.env.NEXT_PUBLIC_OUTREACH_API_KEY || "";
  };

  // Wrapper for authorized backend fetches
  const fetchWithAuth = async (url: string, options: RequestInit = {}) => {
    const key = getApiKey();
    const headers = {
      "X-API-Key": key,
      ...options.headers,
    };
    return await fetch(url, { ...options, headers });
  };

  // Dynamic Auth Submit Check
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passcodeInput.trim()) {
      setAuthError("Passcode cannot be empty.");
      return;
    }
    setLoading(true);
    setAuthError("");
    try {
      const testKey = passcodeInput.trim();
      const res = await fetch(`${API_BASE}/outreach-flow/analytics`, {
        headers: { "X-API-Key": testKey },
      });
      if (res.status === 401) {
        setAuthError("Invalid passcode. Access Denied.");
        setLoading(false);
        return;
      }
      localStorage.setItem("outreach_api_key", testKey);
      setIsAuthenticated(true);
      setPasscodeInput("");
      loadAllData();
    } catch (err) {
      setAuthError("Network error. Verify that your backend server is running.");
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = () => {
    localStorage.removeItem("outreach_api_key");
    setIsAuthenticated(false);
  };

  // Pull All Data from API
  const loadAllData = async () => {
    if (getApiKey() === "") {
      setIsAuthenticated(false);
      return;
    }

    try {
      setLoading(true);
      // 1. Fetch Analytics
      const statsRes = await fetchWithAuth(`${API_BASE}/outreach-flow/analytics`);
      if (statsRes.status === 401) {
        setIsAuthenticated(false);
        setLoading(false);
        return;
      }
      const statsJson = await statsRes.json();
      if (statsJson.success) setStats(statsJson.data);

      // 2. Fetch Profiles
      const profRes = await fetchWithAuth(`${API_BASE}/outreach-flow/profiles`);
      const profJson = await profRes.json();
      if (profJson.success) setProfiles(profJson.data);

      // 3. Fetch Resumes
      const resRes = await fetchWithAuth(`${API_BASE}/outreach-flow/resumes`);
      const resJson = await resRes.json();
      if (resJson.success) {
        setResumes(resJson.data);
        if (resJson.data.length > 0 && !activeResumeId) {
          setActiveResumeId(resJson.data[0].id);
        }
      }

      // 4. Fetch Manual Jobs
      const jobRes = await fetchWithAuth(`${API_BASE}/outreach-flow/jobs`);
      const jobJson = await jobRes.json();
      if (jobJson.success) setManualJobs(jobJson.data);

      // 5. Fetch Templates
      const tempRes = await fetchWithAuth(`${API_BASE}/outreach-flow/templates`);
      const tempJson = await tempRes.json();
      if (tempJson.success) {
        setTemplates(tempJson.data);
        if (tempJson.data.length > 0 && !selectedTemplateId) {
          setSelectedTemplateId(tempJson.data[0].id);
        }
      }

      // 6. Fetch Generation Queue
      const queueRes = await fetchWithAuth(`${API_BASE}/outreach-flow/queue/status`);
      const queueJson = await queueRes.json();
      if (queueJson.success) setGenQueueJobs(queueJson.data);

      // 7. Fetch Approval Queue (DRAFT outbound messages)
      const appRes = await fetchWithAuth(`${API_BASE}/outreach-flow/approval`);
      const appJson = await appRes.json();
      if (appJson.success) setApprovalQueue(appJson.data);

      // 8. Fetch Outbox History
      const messagesRes = await fetchWithAuth(`${API_flow_or_messages()}`);
      const messagesJson = await messagesRes.json();
      if (messagesJson.success) setOutboxMessages(messagesJson.data);

      setIsAuthenticated(true);
    } catch (err) {
      console.error("OutreachFlow data fetching crash:", err);
    } finally {
      setLoading(false);
    }
  };

  const API_flow_or_messages = () => `${API_BASE}/outreach-flow/messages`;

  useEffect(() => {
    loadAllData();
  }, []);

  // Poll queues and outbox every 4 seconds to observe real-time BullMQ & SMTP updates
  useEffect(() => {
    if (isAuthenticated) {
      const interval = setInterval(async () => {
        try {
          const queueRes = await fetchWithAuth(`${API_BASE}/outreach-flow/queue/status`);
          const queueJson = await queueRes.json();
          if (queueJson.success) setGenQueueJobs(queueJson.data);

          const appRes = await fetchWithAuth(`${API_BASE}/outreach-flow/approval`);
          const appJson = await appRes.json();
          if (appJson.success) setApprovalQueue(appJson.data);

          const messagesRes = await fetchWithAuth(API_flow_or_messages());
          const messagesJson = await messagesRes.json();
          if (messagesJson.success) setOutboxMessages(messagesJson.data);

          const statsRes = await fetchWithAuth(`${API_BASE}/outreach-flow/analytics`);
          const statsJson = await statsRes.json();
          if (statsJson.success) setStats(statsJson.data);
        } catch (e) {
          console.error("OutreachFlow real-time background poller failed:", e);
        }
      }, 4000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated]);

  // ==================== A. ADD ENTITIES HANDLERS ====================

  // Upload Resume
  const handleUploadResume = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resumeTitle || !resumeFile) {
      alert("Please fill out resume title and select a PDF file.");
      return;
    }

    setLoading(true);
    try {
      const reader = new FileReader();
      reader.readAsDataURL(resumeFile);
      reader.onload = async () => {
        const base64 = reader.result as string;
        const res = await fetchWithAuth(`${API_BASE}/outreach-flow/resumes`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: resumeTitle,
            pdfBase64: base64,
          }),
        });

        const json = await res.json();
        if (json.success) {
          alert("Resume uploaded and parsed successfully!");
          setResumeTitle("");
          setResumeFile(null);
          setShowAddResumeModal(false);
          loadAllData();
        } else {
          alert("Upload failed: " + json.message);
        }
      };
    } catch (error) {
      console.error(error);
      alert("Resume upload error.");
    } finally {
      setLoading(false);
    }
  };

  // Add Target Profile (Single or Paste Importer)
  const handleAddProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (profileBulkInput.trim()) {
      // Bulk CSV/JSON import
      setLoading(true);
      try {
        let listToUpload = [];
        if (importFormat === "json") {
          listToUpload = JSON.parse(profileBulkInput.trim());
        } else {
          // CSV Parser
          const lines = profileBulkInput.trim().split("\n");
          for (const line of lines) {
            if (!line.trim()) continue;
            const cols = line.split(",").map((c) => c.trim().replace(/^["']|["']$/g, ""));
            if (cols.length >= 3) {
              listToUpload.push({
                name: cols[0],
                role: cols[1],
                company: cols[2],
                linkedinUrl: cols[3] || null,
                email: cols[4] || null,
                notes: cols[5] || null,
              });
            }
          }
        }

        const res = await fetchWithAuth(`${API_BASE}/outreach-flow/profiles`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ profiles: listToUpload }),
        });

        const json = await res.json();
        if (json.success) {
          alert(`Successfully imported ${json.data.length} profiles!`);
          setProfileBulkInput("");
          setShowAddProfileModal(false);
          loadAllData();
        } else {
          alert("Failed to import: " + json.message);
        }
      } catch (err) {
        alert("Parser error. Verify JSON formatting or CSV headers (Name,Role,Company).");
      } finally {
        setLoading(false);
      }
    } else {
      // Single Add
      if (!profileName || !profileRole || !profileCompany) {
        alert("Name, Role, and Company are required.");
        return;
      }

      setLoading(true);
      try {
        const res = await fetchWithAuth(`${API_BASE}/outreach-flow/profiles`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            profiles: {
              name: profileName,
              role: profileRole,
              company: profileCompany,
              linkedinUrl: profileLinkedin || null,
              email: profileEmail || null,
              notes: profileNotes || null,
              tags: profileTagsInput ? profileTagsInput.split(",").map((t) => t.trim()) : [],
            },
          }),
        });

        const json = await res.json();
        if (json.success) {
          setProfileName("");
          setProfileRole("");
          setProfileCompany("");
          setProfileLinkedin("");
          setProfileEmail("");
          setProfileNotes("");
          setProfileTagsInput("");
          setShowAddProfileModal(false);
          loadAllData();
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
  };

  // Add Manual Job
  const handleAddJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jobTitleInput || !jobCompanyInput) {
      alert("Job Title and Company are required.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetchWithAuth(`${API_BASE}/outreach-flow/jobs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: jobTitleInput,
          company: jobCompanyInput,
          description: jobDescriptionInput || null,
          link: jobLinkInput || null,
        }),
      });

      const json = await res.json();
      if (json.success) {
        setJobTitleInput("");
        setJobCompanyInput("");
        setJobDescriptionInput("");
        setJobLinkInput("");
        setShowAddJobModal(false);
        loadAllData();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // Create/Update Prompt Template
  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!templateName || !templatePrompt) {
      alert("Template name and prompt text are required.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetchWithAuth(`${API_BASE}/outreach-flow/templates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingTemplateId || undefined,
          name: templateName,
          type: templateType,
          prompt: templatePrompt,
          active: true,
        }),
      });

      const json = await res.json();
      if (json.success) {
        setTemplateName("");
        setTemplatePrompt("");
        setEditingTemplateId(null);
        setShowTemplateModal(false);
        loadAllData();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // ==================== B. BULK GENERATION DISPATCHER (BULLMQ) ====================

  const handleLaunchGeneration = async () => {
    if (selectedProfileIds.size === 0) {
      alert("Please select at least one target profile from the list.");
      return;
    }
    if (!activeResumeId) {
      alert("Please upload and select an active resume first.");
      return;
    }
    if (!selectedTemplateId) {
      alert("Please select a prompt template to use.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetchWithAuth(`${API_BASE}/outreach-flow/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profileIds: Array.from(selectedProfileIds),
          resumeId: activeResumeId,
          templateId: selectedTemplateId,
          jobId: selectedJobId || null,
        }),
      });

      const json = await res.json();
      if (json.success) {
        alert(`Dispatched BullMQ! Enqueued ${selectedProfileIds.size} bulk generations in the Redis worker pool.`);
        setSelectedProfileIds(new Set());
        setActiveTab("generation");
        loadAllData();
      } else {
        alert("Dispatch failed: " + json.message);
      }
    } catch (err) {
      console.error(err);
      alert("BullMQ dispatch error.");
    } finally {
      setLoading(false);
    }
  };

  // ==================== C. APPROVAL WORKFLOW HANDLERS ====================

  const handleOpenEditDraft = (draft: MessageDraft) => {
    setEditingDraftId(draft.id);
    setEditingSubject(draft.subject);
    setEditingContent(draft.content);
  };

  const handleSaveDraftEdits = async (id: string) => {
    try {
      const res = await fetchWithAuth(`${API_BASE}/outreach-flow/approval/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: editingSubject,
          content: editingContent,
        }),
      });

      const json = await res.json();
      if (json.success) {
        setEditingDraftId(null);
        loadAllData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleApproveMessage = async (id: string) => {
    try {
      const res = await fetchWithAuth(`${API_BASE}/outreach-flow/approval/${id}/approve`, {
        method: "POST",
      });
      const json = await res.json();
      if (json.success) {
        loadAllData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleRejectMessage = async (id: string) => {
    try {
      const res = await fetchWithAuth(`${API_BASE}/outreach-flow/approval/${id}/reject`, {
        method: "POST",
      });
      const json = await res.json();
      if (json.success) {
        loadAllData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Dispatch approved emails sequentially
  const handleTriggerSMTPDispatch = async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth(`${API_BASE}/outreach-flow/outbox/send`, {
        method: "POST",
      });
      const json = await res.json();
      alert(json.message);
      setActiveTab("outbox");
      loadAllData();
    } catch (e) {
      console.error(e);
      alert("SMTP outbox transmission failure.");
    } finally {
      setLoading(false);
    }
  };

  // ==================== D. ENTITY DELETION HANDLERS ====================

  const handleDeleteProfile = async (id: string) => {
    if (!confirm("Delete this target profile?")) return;
    await fetchWithAuth(`${API_BASE}/outreach-flow/profiles/${id}`, { method: "DELETE" });
    loadAllData();
  };

  const handleDeleteResume = async (id: string) => {
    if (!confirm("Delete this resume version?")) return;
    await fetchWithAuth(`${API_BASE}/outreach-flow/resumes/${id}`, { method: "DELETE" });
    loadAllData();
  };

  const handleDeleteJob = async (id: string) => {
    if (!confirm("Delete this target job posting?")) return;
    await fetchWithAuth(`${API_BASE}/outreach-flow/jobs/${id}`, { method: "DELETE" });
    loadAllData();
  };

  // ==================== E. FILTER & SELECTIONS ====================

  const filteredProfiles = useMemo(() => {
    return profiles.filter((p) => {
      const matchSearch =
        p.name.toLowerCase().includes(profileSearchQuery.toLowerCase()) ||
        p.role.toLowerCase().includes(profileSearchQuery.toLowerCase()) ||
        p.company.toLowerCase().includes(profileSearchQuery.toLowerCase());
      const matchCompany = profileFilterCompany ? p.company === profileFilterCompany : true;
      return matchSearch && matchCompany;
    });
  }, [profiles, profileSearchQuery, profileFilterCompany]);

  const uniqueProfileCompanies = useMemo(() => {
    return Array.from(new Set(profiles.map((p) => p.company)));
  }, [profiles]);

  const toggleSelectProfile = (id: string) => {
    setSelectedProfileIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAllProfiles = () => {
    if (selectedProfileIds.size === filteredProfiles.length) {
      setSelectedProfileIds(new Set());
    } else {
      setSelectedProfileIds(new Set(filteredProfiles.map((p) => p.id)));
    }
  };

  // ==================== F. RENDERS AND RENDER BRANCHES ====================

  if (isAuthenticated === null) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "65vh" }}>
        <div className="spinner" style={{
          width: "40px",
          height: "40px",
          border: "4px solid rgba(79, 70, 229, 0.1)",
          borderTopColor: "#4f46e5",
          borderRadius: "50%",
          animation: "spin 1s linear infinite"
        }} />
        <p style={{ marginTop: "1rem", color: "#64748b", fontWeight: 500 }}>Verifying connection...</p>
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div 
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "65vh",
          background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #311042 100%)",
          borderRadius: "24px",
          padding: "3rem 1.5rem",
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.3)",
          position: "relative",
          overflow: "hidden"
        }}
      >
        <div style={{ position: "absolute", top: "-10%", left: "-10%", width: "300px", height: "300px", background: "radial-gradient(circle, rgba(99,102,241,0.15) 0%, rgba(0,0,0,0) 70%)", borderRadius: "50%" }} />
        <div style={{ position: "absolute", bottom: "-10%", right: "-10%", width: "300px", height: "300px", background: "radial-gradient(circle, rgba(168,85,247,0.15) 0%, rgba(0,0,0,0) 70%)", borderRadius: "50%" }} />

        <div 
          style={{
            width: "100%",
            maxWidth: "420px",
            background: "rgba(255, 255, 255, 0.07)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            border: "1px solid rgba(255, 255, 255, 0.15)",
            borderRadius: "24px",
            boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
            padding: "2.5rem",
            display: "flex",
            flexDirection: "column",
            gap: "1.75rem",
            zIndex: 10,
            animation: "fadeInUp 0.6s cubic-bezier(0.16, 1, 0.3, 1)"
          }}
        >
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "3rem", marginBottom: "0.75rem", animation: "pulseLock 2s infinite alternate" }}>🔒</div>
            <h3 style={{ fontSize: "1.6rem", fontWeight: 700, color: "#ffffff", margin: 0, letterSpacing: "-0.025em" }}>Secure Outreach</h3>
            <p style={{ fontSize: "0.88rem", color: "#94a3b8", marginTop: "0.5rem", lineHeight: 1.5 }}>
              A secure passcode is required to send emails, manage recruiters, and run Gemini automation.
            </p>
          </div>

          <form onSubmit={handleAuthSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            <div>
              <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "#cbd5e1", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Enter Passcode
              </label>
              <div style={{ display: "flex", position: "relative" }}>
                <input
                  type={showPasscodeText ? "text" : "password"}
                  placeholder="••••••••••••"
                  value={passcodeInput}
                  onChange={(e) => setPasscodeInput(e.target.value)}
                  disabled={loading}
                  style={{
                    width: "100%",
                    padding: "0.8rem 2.8rem 0.8rem 1rem",
                    borderRadius: "12px",
                    border: "1px solid rgba(255, 255, 255, 0.15)",
                    background: "rgba(255, 255, 255, 0.05)",
                    color: "#ffffff",
                    fontSize: "1rem",
                    outline: "none",
                    transition: "all 150ms ease",
                    boxShadow: "inset 0 2px 4px rgba(0, 0, 0, 0.2)"
                  }}
                  className="auth-input"
                />
                <button
                  type="button"
                  onClick={() => setShowPasscodeText(!showPasscodeText)}
                  style={{
                    position: "absolute",
                    right: "12px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    fontSize: "1.2rem",
                    color: "#94a3b8",
                    padding: "4px",
                  }}
                >
                  {showPasscodeText ? "👁️" : "👁️‍🗨️"}
                </button>
              </div>
            </div>

            {authError && (
              <div style={{ color: "#f87171", fontSize: "0.85rem", fontWeight: 500, background: "rgba(239, 68, 68, 0.1)", padding: "0.75rem 1rem", borderRadius: "10px", border: "1px solid rgba(239, 68, 68, 0.2)", lineHeight: 1.4, animation: "shake 0.4s ease-in-out" }}>
                ⚠️ {authError}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%",
                padding: "0.85rem",
                background: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)",
                color: "white",
                border: "none",
                borderRadius: "12px",
                fontSize: "0.98rem",
                fontWeight: 600,
                cursor: "pointer",
                boxShadow: "0 8px 20px -4px rgba(79, 70, 229, 0.4)",
                transition: "all 150ms cubic-bezier(0.4, 0, 0.2, 1)",
                opacity: loading ? 0.7 : 1
              }}
            >
              {loading ? "Verifying..." : "Authenticate Session 🚀"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="outreach-flow-app" style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
      {/* Header Deck */}
      <div 
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: "rgba(255, 255, 255, 0.8)",
          backdropFilter: "blur(12px)",
          border: "1px solid var(--border)",
          borderRadius: "16px",
          padding: "1.25rem 2rem",
          boxShadow: "var(--shadow)"
        }}
      >
        <div>
          <h1 style={{ fontSize: "1.75rem", fontWeight: 800, color: "#1e293b", margin: 0, letterSpacing: "-0.03em", display: "flex", alignItems: "center", gap: "8px" }}>
            <span>🚀</span> OutreachFlow <span style={{ fontSize: "0.75rem", padding: "2px 8px", background: "linear-gradient(135deg, #4f46e5, #7c3aed)", color: "white", borderRadius: "999px", fontWeight: 600 }}>MVP</span>
          </h1>
          <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: "0.9rem" }}>Contextual, high-signal referral and networking outreach scale system</p>
        </div>

        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
          <button 
            onClick={loadAllData} 
            disabled={loading}
            style={{
              padding: "0.5rem 1rem",
              background: "white",
              border: "1px solid var(--border)",
              borderRadius: "10px",
              fontSize: "0.88rem",
              fontWeight: 500,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px"
            }}
          >
            🔄 Sync Data
          </button>
          <button 
            onClick={handleSignOut}
            style={{
              padding: "0.5rem 1rem",
              background: "#fee2e2",
              color: "#dc2626",
              border: "1px solid #fecaca",
              borderRadius: "10px",
              fontSize: "0.88rem",
              fontWeight: 500,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px"
            }}
          >
            🔒 Lock
          </button>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div 
        style={{
          display: "flex",
          gap: "4px",
          background: "#f1f5f9",
          padding: "6px",
          borderRadius: "14px",
          border: "1px solid #e2e8f0",
          overflowX: "auto"
        }}
      >
        {[
          { key: "analytics", label: "📊 Overview" },
          { key: "profiles", label: "👥 Target Profiles" },
          { key: "resumes", label: "📄 Resumes" },
          { key: "jobs", label: "💼 Target Jobs" },
          { key: "templates", label: "📝 Templates" },
          { key: "generation", label: "✨ Gen Queue" },
          { key: "outbox", label: "✉️ Outbox Outbox" }
        ].map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              style={{
                flex: "1 1 auto",
                padding: "0.65rem 1rem",
                borderRadius: "10px",
                border: "none",
                background: isActive ? "white" : "transparent",
                color: isActive ? "#4f46e5" : "#475569",
                fontWeight: isActive ? 600 : 500,
                fontSize: "0.92rem",
                cursor: "pointer",
                boxShadow: isActive ? "0 1px 3px rgba(0,0,0,0.05)" : "none",
                transition: "all 150ms ease",
                whiteSpace: "nowrap"
              }}
            >
              {tab.label}
              {tab.key === "generation" && genQueueJobs.filter(j => j.status === "PENDING" || j.status === "GENERATING").length > 0 && (
                <span style={{ marginLeft: "6px", width: "8px", height: "8px", background: "#ef4444", borderRadius: "50%", display: "inline-block", animation: "pulseGlow 1s infinite" }} />
              )}
              {tab.key === "outbox" && approvalQueue.length > 0 && (
                <span style={{ marginLeft: "6px", background: "#4f46e5", color: "white", padding: "1px 6px", borderRadius: "999px", fontSize: "0.72rem", fontWeight: 700 }}>
                  {approvalQueue.length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ==================== TAB 1: ANALYTICS OVERVIEW ==================== */}
      {activeTab === "analytics" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          {/* Main Analytics Cards Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1.25rem" }}>
            {[
              { label: "Target Profiles", val: stats.totalProfiles, color: "#4f46e5" },
              { label: "AI Generations", val: stats.totalGenerated, color: "#7c3aed" },
              { label: "Approved Mail", val: stats.approvedCount, color: "#10b981" },
              { label: "Outbox Sent", val: stats.sentCount, color: "#059669" },
              { label: "Replies Received", val: stats.repliesCount, color: "#0891b2" },
              { label: "Referrals Gained", val: stats.referralsReceived, color: "#d97706" },
              { label: "Interviews Scheduled", val: stats.interviewsScheduled, color: "#ef4444" }
            ].map((card, idx) => (
              <div 
                key={idx} 
                style={{
                  background: "white",
                  border: "1px solid var(--border)",
                  borderRadius: "16px",
                  padding: "1.5rem",
                  boxShadow: "var(--shadow)",
                  position: "relative",
                  overflow: "hidden"
                }}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <span style={{ fontSize: "0.85rem", color: "#64748b", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.025em" }}>{card.label}</span>
                  <span style={{ fontSize: "2rem", fontWeight: 800, color: "#1e293b", letterSpacing: "-0.03em" }}>{card.val}</span>
                </div>
                <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "4px", background: card.color }} />
              </div>
            ))}
          </div>

          {/* Rates charts & Visuals */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
            <div style={{ background: "white", border: "1px solid var(--border)", borderRadius: "16px", padding: "2rem", boxShadow: "var(--shadow)", display: "flex", flexDirection: "column", gap: "1rem" }}>
              <h3 style={{ margin: 0, fontSize: "1.1rem", color: "#1e293b", fontWeight: 700 }}>Conversion Performance</h3>
              
              <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem", marginTop: "1rem" }}>
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                    <span style={{ fontSize: "0.9rem", fontWeight: 600, color: "#475569" }}>Outreach Reply Rate</span>
                    <span style={{ fontSize: "0.9rem", fontWeight: 700, color: "#4f46e5" }}>{stats.replyRate}%</span>
                  </div>
                  <div style={{ height: "10px", background: "#f1f5f9", borderRadius: "999px", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${stats.replyRate}%`, background: "linear-gradient(to right, #4f46e5, #6366f1)", borderRadius: "999px" }} />
                  </div>
                </div>

                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                    <span style={{ fontSize: "0.9rem", fontWeight: 600, color: "#475569" }}>Positive Response Conversion</span>
                    <span style={{ fontSize: "0.9rem", fontWeight: 700, color: "#10b981" }}>{stats.positiveReplyRate}%</span>
                  </div>
                  <div style={{ height: "10px", background: "#f1f5f9", borderRadius: "999px", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${stats.positiveReplyRate}%`, background: "linear-gradient(to right, #10b981, #34d399)", borderRadius: "999px" }} />
                  </div>
                </div>
              </div>
            </div>

            {/* Quickstart tutorial widget */}
            <div style={{ background: "linear-gradient(135deg, #1e1b4b, #311042)", color: "white", borderRadius: "16px", padding: "2rem", display: "flex", flexDirection: "column", justifyContent: "space-between", gap: "1.5rem", boxShadow: "0 10px 25px rgba(0,0,0,0.15)" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 700 }}>OutreachFlow Campaign Pipeline</h3>
                <p style={{ margin: "6px 0 0", fontSize: "0.85rem", color: "#c7d2fe" }}>Four simple steps to double your referral response rates:</p>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", fontSize: "0.82rem" }}>
                <div style={{ background: "rgba(255,255,255,0.06)", padding: "10px", borderRadius: "10px" }}>
                  <span style={{ display: "block", fontSize: "1.1rem", marginBottom: "4px" }}>1️⃣</span>
                  <strong>Upload Resume</strong>: Upload parsed PDFs to extract skill profiles.
                </div>
                <div style={{ background: "rgba(255,255,255,0.06)", padding: "10px", borderRadius: "10px" }}>
                  <span style={{ display: "block", fontSize: "1.1rem", marginBottom: "4px" }}>2️⃣</span>
                  <strong>Import Profiles</strong>: Paste CSV lists of target employees.
                </div>
                <div style={{ background: "rgba(255,255,255,0.06)", padding: "10px", borderRadius: "10px" }}>
                  <span style={{ display: "block", fontSize: "1.1rem", marginBottom: "4px" }}>3️⃣</span>
                  <strong>Approve drafts</strong>: Review contextual AI messages in the approval queue.
                </div>
                <div style={{ background: "rgba(255,255,255,0.06)", padding: "10px", borderRadius: "10px" }}>
                  <span style={{ display: "block", fontSize: "1.1rem", marginBottom: "4px" }}>4️⃣</span>
                  <strong>SMTP Dispatch</strong>: Sequentially send approved emails.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================== TAB 2: PROFILES MANAGER ==================== */}
      {activeTab === "profiles" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h2 style={{ fontSize: "1.3rem", fontWeight: 700, margin: 0 }}>Target Employees & Profiles</h2>
              <p style={{ margin: "2px 0 0", fontSize: "0.85rem", color: "#64748b" }}>Manage and import targets from company lists</p>
            </div>
            <button 
              onClick={() => setShowAddProfileModal(true)}
              style={{
                padding: "0.6rem 1.25rem",
                background: "var(--accent)",
                color: "white",
                border: "none",
                borderRadius: "10px",
                fontWeight: 600,
                fontSize: "0.9rem",
                cursor: "pointer",
                boxShadow: "0 2px 8px rgba(220,104,3,0.15)"
              }}
            >
              ➕ Add Profiles / Bulk Import
            </button>
          </div>

          {/* Quick Filter Bar */}
          <div style={{ display: "flex", gap: "0.75rem" }}>
            <input 
              type="text" 
              placeholder="Search by name, role, company..." 
              value={profileSearchQuery}
              onChange={(e) => setProfileSearchQuery(e.target.value)}
              style={{ flex: 1, padding: "0.6rem 1rem", border: "1px solid var(--border)", borderRadius: "10px", outline: "none" }}
            />
            <select
              value={profileFilterCompany}
              onChange={(e) => setProfileFilterCompany(e.target.value)}
              style={{ padding: "0.6rem", border: "1px solid var(--border)", borderRadius: "10px", background: "white" }}
            >
              <option value="">All Companies</option>
              {uniqueProfileCompanies.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Profiles Data Table */}
          {filteredProfiles.length === 0 ? (
            <div style={{ padding: "4rem", textAlign: "center", background: "#f8fafc", border: "1px dashed var(--border)", borderRadius: "16px" }}>
              <h3 style={{ color: "#475569" }}>No target profiles imported yet</h3>
              <p style={{ color: "#64748b", fontSize: "0.9rem" }}>Import single employee details or drag CSV files to start building outreach pipelines.</p>
            </div>
          ) : (
            <div style={{ background: "white", border: "1px solid var(--border)", borderRadius: "16px", overflow: "hidden", boxShadow: "var(--shadow)" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#f8fafc", borderBottom: "1px solid var(--border)", textAlign: "left" }}>
                    <th style={{ padding: "1rem", width: "40px", textAlign: "center" }}>
                      <input 
                        type="checkbox"
                        checked={selectedProfileIds.size === filteredProfiles.length && filteredProfiles.length > 0}
                        onChange={toggleSelectAllProfiles}
                      />
                    </th>
                    <th style={{ padding: "1rem", fontWeight: 600, fontSize: "0.85rem", color: "#475569" }}>Name</th>
                    <th style={{ padding: "1rem", fontWeight: 600, fontSize: "0.85rem", color: "#475569" }}>Role</th>
                    <th style={{ padding: "1rem", fontWeight: 600, fontSize: "0.85rem", color: "#475569" }}>Company</th>
                    <th style={{ padding: "1rem", fontWeight: 600, fontSize: "0.85rem", color: "#475569" }}>Email / Link</th>
                    <th style={{ padding: "1rem", fontWeight: 600, fontSize: "0.85rem", color: "#475569" }}>Source</th>
                    <th style={{ padding: "1rem", fontWeight: 600, fontSize: "0.85rem", color: "#475569" }}>Tags</th>
                    <th style={{ padding: "1rem", fontWeight: 600, fontSize: "0.85rem", color: "#475569", textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProfiles.map((p) => (
                    <tr key={p.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "1rem", textAlign: "center" }}>
                        <input 
                          type="checkbox"
                          checked={selectedProfileIds.has(p.id)}
                          onChange={() => toggleSelectProfile(p.id)}
                        />
                      </td>
                      <td style={{ padding: "1rem", fontWeight: 700, color: "#1e293b" }}>{p.name}</td>
                      <td style={{ padding: "1rem" }}>{p.role}</td>
                      <td style={{ padding: "1rem", fontWeight: 600 }}>{p.company}</td>
                      <td style={{ padding: "1rem", fontSize: "0.88rem" }}>
                        <div>{p.email || "-"}</div>
                        {p.linkedinUrl && <a href={p.linkedinUrl} target="_blank" rel="noreferrer" style={{ fontSize: "0.78rem", color: "#4f46e5" }}>LinkedIn Profile</a>}
                      </td>
                      <td style={{ padding: "1rem" }}>
                        <span style={{ fontSize: "0.75rem", background: p.source === "MANUAL" ? "#eff6ff" : "#f5f5f4", color: p.source === "MANUAL" ? "#1d4ed8" : "#44403c", padding: "2px 8px", borderRadius: "999px", fontWeight: 600 }}>
                          {p.source}
                        </span>
                      </td>
                      <td style={{ padding: "1rem" }}>
                        <div style={{ display: "flex", gap: "4px" }}>
                          {p.tags.map((t) => (
                            <span key={t} style={{ fontSize: "0.72rem", background: "#f1f5f9", padding: "2px 6px", borderRadius: "6px" }}>{t}</span>
                          ))}
                        </div>
                      </td>
                      <td style={{ padding: "1rem", textAlign: "right" }}>
                        <button 
                          onClick={() => handleDeleteProfile(p.id)}
                          style={{ background: "transparent", border: "none", color: "#ef4444", cursor: "pointer", padding: "4px" }}
                        >
                          🗑️
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Action dock when items are selected */}
          {selectedProfileIds.size > 0 && (
            <div 
              style={{
                position: "fixed",
                bottom: "2rem",
                left: "50%",
                transform: "translateX(-50%)",
                background: "rgba(30, 27, 75, 0.95)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "16px",
                padding: "1rem 2rem",
                display: "flex",
                gap: "1.5rem",
                alignItems: "center",
                color: "white",
                boxShadow: "0 10px 30px rgba(0,0,0,0.3)",
                zIndex: 99
              }}
            >
              <span>Selected <strong>{selectedProfileIds.size}</strong> profile(s)</span>
              
              <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
                <select
                  value={selectedTemplateId}
                  onChange={(e) => setSelectedTemplateId(e.target.value)}
                  style={{ padding: "0.5rem", borderRadius: "8px", background: "white", color: "#1e293b", border: "none" }}
                >
                  <option value="">Choose Template...</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>{t.name} ({t.type})</option>
                  ))}
                </select>

                <select
                  value={selectedJobId}
                  onChange={(e) => setSelectedJobId(e.target.value)}
                  style={{ padding: "0.5rem", borderRadius: "8px", background: "white", color: "#1e293b", border: "none" }}
                >
                  <option value="">Job Context (Optional)...</option>
                  {manualJobs.map((j) => (
                    <option key={j.id} value={j.id}>{j.title} @ {j.company}</option>
                  ))}
                </select>

                <button 
                  onClick={handleLaunchGeneration}
                  style={{
                    background: "linear-gradient(to right, #4f46e5, #7c3aed)",
                    border: "none",
                    color: "white",
                    padding: "0.5rem 1.25rem",
                    borderRadius: "8px",
                    fontWeight: 600,
                    cursor: "pointer"
                  }}
                >
                  ✨ Generate bulk outreach
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ==================== TAB 3: RESUME MANAGER ==================== */}
      {activeTab === "resumes" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h2 style={{ fontSize: "1.3rem", fontWeight: 700, margin: 0 }}>Resume Manager</h2>
              <p style={{ margin: "2px 0 0", fontSize: "0.85rem", color: "#64748b" }}>Manage multiple resumes to drive dynamic AI generation context</p>
            </div>
            <button 
              onClick={() => setShowAddResumeModal(true)}
              style={{
                padding: "0.6rem 1.25rem",
                background: "var(--accent)",
                color: "white",
                border: "none",
                borderRadius: "10px",
                fontWeight: 600,
                fontSize: "0.9rem",
                cursor: "pointer"
              }}
            >
              ➕ Upload Resume PDF
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
            {/* List */}
            <div style={{ background: "white", border: "1px solid var(--border)", borderRadius: "16px", padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
              <h3 style={{ margin: 0, fontSize: "1.1rem" }}>Master Resumes</h3>
              
              {resumes.length === 0 ? (
                <div style={{ padding: "2rem", textAlign: "center", background: "#f8fafc", borderRadius: "12px", border: "1px dashed var(--border)" }}>
                  No resumes uploaded. Please upload a PDF to extract ATS parameters.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  {resumes.map((r) => {
                    const isActive = activeResumeId === r.id;
                    return (
                      <div 
                        key={r.id}
                        style={{
                          border: isActive ? "2px solid #4f46e5" : "1px solid var(--border)",
                          borderRadius: "12px",
                          padding: "1rem",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          background: isActive ? "#fefefe" : "white"
                        }}
                      >
                        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                          <input 
                            type="radio" 
                            name="active-resume"
                            checked={isActive}
                            onChange={() => setActiveResumeId(r.id)}
                            style={{ width: "16px", height: "16px" }}
                          />
                          <div>
                            <strong style={{ display: "block" }}>{r.title}</strong>
                            <span style={{ fontSize: "0.75rem", color: "#64748b" }}>Parsed technical skills: {r.skills.length}</span>
                          </div>
                        </div>

                        <button 
                          onClick={() => handleDeleteResume(r.id)}
                          style={{ background: "transparent", border: "none", color: "#ef4444", cursor: "pointer" }}
                        >
                          🗑️
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Details Preview */}
            <div style={{ background: "white", border: "1px solid var(--border)", borderRadius: "16px", padding: "1.5rem" }}>
              <h3 style={{ margin: 0, fontSize: "1.1rem", marginBottom: "1rem" }}>Selected Resume Extracted Context</h3>
              
              {resumes.find(r => r.id === activeResumeId) ? (
                (() => {
                  const selected = resumes.find(r => r.id === activeResumeId)!;
                  return (
                    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                      <div>
                        <strong>Resume Title: </strong> {selected.title}
                      </div>

                      <div>
                        <strong>Extracted Key Skills Profile:</strong>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "6px" }}>
                          {selected.skills.map((s) => (
                            <span key={s} style={{ fontSize: "0.78rem", background: "#f3f4f6", padding: "4px 10px", borderRadius: "999px", border: "1px solid #e5e7eb", color: "#374151", fontWeight: 600 }}>{s}</span>
                          ))}
                        </div>
                      </div>

                      <div>
                        <strong>Extracted ATS Text Preview:</strong>
                        <div style={{ maxHeight: "200px", overflowY: "auto", padding: "0.75rem", background: "#f8fafc", border: "1px solid var(--border)", borderRadius: "8px", fontSize: "0.82rem", color: "#475569", whiteSpace: "pre-wrap" }}>
                          {selected.parsedText}
                        </div>
                      </div>
                    </div>
                  );
                })()
              ) : (
                <div style={{ color: "#64748b", fontStyle: "italic" }}>Select a resume from the list to preview parsed parameters.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ==================== TAB 4: MANUAL JOBS BOARD ==================== */}
      {activeTab === "jobs" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h2 style={{ fontSize: "1.3rem", fontWeight: 700, margin: 0 }}>Target Job Postings</h2>
              <p style={{ margin: "2px 0 0", fontSize: "0.85rem", color: "#64748b" }}>Track specific roles to bind as context for AI generations</p>
            </div>
            <button 
              onClick={() => setShowAddJobModal(true)}
              style={{
                padding: "0.6rem 1.25rem",
                background: "var(--accent)",
                color: "white",
                border: "none",
                borderRadius: "10px",
                fontWeight: 600,
                fontSize: "0.9rem",
                cursor: "pointer"
              }}
            >
              ➕ Add Job Manually
            </button>
          </div>

          {manualJobs.length === 0 ? (
            <div style={{ padding: "4rem", textAlign: "center", background: "#f8fafc", border: "1px dashed var(--border)", borderRadius: "16px" }}>
              <h3>No tracked jobs listed yet</h3>
              <p style={{ fontSize: "0.9rem", color: "#64748b" }}>Create manual target postings to dynamically drive context for founder outreach and referral messages.</p>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "1.25rem" }}>
              {manualJobs.map((j) => (
                <div 
                  key={j.id}
                  style={{
                    background: "white",
                    border: "1px solid var(--border)",
                    borderRadius: "16px",
                    padding: "1.25rem",
                    boxShadow: "var(--shadow)",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    gap: "1rem"
                  }}
                >
                  <div>
                    <h3 style={{ margin: 0, fontSize: "1.1rem", color: "#1e293b", fontWeight: 700 }}>{j.title}</h3>
                    <strong style={{ display: "block", color: "#64748b", fontSize: "0.9rem", marginTop: "4px" }}>{j.company}</strong>
                    
                    {j.applyUrl && (
                      <a href={j.applyUrl} target="_blank" rel="noreferrer" style={{ fontSize: "0.78rem", color: "#4f46e5", display: "inline-block", marginTop: "6px" }}>
                        View Original Posting Link ↗
                      </a>
                    )}

                    <div style={{ fontSize: "0.82rem", color: "#475569", marginTop: "10px", maxHeight: "100px", overflowY: "auto", padding: "6px", background: "#f8fafc", borderRadius: "8px", border: "1px solid #f1f5f9" }}>
                      {j.description || "No JD specified."}
                    </div>
                  </div>

                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <button 
                      onClick={() => handleDeleteJob(j.id)}
                      style={{ background: "transparent", border: "none", color: "#ef4444", cursor: "pointer" }}
                    >
                      Delete Role
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ==================== TAB 5: PROMPT TEMPLATES ==================== */}
      {activeTab === "templates" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h2 style={{ fontSize: "1.3rem", fontWeight: 700, margin: 0 }}>AI Prompt Templates</h2>
              <p style={{ margin: "2px 0 0", fontSize: "0.85rem", color: "#64748b" }}>Tune and tweak customized prompting guidelines for outreach styles</p>
            </div>
            <button 
              onClick={() => {
                setTemplateName("");
                setTemplatePrompt("");
                setEditingTemplateId(null);
                setShowTemplateModal(true);
              }}
              style={{
                padding: "0.6rem 1.25rem",
                background: "var(--accent)",
                color: "white",
                border: "none",
                borderRadius: "10px",
                fontWeight: 600,
                fontSize: "0.9rem",
                cursor: "pointer"
              }}
            >
              ➕ Create Prompt Template
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "1.25rem" }}>
            {templates.map((t) => (
              <div 
                key={t.id}
                style={{
                  background: "white",
                  border: "1px solid var(--border)",
                  borderRadius: "16px",
                  padding: "1.25rem",
                  boxShadow: "var(--shadow)",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  gap: "1rem"
                }}
              >
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700 }}>{t.name}</h3>
                    <span style={{ fontSize: "0.68rem", background: "#f3e8ff", color: "#7e22ce", padding: "2px 8px", borderRadius: "999px", fontWeight: 700 }}>{t.type}</span>
                  </div>
                  
                  <div style={{ fontSize: "0.82rem", color: "#475569", marginTop: "10px", height: "120px", overflowY: "auto", padding: "8px", background: "#f8fafc", borderRadius: "8px", border: "1px solid #f1f5f9" }}>
                    {t.prompt}
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                  <button 
                    onClick={() => {
                      setTemplateName(t.name);
                      setTemplatePrompt(t.prompt);
                      setTemplateType(t.type);
                      setEditingTemplateId(t.id);
                      setShowTemplateModal(true);
                    }}
                    style={{ background: "transparent", border: "none", color: "#4f46e5", cursor: "pointer", fontSize: "0.85rem", fontWeight: 600 }}
                  >
                    Edit Guidelines
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ==================== TAB 6: GENERATION QUEUE ==================== */}
      {activeTab === "generation" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          <div>
            <h2 style={{ fontSize: "1.3rem", fontWeight: 700, margin: 0 }}>Redis Queue Status (BullMQ)</h2>
            <p style={{ margin: "2px 0 0", fontSize: "0.85rem", color: "#64748b" }}>Monitor background AI bulk generation tasks</p>
          </div>

          {genQueueJobs.length === 0 ? (
            <div style={{ padding: "4rem", textAlign: "center", background: "#f8fafc", border: "1px dashed var(--border)", borderRadius: "16px" }}>
              No background jobs enqueued. Go to the "Target Profiles" tab, select profiles, and dispatch generations.
            </div>
          ) : (
            <div style={{ background: "white", border: "1px solid var(--border)", borderRadius: "16px", overflow: "hidden", boxShadow: "var(--shadow)" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#f8fafc", borderBottom: "1px solid var(--border)", textAlign: "left" }}>
                    <th style={{ padding: "1rem", fontWeight: 600, fontSize: "0.85rem", color: "#475569" }}>Target Details</th>
                    <th style={{ padding: "1rem", fontWeight: 600, fontSize: "0.85rem", color: "#475569" }}>Template used</th>
                    <th style={{ padding: "1rem", fontWeight: 600, fontSize: "0.85rem", color: "#475569" }}>Triggered At</th>
                    <th style={{ padding: "1rem", fontWeight: 600, fontSize: "0.85rem", color: "#475569" }}>BullMQ Status</th>
                    <th style={{ padding: "1rem", fontWeight: 600, fontSize: "0.85rem", color: "#475569" }}>Result Logs / Errors</th>
                  </tr>
                </thead>
                <tbody>
                  {genQueueJobs.map((j) => {
                    let statusColor = "#475569";
                    let statusBg = "#f1f5f9";
                    let glow = false;

                    switch (j.status) {
                      case "PENDING":
                        statusColor = "#d97706";
                        statusBg = "#fef3c7";
                        break;
                      case "GENERATING":
                        statusColor = "#7e22ce";
                        statusBg = "#f3e8ff";
                        glow = true;
                        break;
                      case "COMPLETED":
                        statusColor = "#047857";
                        statusBg = "#d1fae5";
                        break;
                      case "FAILED":
                        statusColor = "#b91c1c";
                        statusBg = "#fee2e2";
                        break;
                    }

                    return (
                      <tr key={j.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                        <td style={{ padding: "1rem" }}>
                          <strong style={{ display: "block" }}>{j.profile.name}</strong>
                          <span style={{ fontSize: "0.78rem", color: "#64748b" }}>{j.profile.role} @ {j.profile.company}</span>
                        </td>
                        <td style={{ padding: "1rem", fontSize: "0.88rem" }}>{j.template.name}</td>
                        <td style={{ padding: "1rem", fontSize: "0.85rem", color: "#64748b" }}>
                          {new Date(j.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </td>
                        <td style={{ padding: "1rem" }}>
                          <span
                            style={{
                              background: statusBg,
                              color: statusColor,
                              padding: "4px 10px",
                              borderRadius: "999px",
                              fontSize: "0.75rem",
                              fontWeight: 700,
                              animation: glow ? "pulseGlow 1.5s infinite alternate" : "none"
                            }}
                          >
                            {j.status}
                          </span>
                        </td>
                        <td style={{ padding: "1rem", fontSize: "0.82rem", maxWidth: "250px", wordBreak: "break-word" }}>
                          {j.status === "COMPLETED" ? (
                            <span style={{ color: "#10b981", fontWeight: 600 }}>Message compiled in draft queue ✓</span>
                          ) : j.status === "FAILED" ? (
                            <span style={{ color: "#ef4444" }}>⚠️ {j.error || "Generation crashed."}</span>
                          ) : (
                            <span style={{ color: "#64748b", fontStyle: "italic" }}>Running background prompt...</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ==================== TAB 7: APPROVAL QUEUE & OUTBOX ==================== */}
      {activeTab === "outbox" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          {/* Section 1: Approval Workflow Queue */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <div>
                <h2 style={{ fontSize: "1.3rem", fontWeight: 700, margin: 0 }}>Human Review / Approval Queue</h2>
                <p style={{ margin: "2px 0 0", fontSize: "0.85rem", color: "#64748b" }}>Edit and approve generated messages before transmission</p>
              </div>

              {approvalQueue.length > 0 && (
                <button
                  onClick={handleTriggerSMTPDispatch}
                  style={{
                    padding: "0.65rem 1.5rem",
                    background: "linear-gradient(to right, #059669, #10b981)",
                    color: "white",
                    border: "none",
                    borderRadius: "10px",
                    fontWeight: 700,
                    cursor: "pointer",
                    boxShadow: "0 4px 12px rgba(16,185,129,0.2)"
                  }}
                >
                  ✉️ Dispatch Approved Outbox
                </button>
              )}
            </div>

            {approvalQueue.length === 0 ? (
              <div style={{ padding: "3rem", textAlign: "center", background: "#f8fafc", border: "1px dashed var(--border)", borderRadius: "16px", marginBottom: "2rem" }}>
                <h3 style={{ color: "#475569" }}>Approval Queue is empty</h3>
                <p style={{ fontSize: "0.9rem", color: "#64748b" }}>All enqueued drafts have been processed or approved. Launch new bulk generations to fill reviews.</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem", marginBottom: "2.5rem" }}>
                {approvalQueue.map((draft) => {
                  const isEditing = editingDraftId === draft.id;
                  return (
                    <div 
                      key={draft.id}
                      style={{
                        background: "white",
                        border: "1px solid var(--border)",
                        borderRadius: "16px",
                        boxShadow: "var(--shadow)",
                        overflow: "hidden",
                        display: "grid",
                        gridTemplateColumns: "240px 1fr"
                      }}
                    >
                      {/* Left: Profile metadata context info card */}
                      <div style={{ background: "#f8fafc", padding: "1.5rem", borderRight: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: "1rem" }}>
                        <div>
                          <span style={{ fontSize: "0.72rem", textTransform: "uppercase", color: "#64748b", fontWeight: 700 }}>Recipient</span>
                          <strong style={{ display: "block", fontSize: "1.1rem", color: "#1e293b", marginTop: "2px" }}>{draft.profile.name}</strong>
                          <span style={{ fontSize: "0.85rem", color: "#475569" }}>{draft.profile.role}</span>
                          <span style={{ display: "block", fontSize: "0.85rem", color: "#475569", fontWeight: 600 }}>{draft.profile.company}</span>
                        </div>

                        <div>
                          <span style={{ fontSize: "0.72rem", textTransform: "uppercase", color: "#64748b", fontWeight: 700 }}>Email Address</span>
                          <span style={{ display: "block", fontSize: "0.82rem", wordBreak: "break-all" }}>{draft.profile.email || "No Email Provided"}</span>
                        </div>

                        <div>
                          <span style={{ fontSize: "0.72rem", textTransform: "uppercase", color: "#64748b", fontWeight: 700 }}>Draft Status</span>
                          <span style={{ display: "inline-block", background: "#fef3c7", color: "#d97706", fontSize: "0.75rem", padding: "2px 8px", borderRadius: "999px", fontWeight: 700, marginTop: "2px" }}>
                            {draft.status}
                          </span>
                        </div>
                      </div>

                      {/* Right: Message editor panel */}
                      <div style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
                        {isEditing ? (
                          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                            <div>
                              <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, color: "#475569", marginBottom: "4px" }}>Email Subject</label>
                              <input 
                                type="text" 
                                value={editingSubject} 
                                onChange={(e) => setEditingSubject(e.target.value)}
                                style={{ width: "100%", padding: "0.6rem", border: "1px solid var(--border)", borderRadius: "8px", outline: "none", fontSize: "0.95rem" }}
                              />
                            </div>
                            <div>
                              <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, color: "#475569", marginBottom: "4px" }}>Email Copy</label>
                              <textarea
                                value={editingContent}
                                onChange={(e) => setEditingContent(e.target.value)}
                                rows={8}
                                style={{ width: "100%", padding: "0.75rem", border: "1px solid var(--border)", borderRadius: "8px", outline: "none", fontSize: "0.92rem", lineHeight: 1.4, fontFamily: "inherit" }}
                              />
                            </div>

                            <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
                              <button 
                                onClick={() => setEditingDraftId(null)}
                                style={{ padding: "0.4rem 1rem", background: "white", border: "1px solid var(--border)", borderRadius: "8px", cursor: "pointer" }}
                              >
                                Cancel
                              </button>
                              <button 
                                onClick={() => handleSaveDraftEdits(draft.id)}
                                style={{ padding: "0.4rem 1.25rem", background: "#4f46e5", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: 600 }}
                              >
                                Save Changes
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div style={{ display: "flex", flexDirection: "column", gap: "1rem", height: "100%", justifyContent: "space-between" }}>
                            <div>
                              <div style={{ borderBottom: "1px solid #f1f5f9", paddingBottom: "8px", marginBottom: "8px" }}>
                                <strong>Subject:</strong> {draft.subject}
                              </div>
                              <div style={{ fontSize: "0.92rem", color: "#374151", whiteSpace: "pre-wrap", lineHeight: 1.4 }}>
                                {draft.content}
                              </div>
                            </div>

                            {/* Actions block */}
                            <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end", borderTop: "1px solid #f1f5f9", paddingTop: "10px", marginTop: "auto" }}>
                              <button 
                                onClick={() => handleOpenEditDraft(draft)}
                                style={{ padding: "0.4rem 1rem", background: "white", border: "1px solid var(--border)", borderRadius: "8px", cursor: "pointer", fontSize: "0.85rem", fontWeight: 500 }}
                              >
                                📝 Edit Draft
                              </button>
                              <button 
                                onClick={() => handleRejectMessage(draft.id)}
                                style={{ padding: "0.4rem 1rem", background: "#fee2e2", color: "#ef4444", border: "1px solid #fecaca", borderRadius: "8px", cursor: "pointer", fontSize: "0.85rem", fontWeight: 500 }}
                              >
                                ✕ Reject
                              </button>
                              <button 
                                onClick={() => handleApproveMessage(draft.id)}
                                style={{ padding: "0.4rem 1.25rem", background: "#10b981", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", fontSize: "0.85rem", fontWeight: 600 }}
                              >
                                ✓ Approve Draft
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Section 2: Outbox History Logs */}
          <div>
            <h2 style={{ fontSize: "1.2rem", fontWeight: 700, margin: "0 0 1rem 0" }}>Outbox Logs & Sending Queue</h2>
            
            {outboxMessages.length === 0 ? (
              <div style={{ padding: "2rem", textAlign: "center", background: "#f8fafc", borderRadius: "12px", border: "1px dashed var(--border)" }}>
                No sent logs available. Approved emails appear here when transmitted.
              </div>
            ) : (
              <div style={{ background: "white", border: "1px solid var(--border)", borderRadius: "16px", overflow: "hidden", boxShadow: "var(--shadow)" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "#f8fafc", borderBottom: "1px solid var(--border)", textAlign: "left" }}>
                      <th style={{ padding: "1rem", fontWeight: 600, fontSize: "0.85rem", color: "#475569" }}>Target Recipient</th>
                      <th style={{ padding: "1rem", fontWeight: 600, fontSize: "0.85rem", color: "#475569" }}>Email Subject</th>
                      <th style={{ padding: "1rem", fontWeight: 600, fontSize: "0.85rem", color: "#475569" }}>Channel</th>
                      <th style={{ padding: "1rem", fontWeight: 600, fontSize: "0.85rem", color: "#475569" }}>Status</th>
                      <th style={{ padding: "1rem", fontWeight: 600, fontSize: "0.85rem", color: "#475569" }}>Delivered Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {outboxMessages.map((msg) => {
                      let statusBg = "#f1f5f9";
                      let statusColor = "#475569";
                      let glow = false;

                      switch (msg.status) {
                        case "APPROVED":
                          statusBg = "#e0e7ff";
                          statusColor = "#4338ca";
                          break;
                        case "SENDING":
                          statusBg = "#ffedd5";
                          statusColor = "#c2410c";
                          glow = true;
                          break;
                        case "SENT":
                          statusBg = "#d1fae5";
                          statusColor = "#047857";
                          break;
                        case "FAILED":
                          statusBg = "#fee2e2";
                          statusColor = "#b91c1c";
                          break;
                      }

                      return (
                        <tr key={msg.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                          <td style={{ padding: "1rem" }}>
                            <strong style={{ display: "block" }}>{msg.profile.name}</strong>
                            <span style={{ fontSize: "0.78rem", color: "#64748b" }}>{msg.profile.email}</span>
                          </td>
                          <td style={{ padding: "1rem", fontSize: "0.88rem" }}>{msg.subject}</td>
                          <td style={{ padding: "1rem", fontSize: "0.85rem" }}>
                            <span style={{ background: "#f1f5f9", padding: "2px 8px", borderRadius: "999px", fontSize: "0.72rem", fontWeight: 600 }}>{msg.channel}</span>
                          </td>
                          <td style={{ padding: "1rem" }}>
                            <span style={{ background: statusBg, color: statusColor, padding: "4px 10px", borderRadius: "999px", fontSize: "0.75rem", fontWeight: 700, animation: glow ? "pulseGlow 1s infinite alternate" : "none" }}>
                              {msg.status}
                            </span>
                          </td>
                          <td style={{ padding: "1rem", fontSize: "0.85rem", color: "#64748b" }}>
                            {msg.sentAt ? new Date(msg.sentAt).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "-"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================== G. MODALS & DRAWERS DEFINITIONS ==================== */}

      {/* Add Profile & Importer Modal */}
      {showAddProfileModal && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(15,23,42,0.4)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999 }}>
          <div style={{ width: "560px", background: "white", borderRadius: "20px", padding: "2rem", display: "flex", flexDirection: "column", gap: "1.5rem", boxShadow: "0 20px 25px rgba(0,0,0,0.15)", maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 700 }}>Import Target Profiles</h3>
              <button onClick={() => setShowAddProfileModal(false)} style={{ background: "transparent", border: "none", fontSize: "1.5rem", cursor: "pointer" }}>&times;</button>
            </div>

            <form onSubmit={handleAddProfile} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              {/* Selector to switch between Single and Bulk */}
              <div style={{ display: "flex", gap: "1rem", borderBottom: "1px solid #e2e8f0", paddingBottom: "10px" }}>
                <button 
                  type="button" 
                  onClick={() => setProfileBulkInput("")}
                  style={{ background: !profileBulkInput ? "#4f46e5" : "transparent", color: !profileBulkInput ? "white" : "#475569", border: "none", padding: "6px 12px", borderRadius: "8px", cursor: "pointer", fontWeight: 600 }}
                >
                  Single Form Add
                </button>
                <button 
                  type="button" 
                  onClick={() => setProfileBulkInput("Name,Role,Company,LinkedIn,Email,Notes\nShivam,CTO,Morphie,,shivam@morphie.co,")}
                  style={{ background: profileBulkInput ? "#4f46e5" : "transparent", color: profileBulkInput ? "white" : "#475569", border: "none", padding: "6px 12px", borderRadius: "8px", cursor: "pointer", fontWeight: 600 }}
                >
                  Bulk CSV/JSON paste
                </button>
              </div>

              {profileBulkInput ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <button type="button" onClick={() => setImportFormat("csv")} style={{ background: importFormat === "csv" ? "#1e293b" : "transparent", color: importFormat === "csv" ? "white" : "#475569", border: "1px solid #cbd5e1", padding: "4px 10px", borderRadius: "6px", cursor: "pointer" }}>CSV Format</button>
                    <button type="button" onClick={() => setImportFormat("json")} style={{ background: importFormat === "json" ? "#1e293b" : "transparent", color: importFormat === "json" ? "white" : "#475569", border: "1px solid #cbd5e1", padding: "4px 10px", borderRadius: "6px", cursor: "pointer" }}>JSON Array Format</button>
                  </div>
                  <textarea
                    rows={8}
                    placeholder={importFormat === "csv" ? "Name,Role,Company,LinkedIn,Email,Notes\nShivam,SDE,Snapmint,,shivam@snapmint.com,Ref by John\n..." : '[\n  { "name": "Shivam", "role": "SDE", "company": "Snapmint", "email": "shivam@snapmint.com" }\n]'}
                    value={profileBulkInput}
                    onChange={(e) => setProfileBulkInput(e.target.value)}
                    style={{ width: "100%", padding: "0.75rem", border: "1px solid #cbd5e1", borderRadius: "8px", outline: "none", fontSize: "0.88rem", fontFamily: "monospace" }}
                  />
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <label style={{ fontSize: "0.82rem", fontWeight: 600 }}>Full Name *</label>
                    <input type="text" value={profileName} onChange={(e) => setProfileName(e.target.value)} style={{ padding: "0.5rem", border: "1px solid #cbd5e1", borderRadius: "8px" }} />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <label style={{ fontSize: "0.82rem", fontWeight: 600 }}>Target Role / Title *</label>
                    <input type="text" value={profileRole} onChange={(e) => setProfileRole(e.target.value)} style={{ padding: "0.5rem", border: "1px solid #cbd5e1", borderRadius: "8px" }} />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <label style={{ fontSize: "0.82rem", fontWeight: 600 }}>Company *</label>
                    <input type="text" value={profileCompany} onChange={(e) => setProfileCompany(e.target.value)} style={{ padding: "0.5rem", border: "1px solid #cbd5e1", borderRadius: "8px" }} />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <label style={{ fontSize: "0.82rem", fontWeight: 600 }}>Email Address</label>
                    <input type="email" value={profileEmail} onChange={(e) => setProfileEmail(e.target.value)} style={{ padding: "0.5rem", border: "1px solid #cbd5e1", borderRadius: "8px" }} />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px", gridColumn: "span 2" }}>
                    <label style={{ fontSize: "0.82rem", fontWeight: 600 }}>LinkedIn URL</label>
                    <input type="url" value={profileLinkedin} onChange={(e) => setProfileLinkedin(e.target.value)} style={{ padding: "0.5rem", border: "1px solid #cbd5e1", borderRadius: "8px" }} />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px", gridColumn: "span 2" }}>
                    <label style={{ fontSize: "0.82rem", fontWeight: 600 }}>Skills / Focus Tags (comma separated)</label>
                    <input type="text" placeholder="e.g. Backend, React, Fintech" value={profileTagsInput} onChange={(e) => setProfileTagsInput(e.target.value)} style={{ padding: "0.5rem", border: "1px solid #cbd5e1", borderRadius: "8px" }} />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px", gridColumn: "span 2" }}>
                    <label style={{ fontSize: "0.82rem", fontWeight: 600 }}>Notes & Context</label>
                    <textarea rows={3} placeholder="e.g. Previously worked at Coinbase, active on open source..." value={profileNotes} onChange={(e) => setProfileNotes(e.target.value)} style={{ padding: "0.5rem", border: "1px solid #cbd5e1", borderRadius: "8px", outline: "none" }} />
                  </div>
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", marginTop: "1rem" }}>
                <button type="button" onClick={() => setShowAddProfileModal(false)} style={{ flex: 1, padding: "0.6rem", background: "white", border: "1px solid #cbd5e1", borderRadius: "10px", cursor: "pointer" }}>Cancel</button>
                <button type="submit" disabled={loading} style={{ flex: 1, padding: "0.6rem", background: "#4f46e5", color: "white", border: "none", borderRadius: "10px", cursor: "pointer", fontWeight: 600 }}>
                  {loading ? "Importing..." : "Save Target Profiles"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Resume Modal */}
      {showAddResumeModal && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(15,23,42,0.4)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999 }}>
          <div style={{ width: "420px", background: "white", borderRadius: "20px", padding: "2rem", display: "flex", flexDirection: "column", gap: "1.5rem", boxShadow: "0 20px 25px rgba(0,0,0,0.15)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 700 }}>Upload Resume PDF</h3>
              <button onClick={() => setShowAddResumeModal(false)} style={{ background: "transparent", border: "none", fontSize: "1.5rem", cursor: "pointer" }}>&times;</button>
            </div>

            <form onSubmit={handleUploadResume} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <label style={{ fontSize: "0.82rem", fontWeight: 600 }}>Resume Label / Title *</label>
                <input type="text" placeholder="e.g. Backend SDE Resume, AI Intern Resume" value={resumeTitle} onChange={(e) => setResumeTitle(e.target.value)} style={{ padding: "0.5rem", border: "1px solid #cbd5e1", borderRadius: "8px" }} />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <label style={{ fontSize: "0.82rem", fontWeight: 600 }}>PDF File *</label>
                <input 
                  type="file" 
                  accept="application/pdf" 
                  onChange={(e) => setResumeFile(e.target.files?.[0] || null)} 
                  style={{ padding: "0.5rem", border: "1px dashed #cbd5e1", borderRadius: "8px", background: "#f8fafc" }} 
                />
              </div>

              <div style={{ display: "flex", gap: "10px", marginTop: "1rem" }}>
                <button type="button" onClick={() => setShowAddResumeModal(false)} style={{ flex: 1, padding: "0.6rem", background: "white", border: "1px solid #cbd5e1", borderRadius: "10px", cursor: "pointer" }}>Cancel</button>
                <button type="submit" disabled={loading} style={{ flex: 1, padding: "0.6rem", background: "#4f46e5", color: "white", border: "none", borderRadius: "10px", cursor: "pointer", fontWeight: 600 }}>
                  {loading ? "Parsing PDF..." : "Upload & Parse Context"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Job Modal */}
      {showAddJobModal && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(15,23,42,0.4)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999 }}>
          <div style={{ width: "460px", background: "white", borderRadius: "20px", padding: "2rem", display: "flex", flexDirection: "column", gap: "1.5rem", boxShadow: "0 20px 25px rgba(0,0,0,0.15)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 700 }}>Add Manual Target Job</h3>
              <button onClick={() => setShowAddJobModal(false)} style={{ background: "transparent", border: "none", fontSize: "1.5rem", cursor: "pointer" }}>&times;</button>
            </div>

            <form onSubmit={handleAddJob} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <label style={{ fontSize: "0.82rem", fontWeight: 600 }}>Job Title *</label>
                <input type="text" placeholder="e.g. Backend Engineer Intern" value={jobTitleInput} onChange={(e) => setJobTitleInput(e.target.value)} style={{ padding: "0.5rem", border: "1px solid #cbd5e1", borderRadius: "8px" }} />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <label style={{ fontSize: "0.82rem", fontWeight: 600 }}>Company Name *</label>
                <input type="text" placeholder="e.g. Stripe" value={jobCompanyInput} onChange={(e) => setJobCompanyInput(e.target.value)} style={{ padding: "0.5rem", border: "1px solid #cbd5e1", borderRadius: "8px" }} />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <label style={{ fontSize: "0.82rem", fontWeight: 600 }}>Original Posting URL</label>
                <input type="url" placeholder="https://stripe.com/careers/jobs/..." value={jobLinkInput} onChange={(e) => setJobLinkInput(e.target.value)} style={{ padding: "0.5rem", border: "1px solid #cbd5e1", borderRadius: "8px" }} />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <label style={{ fontSize: "0.82rem", fontWeight: 600 }}>Job Description Details</label>
                <textarea rows={4} placeholder="Requirements, key stacks, experience expectations..." value={jobDescriptionInput} onChange={(e) => setJobDescriptionInput(e.target.value)} style={{ padding: "0.5rem", border: "1px solid #cbd5e1", borderRadius: "8px", outline: "none" }} />
              </div>

              <div style={{ display: "flex", gap: "10px", marginTop: "1rem" }}>
                <button type="button" onClick={() => setShowAddJobModal(false)} style={{ flex: 1, padding: "0.6rem", background: "white", border: "1px solid #cbd5e1", borderRadius: "10px", cursor: "pointer" }}>Cancel</button>
                <button type="submit" disabled={loading} style={{ flex: 1, padding: "0.6rem", background: "#4f46e5", color: "white", border: "none", borderRadius: "10px", cursor: "pointer", fontWeight: 600 }}>
                  Save Job spec
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit/Create Templates Modal */}
      {showTemplateModal && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(15,23,42,0.4)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999 }}>
          <div style={{ width: "500px", background: "white", borderRadius: "20px", padding: "2rem", display: "flex", flexDirection: "column", gap: "1.5rem", boxShadow: "0 20px 25px rgba(0,0,0,0.15)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 700 }}>{editingTemplateId ? "Edit Prompt Guidelines" : "Create Prompt Template"}</h3>
              <button onClick={() => setShowTemplateModal(false)} style={{ background: "transparent", border: "none", fontSize: "1.5rem", cursor: "pointer" }}>&times;</button>
            </div>

            <form onSubmit={handleSaveTemplate} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <label style={{ fontSize: "0.82rem", fontWeight: 600 }}>Template Label</label>
                <input type="text" placeholder="e.g. SDE Referral Pitch" value={templateName} onChange={(e) => setTemplateName(e.target.value)} style={{ padding: "0.5rem", border: "1px solid #cbd5e1", borderRadius: "8px" }} />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <label style={{ fontSize: "0.82rem", fontWeight: 600 }}>Outreach Objective / Type</label>
                <select
                  value={templateType}
                  onChange={(e) => setTemplateType(e.target.value)}
                  style={{ padding: "0.5rem", border: "1px solid #cbd5e1", borderRadius: "8px" }}
                >
                  <option value="REFERRAL">Referral Request</option>
                  <option value="NETWORKING">Networking Connect</option>
                  <option value="FEEDBACK">Profile Feedback</option>
                  <option value="FOUNDER">CTO/Founder Outreach</option>
                </select>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <label style={{ fontSize: "0.82rem", fontWeight: 600 }}>AI Guidelines & Instructions</label>
                <textarea rows={6} placeholder="Instruct the LLM on writing style, formatting, constraints, mapping keys..." value={templatePrompt} onChange={(e) => setTemplatePrompt(e.target.value)} style={{ padding: "0.5rem", border: "1px solid #cbd5e1", borderRadius: "8px", outline: "none", fontSize: "0.88rem" }} />
              </div>

              <div style={{ display: "flex", gap: "10px", marginTop: "1rem" }}>
                <button type="button" onClick={() => setShowTemplateModal(false)} style={{ flex: 1, padding: "0.6rem", background: "white", border: "1px solid #cbd5e1", borderRadius: "10px", cursor: "pointer" }}>Cancel</button>
                <button type="submit" disabled={loading} style={{ flex: 1, padding: "0.6rem", background: "#4f46e5", color: "white", border: "none", borderRadius: "10px", cursor: "pointer", fontWeight: 600 }}>
                  Save Prompt
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Global CSS Styles Injection */}
      <style>{`
        @keyframes pulseGlow {
          from {
            opacity: 0.8;
            box-shadow: 0 0 0 0 rgba(79, 70, 229, 0.4);
          }
          to {
            opacity: 1;
            box-shadow: 0 0 12px 6px rgba(79, 70, 229, 0.15);
          }
        }
        .outreach-flow-app {
          animation: fadeInUp 0.4s ease-out;
        }
      `}</style>
    </div>
  );
}
