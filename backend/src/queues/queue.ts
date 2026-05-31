import { Queue } from "bullmq";

const REDIS_URL = process.env.REDIS_URL;
const REDIS_HOST = process.env.REDIS_HOST || "127.0.0.1";
const REDIS_PORT = parseInt(process.env.REDIS_PORT || "6379");
const REDIS_PASSWORD = process.env.REDIS_PASSWORD || undefined;

export let redisConnectionOptions: any = {
  host: REDIS_HOST,
  port: REDIS_PORT,
  password: REDIS_PASSWORD,
  maxRetriesPerRequest: null, // Critical configuration required by BullMQ
};

if (REDIS_URL) {
  try {
    const parsed = new URL(REDIS_URL);
    console.log(`[Queue Setup] Configuring Redis connection using REDIS_URL...`);
    redisConnectionOptions = {
      host: parsed.hostname,
      port: parseInt(parsed.port || "6379"),
      password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
      maxRetriesPerRequest: null,
    };
  } catch (err) {
    console.error("[Queue Setup] Error parsing REDIS_URL:", err);
  }
} else {
  console.log(`[Queue Setup] Configuring Redis connection to ${REDIS_HOST}:${REDIS_PORT}`);
}

// Queue 1: Processes Master Resume Download + OpenAI tailoring + PDF compilation
export const resumeQueue = new Queue("resume-generation", {
  connection: redisConnectionOptions,
});

// Queue 2: Launches Playwright headed browser and executes auto apply flows
export const applyQueue = new Queue("auto-apply", {
  connection: redisConnectionOptions,
});

console.log("[Queue Setup] BullMQ Queues initialized successfully.");
