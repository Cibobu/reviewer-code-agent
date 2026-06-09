import { Module } from "@nestjs/common";
import { AuthModule } from "./auth/auth.module.js";
import { RepositoriesModule } from "./repositories/repositories.module.js";
import { WebhooksModule } from "./webhooks/webhooks.module.js";
import { ReviewsModule } from "./reviews/reviews.module.js";
import { DashboardModule } from "./dashboard/dashboard.module.js";
import { TelegramModule } from "./integrations/telegram/telegram.module.js";
import { QueueModule } from "./queue/queue.module.js";
import { NotificationsModule } from "./notifications/notifications.module.js";

@Module({
  imports: [
    QueueModule,
    AuthModule,
    RepositoriesModule,
    WebhooksModule,
    ReviewsModule,
    DashboardModule,
    TelegramModule,
    NotificationsModule,
  ],
})
export class AppModule {}
