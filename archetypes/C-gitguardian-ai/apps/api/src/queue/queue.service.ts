import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { Queue } from "bullmq";

export const WEBHOOK_QUEUE = "webhook-events";

@Injectable()
export class QueueService implements OnModuleDestroy {
  readonly webhookQueue: Queue;

  constructor() {
    const url = process.env.REDIS_URL ?? "redis://localhost:6379";
    this.webhookQueue = new Queue(WEBHOOK_QUEUE, {
      connection: { url, maxRetriesPerRequest: null },
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.webhookQueue.close();
  }
}
