import { LinkedinOutreach } from "@/components/linkedin-outreach";

export const metadata = {
  title: "LinkedIn Outreach",
  description: "Automate LinkedIn connections and messages.",
};

export default function LinkedinPage() {
  return (
    <main className="container mx-auto px-4 py-8 md:px-8 flex flex-col gap-8">
      <header className="rounded-xl border bg-card text-card-foreground shadow-sm p-6 flex flex-col gap-1">
        <div>
          <p className="text-primary font-semibold text-sm uppercase tracking-wider">Network Campaigns</p>
          <h1 className="text-3xl font-bold tracking-tight">LinkedIn Outreach</h1>
        </div>
      </header>
      <div style={{ marginTop: "1rem" }}>
        <LinkedinOutreach />
      </div>
    </main>
  );
}
