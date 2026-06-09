import { Module } from "@nestjs/common";
import { RepositoriesModule } from "../repositories/repositories.module.js";
import { WebhooksController } from "./webhooks.controller.js";

@Module({
  imports: [RepositoriesModule],
  controllers: [WebhooksController],
})
export class WebhooksModule {}
