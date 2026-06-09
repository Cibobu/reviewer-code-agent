import { Controller, Get, Param, Query, Req, UnauthorizedException, Inject } from "@nestjs/common";
import type { Request } from "express";
import { AuthService } from "../auth/auth.service.js";
import { ReviewsService } from "./reviews.service.js";
import { NotificationsService } from "../notifications/notifications.service.js";

@Controller("reviews")
export class ReviewsController {
  constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(ReviewsService) private readonly reviews: ReviewsService,
    @Inject(NotificationsService) private readonly notifications: NotificationsService,
  ) {}

  private userId(req: Request): string {
    const token = req.cookies?.access_token as string | undefined;
    if (!token) throw new UnauthorizedException();
    return this.auth.verifyAccess(token).sub;
  }

  @Get()
  async list(@Req() req: Request, @Query("repositoryId") repositoryId?: string) {
    return this.reviews.listForUser(this.userId(req), repositoryId);
  }

  @Get(":id")
  async detail(@Req() req: Request, @Param("id") id: string) {
    const userId = this.userId(req);
    const review = await this.reviews.getForUser(userId, id);
    await this.notifications.markRead(userId, { reviewId: id });
    return review;
  }
}
