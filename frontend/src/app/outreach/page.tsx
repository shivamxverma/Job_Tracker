import { OutreachBoard } from "@/components/outreach-board";

export const metadata = {
  title: "Outreach Board",
  description: "Manage outreach profiles and templates.",
};

export default function OutreachPage() {
  return (
    <main className="container mx-auto px-4 py-8 md:px-8 flex flex-col gap-8">
      <header className="rounded-xl border bg-card text-card-foreground shadow-sm p-6 flex flex-col gap-1">
        <div>
          <p className="text-primary font-semibold text-sm uppercase tracking-wider">Campaign Management</p>
          <h1 className="text-3xl font-bold tracking-tight">Outreach Board</h1>
        </div>
      </header>
      <div style={{ marginTop: "1rem" }}>
        <OutreachBoard />
      </div>
    </main>
  );
}
