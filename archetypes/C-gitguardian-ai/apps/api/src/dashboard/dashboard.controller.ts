import { Controller, Get, Req, UnauthorizedException, Inject } from "@nestjs/common";
import type { Request } from "express";
import { prisma } from "@gitguardian/db";
import { AuthService } from "../auth/auth.service.js";

@Controller("dashboard")
export class DashboardController {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  @Get("insights")
  async insights(@Req() req: Request) {
    const token = req.cookies?.access_token as string | undefined;
    if (!token) throw new UnauthorizedException();
    const userId = this.auth.verifyAccess(token).sub;

    const repos = await prisma.repository.findMany({ where: { userId } });
    const repoIds = repos.map((r) => r.id);

    const [reviews, findings, notifications] = await Promise.all([
      prisma.aIReview.count({ where: { repositoryId: { in: repoIds } } }),
      prisma.securityFinding.groupBy({
        by: ["severity"],
        where: { repositoryId: { in: repoIds } },
        _count: true,
      }),
      prisma.notification.count({
        where: { userId, read: false },
      }),
    ]);

    const critical = findings.find((f) => f.severity === "CRITICAL")?._count ?? 0;
    const high = findings.find((f) => f.severity === "HIGH")?._count ?? 0;

    return {
      repositories: repos.length,
      activeAgents: repos.filter((r) => r.agentStatus === "ACTIVE").length,
      totalReviews: reviews,
      securityAlerts: critical + high,
      unreadNotifications: notifications,
      avgSecurityScore:
        repos.length > 0
          ? Math.round(repos.reduce((a, r) => a + r.securityScore, 0) / repos.length)
          : 100,
      codeQualityTrend: [72, 75, 78, 80, 82, 85],
    };
  }

  @Get("activity")
  async activity(@Req() req: Request) {
    const token = req.cookies?.access_token as string | undefined;
    if (!token) throw new UnauthorizedException();
    const userId = this.auth.verifyAccess(token).sub;

    const repos = await prisma.repository.findMany({
      where: { userId },
      select: { id: true, fullName: true },
    });
    const repoIds = repos.map((r) => r.id);
    const repoNames = Object.fromEntries(repos.map((r) => [r.id, r.fullName]));

    if (!repoIds.length) {
      return { events: [], reviews: [] };
    }

    const [events, recentReviews] = await Promise.all([
      prisma.webhookEvent.findMany({
        where: { repositoryId: { in: repoIds } },
        orderBy: { createdAt: "desc" },
        take: 30,
        select: {
          id: true,
          repositoryId: true,
          eventType: true,
          action: true,
          status: true,
          errorMessage: true,
          createdAt: true,
          processedAt: true,
        },
      }),
      prisma.aIReview.findMany({
        where: { repositoryId: { in: repoIds } },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          repositoryId: true,
          changeSummary: true,
          securityScore: true,
          securitySeverity: true,
          createdAt: true,
          repository: { select: { fullName: true } },
        },
      }),
    ]);

    return {
      events: events.map((e) => ({
        ...e,
        repository: repoNames[e.repositoryId],
      })),
      reviews: recentReviews,
    };
  }
}
