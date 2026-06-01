import { JobsBoard } from "@/components/jobs-board";
import { listJobs } from "@/lib/jobs-service";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Application Tracker",
  description: "Track your job applications and statuses.",
};

export default async function TrackerPage() {
  const jobs = await listJobs();

  return (
    <main className="container mx-auto px-4 py-8 md:px-8 flex flex-col gap-8">
      <JobsBoard jobs={jobs} defaultTab="tracker" />
    </main>
  );
}
