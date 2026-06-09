import { loadRootEnv } from "@gitguardian/shared/load-env";
loadRootEnv();

import { Queue } from "bullmq";
import { prisma, WebhookEventStatus } from "@gitguardian/db";

const WEBHOOK_QUEUE = "webhook-events";
const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";

async function main() {
  const stuck = await prisma.webhookEvent.findMany({
    where: {
      status: { in: [WebhookEventStatus.FAILED, WebhookEventStatus.DEAD_LETTER, WebhookEventStatus.PROCESSING] },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  if (!stuck.length) {
    console.log("No failed/stuck events to retry.");
    return;
  }

  const queue = new Queue(WEBHOOK_QUEUE, { connection: { url: redisUrl } });

  for (const event of stuck) {
    await prisma.webhookEvent.update({
      where: { id: event.id },
      data: { status: WebhookEventStatus.PENDING, errorMessage: null, retryCount: 0 },
    });
    await queue.add(
      "process",
      { webhookEventId: event.id, repositoryId: event.repositoryId },
      { attempts: 5, backoff: { type: "exponential", delay: 2000 } },
    );
    console.log(`Requeued ${event.eventType} (${event.id})`);
  }

  await queue.close();
  await prisma.$disconnect();
  console.log(`Done. Requeued ${stuck.length} event(s).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
