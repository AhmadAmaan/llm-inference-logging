import IORedis from "ioredis";
import { Queue } from "bullmq";

const DEFAULT_QUEUE_NAME = "inference-events";
const DEFAULT_REDIS_URL = "redis://127.0.0.1:6379";
const DEFAULT_QUEUE_CONCURRENCY = 4;
const DEFAULT_MAX_RETRIES = 5;
const DEFAULT_RECONCILIATION_INTERVAL_MS = 15_000;

const globalQueueState = globalThis as typeof globalThis & {
  __llmInferenceRedisQueueConnection?: IORedis;
  __llmInferenceQueue?: Queue<{ eventId: string }>;
};

function parsePositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value || "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function getRedisUrl() {
  return process.env.REDIS_URL || DEFAULT_REDIS_URL;
}

export function getIngestionQueueName() {
  return process.env.INGESTION_QUEUE_NAME || DEFAULT_QUEUE_NAME;
}

export function getIngestionQueueConcurrency() {
  return parsePositiveInt(process.env.INGESTION_QUEUE_CONCURRENCY, DEFAULT_QUEUE_CONCURRENCY);
}

export function getIngestionMaxRetries() {
  return parsePositiveInt(process.env.INGESTION_MAX_RETRIES, DEFAULT_MAX_RETRIES);
}

export function getIngestionReconciliationIntervalMs() {
  return parsePositiveInt(
    process.env.INGESTION_RECONCILIATION_INTERVAL_MS,
    DEFAULT_RECONCILIATION_INTERVAL_MS,
  );
}

export function createRedisConnection() {
  return new IORedis(getRedisUrl(), {
    maxRetriesPerRequest: null,
  });
}

function getQueueConnection() {
  if (!globalQueueState.__llmInferenceRedisQueueConnection) {
    globalQueueState.__llmInferenceRedisQueueConnection = createRedisConnection();
  }

  return globalQueueState.__llmInferenceRedisQueueConnection;
}

export function getInferenceQueue() {
  if (!globalQueueState.__llmInferenceQueue) {
    globalQueueState.__llmInferenceQueue = new Queue<{ eventId: string }>(
      getIngestionQueueName(),
      {
        connection: getQueueConnection(),
        defaultJobOptions: {
          attempts: getIngestionMaxRetries(),
          backoff: {
            type: "exponential",
            delay: 1_000,
          },
          removeOnComplete: 500,
          removeOnFail: false,
        },
      },
    );
  }

  return globalQueueState.__llmInferenceQueue;
}

export async function enqueueInferenceJob(eventId: string) {
  const queue = getInferenceQueue();
  const existing = await queue.getJob(eventId);
  if (existing) {
    return {
      queued: false,
      duplicate: true,
    };
  }

  try {
    await queue.add(
      "materialize-inference-event",
      { eventId },
      {
        jobId: eventId,
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.toLowerCase().includes("job id")) {
      return {
        queued: false,
        duplicate: true,
      };
    }

    throw error;
  }

  return {
    queued: true,
    duplicate: false,
  };
}

export async function closeInferenceQueueResources() {
  if (globalQueueState.__llmInferenceQueue) {
    await globalQueueState.__llmInferenceQueue.close();
    globalQueueState.__llmInferenceQueue = undefined;
  }

  if (globalQueueState.__llmInferenceRedisQueueConnection) {
    await globalQueueState.__llmInferenceRedisQueueConnection.quit();
    globalQueueState.__llmInferenceRedisQueueConnection = undefined;
  }
}
