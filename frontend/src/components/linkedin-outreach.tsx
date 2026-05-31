"use client";

import React, { useState, useEffect } from "react";

interface OutboundMessage {
  id: string;
  profileId: string;
  channel: string;
  subject: string;
  content: string;
  status: "DRAFT" | "APPROVED" | "REJECTED" | "EDITED" | "PENDING" | "SENDING" | "SENT" | "FAILED" | "REPLIED" | "EDTIED";
  sentAt: string | null;
  createdAt: string;
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
  updatedAt: string;
  outboundMessages?: OutboundMessage[];
}

interface Resume {
  id: string;
  title: string;
  parsedText: string;
  skills: string[];
  experience: string | null;
  projects: string | null;
  createdAt: string;
}

interface Template {
  id: string;
  name: string;
  type: string;
  prompt: string;
  active: boolean;
  createdAt: string;
}

export function LinkedinOutreach() {
  const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
  const OUTREACH_API_KEY = process.env.NEXT_PUBLIC_OUTREACH_API_KEY || "hireflow_sec_key_2026_x92a8b";

  // State definitions
  const [linkedinAuth, setLinkedinAuth] = useState<{ authenticated: boolean }>({ authenticated: false });
  const [checkingAuth, setCheckingAuth] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [connectingStatusText, setConnectingStatusText] = useState("");

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(false);

  // Form selections for bulk/AI generation
  const [selectedResumeId, setSelectedResumeId] = useState<string>("");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");

  // New Profile Form
  const [newProfileName, setNewProfileName] = useState("");
  const [newProfileRole, setNewProfileRole] = useState("");
  const [newProfileCompany, setNewProfileCompany] = useState("");
  const [newProfileLinkedinUrl, setNewProfileLinkedinUrl] = useState("");
  const [newProfileNotes, setNewProfileNotes] = useState("");
  const [addingProfile, setAddingProfile] = useState(false);
  const [fileExtracting, setFileExtracting] = useState(false);
  const [importingCookies, setImportingCookies] = useState(false);

  // Selection & Progress
  const [selectedProfileIds, setSelectedProfileIds] = useState<string[]>([]);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [isCampaignRunning, setIsCampaignRunning] = useState(false);

  // Edit Message Modal
  const [editingMessage, setEditingMessage] = useState<OutboundMessage | null>(null);
  const [editedContent, setEditedContent] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  // Fetch authentication status
  const checkLinkedinAuthStatus = async () => {
    try {
      setCheckingAuth(true);
      const res = await fetch(`${API_BASE}/outreach/linkedin/status`, {
        headers: { "bypass-tunnel-reminder": "true" },
      });
      const json = await res.json();
      setLinkedinAuth({ authenticated: !!json.authenticated });
    } catch (err) {
      console.warn("Failed to check LinkedIn status:", err);
    } finally {
      setCheckingAuth(false);
    }
  };

  // Launch manual headed login session
  const connectLinkedinAccount = async () => {
    try {
      setConnecting(true);
      setConnectingStatusText("Launching headed Chrome browser on your desktop...");
      
      const res = await fetch(`${API_BASE}/outreach/linkedin/connect`, {
        headers: { "bypass-tunnel-reminder": "true" },
      });
      
      if (!res.ok) {
        throw new Error("Failed to authenticate session");
      }
      
      setConnectingStatusText("Authentication browser session completed.");
      await checkLinkedinAuthStatus();
    } catch (err) {
      console.error("Connect failed:", err);
      alert("LinkedIn session configuration failed. Please verify console logs.");
    } finally {
      setConnecting(false);
      setConnectingStatusText("");
    }
  };

  // Fetch Resumes, Templates, and Profiles
  const fetchData = async () => {
    try {
      setLoading(true);
      const [resResumes, resTemplates, resProfiles] = await Promise.all([
        fetch(`${API_BASE}/outreach-flow/resumes`, { headers: { "bypass-tunnel-reminder": "true" } }),
        fetch(`${API_BASE}/outreach-flow/templates`, { headers: { "bypass-tunnel-reminder": "true" } }),
        fetch(`${API_BASE}/outreach-flow/profiles`, { headers: { "bypass-tunnel-reminder": "true" } }),
      ]);

      const jsonResumes = await resResumes.json();
      const jsonTemplates = await resTemplates.json();
      const jsonProfiles = await resProfiles.json();

      if (jsonResumes.success) {
        setResumes(jsonResumes.data);
        if (jsonResumes.data.length > 0) setSelectedResumeId(jsonResumes.data[0].id);
      }
      if (jsonTemplates.success) {
        // Filter templates that fit networking or referral types
        setTemplates(jsonTemplates.data);
        if (jsonTemplates.data.length > 0) setSelectedTemplateId(jsonTemplates.data[0].id);
      }
      if (jsonProfiles.success) {
        setProfiles(jsonProfiles.data);
      }
    } catch (err) {
      console.warn("Failed to load campaign dependencies:", err);
    } finally {
      setLoading(false);
    }
  };

  // Poll for campaign sending updates when running
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isCampaignRunning) {
      interval = setInterval(async () => {
        try {
          const res = await fetch(`${API_BASE}/outreach-flow/profiles`, {
            headers: { "bypass-tunnel-reminder": "true" },
          });
          const json = await res.json();
          if (json.success) {
            setProfiles(json.data);
            
            // Check if any selected messages are still in SENDING status
            const activeCampaignIds = selectedProfileIds;
            const stillSending = json.data.some((p: Profile) => {
              if (!activeCampaignIds.includes(p.id)) return false;
              const msg = p.outboundMessages?.find((m) => m.channel === "LINKEDIN");
              return msg?.status === "SENDING";
            });

            if (!stillSending) {
              setIsCampaignRunning(false);
              setSelectedProfileIds([]);
            }
          }
        } catch (err) {
          console.warn("Polling profiles failed:", err);
        }
      }, 4000);
    }
    return () => clearInterval(interval);
  }, [isCampaignRunning, selectedProfileIds, API_BASE]);

  useEffect(() => {
    checkLinkedinAuthStatus();
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Add a Recruiter target profile
  const handleAddProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProfileName || !newProfileRole || !newProfileCompany) return;

    setAddingProfile(true);
    try {
      const res = await fetch(`${API_BASE}/outreach-flow/profiles`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "bypass-tunnel-reminder": "true",
        },
        body: JSON.stringify({
          profiles: [
            {
              name: newProfileName,
              role: newProfileRole,
              company: newProfileCompany,
              linkedinUrl: newProfileLinkedinUrl || null,
              notes: newProfileNotes || null,
            },
          ],
        }),
      });

      const json = await res.json();
      if (json.success) {
        setNewProfileName("");
        setNewProfileRole("");
        setNewProfileCompany("");
        setNewProfileLinkedinUrl("");
        setNewProfileNotes("");
        await fetchData();
      } else {
        alert(json.message || "Failed to create target profile.");
      }
    } catch (err) {
      console.error("Failed to add profile:", err);
    } finally {
      setAddingProfile(false);
    }
  };

  // Process the dropped or selected PDF or Image profile file
  const processUploadedFile = async (file: File) => {
    if (!file) return;

    const validTypes = ["application/pdf", "image/png", "image/jpeg", "image/jpg", "image/webp"];
    if (!validTypes.includes(file.type)) {
      alert("Unsupported file format. Please upload a PDF or an image of a profile/resume.");
      return;
    }

    setFileExtracting(true);

    const convertBase64 = (f: File): Promise<string> => {
      return new Promise((resolve, reject) => {
        const fileReader = new FileReader();
        fileReader.readAsDataURL(f);
        fileReader.onload = () => resolve(fileReader.result as string);
        fileReader.onerror = (error) => reject(error);
      });
    };

    try {
      const base64Str = await convertBase64(file);
      
      const res = await fetch(`${API_BASE}/outreach/linkedin/extract-file`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "bypass-tunnel-reminder": "true",
        },
        body: JSON.stringify({
          fileData: base64Str,
          mimeType: file.type,
        }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        // Auto-populate fields dynamically
        setNewProfileName(json.data.name || "");
        setNewProfileRole(json.data.role || "");
        setNewProfileCompany(json.data.company || "");
        setNewProfileLinkedinUrl(json.data.linkedinUrl || "");
        setNewProfileNotes(json.data.notes || "");
      } else {
        alert(json.message || "Failed to extract details from the uploaded document.");
      }
    } catch (err) {
      console.error("Profile file analysis failed:", err);
      alert("Error contacting the profile parser backend. Please try again.");
    } finally {
      setFileExtracting(false);
    }
  };

  const handleFileDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processUploadedFile(file);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processUploadedFile(file);
    }
  };

  const handleCookieImportSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".json")) {
      alert("Please upload a JSON file containing exported cookies.");
      return;
    }

    setImportingCookies(true);
    try {
      const fileText = await file.text();
      const rawCookies = JSON.parse(fileText);

      const res = await fetch(`${API_BASE}/outreach/linkedin/import-cookies`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "bypass-tunnel-reminder": "true",
        },
        body: JSON.stringify({ cookies: rawCookies }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        alert("LinkedIn cookies imported successfully! Session is now active.");
        await checkLinkedinAuthStatus();
      } else {
        alert(json.message || "Failed to import cookies.");
      }
    } catch (err) {
      console.error("Cookie import failed:", err);
      alert("Failed to parse cookies JSON. Ensure it is a valid exported JSON array.");
    } finally {
      setImportingCookies(false);
      e.target.value = "";
    }
  };

  const handleResumeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      alert("Please upload a PDF format resume.");
      return;
    }

    setLoading(true);
    try {
      const convertBase64 = (f: File): Promise<string> => {
        return new Promise((resolve, reject) => {
          const fileReader = new FileReader();
          fileReader.readAsDataURL(f);
          fileReader.onload = () => resolve(fileReader.result as string);
          fileReader.onerror = (error) => reject(error);
        });
      };

      const base64Str = await convertBase64(file);
      const res = await fetch(`${API_BASE}/outreach-flow/resumes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "bypass-tunnel-reminder": "true"
        },
        body: JSON.stringify({
          title: file.name.replace(".pdf", ""),
          pdfBase64: base64Str
        })
      });

      const json = await res.json();
      if (res.ok && json.success) {
        alert("Master resume uploaded and parsed successfully!");
        // Refresh resumes list and select the uploaded one
        const updatedRes = await fetch(`${API_BASE}/outreach-flow/resumes`, {
          headers: { "bypass-tunnel-reminder": "true" }
        });
        const updatedJson = await updatedRes.json();
        if (updatedJson.success) {
          setResumes(updatedJson.data);
          // Set selection to the uploaded resume
          const uploadedResume = updatedJson.data.find((r: Resume) => r.title === file.name.replace(".pdf", ""));
          if (uploadedResume) {
            setSelectedResumeId(uploadedResume.id);
          } else if (updatedJson.data.length > 0) {
            setSelectedResumeId(updatedJson.data[0].id);
          }
        }
      } else {
        alert("Upload failed: " + (json.message || "Unknown error"));
      }
    } catch (err) {
      console.error("Resume upload error:", err);
      alert("Error parsing and uploading resume.");
    } finally {
      setLoading(false);
      e.target.value = "";
    }
  };

  // Generate customized AI DM
  const handleGenerateMessage = async (profileId: string) => {
    if (!selectedResumeId || !selectedTemplateId) {
      alert("Please upload a resume and select a template first.");
      return;
    }

    setActionLoading(`generate-${profileId}`);
    try {
      const res = await fetch(`${API_BASE}/outreach/linkedin/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "bypass-tunnel-reminder": "true",
        },
        body: JSON.stringify({
          profileId,
          resumeId: selectedResumeId,
          templateId: selectedTemplateId,
        }),
      });

      const json = await res.json();
      if (json.success) {
        await fetchData();
      } else {
        alert(json.message || "Message generation failed.");
      }
    } catch (err) {
      console.error("AI Message Generation failed:", err);
    } finally {
      setActionLoading(null);
    }
  };

  // Single Delete Profile
  const handleDeleteProfile = async (id: string) => {
    if (!confirm("Are you sure you want to delete this recruiter prospect?")) return;
    try {
      const res = await fetch(`${API_BASE}/outreach-flow/profiles/${id}`, {
        method: "DELETE",
        headers: { "bypass-tunnel-reminder": "true" },
      });
      const json = await res.json();
      if (json.success) {
        setProfiles((prev) => prev.filter((p) => p.id !== id));
        setSelectedProfileIds((prev) => prev.filter((item) => item !== id));
      }
    } catch (err) {
      console.error("Delete profile failed:", err);
    }
  };

  // Edit Message Handlers
  const handleOpenEdit = (msg: OutboundMessage) => {
    setEditingMessage(msg);
    setEditedContent(msg.content);
  };

  const handleSaveEdits = async () => {
    if (!editingMessage) return;
    setSavingEdit(true);
    try {
      // Use existing patch endpoint: /outreach-flow/approval/:id
      const res = await fetch(`${API_BASE}/outreach-flow/approval/${editingMessage.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "bypass-tunnel-reminder": "true",
        },
        body: JSON.stringify({
          subject: editingMessage.subject || "Connection Request Note",
          content: editedContent,
        }),
      });

      const json = await res.json();
      if (json.success) {
        setEditingMessage(null);
        await fetchData();
      } else {
        alert(json.message || "Failed to update draft text.");
      }
    } catch (err) {
      console.error("Save message failed:", err);
    } finally {
      setSavingEdit(false);
    }
  };

  // Sequential Background DM campaign dispatcher
  const handleDispatchCampaign = async () => {
    const selectedMessages = profiles
      .filter((p) => selectedProfileIds.includes(p.id))
      .map((p) => p.outboundMessages?.find((m) => m.channel === "LINKEDIN"))
      .filter(Boolean) as OutboundMessage[];

    const pendingMsgIds = selectedMessages
      .filter((m) => m.status === "DRAFT" || m.status === "EDTIED" || m.status === "FAILED")
      .map((m) => m.id);

    if (pendingMsgIds.length === 0) {
      alert("No valid DRAFT or FAILED LinkedIn messages found for the selected recruiters.");
      return;
    }

    if (!linkedinAuth.authenticated) {
      if (!confirm("LinkedIn session is unauthenticated. Background dispatch will fail. Proceed anyway?")) {
        return;
      }
    }

    setActionLoading("sending-bulk");
    try {
      const res = await fetch(`${API_BASE}/outreach/linkedin/send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "bypass-tunnel-reminder": "true",
          "X-API-Key": OUTREACH_API_KEY,
        },
        body: JSON.stringify({ messageIds: pendingMsgIds }),
      });

      const json = await res.json();
      if (json.success) {
        setIsCampaignRunning(true);
        // Instant local state update to SENDING status for visual feedback
        setProfiles((prev) =>
          prev.map((p) => {
            if (selectedProfileIds.includes(p.id)) {
              const msgs = p.outboundMessages?.map((m) =>
                m.channel === "LINKEDIN" ? { ...m, status: "SENDING" as const } : m
              );
              return { ...p, outboundMessages: msgs };
            }
            return p;
          })
        );
      } else {
        alert(json.message || "Failed to trigger LinkedIn DM campaign.");
      }
    } catch (err) {
      console.error("LinkedIn DM dispatch failed:", err);
    } finally {
      setActionLoading(null);
    }
  };

  const toggleSelectProfile = (id: string) => {
    setSelectedProfileIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    // Select all profiles that have generated messages ready for sending
    const actionable = profiles.filter((p) => {
      const msg = p.outboundMessages?.find((m) => m.channel === "LINKEDIN");
      return msg && (msg.status === "DRAFT" || msg.status === "EDTIED" || msg.status === "FAILED" || msg.status === "SENDING" || msg.status === "SENT");
    });
    
    if (selectedProfileIds.length === actionable.length) {
      setSelectedProfileIds([]);
    } else {
      setSelectedProfileIds(actionable.map((p) => p.id));
    }
  };

  return (
    <div style={{ fontFamily: "Inter, system-ui, sans-serif", color: "var(--text)" }}>
      
      {/* 1. LINKEDIN SESSION STATUS & HEADING */}
      <div 
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "24px",
          padding: "1.25rem 2rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "2rem",
          boxShadow: "var(--shadow)",
          backdropFilter: "blur(14px)"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "1.2rem" }}>
          <div 
            style={{ 
              width: "48px", 
              height: "48px", 
              borderRadius: "14px", 
              background: linkedinAuth.authenticated ? "rgba(16, 185, 129, 0.08)" : "rgba(182, 95, 42, 0.08)",
              border: linkedinAuth.authenticated ? "1px solid rgba(16, 185, 129, 0.2)" : "1px solid rgba(182, 95, 42, 0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "1.5rem"
            }}
          >
            {linkedinAuth.authenticated ? "🔗" : "🔌"}
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: "1.05rem", color: "var(--text)", fontWeight: 600 }}>
              {linkedinAuth.authenticated ? "LinkedIn Session Cache Active" : "LinkedIn Session Connection Required"}
            </h3>
            <p style={{ margin: "0.2rem 0 0 0", fontSize: "0.85rem", color: "var(--muted)" }}>
              {linkedinAuth.authenticated 
                ? "Stealth browser session authenticated using cached cookies." 
                : "A headed browser window will launch on your system to complete secure manual login."}
            </p>
            {connectingStatusText && (
              <p style={{ margin: "0.3rem 0 0 0", fontSize: "0.8rem", color: "var(--accent)", fontWeight: 500 }}>
                ℹ️ {connectingStatusText}
              </p>
            )}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <button
            onClick={checkLinkedinAuthStatus}
            disabled={checkingAuth || connecting}
            style={{
              background: "transparent",
              color: "var(--text)",
              border: "1px solid var(--border)",
              padding: "0.5rem 1rem",
              borderRadius: "10px",
              fontSize: "0.8rem",
              cursor: "pointer",
              fontWeight: 500
            }}
          >
            {checkingAuth ? "Checking..." : "🔄 Refresh"}
          </button>

          {linkedinAuth.authenticated ? (
            <span 
              style={{
                background: "rgba(16, 185, 129, 0.1)",
                color: "#059669",
                border: "1px solid rgba(16, 185, 129, 0.2)",
                padding: "0.5rem 1rem",
                borderRadius: "10px",
                fontSize: "0.85rem",
                fontWeight: 600,
              }}
            >
              Session Live ✅
            </span>
          ) : (
            <div style={{ display: "flex", gap: "0.8rem", alignItems: "center" }}>
              <button
                onClick={connectLinkedinAccount}
                disabled={connecting || importingCookies}
                style={{
                  background: "linear-gradient(135deg, var(--accent) 0%, var(--accent-dark) 100%)",
                  color: "#fff",
                  border: "none",
                  padding: "0.7rem 1.4rem",
                  borderRadius: "12px",
                  fontWeight: 600,
                  fontSize: "0.9rem",
                  cursor: (connecting || importingCookies) ? "not-allowed" : "pointer",
                  boxShadow: "0 8px 20px -6px rgba(182, 95, 42, 0.4)",
                  transition: "all 0.2s ease"
                }}
              >
                {connecting ? "Opening Session..." : "🔌 Connect LinkedIn Session"}
              </button>

              <label
                style={{
                  background: "#ffffff",
                  color: "var(--text)",
                  border: "1px solid var(--border)",
                  padding: "0.7rem 1.2rem",
                  borderRadius: "12px",
                  fontWeight: 600,
                  fontSize: "0.9rem",
                  cursor: (connecting || importingCookies) ? "not-allowed" : "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.4rem",
                  transition: "background-color 0.2s"
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(49, 37, 24, 0.03)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "#ffffff")}
              >
                <input
                  type="file"
                  accept=".json"
                  onChange={handleCookieImportSelect}
                  disabled={connecting || importingCookies}
                  style={{ display: "none" }}
                />
                🔑 {importingCookies ? "Importing..." : "Import Cookies JSON"}
              </label>
            </div>
          )}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.1fr 2fr", gap: "2.5rem", alignItems: "start" }}>
        
        {/* 2. ADD RECRUITER FORM SIDE */}
        <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
          
          {/* Main Manual Import Form */}
          <div 
            style={{ 
              background: "var(--surface)", 
              border: "1px solid var(--border)", 
              padding: "2rem", 
              borderRadius: "24px",
              boxShadow: "var(--shadow)",
              backdropFilter: "blur(14px)"
            }}
          >
            <h3 style={{ fontSize: "1.2rem", color: "var(--text)", margin: "0 0 1.5rem 0", fontWeight: 600 }}>
              ➕ Add LinkedIn Prospect
            </h3>

            {/* Drag & Drop PDF / Image Upload Zone */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                e.currentTarget.style.borderColor = "var(--accent)";
                e.currentTarget.style.background = "rgba(182, 95, 42, 0.04)";
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                e.currentTarget.style.borderColor = "var(--border)";
                e.currentTarget.style.background = "rgba(182, 95, 42, 0.02)";
              }}
              onDrop={(e) => handleFileDrop(e)}
              onClick={() => document.getElementById("linkedin-profile-file-input")?.click()}
              style={{
                border: "2px dashed var(--border)",
                borderRadius: "16px",
                padding: "1.5rem",
                textAlign: "center",
                cursor: "pointer",
                background: "rgba(182, 95, 42, 0.02)",
                transition: "all 0.2s ease",
                marginBottom: "1.5rem",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "0.5rem"
              }}
            >
              <input
                id="linkedin-profile-file-input"
                type="file"
                accept="application/pdf,image/*"
                onChange={(e) => handleFileSelect(e)}
                style={{ display: "none" }}
              />
              <span style={{ fontSize: "2rem" }}>📄</span>
              <div style={{ fontWeight: 600, fontSize: "0.85rem", color: "var(--text)" }}>
                {fileExtracting ? "⌛ Extracting details..." : "Drag & Drop Profile PDF or Image"}
              </div>
              <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--muted)" }}>
                Drop a PDF or image of a resume or LinkedIn profile to extract details automatically
              </p>
            </div>

            <form onSubmit={handleAddProfile} style={{ display: "flex", flexDirection: "column", gap: "1.2rem" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                <label style={{ fontSize: "0.8rem", color: "var(--muted)", fontWeight: 600 }}>Recruiter Name</label>
                <input
                  type="text"
                  placeholder="Jane Doe"
                  value={newProfileName}
                  onChange={(e) => setNewProfileName(e.target.value)}
                  required
                  style={{
                    padding: "0.7rem 0.9rem",
                    borderRadius: "10px",
                    border: "1px solid var(--border)",
                    background: "#fffdf9",
                    color: "var(--text)",
                    outline: "none",
                    fontSize: "0.9rem",
                  }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                  <label style={{ fontSize: "0.8rem", color: "var(--muted)", fontWeight: 600 }}>Role Title</label>
                  <input
                    type="text"
                    placeholder="Technical Recruiter"
                    value={newProfileRole}
                    onChange={(e) => setNewProfileRole(e.target.value)}
                    required
                    style={{
                      padding: "0.7rem 0.9rem",
                      borderRadius: "10px",
                      border: "1px solid var(--border)",
                      background: "#fffdf9",
                      color: "var(--text)",
                      outline: "none",
                      fontSize: "0.9rem",
                    }}
                  />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                  <label style={{ fontSize: "0.8rem", color: "var(--muted)", fontWeight: 600 }}>Company</label>
                  <input
                    type="text"
                    placeholder="Google"
                    value={newProfileCompany}
                    onChange={(e) => setNewProfileCompany(e.target.value)}
                    required
                    style={{
                      padding: "0.7rem 0.9rem",
                      borderRadius: "10px",
                      border: "1px solid var(--border)",
                      background: "#fffdf9",
                      color: "var(--text)",
                      outline: "none",
                      fontSize: "0.9rem",
                    }}
                  />
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                <label style={{ fontSize: "0.8rem", color: "var(--muted)", fontWeight: 600 }}>LinkedIn Profile URL</label>
                <input
                  type="url"
                  placeholder="https://www.linkedin.com/in/recruiter-username"
                  value={newProfileLinkedinUrl}
                  onChange={(e) => setNewProfileLinkedinUrl(e.target.value)}
                  style={{
                    padding: "0.7rem 0.9rem",
                    borderRadius: "10px",
                    border: "1px solid var(--border)",
                    background: "#fffdf9",
                    color: "var(--text)",
                    outline: "none",
                    fontSize: "0.9rem",
                  }}
                />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                <label style={{ fontSize: "0.8rem", color: "var(--muted)", fontWeight: 600 }}>Notes / Outreach Context</label>
                <textarea
                  rows={3}
                  placeholder="E.g., recruiting for the Platform Engineering role or met at tech conference..."
                  value={newProfileNotes}
                  onChange={(e) => setNewProfileNotes(e.target.value)}
                  style={{
                    padding: "0.7rem 0.9rem",
                    borderRadius: "10px",
                    border: "1px solid var(--border)",
                    background: "#fffdf9",
                    color: "var(--text)",
                    outline: "none",
                    fontFamily: "inherit",
                    fontSize: "0.9rem",
                    resize: "vertical",
                  }}
                />
              </div>

              <button
                type="submit"
                disabled={addingProfile}
                style={{
                  background: "linear-gradient(135deg, var(--accent) 0%, var(--accent-dark) 100%)",
                  color: "#fff",
                  border: "none",
                  padding: "0.8rem",
                  borderRadius: "12px",
                  fontWeight: 600,
                  cursor: addingProfile ? "not-allowed" : "pointer",
                  boxShadow: "0 4px 12px rgba(182, 95, 42, 0.15)",
                  transition: "transform 0.2s",
                  marginTop: "0.5rem"
                }}
              >
                {addingProfile ? "Adding Profile..." : "Add Recruiter Target 🎯"}
              </button>
            </form>
          </div>

          {/* AI Settings Section */}
          <div 
            style={{ 
              background: "var(--surface)", 
              border: "1px solid var(--border)", 
              padding: "1.5rem 2rem", 
              borderRadius: "24px",
              boxShadow: "var(--shadow)",
              backdropFilter: "blur(14px)"
            }}
          >
            <h4 style={{ fontSize: "1.05rem", color: "var(--text)", margin: "0 0 1.2rem 0", fontWeight: 600 }}>
              ⚙️ AI Generation Parameters
            </h4>

            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                <label style={{ fontSize: "0.8rem", color: "var(--muted)", fontWeight: 600 }}>Master Latex Resume</label>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <select
                    value={selectedResumeId}
                    onChange={(e) => setSelectedResumeId(e.target.value)}
                    style={{
                      flex: 1,
                      padding: "0.7rem 0.9rem",
                      borderRadius: "10px",
                      border: "1px solid var(--border)",
                      background: "#fffdf9",
                      color: "var(--text)",
                      outline: "none",
                      fontSize: "0.9rem",
                      cursor: "pointer"
                    }}
                  >
                    {resumes.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.title}
                      </option>
                    ))}
                    {resumes.length === 0 && <option value="">No resumes found</option>}
                  </select>

                  <label
                    style={{
                      background: "rgba(182, 95, 42, 0.08)",
                      color: "var(--accent-dark)",
                      border: "1px solid rgba(182, 95, 42, 0.2)",
                      padding: "0.7rem 1rem",
                      borderRadius: "10px",
                      fontSize: "0.85rem",
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.3rem",
                      whiteSpace: "nowrap"
                    }}
                  >
                    <input
                      type="file"
                      accept="application/pdf"
                      onChange={handleResumeUpload}
                      style={{ display: "none" }}
                    />
                    📤 Upload PDF
                  </label>
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                <label style={{ fontSize: "0.8rem", color: "var(--muted)", fontWeight: 600 }}>Target Prompt Template</label>
                <select
                  value={selectedTemplateId}
                  onChange={(e) => setSelectedTemplateId(e.target.value)}
                  style={{
                    padding: "0.7rem 0.9rem",
                    borderRadius: "10px",
                    border: "1px solid var(--border)",
                    background: "#fffdf9",
                    color: "var(--text)",
                    outline: "none",
                    fontSize: "0.9rem",
                    cursor: "pointer"
                  }}
                >
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.type})
                    </option>
                  ))}
                  {templates.length === 0 && <option value="">No templates found</option>}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* 3. CAMPAIGN TRACKER BOARD */}
        <div 
          style={{ 
            background: "var(--surface)", 
            border: "1px solid var(--border)", 
            padding: "2rem", 
            borderRadius: "24px",
            boxShadow: "var(--shadow)",
            backdropFilter: "blur(14px)",
            minHeight: "550px"
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
            <div>
              <h3 style={{ fontSize: "1.25rem", color: "var(--text)", margin: 0, fontWeight: 600 }}>
                💼 LinkedIn Campaign Tracker
              </h3>
              <p style={{ margin: "0.2rem 0 0 0", fontSize: "0.85rem", color: "var(--muted)" }}>
                Generate Gemini connection request notes under 300 characters and automate sequential messaging.
              </p>
            </div>
            <button 
              onClick={fetchData} 
              style={{
                background: "transparent",
                color: "var(--muted)",
                border: "none",
                fontSize: "1.2rem",
                cursor: "pointer"
              }}
            >
              🔄
            </button>
          </div>

          {loading ? (
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "300px" }}>
              <div style={{ color: "var(--muted)", fontSize: "0.95rem" }}>Loading campaign board...</div>
            </div>
          ) : profiles.length === 0 ? (
            <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", height: "300px", gap: "1rem" }}>
              <span style={{ fontSize: "2rem" }}>🎯</span>
              <p style={{ color: "var(--muted)", fontSize: "0.9rem", margin: 0 }}>No recruiter prospects registered yet.</p>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.9rem" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border)" }}>
                    <th style={{ padding: "0.75rem 0.5rem", width: "40px" }}>
                      <input 
                        type="checkbox"
                        checked={
                          profiles.length > 0 && 
                          profiles.filter(p => p.outboundMessages?.some(m => m.channel === "LINKEDIN")).length > 0 &&
                          selectedProfileIds.length === profiles.filter(p => p.outboundMessages?.some(m => m.channel === "LINKEDIN")).length
                        }
                        onChange={toggleSelectAll}
                        style={{ cursor: "pointer" }}
                      />
                    </th>
                    <th style={{ padding: "0.75rem", color: "var(--muted)", fontWeight: 500 }}>Recruiter Target</th>
                    <th style={{ padding: "0.75rem", color: "var(--muted)", fontWeight: 500 }}>Company</th>
                    <th style={{ padding: "0.75rem", color: "var(--muted)", fontWeight: 500 }}>LinkedIn Note</th>
                    <th style={{ padding: "0.75rem", color: "var(--muted)", fontWeight: 500 }}>Status</th>
                    <th style={{ padding: "0.75rem", color: "var(--muted)", fontWeight: 500, textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {profiles.map((profile) => {
                    const linkedInMsg = profile.outboundMessages?.find((m) => m.channel === "LINKEDIN");
                    const hasLinkedinUrl = !!profile.linkedinUrl;

                    return (
                      <tr 
                        key={profile.id} 
                        style={{ 
                          borderBottom: "1px solid var(--border)",
                          background: selectedProfileIds.includes(profile.id) ? "rgba(182, 95, 42, 0.02)" : "transparent"
                        }}
                      >
                        <td style={{ padding: "0.75rem 0.5rem" }}>
                          {linkedInMsg && (
                            <input 
                              type="checkbox"
                              checked={selectedProfileIds.includes(profile.id)}
                              onChange={() => toggleSelectProfile(profile.id)}
                              style={{ cursor: "pointer" }}
                            />
                          )}
                        </td>
                        <td style={{ padding: "0.75rem" }}>
                          <div style={{ fontWeight: 600, color: "var(--text)" }}>{profile.name}</div>
                          <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>{profile.role}</div>
                        </td>
                        <td style={{ padding: "0.75rem" }}>
                          <div style={{ color: "var(--text)", fontWeight: 500 }}>{profile.company}</div>
                          {hasLinkedinUrl ? (
                            <a 
                              href={profile.linkedinUrl!} 
                              target="_blank" 
                              rel="noreferrer" 
                              style={{ fontSize: "0.75rem", color: "#0077b5", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "0.2rem", marginTop: "0.15rem" }}
                            >
                              🔗 View Profile
                            </a>
                          ) : (
                            <span style={{ fontSize: "0.75rem", color: "var(--accent)" }}>⚠️ Missing URL</span>
                          )}
                        </td>
                        <td style={{ padding: "0.75rem" }}>
                          {linkedInMsg ? (
                            <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
                              <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--text)", fontStyle: "italic", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "160px" }}>
                               &quot;{linkedInMsg.content}&quot;
                              </p>
                              <span style={{ fontSize: "0.7rem", color: "var(--muted)" }}>
                                {linkedInMsg.content.length} chars / 300 max
                              </span>
                            </div>
                          ) : (
                            <span style={{ fontSize: "0.8rem", color: "var(--muted)", fontStyle: "italic" }}>No message drafted</span>
                          )}
                        </td>
                        <td style={{ padding: "0.75rem" }}>
                          {linkedInMsg ? (
                            <span 
                              style={{
                                display: "inline-block",
                                padding: "0.25rem 0.6rem",
                                borderRadius: "8px",
                                fontSize: "0.75rem",
                                fontWeight: 600,
                                textTransform: "capitalize",
                                ...getStatusBadgeStyles(linkedInMsg.status)
                              }}
                            >
                              {linkedInMsg.status.toLowerCase()}
                            </span>
                          ) : (
                            <span style={{ color: "var(--muted)", fontSize: "0.75rem" }}>—</span>
                          )}
                        </td>
                        <td style={{ padding: "0.75rem", textAlign: "right" }}>
                          <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
                            {!linkedInMsg ? (
                              <button
                                onClick={() => handleGenerateMessage(profile.id)}
                                disabled={actionLoading === `generate-${profile.id}` || !hasLinkedinUrl}
                                style={{
                                  background: "rgba(182, 95, 42, 0.08)",
                                  color: "var(--accent-dark)",
                                  border: "1px solid rgba(182, 95, 42, 0.2)",
                                  padding: "0.4rem 0.8rem",
                                  borderRadius: "8px",
                                  fontSize: "0.75rem",
                                  fontWeight: 600,
                                  cursor: (actionLoading === `generate-${profile.id}` || !hasLinkedinUrl) ? "not-allowed" : "pointer"
                                }}
                              >
                                {actionLoading === `generate-${profile.id}` ? "Drafting..." : "⚡ Generate AI Note"}
                              </button>
                            ) : (
                              <>
                                <button
                                  onClick={() => handleOpenEdit(linkedInMsg)}
                                  style={{
                                    background: "#ffffff",
                                    color: "var(--text)",
                                    border: "1px solid var(--border)",
                                    padding: "0.4rem 0.8rem",
                                    borderRadius: "8px",
                                    fontSize: "0.75rem",
                                    fontWeight: 500,
                                    cursor: "pointer"
                                  }}
                                >
                                  ✏️ Edit Draft
                                </button>
                                <button
                                  onClick={() => handleGenerateMessage(profile.id)}
                                  disabled={actionLoading === `generate-${profile.id}`}
                                  style={{
                                    background: "transparent",
                                    color: "var(--muted)",
                                    border: "none",
                                    padding: "0.4rem",
                                    cursor: "pointer"
                                  }}
                                  title="Regenerate Draft message"
                                >
                                  🔄
                                </button>
                              </>
                            )}
                            <button
                              onClick={() => handleDeleteProfile(profile.id)}
                              style={{
                                background: "transparent",
                                color: "#ef4444",
                                border: "none",
                                padding: "0.4rem",
                                cursor: "pointer",
                                fontSize: "0.9rem"
                              }}
                              title="Delete profile"
                            >
                              🗑️
                            </button>
                          </div>
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

      {/* 4. FLOATING GLASS DISPATCH BAR */}
      {selectedProfileIds.length > 0 && (
        <div 
          style={{
            position: "fixed",
            bottom: "2rem",
            left: "50%",
            transform: "translateX(-50%)",
            background: "rgba(255, 255, 255, 0.85)",
            border: "1px solid rgba(182, 95, 42, 0.25)",
            borderRadius: "20px",
            padding: "1rem 2rem",
            display: "flex",
            alignItems: "center",
            gap: "2rem",
            boxShadow: "0 20px 40px -10px rgba(49, 37, 24, 0.15)",
            backdropFilter: "blur(18px)",
            zIndex: 100,
            animation: "slideUp 0.3s ease-out"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <span style={{ fontSize: "1.3rem" }}>🚀</span>
            <div>
              <div style={{ fontWeight: 600, fontSize: "0.9rem", color: "var(--text)" }}>
                {selectedProfileIds.length} LinkedIn DMs Selected
              </div>
              <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--muted)" }}>
                Sequential dispatches wait 5-10s randomly to protect account safety.
              </p>
            </div>
          </div>

          <div style={{ display: "flex", gap: "1rem" }}>
            <button
              onClick={() => setSelectedProfileIds([])}
              style={{
                background: "transparent",
                color: "var(--text)",
                border: "1px solid var(--border)",
                padding: "0.6rem 1.2rem",
                borderRadius: "10px",
                fontWeight: 500,
                fontSize: "0.85rem",
                cursor: "pointer"
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleDispatchCampaign}
              disabled={actionLoading === "sending-bulk" || isCampaignRunning}
              style={{
                background: "linear-gradient(135deg, var(--accent) 0%, var(--accent-dark) 100%)",
                color: "#fff",
                border: "none",
                padding: "0.6rem 1.4rem",
                borderRadius: "10px",
                fontWeight: 600,
                fontSize: "0.85rem",
                cursor: (actionLoading === "sending-bulk" || isCampaignRunning) ? "not-allowed" : "pointer"
              }}
            >
              {isCampaignRunning ? "Sending sequentially..." : "Send Selected DMs"}
            </button>
          </div>
        </div>
      )}

      {/* 5. EDIT MESSAGE DRAFT MODAL */}
      {editingMessage && (
        <div 
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(49, 37, 24, 0.4)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 1000,
            backdropFilter: "blur(4px)"
          }}
          onClick={() => setEditingMessage(null)}
        >
          <div 
            style={{
              background: "#ffffff",
              border: "1px solid var(--border)",
              borderRadius: "24px",
              padding: "2rem",
              width: "500px",
              maxWidth: "90%",
              boxShadow: "0 24px 64px -12px rgba(49, 37, 24, 0.25)",
              animation: "scaleUp 0.25s ease-out"
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.2rem" }}>
              <h3 style={{ fontSize: "1.15rem", margin: 0, fontWeight: 600, color: "var(--text)" }}>
                ✏️ Edit Personalized Cold Note
              </h3>
              <button 
                onClick={() => setEditingMessage(null)}
                style={{ background: "transparent", border: "none", fontSize: "1.5rem", cursor: "pointer", color: "var(--muted)" }}
              >
                &times;
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                <label style={{ fontSize: "0.8rem", color: "var(--muted)", fontWeight: 600 }}>Message Content</label>
                <textarea
                  rows={6}
                  value={editedContent}
                  onChange={(e) => setEditedContent(e.target.value)}
                  style={{
                    padding: "0.7rem 0.9rem",
                    borderRadius: "10px",
                    border: "1px solid var(--border)",
                    background: "#fffdf9",
                    color: "var(--text)",
                    outline: "none",
                    fontFamily: "inherit",
                    fontSize: "0.9rem",
                    resize: "vertical"
                  }}
                />
                <span 
                  style={{ 
                    fontSize: "0.75rem", 
                    color: editedContent.length > 300 ? "#ef4444" : "var(--muted)",
                    alignSelf: "flex-end",
                    fontWeight: 500
                  }}
                >
                  {editedContent.length} / 300 characters {editedContent.length > 300 && "(Note will be truncated or rejected by LinkedIn)"}
                </span>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "1rem", marginTop: "0.5rem" }}>
                <button
                  onClick={() => setEditingMessage(null)}
                  style={{
                    background: "transparent",
                    color: "var(--text)",
                    border: "1px solid var(--border)",
                    padding: "0.6rem 1.2rem",
                    borderRadius: "10px",
                    fontWeight: 500,
                    cursor: "pointer"
                  }}
                >
                  Close
                </button>
                <button
                  onClick={handleSaveEdits}
                  disabled={savingEdit || editedContent.length === 0}
                  style={{
                    background: "linear-gradient(135deg, var(--accent) 0%, var(--accent-dark) 100%)",
                    color: "#fff",
                    border: "none",
                    padding: "0.6rem 1.4rem",
                    borderRadius: "10px",
                    fontWeight: 600,
                    cursor: (savingEdit || editedContent.length === 0) ? "not-allowed" : "pointer"
                  }}
                >
                  {savingEdit ? "Saving..." : "Save Draft Changes"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Inject custom CSS keyframes dynamically */}
      <style jsx global>{`
        @keyframes slideUp {
          from { transform: translate(-50%, 20px); opacity: 0; }
          to { transform: translate(-50%, 0); opacity: 1; }
        }
        @keyframes scaleUp {
          from { transform: scale(0.96); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

function getStatusBadgeStyles(status: string) {
  switch (status.toUpperCase()) {
    case "SENT":
      return {
        background: "rgba(16, 185, 129, 0.08)",
        color: "#059669",
        border: "1px solid rgba(16, 185, 129, 0.2)",
      };
    case "SENDING":
      return {
        background: "rgba(59, 130, 246, 0.08)",
        color: "#2563eb",
        border: "1px solid rgba(59, 130, 246, 0.2)",
      };
    case "FAILED":
      return {
        background: "rgba(239, 68, 68, 0.08)",
        color: "#dc2626",
        border: "1px solid rgba(239, 68, 68, 0.2)",
      };
    case "DRAFT":
    case "EDTIED":
    case "EDITED":
    default:
      return {
        background: "rgba(107, 114, 128, 0.08)",
        color: "#4b5563",
        border: "1px solid rgba(107, 114, 128, 0.2)",
      };
  }
}
