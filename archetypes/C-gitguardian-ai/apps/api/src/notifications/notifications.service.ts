import { Injectable } from "@nestjs/common";
import { prisma, NotificationChannel } from "@gitguardian/db";

@Injectable()
export class NotificationsService {
  async unreadCount(userId: string, repositoryId?: string) {
    const where = {
      userId,
      read: false,
      channel: NotificationChannel.IN_APP,
      ...(repositoryId
        ? { aiReview: { repositoryId } }
        : {}),
    };
    return prisma.notification.count({ where });
  }

  async unreadByRepository(userId: string) {
    const unread = await prisma.notification.findMany({
      where: { userId, read: false, channel: NotificationChannel.IN_APP },
      select: { aiReview: { select: { repositoryId: true } } },
    });

    const counts: Record<string, number> = {};
    for (const n of unread) {
      const repoId = n.aiReview?.repositoryId;
      if (repoId) counts[repoId] = (counts[repoId] ?? 0) + 1;
    }
    return counts;
  }

  async markRead(userId: string, opts: { repositoryId?: string; reviewId?: string }) {
    const where = {
      userId,
      read: false,
      channel: NotificationChannel.IN_APP,
      ...(opts.reviewId
        ? { aiReviewId: opts.reviewId }
        : opts.repositoryId
          ? { aiReview: { repositoryId: opts.repositoryId } }
          : {}),
    };

    const result = await prisma.notification.updateMany({
      where,
      data: { read: true },
    });
    return { marked: result.count };
  }
}
