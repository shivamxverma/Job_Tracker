import { GmailOutreach } from "@/components/gmail-outreach";

export const metadata = {
  title: "Gmail Outreach",
  description: "Send automated emails via Gmail.",
};

export default function GmailPage() {
  return (
    <main className="container mx-auto px-4 py-8 md:px-8 flex flex-col gap-8">
      <header className="rounded-xl border bg-card text-card-foreground shadow-sm p-6 flex flex-col gap-1">
        <div>
          <p className="text-primary font-semibold text-sm uppercase tracking-wider">Email Campaigns</p>
          <h1 className="text-3xl font-bold tracking-tight">Gmail Outreach</h1>
        </div>
      </header>
      <div style={{ marginTop: "1rem" }}>
        <GmailOutreach />
      </div>
    </main>
  );
}
