"use client";

import React, { useState, useEffect, useRef } from "react";

interface Message {
  id: string;
  leadId: string;
  type: string;
  subject: string;
  body: string;
  sentAt: string | null;
  createdAt: string;
}

interface Lead {
  id: string;
  companyName: string;
  recipientEmail: string;
  jobDescription: string;
  status: "PENDING" | "GENERATING" | "READY" | "SENDING" | "SENT" | "FAILED";
  threadId: string | null;
  createdAt: string;
  updatedAt: string;
  messages: Message[];
}

export function GmailOutreach() {
  const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

  // Google OAuth Auth State
  const [googleAuth, setGoogleAuth] = useState<{ authenticated: boolean; email: string | null }>({
    authenticated: false,
    email: null,
  });

  // Main Lead List
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Checked Lead IDs for batch actions
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);

  // Add Lead Form State
  const [companyName, setCompanyName] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [importOpen, setImportOpen] = useState(false);

  // Bulk Paste State
  const [bulkText, setBulkText] = useState("");

  // Edit Message Modal State
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [editedSubject, setEditedSubject] = useState("");
  const [editedBody, setEditedBody] = useState("");

  // Screenshot image extract state
  const [extractingImage, setExtractingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch Google OAuth Status
  const checkGoogleAuthStatus = async () => {
    try {
      const res = await fetch(`${API_BASE}/outreach/auth/google/status`, {
        headers: { "bypass-tunnel-reminder": "true" },
      });
      const json = await res.json();
      setGoogleAuth({
        authenticated: !!json.authenticated,
        email: json.email,
      });
    } catch (err) {
      console.warn("Failed to check Google OAuth status:", err);
    }
  };

  // Fetch Leads List
  const fetchLeads = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/outreach/leads`, {
        headers: { "bypass-tunnel-reminder": "true" },
      });
      const json = await res.json();
      if (json.success) {
        setLeads(json.data);
      }
    } catch (err) {
      console.warn("Failed to fetch recruiter leads:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkGoogleAuthStatus();
    fetchLeads();

    // Listen for Google OAuth successful completion in popup window
    const handleOauthMessage = (event: MessageEvent) => {
      if (event.data === "oauth-success") {
        // Add a 500ms delay to allow the popup window to close and settle the browser context
        setTimeout(() => {
          checkGoogleAuthStatus();
        }, 500);
      }
    };

    // Robust fallback: check status whenever the user returns focus to the window
    const handleWindowFocus = () => {
      checkGoogleAuthStatus();
    };

    window.addEventListener("message", handleOauthMessage);
    window.addEventListener("focus", handleWindowFocus);
    return () => {
      window.removeEventListener("message", handleOauthMessage);
      window.removeEventListener("focus", handleWindowFocus);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Open Google OAuth Popup
  const connectGoogleAccount = () => {
    const width = 500;
    const height = 600;
    const left = window.screen.width / 2 - width / 2;
    const top = window.screen.height / 2 - height / 2;

    window.open(
      `${API_BASE}/outreach/auth/google`,
      "Connect with Google",
      `width=${width},height=${height},left=${left},top=${top},status=no,resizable=yes`
    );
  };

  // Single Add Lead Handler
  const handleAddLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName || !recipientEmail || !jobDescription) return;

    setActionLoading("add-lead");
    try {
      const res = await fetch(`${API_BASE}/outreach/leads`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "bypass-tunnel-reminder": "true",
        },
        body: JSON.stringify({
          leads: [{
            companyName,
            recipientEmail,
            jobDescription,
          }],
        }),
      });

      const json = await res.json();
      if (json.success) {
        setCompanyName("");
        setRecipientEmail("");
        setJobDescription("");
        fetchLeads();
      } else {
        alert(json.message || "Failed to add recruiter lead.");
      }
    } catch (err) {
      console.error("Add lead failed:", err);
    } finally {
      setActionLoading(null);
    }
  };

  // Parse & Bulk Add Leads Handler
  const handleBulkAddLeads = async () => {
    if (!bulkText.trim()) return;

    setActionLoading("bulk-add");
    let parsedLeads: { companyName: string; recipientEmail: string; jobDescription: string }[] = [];
    const text = bulkText.trim();

    try {
      // Try JSON
      if (text.startsWith("[") && text.endsWith("]")) {
        const json = JSON.parse(text);
        if (Array.isArray(json)) {
          parsedLeads = json.map(item => ({
            companyName: item.companyName || item.company || "",
            recipientEmail: item.email || item.recipientEmail || "",
            jobDescription: item.jobDescription || item.description || "Recruiter Outreach",
          }));
        }
      }
    } catch {}

    // Try CSV format
    if (parsedLeads.length === 0) {
      const lines = text.split("\n").filter(l => l.trim().length > 0);
      if (lines.length > 0) {
        const cols = lines[0].toLowerCase().split(",");
        const emailIdx = cols.findIndex(c => c.includes("email"));
        const companyIdx = cols.findIndex(c => c.includes("company"));
        const descIdx = cols.findIndex(c => c.includes("desc") || c.includes("job"));

        const startIdx = (emailIdx !== -1 || companyIdx !== -1) ? 1 : 0;
        const csvLines = lines.slice(startIdx);

        csvLines.forEach(line => {
          const cells = line.split(",").map(c => c.trim());
          if (cells.length > 0) {
            parsedLeads.push({
              companyName: cells[companyIdx !== -1 ? companyIdx : 0] || "Target Company",
              recipientEmail: cells[emailIdx !== -1 ? emailIdx : 1] || "",
              jobDescription: cells[descIdx !== -1 ? descIdx : 2] || "Recruiter Outreach",
            });
          }
        });
      }
    }

    const validLeads = parsedLeads.filter(l => l.recipientEmail && l.recipientEmail.includes("@"));

    if (validLeads.length === 0) {
      alert("Could not parse any valid leads. Double-check your format.");
      setActionLoading(null);
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/outreach/leads`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "bypass-tunnel-reminder": "true",
        },
        body: JSON.stringify({ leads: validLeads }),
      });
      const json = await res.json();
      if (json.success) {
        setBulkText("");
        setImportOpen(false);
        fetchLeads();
      } else {
        alert(json.message);
      }
    } catch (err) {
      console.error("Bulk add failed:", err);
    } finally {
      setActionLoading(null);
    }
  };

  // Image Upload Extraction Handler
  const handleImageExtract = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setExtractingImage(true);

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
      const res = await fetch(`${API_BASE}/outreach/leads/extract-image`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "bypass-tunnel-reminder": "true",
        },
        body: JSON.stringify({
          image: base64Str,
          mimeType: file.type,
        }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        setCompanyName(json.data.companyName || "");
        setRecipientEmail(json.data.recipientEmail || "");
        setJobDescription(json.data.jobDescription || "");
      } else {
        alert(json.message || "Failed to extract lead details from screenshot.");
      }
    } catch (err) {
      console.error("Image extract failed:", err);
      alert("Error calling image analysis endpoint. Verify your backend is responsive.");
    } finally {
      setExtractingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Delete Recruiter Lead
  const handleDeleteLead = async (id: string) => {
    if (!confirm("Are you sure you want to delete this recruiter lead?")) return;
    try {
      const res = await fetch(`${API_BASE}/outreach/leads/${id}`, {
        method: "DELETE",
        headers: { "bypass-tunnel-reminder": "true" },
      });
      const json = await res.json();
      if (json.success) {
        setLeads(prev => prev.filter(l => l.id !== id));
        setSelectedLeadIds(prev => prev.filter(item => item !== id));
      }
    } catch (err) {
      console.error("Delete lead failed:", err);
    }
  };

  // Edit Message Form Handler
  const handleSaveMessageEdits = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMessage) return;

    try {
      const res = await fetch(`${API_BASE}/outreach/messages/${editingMessage.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "bypass-tunnel-reminder": "true",
        },
        body: JSON.stringify({
          subject: editedSubject,
          body: editedBody,
        }),
      });

      const json = await res.json();
      if (json.success) {
        setEditingMessage(null);
        fetchLeads();
      }
    } catch (err) {
      console.error("Edit message failed:", err);
    }
  };

  // Generate Cold Emails for ALL leads that don't have one
  const handleGenerateAllEmails = async () => {
    setActionLoading("generate-emails");
    try {
      const res = await fetch(`${API_BASE}/outreach/generate-all`, {
        method: "POST",
        headers: { "bypass-tunnel-reminder": "true" },
      });
      const json = await res.json();
      alert(json.message);
      fetchLeads();
    } catch (err) {
      console.error("Bulk generate failed:", err);
    } finally {
      setActionLoading(null);
    }
  };

  // Send Single Mail via Gmail API
  const handleSendSingleMail = async (leadId: string) => {
    setActionLoading(`sending-${leadId}`);
    try {
      const res = await fetch(`${API_BASE}/outreach/send/${leadId}`, {
        method: "POST",
        headers: { 
          "bypass-tunnel-reminder": "true",
          "X-API-Key": process.env.NEXT_PUBLIC_OUTREACH_API_KEY || "hireflow_sec_key_2026_x92a8b"
        },
      });
      const json = await res.json();
      if (json.success) {
        fetchLeads();
      } else {
        alert(json.message || "Failed to send email.");
      }
    } catch (err) {
      console.error("Single send failed:", err);
    } finally {
      setActionLoading(null);
    }
  };

  // Bulk Send Selected Initial Emails
  const handleSendSelectedMails = async () => {
    if (selectedLeadIds.length === 0) return;

    setActionLoading("sending-bulk");
    let success = 0;
    let failed = 0;

    for (const leadId of selectedLeadIds) {
      const lead = leads.find(l => l.id === leadId);
      const unsentInitial = lead?.messages.find(m => m.type === "INITIAL" && !m.sentAt);
      
      if (!unsentInitial) continue;

      try {
        const res = await fetch(`${API_BASE}/outreach/send/${leadId}`, {
          method: "POST",
          headers: { 
            "bypass-tunnel-reminder": "true",
            "X-API-Key": process.env.NEXT_PUBLIC_OUTREACH_API_KEY || "hireflow_sec_key_2026_x92a8b"
          },
        });
        const json = await res.json();
        if (res.ok && json.success) {
          success++;
        } else {
          failed++;
        }
      } catch {
        failed++;
      }
    }

    alert(`Bulk Send complete!\nSuccessfully sent: ${success}\nFailed: ${failed}`);
    setSelectedLeadIds([]);
    fetchLeads();
    setActionLoading(null);
  };

  // Generate Follow-Ups for Checked Leads
  const handleGenerateFollowUps = async () => {
    if (selectedLeadIds.length === 0) return;

    setActionLoading("generate-followups");
    try {
      const res = await fetch(`${API_BASE}/outreach/followups/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "bypass-tunnel-reminder": "true",
        },
        body: JSON.stringify({ leadIds: selectedLeadIds }),
      });
      const json = await res.json();
      alert(json.message);
      fetchLeads();
    } catch (err) {
      console.error("Follow-up generation failed:", err);
    } finally {
      setActionLoading(null);
    }
  };

  // Send Follow-Ups inside the SAME thread for Checked Leads
  const handleSendFollowUps = async () => {
    if (selectedLeadIds.length === 0) return;

    setActionLoading("sending-followups");
    try {
      const res = await fetch(`${API_BASE}/outreach/followups/send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "bypass-tunnel-reminder": "true",
          "X-API-Key": process.env.NEXT_PUBLIC_OUTREACH_API_KEY || "hireflow_sec_key_2026_x92a8b"
        },
        body: JSON.stringify({ leadIds: selectedLeadIds }),
      });
      const json = await res.json();
      alert(json.message);
      setSelectedLeadIds([]);
      fetchLeads();
    } catch (err) {
      console.error("Follow-up sending failed:", err);
    } finally {
      setActionLoading(null);
    }
  };

  const toggleSelectLead = (id: string) => {
    setSelectedLeadIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedLeadIds.length === leads.length) {
      setSelectedLeadIds([]);
    } else {
      setSelectedLeadIds(leads.map(l => l.id));
    }
  };

  // Metadata aggregation calculations
  const getFollowUpCount = (lead: Lead) => {
    return lead.messages.filter(m => m.type.startsWith("FOLLOWUP_")).length;
  };

  const getLastSentDate = (lead: Lead) => {
    const sent = lead.messages.filter(m => m.sentAt);
    if (sent.length === 0) return "N/A";
    
    // Grab the most recent sent message
    const sorted = [...sent].sort(
      (a, b) => new Date(b.sentAt!).getTime() - new Date(a.sentAt!).getTime()
    );
    return new Date(sorted[0].sentAt!).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div style={{ fontFamily: "Inter, system-ui, sans-serif", color: "var(--text)" }}>
      
      {/* 1. GOOGLE CONNECTION BAR */}
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
              background: googleAuth.authenticated ? "rgba(16, 185, 129, 0.08)" : "rgba(182, 95, 42, 0.08)",
              border: googleAuth.authenticated ? "1px solid rgba(16, 185, 129, 0.2)" : "1px solid rgba(182, 95, 42, 0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "1.5rem"
            }}
          >
            {googleAuth.authenticated ? "🛡️" : "🔑"}
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: "1.05rem", color: "var(--text)", fontWeight: 600 }}>
              {googleAuth.authenticated ? "Google Account Connected" : "Google OAuth Authentication Required"}
            </h3>
            <p style={{ margin: "0.2rem 0 0 0", fontSize: "0.85rem", color: "var(--muted)" }}>
              {googleAuth.authenticated 
                ? `Sending campaigns securely from: ${googleAuth.email}` 
                : "Connect your Gmail account via secure OAuth to dispatch and thread emails."}
            </p>
          </div>
        </div>

        {googleAuth.authenticated ? (
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <span 
              style={{
                background: "rgba(16, 185, 129, 0.1)",
                color: "#059669",
                border: "1px solid rgba(16, 185, 129, 0.2)",
                padding: "0.5rem 1rem",
                borderRadius: "10px",
                fontSize: "0.85rem",
                fontWeight: 600,
                display: "inline-flex",
                alignItems: "center",
                gap: "0.3rem"
              }}
            >
              Connected ✅
            </span>
            <button
              onClick={connectGoogleAccount}
              style={{
                background: "transparent",
                color: "var(--accent)",
                border: "none",
                fontSize: "0.8rem",
                textDecoration: "underline",
                cursor: "pointer",
                padding: "0.5rem",
                fontWeight: 600,
                transition: "color 0.2s"
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "var(--accent-dark)")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "var(--accent)")}
            >
              Switch Account
            </button>
          </div>
        ) : (
          <button
            onClick={connectGoogleAccount}
            style={{
              background: "linear-gradient(135deg, var(--accent) 0%, var(--accent-dark) 100%)",
              color: "#fff",
              border: "none",
              padding: "0.7rem 1.4rem",
              borderRadius: "12px",
              fontWeight: 600,
              fontSize: "0.9rem",
              cursor: "pointer",
              boxShadow: "0 8px 20px -6px rgba(182, 95, 42, 0.4)",
              transition: "all 0.2s ease"
            }}
          >
            🔌 Connect Google Account
          </button>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 2fr", gap: "2.5rem", alignItems: "start" }}>
        
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
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
              <h3 style={{ fontSize: "1.2rem", color: "var(--text)", margin: 0, fontWeight: 600 }}>
                ➕ Add Recruiter Target
              </h3>
              
              {/* Screenshot extract label button */}
              <label 
                style={{
                  background: extractingImage ? "#e2e8f0" : "rgba(182, 95, 42, 0.08)",
                  color: extractingImage ? "#94a3b8" : "var(--accent-dark)",
                  border: "1px solid rgba(182, 95, 42, 0.2)",
                  padding: "0.4rem 0.8rem",
                  borderRadius: "8px",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  cursor: extractingImage ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.3rem"
                }}
              >
                <input 
                  type="file" 
                  accept="image/*" 
                  ref={fileInputRef} 
                  onChange={handleImageExtract} 
                  disabled={extractingImage} 
                  style={{ display: "none" }}
                />
                📷 {extractingImage ? "Analyzing Screenshot..." : "Extract Job Details"}
              </label>
            </div>

            <form onSubmit={handleAddLead} style={{ display: "flex", flexDirection: "column", gap: "1.2rem" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                  <label style={{ fontSize: "0.8rem", color: "var(--muted)", fontWeight: 600 }}>Company Name</label>
                  <input
                    type="text"
                    placeholder="Stripe"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    required
                    style={{
                      padding: "0.7rem 0.9rem",
                      borderRadius: "10px",
                      border: "1px solid var(--border)",
                      background: "#fffdf9",
                      color: "var(--text)",
                      outline: "none",
                      fontSize: "0.9rem",
                      transition: "border-color 0.2s"
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = "var(--accent)";
                      e.currentTarget.style.boxShadow = "0 0 0 3px rgba(182, 95, 42, 0.12)";
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = "var(--border)";
                      e.currentTarget.style.boxShadow = "none";
                    }}
                  />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                  <label style={{ fontSize: "0.8rem", color: "var(--muted)", fontWeight: 600 }}>Recruiter Email</label>
                  <input
                    type="email"
                    placeholder="recruiter@stripe.com"
                    value={recipientEmail}
                    onChange={(e) => setRecipientEmail(e.target.value)}
                    required
                    style={{
                      padding: "0.7rem 0.9rem",
                      borderRadius: "10px",
                      border: "1px solid var(--border)",
                      background: "#fffdf9",
                      color: "var(--text)",
                      outline: "none",
                      fontSize: "0.9rem",
                      transition: "border-color 0.2s"
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = "var(--accent)";
                      e.currentTarget.style.boxShadow = "0 0 0 3px rgba(182, 95, 42, 0.12)";
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = "var(--border)";
                      e.currentTarget.style.boxShadow = "none";
                    }}
                  />
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                <label style={{ fontSize: "0.8rem", color: "var(--muted)", fontWeight: 600 }}>Job Description Context</label>
                <textarea
                  rows={6}
                  placeholder="Paste details of the role or specific specs..."
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  required
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
                    transition: "border-color 0.2s"
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = "var(--accent)";
                    e.currentTarget.style.boxShadow = "0 0 0 3px rgba(182, 95, 42, 0.12)";
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = "var(--border)";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                />
              </div>

              <div style={{ display: "flex", gap: "1rem", marginTop: "0.5rem" }}>
                <button
                  type="submit"
                  disabled={actionLoading === "add-lead"}
                  style={{
                    flex: 1,
                    background: "linear-gradient(135deg, var(--accent) 0%, var(--accent-dark) 100%)",
                    color: "#fff",
                    border: "none",
                    padding: "0.8rem",
                    borderRadius: "12px",
                    fontWeight: 600,
                    cursor: actionLoading === "add-lead" ? "not-allowed" : "pointer",
                    boxShadow: "0 4px 12px rgba(182, 95, 42, 0.15)",
                    transition: "transform 0.2s"
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.transform = "translateY(-1px)"}
                  onMouseLeave={(e) => e.currentTarget.style.transform = "none"}
                >
                  {actionLoading === "add-lead" ? "Adding Lead..." : "Add Single Lead 🎯"}
                </button>
                
                <button
                  type="button"
                  onClick={() => setImportOpen(!importOpen)}
                  style={{
                    background: "#ffffff",
                    color: "var(--text)",
                    border: "1px solid var(--border)",
                    padding: "0.8rem 1.2rem",
                    borderRadius: "12px",
                    fontWeight: 600,
                    cursor: "pointer",
                    transition: "background-color 0.2s"
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = "rgba(49, 37, 24, 0.03)"}
                  onMouseLeave={(e) => e.currentTarget.style.background = "#ffffff"}
                >
                  📥 Bulk Paste
                </button>
              </div>
            </form>
          </div>

          {/* Bulk Paste Importer Drawer */}
          {importOpen && (
            <div 
              style={{ 
                background: "rgba(255, 255, 255, 0.5)", 
                border: "1px dashed var(--border)", 
                padding: "1.5rem", 
                borderRadius: "20px",
                marginTop: "1rem"
              }}
            >
              <h4 style={{ margin: "0 0 0.8rem 0", color: "var(--accent-dark)", fontSize: "0.95rem", fontWeight: 600 }}>
                📋 Paste Recruiter Details (CSV / JSON)
              </h4>
              <textarea
                rows={5}
                placeholder={`Example CSV:\ncompanyName,recipientEmail,jobDescription\nStripe,recruiter@stripe.com,Software Engineer\n\nOr JSON:\n[{"companyName": "Stripe", "email": "recruiter@stripe.com", "jobDescription": "..."}]`}
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                style={{
                  width: "100%",
                  padding: "0.8rem",
                  borderRadius: "10px",
                  border: "1px solid var(--border)",
                  background: "#fffdf9",
                  color: "#059669",
                  fontFamily: "monospace",
                  fontSize: "0.8rem",
                  outline: "none",
                  resize: "vertical"
                }}
              />
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.8rem", marginTop: "1rem" }}>
                <button
                  onClick={() => setImportOpen(false)}
                  style={{ background: "transparent", border: "none", color: "var(--muted)", cursor: "pointer", fontSize: "0.85rem", fontWeight: 500 }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleBulkAddLeads}
                  disabled={actionLoading === "bulk-add"}
                  style={{
                    background: "var(--accent)",
                    color: "#fff",
                    border: "none",
                    padding: "0.5rem 1.2rem",
                    borderRadius: "8px",
                    fontWeight: 600,
                    fontSize: "0.85rem",
                    cursor: "pointer",
                    transition: "background 0.2s"
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = "var(--accent-dark)"}
                  onMouseLeave={(e) => e.currentTarget.style.background = "var(--accent)"}
                >
                  {actionLoading === "bulk-add" ? "Importing..." : "Parse & Import ⚡"}
                </button>
              </div>
            </div>
          )}

          {/* Quick Metrics Bar */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1rem" }}>
            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", padding: "1rem", borderRadius: "16px", textAlign: "center", boxShadow: "var(--shadow)" }}>
              <div style={{ fontSize: "1.6rem", fontWeight: 700, color: "var(--accent-dark)" }}>{leads.length}</div>
              <div style={{ fontSize: "0.75rem", color: "var(--muted)", fontWeight: 600, marginTop: "0.2rem" }}>TOTAL CAMPAIGNS</div>
            </div>
            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", padding: "1rem", borderRadius: "16px", textAlign: "center", boxShadow: "var(--shadow)" }}>
              <div style={{ fontSize: "1.6rem", fontWeight: 700, color: "var(--accent)" }}>
                {leads.filter(l => l.status === "READY").length}
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--muted)", fontWeight: 600, marginTop: "0.2rem" }}>READY TO SEND</div>
            </div>
            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", padding: "1rem", borderRadius: "16px", textAlign: "center", boxShadow: "var(--shadow)" }}>
              <div style={{ fontSize: "1.6rem", fontWeight: 700, color: "#10b981" }}>
                {leads.filter(l => l.status === "SENT").length}
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--muted)", fontWeight: 600, marginTop: "0.2rem" }}>SENT COLD MAILS</div>
            </div>
          </div>

        </div>

        {/* 3. CAMPAIGN ACTION GRID / DASHBOARD DECK */}
        <div 
          style={{ 
            background: "var(--surface)", 
            border: "1px solid var(--border)", 
            borderRadius: "24px",
            padding: "2rem",
            boxShadow: "var(--shadow)",
            backdropFilter: "blur(14px)"
          }}
        >
          {/* Header controls */}
          <div 
            style={{ 
              display: "flex", 
              justifyContent: "space-between", 
              alignItems: "center", 
              marginBottom: "2rem",
              borderBottom: "1px solid var(--border)",
              paddingBottom: "1.2rem"
            }}
          >
            <div>
              <h4 style={{ fontSize: "1.2rem", color: "var(--text)", margin: 0, fontWeight: 600 }}>
                📊 Outreach Campaigns Tracker
              </h4>
              <p style={{ margin: "0.2rem 0 0 0", fontSize: "0.82rem", color: "var(--muted)" }}>
                Select rows to trigger personalized generations and replies.
              </p>
            </div>

            <div style={{ display: "flex", gap: "0.75rem" }}>
              <button
                onClick={handleGenerateAllEmails}
                disabled={actionLoading !== null || leads.length === 0}
                style={{
                  background: "rgba(182, 95, 42, 0.08)",
                  color: "var(--accent-dark)",
                  border: "1px solid rgba(182, 95, 42, 0.2)",
                  padding: "0.5rem 1rem",
                  borderRadius: "10px",
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "background-color 0.2s"
                }}
                onMouseEnter={(e) => {
                  if (actionLoading === null && leads.length > 0) {
                    e.currentTarget.style.background = "rgba(182, 95, 42, 0.15)";
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "rgba(182, 95, 42, 0.08)";
                }}
              >
                ⚙️ {actionLoading === "generate-emails" ? "Generating..." : "Generate Cold Mails"}
              </button>
            </div>
          </div>

          {/* Leads table */}
          {loading && leads.length === 0 ? (
            <p style={{ color: "var(--muted)", textAlign: "center", padding: "3rem" }}>Loading campaign list...</p>
          ) : leads.length === 0 ? (
            <div style={{ textTransform: "uppercase", textAlign: "center", padding: "4rem 2rem", border: "1px dashed var(--border)", borderRadius: "16px" }}>
              <span style={{ fontSize: "2.5rem" }}>📭</span>
              <p style={{ color: "var(--muted)", fontSize: "0.85rem", marginTop: "1rem", fontWeight: 700 }}>No Recruiter Targets Registered Yet</p>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.85rem" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border)", color: "var(--muted)" }}>
                    <th style={{ padding: "0.75rem 0.5rem", width: "40px" }}>
                      <input
                        type="checkbox"
                        checked={selectedLeadIds.length === leads.length}
                        onChange={toggleSelectAll}
                        style={{ cursor: "pointer" }}
                      />
                    </th>
                    <th style={{ padding: "0.75rem 0.5rem" }}>Company / Recipient</th>
                    <th style={{ padding: "0.75rem 0.5rem", textAlign: "center" }}>Status</th>
                    <th style={{ padding: "0.75rem 0.5rem" }}>Outbox Details</th>
                    <th style={{ padding: "0.75rem 0.5rem", textAlign: "center" }}>Follow Ups</th>
                    <th style={{ padding: "0.75rem 0.5rem" }}>Last Sent</th>
                    <th style={{ padding: "0.75rem 0.5rem", textAlign: "center" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map((lead) => {
                    const initialMail = lead.messages.find(m => m.type === "INITIAL");
                    const isChecked = selectedLeadIds.includes(lead.id);

                    return (
                      <tr
                        key={lead.id}
                        style={{
                          borderBottom: "1px solid var(--border)",
                          background: isChecked ? "rgba(182, 95, 42, 0.04)" : "transparent",
                          transition: "background 0.2s"
                        }}
                        onMouseEnter={(e) => {
                          if (!isChecked) {
                            e.currentTarget.style.background = "rgba(49, 37, 24, 0.02)";
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!isChecked) {
                            e.currentTarget.style.background = "transparent";
                          }
                        }}
                      >
                        <td style={{ padding: "1rem 0.5rem" }}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleSelectLead(lead.id)}
                            style={{ cursor: "pointer" }}
                          />
                        </td>
                        <td style={{ padding: "1rem 0.5rem" }}>
                          <div style={{ fontWeight: 700, color: "var(--text)" }}>{lead.companyName}</div>
                          <div style={{ color: "var(--muted)", fontSize: "0.78rem", marginTop: "0.1rem" }}>{lead.recipientEmail}</div>
                        </td>
                        <td style={{ padding: "1rem 0.5rem", textAlign: "center" }}>
                          <span 
                            style={{
                              padding: "0.25rem 0.55rem",
                              borderRadius: "6px",
                              fontSize: "0.72rem",
                              fontWeight: 700,
                              background: 
                                lead.status === "SENT" ? "#ecfdf5" :
                                lead.status === "READY" ? "#e0e7ff" :
                                lead.status === "GENERATING" || lead.status === "SENDING" ? "#f3e8ff" :
                                lead.status === "FAILED" ? "#fee2e2" : "#f1f5f9",
                              color: 
                                lead.status === "SENT" ? "#065f46" :
                                lead.status === "READY" ? "#3730a3" :
                                lead.status === "GENERATING" || lead.status === "SENDING" ? "#6b21a8" :
                                lead.status === "FAILED" ? "#991b1b" : "#475569"
                            }}
                          >
                            {lead.status}
                          </span>
                        </td>
                        <td style={{ padding: "1rem 0.5rem" }}>
                          {initialMail ? (
                            <button
                              onClick={() => {
                                setEditingMessage(initialMail);
                                setEditedSubject(initialMail.subject);
                                setEditedBody(initialMail.body);
                              }}
                              style={{
                                background: "#ffffff",
                                border: "1px solid var(--border)",
                                color: "var(--accent-dark)",
                                padding: "0.35rem 0.7rem",
                                borderRadius: "8px",
                                fontSize: "0.75rem",
                                fontWeight: 600,
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                gap: "0.2rem",
                                boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
                                transition: "all 0.15s ease"
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.borderColor = "var(--accent)";
                                e.currentTarget.style.background = "var(--surface-strong)";
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.borderColor = "var(--border)";
                                e.currentTarget.style.background = "#ffffff";
                              }}
                            >
                              📝 {initialMail.subject.length > 25 ? initialMail.subject.substring(0, 25) + "..." : initialMail.subject}
                            </button>
                          ) : (
                            <span style={{ color: "var(--muted)", fontStyle: "italic" }}>No cold mail yet</span>
                          )}
                        </td>
                        <td style={{ padding: "1rem 0.5rem", textAlign: "center", color: "var(--text)", fontWeight: 600 }}>
                          {getFollowUpCount(lead)}
                        </td>
                        <td style={{ padding: "1rem 0.5rem", color: "var(--muted)" }}>
                          {getLastSentDate(lead)}
                        </td>
                        <td style={{ padding: "1rem 0.5rem", textAlign: "center" }}>
                          <div style={{ display: "flex", gap: "0.5rem", justifyContent: "center" }}>
                            {lead.status === "READY" && (
                              <button
                                onClick={() => handleSendSingleMail(lead.id)}
                                disabled={actionLoading !== null || !googleAuth.authenticated}
                                style={{
                                  background: "#10b981",
                                  border: "none",
                                  color: "#fff",
                                  padding: "0.3rem 0.6rem",
                                  borderRadius: "6px",
                                  fontSize: "0.75rem",
                                  fontWeight: 600,
                                  cursor: "pointer"
                                }}
                                title={!googleAuth.authenticated ? "Connect your Google account first" : "Send Email"}
                              >
                                {actionLoading === `sending-${lead.id}` ? "..." : "Send 🚀"}
                              </button>
                            )}
                            <button
                              onClick={() => handleDeleteLead(lead.id)}
                              style={{
                                background: "transparent",
                                border: "none",
                                color: "var(--muted)",
                                cursor: "pointer",
                                transition: "color 0.2s"
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.color = "#dc2626"}
                              onMouseLeave={(e) => e.currentTarget.style.color = "var(--muted)"}
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

          {/* Bulk Sending / Threading Action Blocks */}
          {selectedLeadIds.length > 0 && (
            <div 
              style={{ 
                marginTop: "2rem", 
                background: "var(--surface)", 
                border: "1px solid var(--border)", 
                padding: "1.5rem", 
                borderRadius: "20px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                boxShadow: "var(--shadow)",
                backdropFilter: "blur(14px)"
              }}
            >
              <span style={{ fontSize: "0.9rem", color: "var(--text)", fontWeight: 600 }}>
                Selected Recipient(s): <b style={{ color: "var(--accent-dark)" }}>{selectedLeadIds.length} lead(s)</b>
              </span>

              <div style={{ display: "flex", gap: "0.8rem" }}>
                
                {/* 1. Initial bulk sender */}
                <button
                  onClick={handleSendSelectedMails}
                  disabled={actionLoading !== null || !googleAuth.authenticated}
                  style={{
                    background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                    color: "#fff",
                    border: "none",
                    padding: "0.55rem 1.1rem",
                    borderRadius: "10px",
                    fontWeight: 600,
                    fontSize: "0.82rem",
                    cursor: "pointer",
                    boxShadow: "0 4px 12px rgba(16, 185, 129, 0.15)"
                  }}
                >
                  Send Cold Mails 🚀
                </button>

                {/* 2. Follow up generator */}
                <button
                  onClick={handleGenerateFollowUps}
                  disabled={actionLoading !== null}
                  style={{
                    background: "rgba(182, 95, 42, 0.08)",
                    color: "var(--accent-dark)",
                    border: "1px solid rgba(182, 95, 42, 0.2)",
                    padding: "0.55rem 1.1rem",
                    borderRadius: "10px",
                    fontWeight: 600,
                    fontSize: "0.82rem",
                    cursor: "pointer"
                  }}
                >
                  🔄 {actionLoading === "generate-followups" ? "Generating..." : "Generate Follow Up"}
                </button>

                {/* 3. Threaded follow up sender */}
                <button
                  onClick={handleSendFollowUps}
                  disabled={actionLoading !== null || !googleAuth.authenticated}
                  style={{
                    background: "linear-gradient(135deg, var(--accent) 0%, var(--accent-dark) 100%)",
                    color: "#fff",
                    border: "none",
                    padding: "0.55rem 1.1rem",
                    borderRadius: "10px",
                    fontWeight: 600,
                    fontSize: "0.82rem",
                    cursor: "pointer",
                    boxShadow: "0 4px 12px rgba(182, 95, 42, 0.15)"
                  }}
                >
                  📬 {actionLoading === "sending-followups" ? "Replying..." : "Send Threaded Follow Ups"}
                </button>

              </div>
            </div>
          )}

        </div>

      </div>

      {/* 4. EDIT MESSAGE MODAL OVERLAY */}
      {editingMessage && (
        <div 
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            background: "rgba(33, 23, 15, 0.4)",
            backdropFilter: "blur(8px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999
          }}
          onClick={() => setEditingMessage(null)}
        >
          <div 
            style={{
              width: "100%",
              maxWidth: "600px",
              background: "rgba(255, 253, 248, 0.98)",
              border: "1px solid rgba(49, 37, 24, 0.15)",
              borderRadius: "24px",
              padding: "2rem",
              boxShadow: "0 30px 70px rgba(21, 14, 9, 0.3)"
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h4 style={{ margin: "0 0 1rem 0", color: "var(--accent-dark)", fontSize: "1.25rem", fontWeight: 600 }}>
              📝 Review & Edit Cold Email Draft
            </h4>

            <form onSubmit={handleSaveMessageEdits} style={{ display: "flex", flexDirection: "column", gap: "1.2rem" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                <label style={{ fontSize: "0.85rem", color: "var(--muted)", fontWeight: 600 }}>Subject Line</label>
                <input
                  type="text"
                  value={editedSubject}
                  onChange={(e) => setEditedSubject(e.target.value)}
                  required
                  style={{
                    padding: "0.7rem 0.9rem",
                    borderRadius: "10px",
                    border: "1px solid var(--border)",
                    background: "#fffdf9",
                    color: "var(--text)",
                    outline: "none",
                    fontSize: "0.9rem"
                  }}
                />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                <label style={{ fontSize: "0.85rem", color: "var(--muted)", fontWeight: 600 }}>Email Body</label>
                <textarea
                  rows={10}
                  value={editedBody}
                  onChange={(e) => setEditedBody(e.target.value)}
                  required
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
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "1rem", marginTop: "0.5rem", alignItems: "center" }}>
                <button
                  type="button"
                  onClick={() => setEditingMessage(null)}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "var(--muted)",
                    cursor: "pointer",
                    fontSize: "0.9rem",
                    fontWeight: 500
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    background: "linear-gradient(135deg, var(--accent) 0%, var(--accent-dark) 100%)",
                    color: "#fff",
                    border: "none",
                    padding: "0.6rem 1.4rem",
                    borderRadius: "10px",
                    fontWeight: 600,
                    fontSize: "0.9rem",
                    cursor: "pointer",
                    boxShadow: "0 4px 12px rgba(182, 95, 42, 0.15)"
                  }}
                >
                  Save Draft Changes ✅
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
