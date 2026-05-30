import { triggerFetchJob } from "../scheduler/fetch.scheduler.js";

async function main() {
  console.log("=== INITIATING CRAWLER FOR INDIA JOBS ===");
  try {
    await triggerFetchJob();
    console.log("=== CRAWL PROCESS COMPLETED ===");
  } catch (error) {
    console.error("Crawler encountered an error:", error);
  } finally {
    process.exit(0);
  }
}

main();
