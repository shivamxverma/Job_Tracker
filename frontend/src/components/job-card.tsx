import type { Job } from "@/types/job";
import { MapPin, DollarSign, ExternalLink, Zap, Target } from "lucide-react";

type JobCardProps = {
  job: Job;
  onTrack?: (job: Job) => void;
  onSelect?: (job: Job) => void;
};

export function getStatusStyle(status: string) {
  switch (status) {
    case "Applied":
      return { bg: "#fef3c7", text: "#b45309", label: "Applied" };
    case "Followed Up":
      return { bg: "#e0e7ff", text: "#4338ca", label: "Followed Up" };
    case "Interview Scheduled":
      return { bg: "#e0f2fe", text: "#0369a1", label: "Interview" };
    case "Rejected":
      return { bg: "#fee2e2", text: "#b91c1c", label: "Rejected" };
    case "Offer":
      return { bg: "#d1fae5", text: "#047857", label: "Offer" };
    default:
      return { bg: "#f1f5f9", text: "#475569", label: status };
  }
}

function formatPostedDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

export function JobCard({ job, onTrack, onSelect }: JobCardProps) {
  return (
    <article 
      className="rounded-xl border bg-card text-card-foreground shadow-sm p-5 hover:shadow-md transition-shadow relative flex flex-col justify-between"
      onClick={() => onSelect?.(job)}
      style={{ cursor: "pointer", transition: "transform 150ms ease, box-shadow 150ms ease" }}
    >
      <div className="flex justify-between items-center mb-4">
        <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase text-muted-foreground">{job.source}</span>
        <div className="flex gap-2 items-center text-xs text-muted-foreground">
          {job.status && (
            <span
              className="inline-flex items-center px-2 py-0.5 rounded-full font-semibold shadow-sm text-[0.68rem]"
              style={{
                background: getStatusStyle(job.status).bg,
                color: getStatusStyle(job.status).text,
              }}
            >
              {getStatusStyle(job.status).label}
            </span>
          )}
          <span>Updated {formatPostedDate(job.updatedAt)}</span>
        </div>
      </div>

      <div className="flex flex-col gap-1 mb-4">
        <h2 className="text-lg font-bold leading-tight">{job.title}</h2>
        <p className="text-sm font-medium text-muted-foreground">{job.company}</p>
      </div>

      <div className="flex flex-wrap items-center gap-4 text-xs font-medium text-muted-foreground mb-6">
        <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> {job.location}</span>
        <span className="flex items-center gap-1.5"><DollarSign className="w-3.5 h-3.5" /> {job.salary ?? "Salary not listed"}</span>
      </div>

      <div className="flex items-center justify-between border-t pt-4 mt-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex gap-2 items-center flex-wrap">
          {job.applyUrl ? (
            <a href={job.applyUrl} target="_blank" rel="noreferrer" className="inline-flex items-center text-sm text-primary hover:underline gap-1 font-medium">
              <ExternalLink className="w-3.5 h-3.5" />
              Apply now
            </a>
          ) : (
            <span className="text-sm text-muted-foreground">No link</span>
          )}

          <button
            onClick={(e) => {
              e.stopPropagation();
              onSelect?.(job);
            }}
            className="inline-flex items-center justify-center min-h-[36px] px-3 py-1.5 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-sm font-medium border-none cursor-pointer transition-transform hover:scale-[1.02] shadow-sm ml-2 gap-1.5"
          >
            <Zap className="w-3.5 h-3.5 fill-current" /> Auto Apply
          </button>
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onTrack?.(job);
          }}
          className="inline-flex items-center justify-center min-h-[36px] px-3 py-1.5 rounded-full text-sm font-medium border cursor-pointer transition-colors bg-transparent text-foreground hover:bg-muted gap-1.5"
        >
          <Target className="w-3.5 h-3.5" />
          {job.status ? "Update" : "Track"}
        </button>
      </div>
    </article>
  );
}
