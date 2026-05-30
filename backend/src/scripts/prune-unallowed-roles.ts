import { prisma } from "../services/prisma.js";
import { isAllowedRole } from "../shared/role-filter.js";

async function main() {
  console.log("=== ROLE-BASED DB PRUNING IN PROGRESS ===");
  try {
    const allJobs = await prisma.job.findMany({
      select: {
        id: true,
        title: true,
        company: true,
        location: true,
      },
    });

    console.log(`Analyzing ${allJobs.length} jobs in database...`);

    const jobsToDelete = allJobs.filter((job) => !isAllowedRole(job.title));

    console.log(`Found ${jobsToDelete.length} jobs to delete (unallowed roles).`);

    if (jobsToDelete.length > 0) {
      const idsToDelete = jobsToDelete.map((job) => job.id);
      
      console.log("Starting deletion of unallowed role jobs...");
      const deleteResult = await prisma.job.deleteMany({
        where: {
          id: {
            in: idsToDelete,
          },
        },
      });

      console.log(`Successfully deleted ${deleteResult.count} unallowed role job listings from database.`);
    } else {
      console.log("No jobs require pruning.");
    }

    const remainingJobsCount = await prisma.job.count();
    console.log(`Remaining jobs in database: ${remainingJobsCount}`);

  } catch (error) {
    console.error("Pruning script encountered an error:", error);
  } finally {
    await prisma.$disconnect();
    console.log("Database disconnected.");
  }
}

main();
