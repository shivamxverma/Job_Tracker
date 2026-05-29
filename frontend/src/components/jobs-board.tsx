"use client";

import { useMemo, useState } from "react";

import { JobCard, getStatusStyle } from "@/components/job-card";
import type { Job } from "@/types/job";

type JobsBoardProps = {
  jobs: Job[];
};

export function JobsBoard({ jobs: initialJobs }: JobsBoardProps) {
  // Main reactive database state
  const [allJobs, setAllJobs] = useState<Job[]>(initialJobs);

  // Layout Tab State: "explore" or "tracker"
  const [activeTab, setActiveTab] = useState<"explore" | "tracker">("explore");

  // Search & Filter state for Explore
  const [query, setQuery] = useState("");
  const [entryLevelOnly, setEntryLevelOnly] = useState(true);

  // Search & Filter state for Tracker
  const [trackerQuery, setTrackerQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Modals state
  const [selectedJobForTrack, setSelectedJobForTrack] = useState<Job | null>(null);
  const [showManualModal, setShowManualModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Tracking Form Fields
  const [trackStatus, setTrackStatus] = useState("Applied");
  const [trackPlatform, setTrackPlatform] = useState("");
  const [trackNotes, setTrackNotes] = useState("");

  // Manual Creation Fields
  const [manualTitle, setManualTitle] = useState("");
  const [manualCompany, setManualCompany] = useState("");
  const [manualLocation, setManualLocation] = useState("");
  const [manualSalary, setManualSalary] = useState("");
  const [manualUrl, setManualUrl] = useState("");
  const [manualPlatform, setManualPlatform] = useState("College");
  const [manualStatus, setManualStatus] = useState("Applied");
  const [manualNotes, setManualNotes] = useState("");

  // Inline dropdown status state (which job ID is currently opening the inline picker)
  const [activeInlineDropdownId, setActiveInlineDropdownId] = useState<string | null>(null);

  // 1. Process scraped jobs list for the Explore Board
  const filteredJobs = useMemo(() => {
    let result = allJobs.filter((job) => job.source !== "manual");

    if (entryLevelOnly) {
      const seniorKeywords = [
        "senior", "sr", "lead", "staff", "principal", "manager", "director", "vp", "architect", "head"
      ];
      result = result.filter((job) => {
        const titleLower = job.title.toLowerCase();
        return !seniorKeywords.some((keyword) => {
          const regex = new RegExp(`\\b${keyword}\\b`, 'i');
          return regex.test(titleLower);
        });
      });
    }

    // Filter out LinkedIn jobs older than 24 hours
    const now = new Date();
    const msIn24Hours = 24 * 60 * 60 * 1000;
    result = result.filter((job) => {
      if (job.source === "linkedin") {
        const jobDate = new Date(job.createdAt);
        return (now.getTime() - jobDate.getTime()) <= msIn24Hours;
      }
      return true;
    });

    const normalizedQuery = query.trim().toLowerCase();
    if (normalizedQuery) {
      result = result.filter((job) =>
        [job.title, job.company, job.location, job.source].some((field) =>
          field.toLowerCase().includes(normalizedQuery),
        ),
      );
    }

    return result;
  }, [allJobs, query, entryLevelOnly]);

  // 2. Process tracked jobs list for the Application Tracker
  const trackedJobs = useMemo(() => {
    let result = allJobs.filter((job) => job.status && job.status !== "Not Applied");

    if (statusFilter !== "all") {
      result = result.filter((job) => job.status === statusFilter);
    }

    const normalizedQuery = trackerQuery.trim().toLowerCase();
    if (normalizedQuery) {
      result = result.filter((job) =>
        [job.title, job.company, job.location, job.platform || "", job.source].some((field) =>
          field.toLowerCase().includes(normalizedQuery),
        ),
      );
    }

    // Sort by applied date (newest first)
    return [...result].sort((a, b) => {
      const dateA = a.appliedAt ? new Date(a.appliedAt).getTime() : 0;
      const dateB = b.appliedAt ? new Date(b.appliedAt).getTime() : 0;
      return dateB - dateA;
    });
  }, [allJobs, trackerQuery, statusFilter]);

  // 3. Metrics for the Tracker Dashboard
  const metrics = useMemo(() => {
    const tracked = allJobs.filter((job) => job.status && job.status !== "Not Applied");
    return {
      total: tracked.length,
      interviewing: tracked.filter((j) => j.status === "Interview Scheduled").length,
      offers: tracked.filter((j) => j.status === "Offer").length,
      rejected: tracked.filter((j) => j.status === "Rejected").length,
    };
  }, [allJobs]);

  // Handles starting the tracking flow
  const handleOpenTrackModal = (job: Job) => {
    setSelectedJobForTrack(job);
    setTrackStatus(job.status || "Applied");
    setTrackPlatform(job.platform || job.source || "LinkedIn");
    setTrackNotes(job.notes || "");
  };

  // Submits updates to a job status
  const handleUpdateStatus = async (jobId: string, status: string, platform: string, notes: string) => {
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/v1/jobs/${jobId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, platform, notes }),
      });

      const resJson = await response.json();
      if (resJson.success) {
        // Update local state reactively
        setAllJobs((prev) =>
          prev.map((job) =>
            job.id === jobId
              ? {
                  ...job,
                  status,
                  platform,
                  notes,
                  appliedAt: resJson.data.job.appliedAt,
                  updatedAt: resJson.data.job.updatedAt,
                }
              : job
          )
        );
        setSelectedJobForTrack(null);
      } else {
        alert("Failed to update status: " + resJson.message);
      }
    } catch (err) {
      console.error(err);
      alert("Error updating status.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submits a manually added job application
  const handleAddManualApplication = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualTitle || !manualCompany) {
      alert("Role Title and Company Name are required.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/v1/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: manualTitle,
          company: manualCompany,
          location: manualLocation || "Remote",
          salary: manualSalary || null,
          applyUrl: manualUrl || null,
          status: manualStatus,
          platform: manualPlatform,
          notes: manualNotes,
        }),
      });

      const resJson = await response.json();
      if (resJson.success) {
        // Add new manual job at the start of local state
        setAllJobs((prev) => [resJson.data.job, ...prev]);
        setShowManualModal(false);

        // Reset form
        setManualTitle("");
        setManualCompany("");
        setManualLocation("");
        setManualSalary("");
        setManualUrl("");
        setManualPlatform("College");
        setManualStatus("Applied");
        setManualNotes("");
      } else {
        alert("Failed to add: " + resJson.message);
      }
    } catch (err) {
      console.error(err);
      alert("Error tracking manual application.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helper for platform styling tag colors
  const getPlatformTagClass = (platform: string) => {
    const p = platform.toLowerCase();
    if (p.includes("college")) return "tag-college";
    if (p.includes("referral")) return "tag-referral";
    if (p.includes("linkedin")) return "tag-linkedin";
    if (p.includes("wellfound")) return "tag-wellfound";
    if (p.includes("yc") || p.includes("combinator")) return "tag-yc";
    return "tag-direct";
  };

  return (
    <div className="jobs-board-wrapper">
      {/* Dynamic Navigation Tabs */}
      <nav className="board-tabs" aria-label="Job Board Navigation">
        <button
          className={`board-tab-btn ${activeTab === "explore" ? "active" : ""}`}
          onClick={() => setActiveTab("explore")}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="7" height="9" rx="1" />
            <rect x="14" y="3" width="7" height="5" rx="1" />
            <rect x="14" y="12" width="7" height="9" rx="1" />
            <rect x="3" y="16" width="7" height="5" rx="1" />
          </svg>
          Explore Board
        </button>
        <button
          className={`board-tab-btn ${activeTab === "tracker" ? "active" : ""}`}
          onClick={() => setActiveTab("tracker")}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 11l3 3L22 4" />
            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
          </svg>
          Application Tracker
        </button>
      </nav>

      {/* ==================== EXPLORE BOARD TAB ==================== */}
      {activeTab === "explore" && (
        <section className="jobs-section">
          <div className="jobs-section__header">
            <div>
              <p className="section-kicker">All listings</p>
              <h2>Fresh scraped roles</h2>
            </div>

            <div className="jobs-toolbar">
              <div className="jobs-toolbar-controls">
                <label className="checkbox-filter" htmlFor="entry-level-toggle">
                  <input
                    id="entry-level-toggle"
                    type="checkbox"
                    checked={entryLevelOnly}
                    onChange={(e) => setEntryLevelOnly(e.target.checked)}
                  />
                  <span>Entry Level (0-1 yrs exp)</span>
                </label>

                <label className="jobs-search" htmlFor="job-search">
                  <span>Search jobs</span>
                  <input
                    id="job-search"
                    name="job-search"
                    type="search"
                    placeholder="Title, company, location, source"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                  />
                </label>
              </div>
              <p className="jobs-section__summary">{filteredJobs.length} matching roles</p>
            </div>
          </div>

          {filteredJobs.length === 0 ? (
            <div className="empty-state">
              <h3>No matching jobs</h3>
              <p>Try a different keyword or clear the search to see every role in the database.</p>
            </div>
          ) : (
            <div className="jobs-grid">
              {filteredJobs.map((job) => (
                <JobCard key={job.id} job={job} onTrack={handleOpenTrackModal} />
              ))}
            </div>
          )}
        </section>
      )}

      {/* ==================== APPLICATION TRACKER TAB ==================== */}
      {activeTab === "tracker" && (
        <section className="tracker-section">
          {/* Metrics Dashboard */}
          <div className="tracker-metrics-grid">
            <div className="metric-card metric-total">
              <div className="metric-card-inner">
                <span className="metric-label">Applications</span>
                <span className="metric-val">{metrics.total}</span>
              </div>
              <div className="metric-card-accent" />
            </div>

            <div className="metric-card metric-interviewing">
              <div className="metric-card-inner">
                <span className="metric-label">Interviewing</span>
                <span className="metric-val text-blue">{metrics.interviewing}</span>
              </div>
              <div className="metric-card-accent" />
            </div>

            <div className="metric-card metric-offers">
              <div className="metric-card-inner">
                <span className="metric-label">Offers Received</span>
                <span className="metric-val text-green">{metrics.offers}</span>
              </div>
              <div className="metric-card-accent" />
            </div>

            <div className="metric-card metric-rejected">
              <div className="metric-card-inner">
                <span className="metric-label">Rejections</span>
                <span className="metric-val text-red">{metrics.rejected}</span>
              </div>
              <div className="metric-card-accent" />
            </div>
          </div>

          {/* Tracker Toolbar */}
          <div className="tracker-toolbar-container">
            <div className="tracker-toolbar-left">
              <h2>My Applications</h2>
              <p className="tracker-toolbar-sub">{trackedJobs.length} active pipelines</p>
            </div>

            <div className="tracker-toolbar-right">
              {/* Search */}
              <div className="tracker-search-box">
                <input
                  type="text"
                  placeholder="Filter by company, role..."
                  value={trackerQuery}
                  onChange={(e) => setTrackerQuery(e.target.value)}
                />
              </div>

              {/* Status Filter */}
              <div className="tracker-status-filter">
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                  <option value="all">All Statuses</option>
                  <option value="Applied">Applied</option>
                  <option value="Followed Up">Followed Up</option>
                  <option value="Interview Scheduled">Interview Scheduled</option>
                  <option value="Rejected">Rejected</option>
                  <option value="Offer">Offer</option>
                </select>
              </div>

              {/* Add Manual Application Button */}
              <button className="add-app-btn" onClick={() => setShowManualModal(true)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Track Application
              </button>
            </div>
          </div>

          {/* Applications list */}
          {trackedJobs.length === 0 ? (
            <div className="empty-state">
              <h3>No tracked applications yet</h3>
              <p>Go to the &quot;Explore Board&quot; to track a scraped job, or click &quot;Track Application&quot; to add a manual entry!</p>
            </div>
          ) : (
            <div className="tracker-table-container">
              <table className="tracker-table">
                <thead>
                  <tr>
                    <th>Company</th>
                    <th>Role</th>
                    <th>Platform</th>
                    <th>Status</th>
                    <th>Date Applied</th>
                    <th>Notes & Details</th>
                  </tr>
                </thead>
                <tbody>
                  {trackedJobs.map((job) => {
                    const statusColor = getStatusStyle(job.status || "");
                    const isDropdownActive = activeInlineDropdownId === job.id;

                    return (
                      <tr key={job.id} className="tracker-row">
                        <td className="company-col">
                          <strong>{job.company}</strong>
                        </td>
                        <td className="role-col">
                          <span>{job.title}</span>
                          {job.applyUrl && (
                            <a
                              href={job.applyUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-url-icon"
                              title="Go to posting"
                            >
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                                <polyline points="15 3 21 3 21 9" />
                                <line x1="10" y1="14" x2="21" y2="3" />
                              </svg>
                            </a>
                          )}
                        </td>
                        <td className="platform-col">
                          <span className={`platform-pill ${getPlatformTagClass(job.platform || job.source || "")}`}>
                            {job.platform || job.source}
                          </span>
                        </td>
                        <td className="status-col">
                          {/* Premium interactive status dropdown */}
                          <div className="status-select-container">
                            <button
                              className="status-dropdown-trigger"
                              style={{
                                background: statusColor.bg,
                                color: statusColor.text,
                              }}
                              onClick={() =>
                                setActiveInlineDropdownId(isDropdownActive ? null : job.id)
                              }
                            >
                              {statusColor.label}
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polyline points="6 9 12 15 18 9" />
                              </svg>
                            </button>

                            {isDropdownActive && (
                              <div className="status-floating-menu">
                                <button
                                  onClick={() => {
                                    handleUpdateStatus(job.id, "Applied", job.platform || job.source, job.notes || "");
                                    setActiveInlineDropdownId(null);
                                  }}
                                >
                                  Applied
                                </button>
                                <button
                                  onClick={() => {
                                    handleUpdateStatus(job.id, "Followed Up", job.platform || job.source, job.notes || "");
                                    setActiveInlineDropdownId(null);
                                  }}
                                >
                                  Followed Up
                                </button>
                                <button
                                  onClick={() => {
                                    handleUpdateStatus(job.id, "Interview Scheduled", job.platform || job.source, job.notes || "");
                                    setActiveInlineDropdownId(null);
                                  }}
                                >
                                  Interview Scheduled
                                </button>
                                <button
                                  onClick={() => {
                                    handleUpdateStatus(job.id, "Offer", job.platform || job.source, job.notes || "");
                                    setActiveInlineDropdownId(null);
                                  }}
                                >
                                  Offer
                                </button>
                                <button
                                  onClick={() => {
                                    handleUpdateStatus(job.id, "Rejected", job.platform || job.source, job.notes || "");
                                    setActiveInlineDropdownId(null);
                                  }}
                                >
                                  Rejected
                                </button>
                                <div className="dropdown-divider" />
                                <button
                                  className="text-muted-delete"
                                  onClick={() => {
                                    handleUpdateStatus(job.id, "Not Applied", job.platform || job.source, job.notes || "");
                                    setActiveInlineDropdownId(null);
                                  }}
                                >
                                  Stop Tracking
                                </button>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="date-col">
                          {job.appliedAt
                            ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(
                                new Date(job.appliedAt)
                              )
                            : "-"}
                        </td>
                        <td className="notes-col">
                          <div className="notes-display">
                            {job.notes ? (
                              <span className="notes-text" title={job.notes}>
                                {job.notes}
                              </span>
                            ) : (
                              <span className="no-notes-placeholder">No notes added</span>
                            )}
                            <button
                              className="edit-notes-icon-btn"
                              onClick={() => handleOpenTrackModal(job)}
                              title="Edit notes/platform"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M12 20h9" />
                                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                              </svg>
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
        </section>
      )}

      {/* ==================== SCRAPED JOB TRACK MODAL ==================== */}
      {selectedJobForTrack && (
        <div className="glass-modal-overlay" onClick={() => setSelectedJobForTrack(null)}>
          <div className="glass-modal-content" onClick={(e) => e.stopPropagation()}>
            <header className="glass-modal-header">
              <div>
                <p className="modal-kicker">Track application status</p>
                <h3>{selectedJobForTrack.company}</h3>
                <p className="modal-subtitle">{selectedJobForTrack.title}</p>
              </div>
              <button className="modal-close-btn" onClick={() => setSelectedJobForTrack(null)}>
                &times;
              </button>
            </header>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleUpdateStatus(selectedJobForTrack.id, trackStatus, trackPlatform, trackNotes);
              }}
              className="modal-form"
            >
              <div className="form-group">
                <label htmlFor="modal-status">Application Status</label>
                <select
                  id="modal-status"
                  value={trackStatus}
                  onChange={(e) => setTrackStatus(e.target.value)}
                >
                  <option value="Applied">Applied</option>
                  <option value="Followed Up">Followed Up</option>
                  <option value="Interview Scheduled">Interview Scheduled</option>
                  <option value="Offer">Offer</option>
                  <option value="Rejected">Rejected</option>
                  <option value="Not Applied">Not Applied (Stop Tracking)</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="modal-platform">Platform / Source</label>
                <select
                  id="modal-platform"
                  value={trackPlatform}
                  onChange={(e) => setTrackPlatform(e.target.value)}
                >
                  <option value="LinkedIn">LinkedIn</option>
                  <option value="Wellfound">Wellfound</option>
                  <option value="YC">YC</option>
                  <option value="College">College</option>
                  <option value="Referral">Referral</option>
                  <option value="Direct">Direct Application</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="modal-notes">Notes / Outreach log</label>
                <textarea
                  id="modal-notes"
                  placeholder="e.g. Referred by John Doe, contacted hiring manager on LinkedIn..."
                  rows={4}
                  value={trackNotes}
                  onChange={(e) => setTrackNotes(e.target.value)}
                />
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setSelectedJobForTrack(null)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? "Saving..." : "Save Settings"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== ADD MANUAL APPLICATION MODAL ==================== */}
      {showManualModal && (
        <div className="glass-modal-overlay" onClick={() => setShowManualModal(false)}>
          <div className="glass-modal-content" onClick={(e) => e.stopPropagation()}>
            <header className="glass-modal-header">
              <div>
                <p className="modal-kicker">New Entry</p>
                <h3>Track Application</h3>
              </div>
              <button className="modal-close-btn" onClick={() => setShowManualModal(false)}>
                &times;
              </button>
            </header>

            <form onSubmit={handleAddManualApplication} className="modal-form">
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="manual-company">Company *</label>
                  <input
                    type="text"
                    id="manual-company"
                    required
                    placeholder="e.g. Google, Morphie Labs"
                    value={manualCompany}
                    onChange={(e) => setManualCompany(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="manual-title">Role Title *</label>
                  <input
                    type="text"
                    id="manual-title"
                    required
                    placeholder="e.g. SDE Intern, Python Developer"
                    value={manualTitle}
                    onChange={(e) => setManualTitle(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="manual-loc">Location</label>
                  <input
                    type="text"
                    id="manual-loc"
                    placeholder="e.g. Remote, New York"
                    value={manualLocation}
                    onChange={(e) => setManualLocation(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="manual-sal">Salary Info</label>
                  <input
                    type="text"
                    id="manual-sal"
                    placeholder="e.g. $60/hr, 12 LPA"
                    value={manualSalary}
                    onChange={(e) => setManualSalary(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="manual-plat">Platform / Source</label>
                  <select
                    id="manual-plat"
                    value={manualPlatform}
                    onChange={(e) => setManualPlatform(e.target.value)}
                  >
                    <option value="College">College Placement</option>
                    <option value="Referral">Referral</option>
                    <option value="LinkedIn">LinkedIn</option>
                    <option value="Wellfound">Wellfound</option>
                    <option value="YC">YC</option>
                    <option value="Direct">Direct Application</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="manual-status">Current Status</label>
                  <select
                    id="manual-status"
                    value={manualStatus}
                    onChange={(e) => setManualStatus(e.target.value)}
                  >
                    <option value="Applied">Applied</option>
                    <option value="Followed Up">Followed Up</option>
                    <option value="Interview Scheduled">Interview Scheduled</option>
                    <option value="Offer">Offer</option>
                    <option value="Rejected">Rejected</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="manual-url">Job Posting URL (Optional)</label>
                <input
                  type="url"
                  id="manual-url"
                  placeholder="https://company.com/careers/job-id"
                  value={manualUrl}
                  onChange={(e) => setManualUrl(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label htmlFor="manual-notes">Outreach & Application Notes</label>
                <textarea
                  id="manual-notes"
                  placeholder="e.g. Interview scheduled with HR on Tuesday, referred by alumni..."
                  rows={3}
                  value={manualNotes}
                  onChange={(e) => setManualNotes(e.target.value)}
                />
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowManualModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? "Tracking..." : "Save Application"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
