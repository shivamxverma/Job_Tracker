import { prisma } from "../services/prisma.js";

async function main() {
  console.log("=== DIAGNOSING LAST LINKEDIN FAILURE ===");
  
  const lastFailed = await prisma.outboundMessage.findFirst({
    where: {
      channel: "LINKEDIN",
      status: "FAILED"
    },
    orderBy: {
      createdAt: "desc"
    },
    include: {
      profile: true
    }
  });

  if (!lastFailed) {
    console.log("No failed LinkedIn messages found in database.");
    return;
  }

  console.log("Failed Message ID:", lastFailed.id);
  console.log("Recruiter Name:", lastFailed.profile.name);
  console.log("Company:", lastFailed.profile.company);
  console.log("LinkedIn URL:", lastFailed.profile.linkedinUrl);
  console.log("Notes:", lastFailed.profile.notes);
  console.log("Message Content:", lastFailed.content);
  console.log("Status:", lastFailed.status);
  console.log("Created At:", lastFailed.createdAt);
  
  // Find conversation tracker if any
  const tracker = await prisma.conversationTracker.findUnique({
    where: { profileId: lastFailed.profileId }
  });
  console.log("Tracker:", tracker);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
