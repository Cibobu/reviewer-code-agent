import { Injectable, NotFoundException } from "@nestjs/common";
import { prisma, NotificationChannel } from "@gitguardian/db";

@Injectable()
export class ReviewsService {
  async listForUser(userId: string, repositoryId?: string) {
    const repos = await prisma.repository.findMany({
      where: { userId },
      select: { id: true, fullName: true },
    });
    const repoIds = repos.map((r) => r.id);
    if (!repoIds.length) return [];

    if (repositoryId && !repoIds.includes(repositoryId)) {
      throw new NotFoundException("Repository not found");
    }

    const reviews = await prisma.aIReview.findMany({
      where: {
        repositoryId: repositoryId ? repositoryId : { in: repoIds },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        repository: { select: { fullName: true, id: true } },
        findings: { select: { id: true, severity: true, title: true, category: true } },
      },
    });

    const unreadIds = new Set(
      (
        await prisma.notification.findMany({
          where: {
            userId,
            read: false,
            channel: NotificationChannel.IN_APP,
            aiReviewId: { in: reviews.map((r) => r.id) },
          },
          select: { aiReviewId: true },
        })
      )
        .map((n) => n.aiReviewId)
        .filter(Boolean) as string[],
    );

    return reviews.map((r) => ({ ...r, unread: unreadIds.has(r.id) }));
  }

  async getForUser(userId: string, reviewId: string) {
    const review = await prisma.aIReview.findFirst({
      where: {
        id: reviewId,
        repository: { userId },
      },
      include: {
        repository: { select: { fullName: true, name: true } },
        findings: true,
      },
    });
    if (!review) throw new NotFoundException("Review not found");
    return review;
  }
}
