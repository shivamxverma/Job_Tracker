"use client";

import React, { useState, useEffect } from "react";

interface LeadLog {
  id: string;
  companyName: string;
  recipientEmail: string;
  jobDescription: string;
  status: "READY" | "SENDING" | "SENT" | "FAILED";
  createdAt: string;
}

interface MessageLog {
  id: string;
  leadId: string;
  type: string;
  subject: string;
  body: string;
  sentAt: string | null;
  createdAt: string;
  lead: LeadLog;
}

interface ParsedRecipient {
  id: string;
  email: string;
  name: string;
  company: string;
  status: "pending" | "sending" | "success" | "error";
  errorDetails?: string;
}

export function ColdMailerBoard() {
  const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

  // Tab State: "single", "campaign", "history"
  const [activeSubTab, setActiveSubTab] = useState<"single" | "campaign" | "history">("single");

  // Loading & Error States
  const [loading, setLoading] = useState(false);
  const [apiLogs, setApiLogs] = useState<MessageLog[]>([]);
  const [activeLogDetail, setActiveLogDetail] = useState<MessageLog | null>(null);

  // 1. Single Send State
  const [singleEmail, setSingleEmail] = useState("");
  const [singleName, setSingleName] = useState("");
  const [singleCompany, setSingleCompany] = useState("");
  const [singleSubject, setSingleSubject] = useState("Question about {company} engineering team");
  const [singleBody, setSingleBody] = useState("Hi {name},\n\nI hope you're having a great week!\n\nI was looking into the engineering group at {company} and would love to ask a couple of quick questions about your team culture.\n\nBest,\nShivam");
  const [singleStatus, setSingleStatus] = useState<{ type: "idle" | "success" | "error"; message: string }>({ type: "idle", message: "" });

  // 2. Campaign State
  const [importText, setImportText] = useState("");
  const [parsedRecipients, setParsedRecipients] = useState<ParsedRecipient[]>([]);
  const [campaignSubjectTemplate, setCampaignSubjectTemplate] = useState("Quick question, {name}!");
  const [campaignBodyTemplate, setCampaignBodyTemplate] = useState("Hello {name},\n\nI saw your work at {company} and wanted to reach out. I'm a CSE student with strong experience in AI backend engineering.\n\nWould you be open to a quick chat?\n\nBest regards,\nShivam");
  const [selectedRecipientId, setSelectedRecipientId] = useState<string | null>(null);
  
  // Campaign Execution Settings
  const [sendingDelay, setSendingDelay] = useState(3); // Seconds
  const [campaignRunning, setCampaignRunning] = useState(false);
  const [campaignProgress, setCampaignProgress] = useState({ current: 0, total: 0 });
  const [campaignLogs, setCampaignLogs] = useState<string[]>([]);

  // Variable Resolver Helper
  const resolveTemplate = (template: string, name: string, company: string) => {
    return template
      .replace(/{name}/g, name || "Hiring Manager")
      .replace(/{company}/g, company || "Company");
  };

  // Fetch History Logs
  const fetchLogs = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/outreach-flow/cold-mail/logs`, {
        headers: { "bypass-tunnel-reminder": "true" },
      });
      const json = await res.json();
      if (json.success) {
        setApiLogs(json.data);
      }
    } catch (err) {
      console.error("Failed to fetch cold mail logs:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeSubTab === "history") {
      fetchLogs();
    }
  }, [activeSubTab]); // eslint-disable-line react-hooks/exhaustive-deps

  // Single Send Handler
  const handleSingleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!singleEmail || !singleSubject || !singleBody) {
      setSingleStatus({ type: "error", message: "Email, Subject, and Body are required." });
      return;
    }

    setLoading(true);
    setSingleStatus({ type: "idle", message: "" });

    try {
      const resolvedSubject = resolveTemplate(singleSubject, singleName, singleCompany);
      const resolvedBody = resolveTemplate(singleBody, singleName, singleCompany);

      const res = await fetch(`${API_BASE}/outreach-flow/cold-mail/send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "bypass-tunnel-reminder": "true",
        },
        body: JSON.stringify({
          email: singleEmail,
          subject: resolvedSubject,
          body: resolvedBody,
          name: singleName,
          company: singleCompany,
        }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        setSingleStatus({ type: "success", message: `Email sent successfully to ${singleEmail}!` });
        // Clear fields on success
        setSingleEmail("");
        setSingleName("");
        setSingleCompany("");
      } else {
        setSingleStatus({ type: "error", message: json.message || "Failed to dispatch email." });
      }
    } catch {
      setSingleStatus({ type: "error", message: "Network error. Make sure your backend server is active." });
    } finally {
      setLoading(false);
    }
  };

  // Parser Handler for CSV, JSON, TXT
  const handleParseImport = () => {
    if (!importText.trim()) return;

    let list: ParsedRecipient[] = [];
    const text = importText.trim();

    try {
      // 1. Try JSON parsing
      if (text.startsWith("[") && text.endsWith("]")) {
        const json = JSON.parse(text);
        if (Array.isArray(json)) {
          list = json.map((item: { email?: string; recipientEmail?: string; name?: string; recipientName?: string; company?: string; companyName?: string }, idx) => ({
            id: `json-${idx}-${Date.now()}`,
            email: item.email || item.recipientEmail || "",
            name: item.name || item.recipientName || "Hiring Manager",
            company: item.company || item.companyName || "Company",
            status: "pending" as const,
          }));
        }
      }
    } catch {
      // Parsing JSON failed, fallback to CSV or TXT
    }

    // 2. CSV parsing fallback
    if (list.length === 0) {
      const lines = text.split("\n").filter((l) => l.trim().length > 0);
      if (lines.length > 0) {
        const header = lines[0].toLowerCase();
        
        // Detect if the first line is indeed a CSV header
        const isCsvHeader = header.includes("email") || header.includes("name") || header.includes("company");
        
        let startIdx = 0;
        let emailIdx = 0;
        let nameIdx = 1;
        let companyIdx = 2;

        if (isCsvHeader) {
          startIdx = 1;
          const cols = header.split(",").map(c => c.trim());
          emailIdx = cols.findIndex(c => c.includes("email"));
          nameIdx = cols.findIndex(c => c.includes("name"));
          companyIdx = cols.findIndex(c => c.includes("company"));
          
          if (emailIdx === -1) emailIdx = 0;
          if (nameIdx === -1) nameIdx = 1;
          if (companyIdx === -1) companyIdx = 2;
        }

        const csvLines = lines.slice(startIdx);
        csvLines.forEach((line, idx) => {
          const cols = line.split(",").map(c => c.trim());
          if (cols.length > 0 && cols[emailIdx || 0]) {
            list.push({
              id: `csv-${idx}-${Date.now()}`,
              email: cols[emailIdx] || "",
              name: cols[nameIdx] || "Hiring Manager",
              company: cols[companyIdx] || "Company",
              status: "pending" as const,
            });
          }
        });
      }
    }

    // 3. Raw Plain-Text Email list fallback (if both fails or empty)
    if (list.length === 0) {
      const emailMatches = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
      list = Array.from(new Set(emailMatches)).map((email, idx) => ({
        id: `txt-${idx}-${Date.now()}`,
        email,
        name: "Hiring Manager",
        company: "Company",
        status: "pending" as const,
      }));
    }

    // Filter out invalid items
    const validList = list.filter((r) => r.email && r.email.includes("@"));

    if (validList.length > 0) {
      setParsedRecipients(validList);
      setSelectedRecipientId(validList[0].id);
      setImportText(""); // Clear import text on successful parse
    } else {
      alert("Could not parse any valid email addresses from the text. Make sure headers or formats match.");
    }
  };

  // Run sequential campaign sends
  const runCampaign = async () => {
    if (parsedRecipients.length === 0 || campaignRunning) return;

    setCampaignRunning(true);
    setCampaignProgress({ current: 0, total: parsedRecipients.length });
    setCampaignLogs([`[INFO] Starting Campaign for ${parsedRecipients.length} recipients. Delay: ${sendingDelay}s.`]);

    const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    for (let i = 0; i < parsedRecipients.length; i++) {
      const recipient = parsedRecipients[i];

      // Update status in list to sending
      setParsedRecipients((prev) =>
        prev.map((r) => (r.id === recipient.id ? { ...r, status: "sending" } : r))
      );

      const resolvedSubject = resolveTemplate(campaignSubjectTemplate, recipient.name, recipient.company);
      const resolvedBody = resolveTemplate(campaignBodyTemplate, recipient.name, recipient.company);

      const timestamp = new Date().toLocaleTimeString();
      setCampaignLogs((prev) => [...prev, `[${timestamp}] Sending to ${recipient.email}...`]);

      try {
        const res = await fetch(`${API_BASE}/outreach-flow/cold-mail/send`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "bypass-tunnel-reminder": "true",
          },
          body: JSON.stringify({
            email: recipient.email,
            subject: resolvedSubject,
            body: resolvedBody,
            name: recipient.name,
            company: recipient.company,
          }),
        });

        const json = await res.json();

        if (res.ok && json.success) {
          setParsedRecipients((prev) =>
            prev.map((r) => (r.id === recipient.id ? { ...r, status: "success" } : r))
          );
          setCampaignLogs((prev) => [...prev, `[${timestamp}] Sent to ${recipient.email} successfully ✅`]);
        } else {
          setParsedRecipients((prev) =>
            prev.map((r) =>
              r.id === recipient.id ? { ...r, status: "error", errorDetails: json.message || "Failed" } : r
            )
          );
          setCampaignLogs((prev) => [...prev, `[${timestamp}] Failed to send to ${recipient.email} ❌ (Error: ${json.message || "Unknown error"})`]);
        }
      } catch {
        setParsedRecipients((prev) =>
          prev.map((r) =>
            r.id === recipient.id ? { ...r, status: "error", errorDetails: "Network error" } : r
          )
        );
        setCampaignLogs((prev) => [...prev, `[${timestamp}] Network Error connecting to backend for ${recipient.email} ❌`]);
      }

      setCampaignProgress((prev) => ({ ...prev, current: i + 1 }));

      // Wait delay for next send
      if (i < parsedRecipients.length - 1) {
        setCampaignLogs((prev) => [...prev, `[WAIT] Cooling down for ${sendingDelay} seconds...`]);
        await sleep(sendingDelay * 1000);
      }
    }

    setCampaignLogs((prev) => [...prev, "[INFO] Campaign Completed."]);
    setCampaignRunning(false);
  };

  const getRecipientPreview = () => {
    const selected = parsedRecipients.find((r) => r.id === selectedRecipientId);
    if (!selected) return null;
    return {
      subject: resolveTemplate(campaignSubjectTemplate, selected.name, selected.company),
      body: resolveTemplate(campaignBodyTemplate, selected.name, selected.company),
    };
  };

  const activePreview = getRecipientPreview();

  return (
    <div style={{ fontFamily: "Inter, system-ui, sans-serif", color: "#f8fafc" }}>
      
      {/* Sub Header tabs */}
      <div 
        style={{ 
          display: "flex", 
          gap: "1rem", 
          borderBottom: "1px solid rgba(255,255,255,0.1)", 
          paddingBottom: "1rem",
          marginBottom: "2rem" 
        }}
      >
        <button
          onClick={() => setActiveSubTab("single")}
          style={{
            background: activeSubTab === "single" ? "rgba(99,102,241,0.2)" : "transparent",
            color: activeSubTab === "single" ? "#a5b4fc" : "#94a3b8",
            border: activeSubTab === "single" ? "1px solid rgba(99,102,241,0.4)" : "1px solid transparent",
            padding: "0.5rem 1.2rem",
            borderRadius: "12px",
            cursor: "pointer",
            fontWeight: 600,
            transition: "all 0.2s ease"
          }}
        >
          Single Send
        </button>
        <button
          onClick={() => setActiveSubTab("campaign")}
          style={{
            background: activeSubTab === "campaign" ? "rgba(99,102,241,0.2)" : "transparent",
            color: activeSubTab === "campaign" ? "#a5b4fc" : "#94a3b8",
            border: activeSubTab === "campaign" ? "1px solid rgba(99,102,241,0.4)" : "1px solid transparent",
            padding: "0.5rem 1.2rem",
            borderRadius: "12px",
            cursor: "pointer",
            fontWeight: 600,
            transition: "all 0.2s ease"
          }}
        >
          Bulk Importer & Campaign
        </button>
        <button
          onClick={() => setActiveSubTab("history")}
          style={{
            background: activeSubTab === "history" ? "rgba(99,102,241,0.2)" : "transparent",
            color: activeSubTab === "history" ? "#a5b4fc" : "#94a3b8",
            border: activeSubTab === "history" ? "1px solid rgba(99,102,241,0.4)" : "1px solid transparent",
            padding: "0.5rem 1.2rem",
            borderRadius: "12px",
            cursor: "pointer",
            fontWeight: 600,
            transition: "all 0.2s ease"
          }}
        >
          Sent History Logs
        </button>
      </div>

      {/* TAB 1: SINGLE SEND */}
      {activeSubTab === "single" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2.5rem" }}>
          
          {/* Form Side */}
          <div 
            style={{ 
              background: "rgba(30, 27, 75, 0.4)", 
              border: "1px solid rgba(255,255,255,0.08)", 
              padding: "2rem", 
              borderRadius: "20px" 
            }}
          >
            <h3 style={{ fontSize: "1.25rem", color: "#f1f5f9", marginTop: 0, marginBottom: "1.5rem" }}>
              📨 Compose Direct Cold Email
            </h3>

            <form onSubmit={handleSingleSend} style={{ display: "flex", flexDirection: "column", gap: "1.2rem" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                <label style={{ fontSize: "0.85rem", color: "#94a3b8", fontWeight: 600 }}>Recipient Email *</label>
                <input
                  type="email"
                  placeholder="recruiter@company.com"
                  value={singleEmail}
                  onChange={(e) => setSingleEmail(e.target.value)}
                  required
                  style={{
                    padding: "0.75rem 1rem",
                    borderRadius: "10px",
                    border: "1px solid rgba(255,255,255,0.15)",
                    background: "rgba(15, 23, 42, 0.6)",
                    color: "#fff",
                    outline: "none",
                  }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                  <label style={{ fontSize: "0.85rem", color: "#94a3b8", fontWeight: 600 }}>Recipient Name</label>
                  <input
                    type="text"
                    placeholder="Amit Kumar"
                    value={singleName}
                    onChange={(e) => setSingleName(e.target.value)}
                    style={{
                      padding: "0.75rem 1rem",
                      borderRadius: "10px",
                      border: "1px solid rgba(255,255,255,0.15)",
                      background: "rgba(15, 23, 42, 0.6)",
                      color: "#fff",
                      outline: "none",
                    }}
                  />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                  <label style={{ fontSize: "0.85rem", color: "#94a3b8", fontWeight: 600 }}>Company Name</label>
                  <input
                    type="text"
                    placeholder="Google"
                    value={singleCompany}
                    onChange={(e) => setSingleCompany(e.target.value)}
                    style={{
                      padding: "0.75rem 1rem",
                      borderRadius: "10px",
                      border: "1px solid rgba(255,255,255,0.15)",
                      background: "rgba(15, 23, 42, 0.6)",
                      color: "#fff",
                      outline: "none",
                    }}
                  />
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                <label style={{ fontSize: "0.85rem", color: "#94a3b8", fontWeight: 600 }}>
                  Subject Line Template
                </label>
                <input
                  type="text"
                  value={singleSubject}
                  onChange={(e) => setSingleSubject(e.target.value)}
                  style={{
                    padding: "0.75rem 1rem",
                    borderRadius: "10px",
                    border: "1px solid rgba(255,255,255,0.15)",
                    background: "rgba(15, 23, 42, 0.6)",
                    color: "#fff",
                    outline: "none",
                  }}
                />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                <label style={{ fontSize: "0.85rem", color: "#94a3b8", fontWeight: 600 }}>
                  Email Body Template
                </label>
                <textarea
                  rows={8}
                  value={singleBody}
                  onChange={(e) => setSingleBody(e.target.value)}
                  style={{
                    padding: "0.75rem 1rem",
                    borderRadius: "10px",
                    border: "1px solid rgba(255,255,255,0.15)",
                    background: "rgba(15, 23, 42, 0.6)",
                    color: "#fff",
                    outline: "none",
                    fontFamily: "inherit",
                    resize: "vertical"
                  }}
                />
                <span style={{ fontSize: "0.75rem", color: "#64748b" }}>
                  Tip: Use <b>{"{name}"}</b> and <b>{"{company}"}</b> tags for dynamic placement.
                </span>
              </div>

              {singleStatus.message && (
                <div 
                  style={{ 
                    padding: "0.8rem 1rem", 
                    borderRadius: "10px", 
                    fontSize: "0.9rem",
                    fontWeight: 500,
                    background: singleStatus.type === "success" ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)",
                    color: singleStatus.type === "success" ? "#34d399" : "#f87171",
                    border: singleStatus.type === "success" ? "1px solid rgba(16,185,129,0.3)" : "1px solid rgba(239,68,68,0.3)"
                  }}
                >
                  {singleStatus.message}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                style={{
                  background: loading ? "#4b5563" : "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
                  color: "#fff",
                  border: "none",
                  padding: "0.85rem",
                  borderRadius: "12px",
                  fontWeight: 600,
                  fontSize: "1rem",
                  cursor: loading ? "not-allowed" : "pointer",
                  marginTop: "0.5rem",
                  boxShadow: "0 10px 15px -3px rgba(79, 70, 229, 0.3)"
                }}
              >
                {loading ? "Sending..." : "Send Cold Email 🚀"}
              </button>
            </form>
          </div>

          {/* Live Preview Side */}
          <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            <div 
              style={{ 
                background: "rgba(15, 23, 42, 0.4)", 
                border: "1px solid rgba(255,255,255,0.06)", 
                padding: "2rem", 
                borderRadius: "20px",
                flex: 1
              }}
            >
              <h4 style={{ fontSize: "1rem", color: "#a5b4fc", marginTop: 0, marginBottom: "1rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span>👁️</span> Live Variable Resolved Preview
              </h4>
              <p style={{ fontSize: "0.85rem", color: "#64748b", margin: "0 0 1.5rem 0" }}>
                This is exactly how your email will look when sent to the recipient:
              </p>

              <div 
                style={{ 
                  background: "rgba(15, 23, 42, 0.8)", 
                  border: "1px solid rgba(255,255,255,0.1)", 
                  borderRadius: "12px",
                  padding: "1.5rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: "1rem"
                }}
              >
                <div>
                  <div style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: 700, textTransform: "uppercase" }}>To</div>
                  <div style={{ color: "#e2e8f0", fontSize: "0.95rem" }}>{singleEmail || "recruiter@company.com"}</div>
                </div>
                
                <hr style={{ border: "0", borderTop: "1px solid rgba(255,255,255,0.1)", margin: 0 }} />

                <div>
                  <div style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: 700, textTransform: "uppercase" }}>Subject</div>
                  <div style={{ color: "#fff", fontSize: "1rem", fontWeight: 600 }}>
                    {resolveTemplate(singleSubject, singleName, singleCompany)}
                  </div>
                </div>

                <hr style={{ border: "0", borderTop: "1px solid rgba(255,255,255,0.1)", margin: 0 }} />

                <div>
                  <div style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: 700, textTransform: "uppercase", marginBottom: "0.5rem" }}>Body</div>
                  <div style={{ color: "#cbd5e1", whiteSpace: "pre-wrap", lineHeight: 1.6, fontSize: "0.95rem" }}>
                    {resolveTemplate(singleBody, singleName, singleCompany)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: BULK CAMPAIGN */}
      {activeSubTab === "campaign" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
          
          {/* Top block: Import Row */}
          <div 
            style={{ 
              background: "rgba(30, 27, 75, 0.3)", 
              border: "1px solid rgba(255,255,255,0.08)", 
              padding: "2rem", 
              borderRadius: "24px" 
            }}
          >
            <h3 style={{ fontSize: "1.25rem", color: "#f1f5f9", marginTop: 0, marginBottom: "1rem" }}>
              📥 Bulk Import Recipients List
            </h3>
            <p style={{ fontSize: "0.9rem", color: "#94a3b8", marginTop: 0, marginBottom: "1.5rem" }}>
              Paste your list below. We automatically parse **CSV** (with headers), **JSON** arrays, or **raw lists of emails**.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <textarea
                rows={4}
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                placeholder={`Example CSV:\nemail,name,company\nsam@apple.com,Sam,Apple\n\nOr JSON array:\n[{"email": "sam@apple.com", "name": "Sam", "company": "Apple"}]\n\nOr plain raw emails:\nsam@apple.com, test@microsoft.com`}
                style={{
                  padding: "1rem",
                  borderRadius: "12px",
                  border: "1px solid rgba(255,255,255,0.15)",
                  background: "rgba(15, 23, 42, 0.7)",
                  color: "#fff",
                  outline: "none",
                  fontFamily: "monospace",
                  fontSize: "0.9rem"
                }}
              />
              <button
                onClick={handleParseImport}
                style={{
                  background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
                  color: "#fff",
                  border: "none",
                  padding: "0.8rem 1.5rem",
                  borderRadius: "12px",
                  fontWeight: 600,
                  fontSize: "0.95rem",
                  cursor: "pointer",
                  alignSelf: "flex-end"
                }}
              >
                Parse & Add to Campaign ⚡
              </button>
            </div>
          </div>

          {/* Parsed Recipients & Preview Deck Grid */}
          {parsedRecipients.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "2rem" }}>
              
              {/* Left Side: Recipients Table */}
              <div 
                style={{ 
                  background: "rgba(15,23,42,0.4)", 
                  border: "1px solid rgba(255,255,255,0.06)", 
                  borderRadius: "24px",
                  padding: "2rem" 
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
                  <h4 style={{ fontSize: "1.1rem", color: "#f1f5f9", margin: 0 }}>
                    📋 Campaign Recipients ({parsedRecipients.length})
                  </h4>
                  <button 
                    onClick={() => setParsedRecipients([])} 
                    style={{ 
                      background: "transparent", 
                      color: "#f87171", 
                      border: "none", 
                      cursor: "pointer", 
                      fontSize: "0.85rem",
                      fontWeight: 600
                    }}
                  >
                    Clear List
                  </button>
                </div>

                <div style={{ overflowX: "auto", maxHeight: "400px", overflowY: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.9rem" }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.1)", color: "#94a3b8" }}>
                        <th style={{ padding: "0.75rem 0.5rem" }}>Email</th>
                        <th style={{ padding: "0.75rem 0.5rem" }}>Name</th>
                        <th style={{ padding: "0.75rem 0.5rem" }}>Company</th>
                        <th style={{ padding: "0.75rem 0.5rem", textAlign: "center" }}>Status</th>
                        <th style={{ padding: "0.75rem 0.5rem", textAlign: "center" }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsedRecipients.map((recipient) => (
                        <tr
                          key={recipient.id}
                          onClick={() => setSelectedRecipientId(recipient.id)}
                          style={{
                            borderBottom: "1px solid rgba(255,255,255,0.05)",
                            background: selectedRecipientId === recipient.id ? "rgba(99,102,241,0.1)" : "transparent",
                            cursor: "pointer",
                            transition: "background 0.2s"
                          }}
                        >
                          <td style={{ padding: "0.75rem 0.5rem", color: "#cbd5e1" }}>{recipient.email}</td>
                          <td style={{ padding: "0.75rem 0.5rem" }}>
                            <input
                              value={recipient.name}
                              onChange={(e) => {
                                const val = e.target.value;
                                setParsedRecipients(prev => prev.map(r => r.id === recipient.id ? { ...r, name: val } : r));
                              }}
                              style={{
                                background: "transparent",
                                border: "none",
                                color: "#fff",
                                width: "90%",
                                outline: "none",
                              }}
                            />
                          </td>
                          <td style={{ padding: "0.75rem 0.5rem" }}>
                            <input
                              value={recipient.company}
                              onChange={(e) => {
                                const val = e.target.value;
                                setParsedRecipients(prev => prev.map(r => r.id === recipient.id ? { ...r, company: val } : r));
                              }}
                              style={{
                                background: "transparent",
                                border: "none",
                                color: "#fff",
                                width: "90%",
                                outline: "none",
                              }}
                            />
                          </td>
                          <td style={{ padding: "0.75rem 0.5rem", textAlign: "center" }}>
                            {recipient.status === "pending" && <span style={{ color: "#94a3b8" }}>⏳</span>}
                            {recipient.status === "sending" && <span style={{ color: "#6366f1" }}>🔄</span>}
                            {recipient.status === "success" && <span style={{ color: "#34d399" }}>✅</span>}
                            {recipient.status === "error" && <span style={{ color: "#f87171" }} title={recipient.errorDetails}>❌</span>}
                          </td>
                          <td style={{ padding: "0.75rem 0.5rem", textAlign: "center" }}>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setParsedRecipients(prev => prev.filter(r => r.id !== recipient.id));
                              }}
                              style={{
                                background: "transparent",
                                border: "none",
                                color: "#64748b",
                                cursor: "pointer"
                              }}
                            >
                              🗑️
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Right Side: Templates & Preview Resolver */}
              <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
                
                {/* Templates Inputs */}
                <div 
                  style={{ 
                    background: "rgba(15,23,42,0.4)", 
                    border: "1px solid rgba(255,255,255,0.06)", 
                    borderRadius: "24px",
                    padding: "1.5rem" 
                  }}
                >
                  <h4 style={{ fontSize: "1rem", color: "#f1f5f9", marginTop: 0, marginBottom: "1rem" }}>
                    📝 Campaign Templates
                  </h4>
                  <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                      <label style={{ fontSize: "0.8rem", color: "#94a3b8" }}>Subject Template</label>
                      <input
                        value={campaignSubjectTemplate}
                        onChange={(e) => setCampaignSubjectTemplate(e.target.value)}
                        style={{
                          padding: "0.6rem 0.8rem",
                          borderRadius: "8px",
                          border: "1px solid rgba(255,255,255,0.15)",
                          background: "rgba(15, 23, 42, 0.6)",
                          color: "#fff",
                          fontSize: "0.9rem"
                        }}
                      />
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                      <label style={{ fontSize: "0.8rem", color: "#94a3b8" }}>Body Template</label>
                      <textarea
                        rows={5}
                        value={campaignBodyTemplate}
                        onChange={(e) => setCampaignBodyTemplate(e.target.value)}
                        style={{
                          padding: "0.6rem 0.8rem",
                          borderRadius: "8px",
                          border: "1px solid rgba(255,255,255,0.15)",
                          background: "rgba(15, 23, 42, 0.6)",
                          color: "#fff",
                          fontSize: "0.9rem",
                          resize: "vertical",
                          fontFamily: "inherit"
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Resolved Preview Panel */}
                {activePreview && (
                  <div 
                    style={{ 
                      background: "rgba(15,23,42,0.8)", 
                      border: "1px solid rgba(99,102,241,0.2)", 
                      borderRadius: "24px",
                      padding: "1.5rem" 
                    }}
                  >
                    <h5 style={{ fontSize: "0.95rem", color: "#a5b4fc", marginTop: 0, marginBottom: "0.8rem" }}>
                      ⚡ Preview Selected Recipient
                    </h5>
                    <div style={{ fontSize: "0.85rem", display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                      <div>
                        <span style={{ color: "#64748b", fontWeight: 600 }}>Subject: </span>
                        <span style={{ color: "#fff", fontWeight: 500 }}>{activePreview.subject}</span>
                      </div>
                      <hr style={{ border: "0", borderTop: "1px solid rgba(255,255,255,0.05)" }} />
                      <div>
                        <span style={{ color: "#64748b", fontWeight: 600, display: "block", marginBottom: "0.3rem" }}>Body:</span>
                        <div style={{ color: "#cbd5e1", whiteSpace: "pre-wrap", lineHeight: 1.5, background: "rgba(0,0,0,0.2)", padding: "0.8rem", borderRadius: "8px" }}>
                          {activePreview.body}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Campaign Send Execution Deck */}
          {parsedRecipients.length > 0 && (
            <div 
              style={{ 
                background: "rgba(30, 27, 75, 0.4)", 
                border: "1px solid rgba(99,102,241,0.2)", 
                padding: "2rem", 
                borderRadius: "24px",
                display: "grid",
                gridTemplateColumns: "1fr 1.2fr",
                gap: "2.5rem"
              }}
            >
              
              {/* Left Column: Progress Controls */}
              <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                <div>
                  <h4 style={{ fontSize: "1.2rem", color: "#f1f5f9", marginTop: 0, marginBottom: "0.5rem" }}>
                    🚀 Run Cold Email Campaign
                  </h4>
                  <p style={{ fontSize: "0.9rem", color: "#94a3b8", margin: 0 }}>
                    Execute sequential cold email dispatches with safety limits to bypass rate caps.
                  </p>
                </div>

                {/* Delay Slider */}
                <div style={{ margin: "2rem 0" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem", fontSize: "0.85rem" }}>
                    <span style={{ color: "#94a3b8" }}>Rate Limit Send Delay</span>
                    <span style={{ color: "#a5b4fc", fontWeight: 700 }}>{sendingDelay} seconds</span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={10}
                    value={sendingDelay}
                    onChange={(e) => setSendingDelay(parseInt(e.target.value))}
                    disabled={campaignRunning}
                    style={{ width: "100%", accentColor: "#6366f1" }}
                  />
                </div>

                {/* Progress Visual */}
                {campaignRunning && (
                  <div style={{ margin: "0 0 1.5rem 0" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem", fontSize: "0.85rem" }}>
                      <span style={{ color: "#cbd5e1" }}>Sending Progress</span>
                      <span>{campaignProgress.current} / {campaignProgress.total}</span>
                    </div>
                    <div style={{ background: "rgba(255,255,255,0.1)", height: "8px", borderRadius: "10px", overflow: "hidden" }}>
                      <div 
                        style={{ 
                          background: "#6366f1", 
                          height: "100%", 
                          width: `${(campaignProgress.current / campaignProgress.total) * 100}%`,
                          transition: "width 0.4s ease"
                        }}
                      />
                    </div>
                  </div>
                )}

                <button
                  onClick={runCampaign}
                  disabled={campaignRunning}
                  style={{
                    background: campaignRunning ? "#4b5563" : "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                    color: "#fff",
                    border: "none",
                    padding: "1rem",
                    borderRadius: "14px",
                    fontWeight: 700,
                    fontSize: "1.1rem",
                    cursor: campaignRunning ? "not-allowed" : "pointer",
                    boxShadow: "0 10px 15px -3px rgba(16, 185, 129, 0.3)",
                    transition: "transform 0.2s"
                  }}
                >
                  {campaignRunning ? `Running Campaign (${campaignProgress.current}/${campaignProgress.total})` : "Start Campaign 🚀"}
                </button>
              </div>

              {/* Right Column: Campaign Terminal Logs */}
              <div 
                style={{ 
                  background: "rgba(15, 23, 42, 0.8)", 
                  border: "1px solid rgba(255,255,255,0.1)", 
                  borderRadius: "18px",
                  padding: "1.5rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.75rem"
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "0.85rem", color: "#a5b4fc", fontWeight: 700, textTransform: "uppercase" }}>🖨️ Campaign Console Output</span>
                  <button 
                    onClick={() => setCampaignLogs([])} 
                    style={{ background: "transparent", color: "#64748b", border: "none", cursor: "pointer", fontSize: "0.75rem" }}
                  >
                    Clear Terminal
                  </button>
                </div>
                
                <div 
                  style={{ 
                    background: "#000", 
                    borderRadius: "10px", 
                    padding: "1rem", 
                    fontFamily: "monospace", 
                    fontSize: "0.85rem", 
                    color: "#34d399",
                    height: "220px",
                    overflowY: "auto",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.4rem",
                    border: "1px solid rgba(255,255,255,0.05)"
                  }}
                >
                  {campaignLogs.length === 0 ? (
                    <span style={{ color: "#64748b" }}>[IDLE] Awaiting campaign startup...</span>
                  ) : (
                    campaignLogs.map((log, idx) => (
                      <div key={idx} style={{ wordBreak: "break-all" }}>{log}</div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: HISTORY */}
      {activeSubTab === "history" && (
        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "2.5rem" }}>
          
          {/* Logs Table */}
          <div 
            style={{ 
              background: "rgba(30, 27, 75, 0.3)", 
              border: "1px solid rgba(255,255,255,0.08)", 
              padding: "2rem", 
              borderRadius: "24px" 
            }}
          >
            <h3 style={{ fontSize: "1.25rem", color: "#f1f5f9", marginTop: 0, marginBottom: "1.5rem" }}>
              📜 Historical Cold Mailing Logs
            </h3>

            {loading && apiLogs.length === 0 ? (
              <p style={{ color: "#64748b", fontSize: "0.95rem" }}>Fetching outbox history logs...</p>
            ) : apiLogs.length === 0 ? (
              <p style={{ color: "#64748b", fontSize: "0.95rem" }}>No cold mail logs found in the database. Run your first campaign!</p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.9rem" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.1)", color: "#94a3b8" }}>
                      <th style={{ padding: "0.75rem" }}>Recipient</th>
                      <th style={{ padding: "0.75rem" }}>Subject</th>
                      <th style={{ padding: "0.75rem", textAlign: "center" }}>Status</th>
                      <th style={{ padding: "0.75rem" }}>Sent At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {apiLogs.map((log) => (
                      <tr
                        key={log.id}
                        onClick={() => setActiveLogDetail(log)}
                        style={{
                          borderBottom: "1px solid rgba(255,255,255,0.05)",
                          background: activeLogDetail?.id === log.id ? "rgba(99,102,241,0.1)" : "transparent",
                          cursor: "pointer",
                          transition: "background 0.2s"
                        }}
                      >
                        <td style={{ padding: "0.75rem" }}>
                          <div style={{ fontWeight: 600, color: "#fff" }}>{log.lead.recipientEmail}</div>
                          <div style={{ fontSize: "0.75rem", color: "#94a3b8" }}>{log.lead.companyName}</div>
                        </td>
                        <td style={{ padding: "0.75rem", color: "#cbd5e1" }}>{log.subject}</td>
                        <td style={{ padding: "0.75rem", textAlign: "center" }}>
                          {log.lead.status === "SENT" ? (
                            <span style={{ color: "#34d399", background: "rgba(16,185,129,0.1)", padding: "0.2rem 0.5rem", borderRadius: "8px", fontSize: "0.8rem", fontWeight: 600 }}>SENT</span>
                          ) : (
                            <span style={{ color: "#f87171", background: "rgba(239,68,68,0.1)", padding: "0.2rem 0.5rem", borderRadius: "8px", fontSize: "0.8rem", fontWeight: 600 }}>FAILED</span>
                          )}
                        </td>
                        <td style={{ padding: "0.75rem", color: "#64748b", fontSize: "0.8rem" }}>
                          {log.sentAt ? new Date(log.sentAt).toLocaleString() : new Date(log.createdAt).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Log Details Display */}
          <div>
            {activeLogDetail ? (
              <div 
                style={{ 
                  background: "rgba(15, 23, 42, 0.4)", 
                  border: "1px solid rgba(255,255,255,0.06)", 
                  padding: "2rem", 
                  borderRadius: "24px" 
                }}
              >
                <h4 style={{ fontSize: "1.1rem", color: "#a5b4fc", marginTop: 0, marginBottom: "1.5rem" }}>
                  🔍 Outbound Email details
                </h4>

                <div style={{ display: "flex", flexDirection: "column", gap: "1.2rem", fontSize: "0.9rem" }}>
                  <div>
                    <div style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: 700, textTransform: "uppercase" }}>To Email</div>
                    <div style={{ color: "#fff", fontSize: "1rem", marginTop: "0.2rem" }}>{activeLogDetail.lead.recipientEmail}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: 700, textTransform: "uppercase" }}>Company / Target</div>
                    <div style={{ color: "#fff", fontSize: "1rem", marginTop: "0.2rem" }}>{activeLogDetail.lead.companyName}</div>
                  </div>
                  <hr style={{ border: "0", borderTop: "1px solid rgba(255,255,255,0.05)" }} />
                  <div>
                    <div style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: 700, textTransform: "uppercase" }}>Subject Line</div>
                    <div style={{ color: "#fff", fontSize: "1rem", fontWeight: 600, marginTop: "0.2rem" }}>{activeLogDetail.subject}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: 700, textTransform: "uppercase", marginBottom: "0.4rem" }}>Message Body</div>
                    <div 
                      style={{ 
                        color: "#cbd5e1", 
                        whiteSpace: "pre-wrap", 
                        lineHeight: 1.6, 
                        background: "rgba(0,0,0,0.3)", 
                        padding: "1rem", 
                        borderRadius: "10px",
                        fontSize: "0.9rem",
                        border: "1px solid rgba(255,255,255,0.05)" 
                      }}
                    >
                      {activeLogDetail.body}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div 
                style={{ 
                  background: "rgba(15, 23, 42, 0.2)", 
                  border: "1px dashed rgba(255,255,255,0.1)", 
                  height: "300px", 
                  borderRadius: "24px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#64748b",
                  fontWeight: 500
                }}
              >
                👈 Select an outbox record to view detailed body
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
