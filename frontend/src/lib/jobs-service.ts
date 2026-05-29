import { prisma } from "@/lib/prisma";
import { normalizeJobUrl } from "@/lib/job-url";
import type { Job } from "@/types/job";

export async function listJobs(): Promise<Job[]> {
  const jobs = await prisma.job.findMany({
    orderBy: [
      { updatedAt: "desc" },
      { createdAt: "desc" },
    ],
  });

  return jobs.map((job) => ({
    ...job,
    applyUrl: job.applyUrl ? normalizeJobUrl(job.source, job.applyUrl) : null,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
    appliedAt: job.appliedAt ? job.appliedAt.toISOString() : null,
  }));
}
