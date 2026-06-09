import {
  Controller,
  Post,
  Param,
  Req,
  Headers,
  UnauthorizedException,
  Inject,
} from "@nestjs/common";
import type { RawBodyRequest } from "@nestjs/common";
import type { Request } from "express";
import { prisma, WebhookEventStatus, Prisma } from "@gitguardian/db";
import { decrypt } from "@gitguardian/shared";
import { RepositoriesService } from "../repositories/repositories.service.js";
import { QueueService } from "../queue/queue.service.js";

@Controller("webhooks/github")
export class WebhooksController {
  constructor(
    @Inject(RepositoriesService) private readonly repos: RepositoriesService,
    @Inject(QueueService) private readonly queue: QueueService,
  ) {}

  @Post(":repositoryId")
  async handle(
    @Param("repositoryId") repositoryId: string,
    @Req() req: RawBodyRequest<Request>,
    @Headers("x-hub-signature-256") signature: string,
    @Headers("x-github-event") eventType: string,
    @Headers("x-github-delivery") deliveryId: string,
  ) {
    const repo = await prisma.repository.findUnique({ where: { id: repositoryId } });
    if (!repo?.webhookSecret) throw new UnauthorizedException();

    const rawBody =
      typeof req.rawBody === "string"
        ? req.rawBody
        : req.rawBody?.toString("utf8") ?? JSON.stringify(req.body);

    const secret = decrypt(repo.webhookSecret);
    if (!this.repos.verifySignature(rawBody, signature, secret)) {
      throw new UnauthorizedException("Invalid signature");
    }

    const payload = JSON.parse(rawBody) as Record<string, unknown>;
    const action =
      typeof payload.action === "string" ? payload.action : undefined;

    const event = await prisma.webhookEvent.create({
      data: {
        repositoryId,
        deliveryId: deliveryId ?? `local-${Date.now()}`,
        eventType: eventType ?? "unknown",
        action,
        payload: payload as Prisma.InputJsonValue,
        status: WebhookEventStatus.PENDING,
      },
    });

    await this.queue.webhookQueue.add(
      "process",
      { webhookEventId: event.id, repositoryId },
      {
        attempts: 5,
        backoff: { type: "exponential", delay: 2000 },
        removeOnComplete: 1000,
        removeOnFail: false,
      },
    );

    return { accepted: true, eventId: event.id };
  }
}
