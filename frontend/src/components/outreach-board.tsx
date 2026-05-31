"use client";

import { useState, useEffect, useMemo } from "react";

interface Message {
  id: string;
  leadId: string;
  type: string; // INITIAL, FOLLOWUP_1, FOLLOWUP_2, FOLLOWUP_3
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
  status: string; // READY, SENDING, SENT, FAILED
  createdAt: string;
  updatedAt: string;
  messages: Message[];
}

export function OutreachBoard() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Authentication State
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  // Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [addMode, setAddMode] = useState<"single" | "bulk" | "image">("single");
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);

  // Passcode Authentication State
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [passcodeInput, setPasscodeInput] = useState("");
  const [authError, setAuthError] = useState("");
  const [showPasscodeText, setShowPasscodeText] = useState(false);

  // Image Upload Form
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [extractingImage, setExtractingImage] = useState(false);

  // Single Lead Input Form
  const [companyName, setCompanyName] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [jobDescription, setJobDescription] = useState("");

  // Bulk Upload Form
  const [bulkInput, setBulkInput] = useState("");
  const [bulkFormat, setBulkFormat] = useState<"json" | "csv">("json");

  // Search Filter
  const [query, setQuery] = useState("");

  // API base URL pointing to the Express server running on port 3000
  const API_BASE = "http://localhost:3000";

  // Load API key from env or localStorage
  const getApiKey = () => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("outreach_api_key") || process.env.NEXT_PUBLIC_OUTREACH_API_KEY || "";
    }
    return process.env.NEXT_PUBLIC_OUTREACH_API_KEY || "";
  };

  // Helper wrapper for making authorized backend fetch requests
  const fetchWithAuth = async (url: string, options: RequestInit = {}) => {
    const key = getApiKey();
    const headers = {
      "X-API-Key": key,
      ...options.headers,
    };

    return await fetch(url, { ...options, headers });
  };

  // Real-time verification on submit
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
      const res = await fetch(`${API_BASE}/outreach/leads`, {
        headers: {
          "X-API-Key": testKey,
        },
      });
      
      if (res.status === 401) {
        setAuthError("Invalid passcode. Access Denied.");
        setLoading(false);
        return;
      }
      
      localStorage.setItem("outreach_api_key", testKey);
      setIsAuthenticated(true);
      setPasscodeInput("");
      // Fetch data immediately
      const json = await res.json();
      if (json.success) {
        setLeads(json.data);
      }
    } catch (err) {
      setAuthError("Network error. Verify that the backend server is running.");
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = () => {
    localStorage.removeItem("outreach_api_key");
    setIsAuthenticated(false);
    setLeads([]);
  };

  // Fetch all leads from Express backend
  const fetchLeads = async () => {
    try {
      const res = await fetchWithAuth(`${API_BASE}/outreach/leads`);
      if (res.status === 401) {
        setIsAuthenticated(false);
        return;
      }
      const json = await res.json();
      if (json.success) {
        setLeads(json.data);
        setIsAuthenticated(true);
      }
    } catch (err) {
      console.error("[OutreachBoard] Failed to fetch leads:", err);
    }
  };


  useEffect(() => {
    fetchLeads();
    // Poll leads every 4 seconds to observe real-time status changes when emails are sending sequentially
    const interval = setInterval(fetchLeads, 4000);
    return () => clearInterval(interval);
  }, []);

  // Compute Metrics
  const metrics = useMemo(() => {
    return {
      total: leads.length,
      ready: leads.filter((l) => l.status === "READY").length,
      sending: leads.filter((l) => l.status === "SENDING").length,
      sent: leads.filter((l) => l.status === "SENT").length,
      failed: leads.filter((l) => l.status === "FAILED").length,
    };
  }, [leads]);

  // Handle Checkbox Selection
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredLeads.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredLeads.map((l) => l.id)));
    }
  };

  // Filter Leads
  const filteredLeads = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return leads;
    return leads.filter(
      (l) =>
        l.companyName.toLowerCase().includes(q) ||
        l.recipientEmail.toLowerCase().includes(q) ||
        l.status.toLowerCase().includes(q)
    );
  }, [leads, query]);

  // Submit Single Lead
  const handleAddSingleLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName || !recipientEmail || !jobDescription) {
      alert("Please fill out all fields.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetchWithAuth(`${API_BASE}/outreach/leads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leads: { companyName, recipientEmail, jobDescription },
        }),
      });

      const json = await res.json();
      if (json.success) {
        // Reset form and refresh
        setCompanyName("");
        setRecipientEmail("");
        setJobDescription("");
        setShowAddModal(false);
        fetchLeads();
      } else {
        alert("Failed to add lead: " + json.message);
      }
    } catch (err) {
      console.error(err);
      alert("Error adding lead.");
    } finally {
      setLoading(false);
    }
  };

  // Submit Bulk Leads (handles CSV or JSON paste)
  const handleAddBulkLeads = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bulkInput.trim()) {
      alert("Please paste some data first.");
      return;
    }

    setLoading(true);
    try {
      let parsedLeads = [];

      if (bulkFormat === "json") {
        try {
          parsedLeads = JSON.parse(bulkInput.trim());
          if (!Array.isArray(parsedLeads)) {
            throw new Error("Pasted JSON is not an array.");
          }
        } catch (err) {
          alert("Invalid JSON format. Please ensure it is a valid JSON array.");
          setLoading(false);
          return;
        }
      } else {
        // CSV Parser: parses companyName, recipientEmail, jobDescription
        const lines = bulkInput.trim().split("\n");
        for (const line of lines) {
          if (!line.trim()) continue;
          // Split by comma, handling potential quotes
          const cols = line.split(",").map((c) => c.trim().replace(/^["']|["']$/g, ""));
          if (cols.length >= 3) {
            parsedLeads.push({
              companyName: cols[0],
              recipientEmail: cols[1],
              jobDescription: cols.slice(2).join(","), // description can contain commas
            });
          }
        }

        if (parsedLeads.length === 0) {
          alert("Could not extract any leads from CSV. Format: Company,Email,Job Description");
          setLoading(false);
          return;
        }
      }

      const res = await fetchWithAuth(`${API_BASE}/outreach/leads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leads: parsedLeads }),
      });

      const json = await res.json();
      if (json.success) {
        setBulkInput("");
        setShowAddModal(false);
        fetchLeads();
      } else {
        alert("Failed to bulk add leads: " + json.message);
      }
    } catch (err) {
      console.error(err);
      alert("Error uploading bulk leads.");
    } finally {
      setLoading(false);
    }
  };

  // Handle image selection
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImageFile(file);

    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Submit image to Gemini backend for parsing
  const handleExtractFromImage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!imagePreview || !imageFile) {
      alert("Please select an image first.");
      return;
    }

    setExtractingImage(true);
    try {
      const res = await fetchWithAuth(`${API_BASE}/outreach/leads/extract-image`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: imagePreview,
          mimeType: imageFile.type,
        }),
      });

      const json = await res.json();
      if (json.success && json.data) {
        const { companyName, recipientEmail, jobDescription } = json.data;
        setCompanyName(companyName || "");
        setRecipientEmail(recipientEmail || "");
        setJobDescription(jobDescription || "");
        setAddMode("single"); // Switch back to the single recruiter form pre-filled!
        setImageFile(null);
        setImagePreview(null);
      } else {
        alert("Failed to extract: " + json.message);
      }
    } catch (err) {
      console.error(err);
      alert("Error extracting lead details from image.");
    } finally {
      setExtractingImage(false);
    }
  };

  // Trigger Gemini Cold Email Generation for all pending leads
  const handleGenerateAll = async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth(`${API_BASE}/outreach/generate-all`, { method: "POST" });
      const json = await res.json();
      alert(json.message);
      fetchLeads();
    } catch (err) {
      console.error(err);
      alert("Failed to trigger generation.");
    } finally {
      setLoading(false);
    }
  };

  // Send All READY Emails Sequentially
  const handleSendAll = async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth(`${API_BASE}/outreach/send-all`, { method: "POST" });
      const json = await res.json();
      alert(json.message);
      fetchLeads();
    } catch (err) {
      console.error(err);
      alert("Failed to send emails.");
    } finally {
      setLoading(false);
    }
  };

  // Generate Follow-Ups for selected lead IDs
  const handleGenerateFollowups = async () => {
    if (selectedIds.size === 0) {
      alert("Please select at least one lead.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetchWithAuth(`${API_BASE}/outreach/followups/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadIds: Array.from(selectedIds) }),
      });
      const json = await res.json();
      alert(json.message);
      setSelectedIds(new Set());
      fetchLeads();
    } catch (err) {
      console.error(err);
      alert("Error generating follow-ups.");
    } finally {
      setLoading(false);
    }
  };

  // Send Follow-Ups for selected leads
  const handleSendFollowups = async () => {
    if (selectedIds.size === 0) {
      alert("Please select at least one lead.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetchWithAuth(`${API_BASE}/outreach/followups/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadIds: Array.from(selectedIds) }),
      });
      const json = await res.json();
      alert(json.message);
      setSelectedIds(new Set());
      fetchLeads();
    } catch (err) {
      console.error(err);
      alert("Error sending follow-ups.");
    } finally {
      setLoading(false);
    }
  };

  // Delete Lead Handler
  const handleDeleteLead = async (id: string) => {
    if (!confirm("Are you sure you want to delete this lead? All email logs will be deleted too.")) {
      return;
    }

    try {
      const res = await fetchWithAuth(`${API_BASE}/outreach/leads/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (json.success) {
        fetchLeads();
      } else {
        alert("Failed to delete lead.");
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Edit Message Handler
  const handleSaveMessageEdits = async () => {
    if (!editingMessage) return;

    try {
      const res = await fetchWithAuth(`${API_BASE}/outreach/messages/${editingMessage.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: editingMessage.subject,
          body: editingMessage.body,
        }),
      });

      const json = await res.json();
      if (json.success) {
        alert("Email saved successfully.");
        // Refresh and close editing state
        setEditingMessage(null);
        setSelectedLead(null);
        fetchLeads();
      } else {
        alert("Failed to save: " + json.message);
      }
    } catch (err) {
      console.error(err);
      alert("Error saving edits.");
    }
  };

  // Send single message immediately
  const handleSendSingleEmail = async (id: string) => {
    setLoading(true);
    try {
      const res = await fetchWithAuth(`${API_BASE}/outreach/send/${id}`, { method: "POST" });
      const json = await res.json();
      alert(json.message || "Email send triggered!");
      setEditingMessage(null);
      setSelectedLead(null);
      fetchLeads();
    } catch (err) {
      console.error(err);
      alert("Failed to send email.");
    } finally {
      setLoading(false);
    }
  };

  // Open email reviewing drawer/modal
  const handleOpenReviewModal = (lead: Lead) => {
    setSelectedLead(lead);
    // Find the latest message, or the latest unsent message
    const unsent = lead.messages.find((m) => !m.sentAt);
    const msg = unsent || lead.messages[lead.messages.length - 1];
    setEditingMessage(msg ? { ...msg } : null);
  };

  // Helper for lead statuses color styling
  const getOutreachStatusStyle = (status: string) => {
    switch (status) {
      case "READY":
        return { bg: "#ecfdf5", text: "#047857", label: "Ready" };
      case "SENDING":
        return { bg: "#eff6ff", text: "#1d4ed8", label: "Sending..." };
      case "SENT":
        return { bg: "#f0fdf4", text: "#166534", label: "Sent" };
      case "FAILED":
        return { bg: "#fef2f2", text: "#b91c1c", label: "Failed" };
      default:
        return { bg: "#f3f4f6", text: "#374151", label: status };
    }
  };

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
        {/* Glow Spheres */}
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
            <div style={{ 
              fontSize: "3rem", 
              marginBottom: "0.75rem",
              animation: "pulseLock 2s infinite alternate" 
            }}>
              🔒
            </div>
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
                  title={showPasscodeText ? "Hide passcode" : "Show passcode"}
                >
                  {showPasscodeText ? "👁️" : "👁️‍🗨️"}
                </button>
              </div>
            </div>

            {authError && (
              <div 
                style={{ 
                  color: "#f87171", 
                  fontSize: "0.85rem", 
                  fontWeight: 500,
                  background: "rgba(239, 68, 68, 0.1)",
                  padding: "0.75rem 1rem",
                  borderRadius: "10px",
                  border: "1px solid rgba(239, 68, 68, 0.2)",
                  lineHeight: 1.4,
                  animation: "shake 0.4s ease-in-out"
                }}
              >
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

        {/* Global Keyframes styling */}
        <style>{`
          @keyframes fadeInUp {
            from {
              opacity: 0;
              transform: translateY(20px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
          @keyframes pulseLock {
            from { transform: scale(1); }
            to { transform: scale(1.08); }
          }
          @keyframes shake {
            0%, 100% { transform: translateX(0); }
            25% { transform: translateX(-6px); }
            75% { transform: translateX(6px); }
          }
          .auth-input:focus {
            border-color: #6366f1 !important;
            box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.25) !important;
            background: rgba(255, 255, 255, 0.08) !important;
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="tracker-section" style={{ minHeight: "65vh" }}>
      {/* 1. Metrics Counter Dashboard */}
      <div className="tracker-metrics-grid" style={{ marginBottom: "1.5rem" }}>
        <div className="metric-card metric-total">
          <div className="metric-card-inner">
            <span className="metric-label">Recruiters</span>
            <span className="metric-val">{metrics.total}</span>
          </div>
          <div className="metric-card-accent" style={{ background: "var(--accent)" }} />
        </div>

        <div className="metric-card">
          <div className="metric-card-inner">
            <span className="metric-label">Ready Emails</span>
            <span className="metric-val text-blue" style={{ color: "#2563eb" }}>
              {metrics.ready}
            </span>
          </div>
          <div className="metric-card-accent" style={{ background: "#2563eb" }} />
        </div>

        <div className="metric-card">
          <div className="metric-card-inner">
            <span className="metric-label">Outbox Sent</span>
            <span className="metric-val text-green" style={{ color: "#16a34a" }}>
              {metrics.sent}
            </span>
          </div>
          <div className="metric-card-accent" style={{ background: "#16a34a" }} />
        </div>

        <div className="metric-card">
          <div className="metric-card-inner">
            <span className="metric-label">SMTP Errors</span>
            <span className="metric-val text-red" style={{ color: "#dc2626" }}>
              {metrics.failed}
            </span>
          </div>
          <div className="metric-card-accent" style={{ background: "#dc2626" }} />
        </div>
      </div>

      {/* 2. Actions Toolbar */}
      <div className="tracker-toolbar-container" style={{ margin: "2rem 0 1rem 0" }}>
        <div className="tracker-toolbar-left">
          <h2 style={{ fontSize: "1.5rem", fontWeight: 700, color: "#111827", margin: "0" }}>Outreach Automation</h2>
          <p className="tracker-toolbar-sub" style={{ margin: "4px 0 0", color: "var(--muted)" }}>
            Sequential, highly targeted Gmail cold emailing powered by Google Gemini AI
          </p>
        </div>

        <div className="tracker-toolbar-right" style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
          {/* Lock Session Button */}
          <button
            onClick={handleSignOut}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.4rem",
              minHeight: "42px",
              padding: "0.5rem 1rem",
              background: "#fee2e2",
              color: "#dc2626",
              border: "1px solid #fecaca",
              borderRadius: "10px",
              fontSize: "0.9rem",
              fontWeight: 500,
              cursor: "pointer",
              transition: "all 150ms ease",
            }}
            title="Lock Session / Sign Out"
          >
            🔒 Lock Session
          </button>

          {/* Search Box */}
          <div className="tracker-search-box">
            <input
              type="text"
              placeholder="Search companies..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              style={{ minHeight: "42px", padding: "0.5rem 0.85rem", borderRadius: "10px", border: "1px solid var(--border)" }}
            />
          </div>

          {/* Add Recruiter Button */}
          <button
            className="add-app-btn"
            onClick={() => setShowAddModal(true)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.4rem",
              minHeight: "42px",
              padding: "0.5rem 1.15rem",
              background: "var(--accent)",
              color: "white",
              border: "none",
              borderRadius: "10px",
              fontSize: "0.9rem",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            ➕ Add Leads
          </button>

          {/* Generate All Button */}
          <button
            className="add-app-btn"
            onClick={handleGenerateAll}
            disabled={loading || leads.length === 0}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.4rem",
              minHeight: "42px",
              padding: "0.5rem 1.15rem",
              background: "#4f46e5",
              color: "white",
              border: "none",
              borderRadius: "10px",
              fontSize: "0.9rem",
              fontWeight: 500,
              cursor: "pointer",
              opacity: loading || leads.length === 0 ? 0.6 : 1,
            }}
            title="Fetches resume/projects and generates cold emails via Gemini"
          >
            ✨ Generate All
          </button>

          {/* Send All Button */}
          <button
            className="add-app-btn"
            onClick={handleSendAll}
            disabled={loading || metrics.ready === 0}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.4rem",
              minHeight: "42px",
              padding: "0.5rem 1.15rem",
              background: "#059669",
              color: "white",
              border: "none",
              borderRadius: "10px",
              fontSize: "0.9rem",
              fontWeight: 500,
              cursor: "pointer",
              opacity: loading || metrics.ready === 0 ? 0.6 : 1,
            }}
            title="Sequentially sends all READY cold emails with a 2-5 second rate-limiting delay"
          >
            ✉️ Send All READY
          </button>
        </div>
      </div>

      {/* 3. Multi-Select Context Bar */}
      {selectedIds.size > 0 && (
        <div
          className="multi-select-bar"
          style={{
            background: "rgba(255, 250, 241, 0.95)",
            border: "1px solid var(--accent)",
            borderRadius: "12px",
            padding: "0.75rem 1.25rem",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "1rem",
            boxShadow: "var(--shadow)",
            animation: "fadeIn 180ms ease",
          }}
        >
          <div style={{ fontSize: "0.95rem", fontWeight: 500, color: "var(--accent-dark)" }}>
            Selected <strong>{selectedIds.size}</strong> recruiter(s)
          </div>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button
              onClick={handleGenerateFollowups}
              disabled={loading}
              style={{
                background: "#7c3aed",
                color: "white",
                border: "none",
                borderRadius: "8px",
                padding: "0.45rem 1rem",
                fontSize: "0.88rem",
                cursor: "pointer",
                fontWeight: 500,
              }}
            >
              🔄 Generate Follow-Up
            </button>
            <button
              onClick={handleSendFollowups}
              disabled={loading}
              style={{
                background: "#0891b2",
                color: "white",
                border: "none",
                borderRadius: "8px",
                padding: "0.45rem 1rem",
                fontSize: "0.88rem",
                cursor: "pointer",
                fontWeight: 500,
              }}
            >
              🚀 Send Selected Follow-Ups
            </button>
          </div>
        </div>
      )}

      {/* 4. Leads Table */}
      {filteredLeads.length === 0 ? (
        <div className="empty-state" style={{ marginTop: "1rem" }}>
          <h3>No recruiter leads found</h3>
          <p>
            Add a single lead or paste multiple leads to begin. Use &quot;Generate All&quot; to draft cold emails instantly.
          </p>
        </div>
      ) : (
        <div className="tracker-table-container" style={{ overflowX: "auto" }}>
          <table className="tracker-table" style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ width: "40px", textAlign: "center" }}>
                  <input
                    type="checkbox"
                    checked={selectedIds.size === filteredLeads.length && filteredLeads.length > 0}
                    onChange={toggleSelectAll}
                    style={{ cursor: "pointer", transform: "scale(1.15)" }}
                  />
                </th>
                <th>Company</th>
                <th>Recipient Email</th>
                <th>Outreach Status</th>
                <th>Active Campaign Type</th>
                <th>Last Sent Date</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredLeads.map((lead) => {
                const statusStyle = getOutreachStatusStyle(lead.status);

                // Find active message
                const unsent = lead.messages.find((m) => !m.sentAt);
                const activeMessage = unsent || lead.messages[lead.messages.length - 1];

                const lastSentMsg = [...lead.messages].reverse().find((m) => m.sentAt);
                const lastSentDate = lastSentMsg?.sentAt
                  ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(
                      new Date(lastSentMsg.sentAt)
                    )
                  : "-";

                return (
                  <tr key={lead.id} className="tracker-row">
                    <td style={{ textAlign: "center", verticalAlign: "middle" }}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(lead.id)}
                        onChange={() => toggleSelect(lead.id)}
                        style={{ cursor: "pointer", transform: "scale(1.15)" }}
                      />
                    </td>
                    <td className="company-col" style={{ fontWeight: 600 }}>
                      {lead.companyName}
                    </td>
                    <td>{lead.recipientEmail}</td>
                    <td>
                      <span
                        className="status-dropdown-trigger"
                        style={{
                          background: statusStyle.bg,
                          color: statusStyle.text,
                          padding: "0.3rem 0.85rem",
                          fontSize: "0.78rem",
                          fontWeight: 600,
                          borderRadius: "999px",
                          display: "inline-flex",
                          alignItems: "center",
                          cursor: "default",
                        }}
                      >
                        {statusStyle.label}
                      </span>
                    </td>
                    <td>
                      {activeMessage ? (
                        <span style={{ fontSize: "0.88rem", fontWeight: 500, color: "var(--muted)" }}>
                          {activeMessage.type === "INITIAL" ? "Cold Draft" : `Follow-up ${activeMessage.type.split("_")[1]}`}
                          {!activeMessage.sentAt && <span style={{ color: "#d97706", marginLeft: "4px" }}>(Draft)</span>}
                        </span>
                      ) : (
                        <span style={{ fontStyle: "italic", color: "var(--border)", fontSize: "0.85rem" }}>None Generated</span>
                      )}
                    </td>
                    <td>{lastSentDate}</td>
                    <td style={{ textAlign: "right" }}>
                      <div style={{ display: "inline-flex", gap: "0.35rem" }}>
                        {activeMessage && (
                          <button
                            onClick={() => handleOpenReviewModal(lead)}
                            style={{
                              background: "transparent",
                              border: "1px solid var(--border)",
                              borderRadius: "8px",
                              padding: "0.35rem 0.75rem",
                              fontSize: "0.82rem",
                              cursor: "pointer",
                              color: "var(--text)",
                              fontWeight: 500,
                            }}
                            title="Review generated email text"
                          >
                            👁️ Review
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteLead(lead.id)}
                          style={{
                            background: "transparent",
                            border: "1px solid transparent",
                            borderRadius: "8px",
                            padding: "0.35rem 0.5rem",
                            fontSize: "0.82rem",
                            cursor: "pointer",
                            color: "#dc2626",
                          }}
                          title="Delete Lead"
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

      {/* 5. ADD LEADS MODAL */}
      {showAddModal && (
        <div className="glass-modal-overlay">
          <div className="glass-modal-content" style={{ width: "580px" }}>
            <div className="glass-modal-header" style={{ borderBottom: "1px solid var(--border)", padding: "1.25rem 1.5rem" }}>
              <h3 style={{ fontSize: "1.25rem", fontWeight: 600, margin: 0 }}>Add Recruiter Leads</h3>
              <button
                onClick={() => setShowAddModal(false)}
                style={{ background: "transparent", border: "none", fontSize: "1.2rem", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>

            {/* Toggle Modes */}
            <div style={{ display: "flex", borderBottom: "1px solid var(--border)" }}>
              <button
                onClick={() => setAddMode("single")}
                style={{
                  flex: 1,
                  padding: "0.75rem",
                  border: "none",
                  background: addMode === "single" ? "rgba(49, 37, 24, 0.04)" : "transparent",
                  fontWeight: addMode === "single" ? 600 : 400,
                  color: addMode === "single" ? "var(--accent)" : "var(--muted)",
                  borderBottom: addMode === "single" ? "2px solid var(--accent)" : "none",
                  cursor: "pointer",
                }}
              >
                Single Recruiter
              </button>
              <button
                onClick={() => setAddMode("bulk")}
                style={{
                  flex: 1,
                  padding: "0.75rem",
                  border: "none",
                  background: addMode === "bulk" ? "rgba(49, 37, 24, 0.04)" : "transparent",
                  fontWeight: addMode === "bulk" ? 600 : 400,
                  color: addMode === "bulk" ? "var(--accent)" : "var(--muted)",
                  borderBottom: addMode === "bulk" ? "2px solid var(--accent)" : "none",
                  cursor: "pointer",
                }}
              >
                Bulk Copy/Paste
              </button>
              <button
                onClick={() => setAddMode("image")}
                style={{
                  flex: 1,
                  padding: "0.75rem",
                  border: "none",
                  background: addMode === "image" ? "rgba(49, 37, 24, 0.04)" : "transparent",
                  fontWeight: addMode === "image" ? 600 : 400,
                  color: addMode === "image" ? "var(--accent)" : "var(--muted)",
                  borderBottom: addMode === "image" ? "2px solid var(--accent)" : "none",
                  cursor: "pointer",
                }}
              >
                📸 Add via Image/Screenshot
              </button>
            </div>

            <div className="glass-modal-body" style={{ padding: "1.5rem" }}>
              {addMode === "single" && (
                <form onSubmit={handleAddSingleLead} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "var(--muted)", marginBottom: "4px" }}>
                      Company Name *
                    </label>
                    <input
                      type="text"
                      placeholder="Stripe, Apple, etc."
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      required
                      style={{
                        width: "100%",
                        padding: "0.6rem 0.85rem",
                        borderRadius: "10px",
                        border: "1px solid var(--border)",
                        fontFamily: "inherit",
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "var(--muted)", marginBottom: "4px" }}>
                      Recruiter/Contact Email *
                    </label>
                    <input
                      type="email"
                      placeholder="recruiter@company.com"
                      value={recipientEmail}
                      onChange={(e) => setRecipientEmail(e.target.value)}
                      required
                      style={{
                        width: "100%",
                        padding: "0.6rem 0.85rem",
                        borderRadius: "10px",
                        border: "1px solid var(--border)",
                        fontFamily: "inherit",
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "var(--muted)", marginBottom: "4px" }}>
                      Job Description / Requirements *
                    </label>
                    <textarea
                      placeholder="Paste the target job description or requirements here..."
                      value={jobDescription}
                      onChange={(e) => setJobDescription(e.target.value)}
                      required
                      rows={6}
                      style={{
                        width: "100%",
                        padding: "0.6rem 0.85rem",
                        borderRadius: "10px",
                        border: "1px solid var(--border)",
                        fontFamily: "inherit",
                        resize: "vertical",
                      }}
                    />
                  </div>

                  <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end", marginTop: "1rem" }}>
                    <button
                      type="button"
                      onClick={() => setShowAddModal(false)}
                      style={{
                        padding: "0.5rem 1rem",
                        border: "1px solid var(--border)",
                        borderRadius: "8px",
                        background: "transparent",
                        cursor: "pointer",
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      style={{
                        padding: "0.5rem 1.25rem",
                        background: "var(--accent)",
                        color: "white",
                        border: "none",
                        borderRadius: "8px",
                        cursor: "pointer",
                        fontWeight: 500,
                      }}
                    >
                      Add Lead
                    </button>
                  </div>
                </form>
              )}
              {addMode === "bulk" && (
                <form onSubmit={handleAddBulkLeads} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "var(--muted)", marginBottom: "8px" }}>
                      Format Options
                    </label>
                    <div style={{ display: "flex", gap: "1rem", marginBottom: "0.5rem" }}>
                      <label style={{ display: "flex", alignItems: "center", gap: "0.35rem", cursor: "pointer" }}>
                        <input
                          type="radio"
                          name="bulkFormat"
                          checked={bulkFormat === "json"}
                          onChange={() => setBulkFormat("json")}
                        />
                        JSON Array
                      </label>
                      <label style={{ display: "flex", alignItems: "center", gap: "0.35rem", cursor: "pointer" }}>
                        <input
                          type="radio"
                          name="bulkFormat"
                          checked={bulkFormat === "csv"}
                          onChange={() => setBulkFormat("csv")}
                        />
                        CSV Format (Company,Email,Job Description)
                      </label>
                    </div>
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "var(--muted)", marginBottom: "4px" }}>
                      Data Paste *
                    </label>
                    <textarea
                      placeholder={
                        bulkFormat === "json"
                          ? `[\n  {\n    "companyName": "Stripe",\n    "recipientEmail": "recruiter@stripe.com",\n    "jobDescription": "Full stack engineer React node..."\n  }\n]`
                          : "Google,recruiter@google.com,We are looking for frontend engineer...\nMeta,hr@meta.com,Senior backend architect..."
                      }
                      value={bulkInput}
                      onChange={(e) => setBulkInput(e.target.value)}
                      required
                      rows={10}
                      style={{
                        width: "100%",
                        padding: "0.6rem 0.85rem",
                        borderRadius: "10px",
                        border: "1px solid var(--border)",
                        fontFamily: "monospace",
                        fontSize: "0.85rem",
                        resize: "vertical",
                      }}
                    />
                  </div>

                  <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end", marginTop: "1rem" }}>
                    <button
                      type="button"
                      onClick={() => setShowAddModal(false)}
                      style={{
                        padding: "0.5rem 1rem",
                        border: "1px solid var(--border)",
                        borderRadius: "8px",
                        background: "transparent",
                        cursor: "pointer",
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      style={{
                        padding: "0.5rem 1.25rem",
                        background: "var(--accent)",
                        color: "white",
                        border: "none",
                        borderRadius: "8px",
                        cursor: "pointer",
                        fontWeight: 500,
                      }}
                    >
                      Parse & Bulk Add
                    </button>
                  </div>
                </form>
              )}
              {addMode === "image" && (
                <form onSubmit={handleExtractFromImage} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                  <div
                    style={{
                      border: "2px dashed var(--border)",
                      borderRadius: "12px",
                      padding: "2rem",
                      textAlign: "center",
                      background: "rgba(0,0,0,0.01)",
                      cursor: "pointer",
                      position: "relative",
                      transition: "all 0.2s ease"
                    }}
                  >
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange}
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        width: "100%",
                        height: "100%",
                        opacity: 0,
                        cursor: "pointer"
                      }}
                    />
                    <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>📸</div>
                    <p style={{ fontWeight: 500, margin: "0 0 4px 0", color: "var(--text)" }}>
                      {imageFile ? imageFile.name : "Click or drag an image here to upload"}
                    </p>
                    <p style={{ fontSize: "0.8rem", color: "var(--muted)", margin: 0 }}>
                      Supports PNG, JPG, or screenshots of job listings
                    </p>
                  </div>

                  {imagePreview && (
                    <div style={{ textAlign: "center", margin: "0.5rem 0" }}>
                      <img
                        src={imagePreview}
                        alt="Preview"
                        style={{
                          maxWidth: "100%",
                          maxHeight: "180px",
                          borderRadius: "8px",
                          boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                          objectFit: "contain"
                        }}
                      />
                    </div>
                  )}

                  <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end", marginTop: "1rem" }}>
                    <button
                      type="button"
                      onClick={() => {
                        setImageFile(null);
                        setImagePreview(null);
                        setShowAddModal(false);
                      }}
                      style={{
                        padding: "0.5rem 1rem",
                        border: "1px solid var(--border)",
                        borderRadius: "8px",
                        background: "transparent",
                        cursor: "pointer",
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={extractingImage || !imagePreview}
                      style={{
                        padding: "0.5rem 1.25rem",
                        background: "#4f46e5",
                        color: "white",
                        border: "none",
                        borderRadius: "8px",
                        cursor: "pointer",
                        fontWeight: 600,
                        opacity: extractingImage || !imagePreview ? 0.6 : 1,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "0.5rem"
                      }}
                    >
                      {extractingImage ? "✨ AI Extracting..." : "✨ Extract Lead with Gemini"}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 6. REVIEW & EDIT EMAIL MODAL */}
      {selectedLead && editingMessage && (
        <div className="glass-modal-overlay">
          <div className="glass-modal-content" style={{ width: "650px" }}>
            <div className="glass-modal-header" style={{ borderBottom: "1px solid var(--border)", padding: "1.25rem 1.5rem" }}>
              <div>
                <h3 style={{ fontSize: "1.2rem", fontWeight: 600, margin: 0 }}>Review Email Campaign</h3>
                <p style={{ margin: "4px 0 0 0", fontSize: "0.85rem", color: "var(--muted)" }}>
                  Recruiter Contact: <strong>{selectedLead.recipientEmail}</strong> for <strong>{selectedLead.companyName}</strong>
                </p>
              </div>
              <button
                onClick={() => {
                  setSelectedLead(null);
                  setEditingMessage(null);
                }}
                style={{ background: "transparent", border: "none", fontSize: "1.2rem", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>

            <div className="glass-modal-body" style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
              {editingMessage.sentAt && (
                <div
                  style={{
                    background: "#ecfdf5",
                    border: "1px solid #059669",
                    borderRadius: "10px",
                    padding: "0.65rem 1rem",
                    fontSize: "0.88rem",
                    color: "#047857",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.4rem",
                  }}
                >
                  ✔ This email was successfully sent on {new Date(editingMessage.sentAt).toLocaleString()}
                </div>
              )}

              <div>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "var(--muted)", marginBottom: "4px" }}>
                  Subject Line
                </label>
                <input
                  type="text"
                  value={editingMessage.subject}
                  onChange={(e) => setEditingMessage({ ...editingMessage, subject: e.target.value })}
                  disabled={!!editingMessage.sentAt}
                  style={{
                    width: "100%",
                    padding: "0.6rem 0.85rem",
                    borderRadius: "10px",
                    border: "1px solid var(--border)",
                    fontFamily: "inherit",
                    fontWeight: 500,
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "var(--muted)", marginBottom: "4px" }}>
                  Email Body
                </label>
                <textarea
                  value={editingMessage.body}
                  onChange={(e) => setEditingMessage({ ...editingMessage, body: e.target.value })}
                  disabled={!!editingMessage.sentAt}
                  rows={14}
                  style={{
                    width: "100%",
                    padding: "0.75rem 0.9rem",
                    borderRadius: "12px",
                    border: "1px solid var(--border)",
                    fontFamily: "monospace",
                    fontSize: "0.9rem",
                    lineHeight: 1.5,
                    resize: "vertical",
                  }}
                />
              </div>

              <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end", marginTop: "1rem" }}>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedLead(null);
                    setEditingMessage(null);
                  }}
                  style={{
                    padding: "0.5rem 1rem",
                    border: "1px solid var(--border)",
                    borderRadius: "8px",
                    background: "transparent",
                    cursor: "pointer",
                  }}
                >
                  Close
                </button>

                {!editingMessage.sentAt && (
                  <>
                    <button
                      type="button"
                      onClick={handleSaveMessageEdits}
                      style={{
                        padding: "0.5rem 1.25rem",
                        background: "#4f46e5",
                        color: "white",
                        border: "none",
                        borderRadius: "8px",
                        cursor: "pointer",
                        fontWeight: 500,
                      }}
                    >
                      💾 Save Changes
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSendSingleEmail(editingMessage.id)}
                      disabled={loading}
                      style={{
                        padding: "0.5rem 1.25rem",
                        background: "#059669",
                        color: "white",
                        border: "none",
                        borderRadius: "8px",
                        cursor: "pointer",
                        fontWeight: 500,
                        opacity: loading ? 0.6 : 1,
                      }}
                    >
                      🚀 Send Now
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 6. SECURITY AUTHENTICATION PASSCODE MODAL */}
      {showAuthModal && (
        <div 
          className="glass-modal-overlay" 
          style={{ 
            position: "fixed",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            background: "rgba(15, 23, 42, 0.4)",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
          }}
        >
          <div 
            className="glass-modal-content" 
            style={{ 
              width: "420px", 
              background: "rgba(255, 255, 255, 0.95)",
              border: "1px solid rgba(229, 231, 235, 0.5)",
              borderRadius: "20px",
              boxShadow: "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)",
              padding: "2rem",
              display: "flex",
              flexDirection: "column",
              gap: "1.5rem",
            }}
          >
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>🔒</div>
              <h3 style={{ fontSize: "1.35rem", fontWeight: 700, color: "#1e293b", margin: 0 }}>Security Verification</h3>
              <p style={{ fontSize: "0.88rem", color: "#64748b", marginTop: "0.5rem", lineHeight: 1.4 }}>
                A secure passcode is required to send emails and manage outreach campaigns from your account.
              </p>
            </div>

            <form onSubmit={handleAuthSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, color: "#475569", marginBottom: "6px" }}>
                  Enter Security Passcode
                </label>
                <div style={{ display: "flex", position: "relative" }}>
                  <input
                    type={showPasscodeText ? "text" : "password"}
                    placeholder="••••••••••••"
                    value={passcodeInput}
                    onChange={(e) => setPasscodeInput(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "0.7rem 2.5rem 0.7rem 0.9rem",
                      borderRadius: "10px",
                      border: "1px solid #cbd5e1",
                      fontSize: "0.95rem",
                      outline: "none",
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasscodeText(!showPasscodeText)}
                    style={{
                      position: "absolute",
                      right: "10px",
                      top: "50%",
                      transform: "translateY(-50%)",
                      background: "transparent",
                      border: "none",
                      cursor: "pointer",
                      fontSize: "1.1rem",
                      color: "#64748b",
                      padding: "4px",
                    }}
                    title={showPasscodeText ? "Hide passcode" : "Show passcode"}
                  >
                    {showPasscodeText ? "👁️" : "👁️‍🗨️"}
                  </button>
                </div>
              </div>

              {authError && (
                <div 
                  style={{ 
                    color: "#ef4444", 
                    fontSize: "0.8rem", 
                    fontWeight: 500,
                    background: "#fef2f2",
                    padding: "0.5rem 0.75rem",
                    borderRadius: "8px",
                    border: "1px solid #fee2e2",
                    lineHeight: 1.3,
                  }}
                >
                  ⚠️ {authError}
                </div>
              )}

              <button
                type="submit"
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  background: "linear-gradient(to right, #4f46e5, #6366f1)",
                  color: "white",
                  border: "none",
                  borderRadius: "10px",
                  fontSize: "0.95rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  boxShadow: "0 4px 6px -1px rgb(79 70 229 / 0.1)",
                }}
              >
                Authenticate Session
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

