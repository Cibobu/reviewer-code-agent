import { Body, Controller, Get, Inject, Patch, Query, Req, UnauthorizedException } from "@nestjs/common";
import type { Request } from "express";
import { AuthService } from "../auth/auth.service.js";
import { NotificationsService } from "./notifications.service.js";

@Controller("notifications")
export class NotificationsController {
  constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(NotificationsService) private readonly notifications: NotificationsService,
  ) {}

  private userId(req: Request): string {
    const token = req.cookies?.access_token as string | undefined;
    if (!token) throw new UnauthorizedException();
    return this.auth.verifyAccess(token).sub;
  }

  @Get("unread-count")
  unreadCount(@Req() req: Request, @Query("repositoryId") repositoryId?: string) {
    return this.notifications
      .unreadCount(this.userId(req), repositoryId)
      .then((count) => ({ count }));
  }

  @Get("unread-by-repo")
  unreadByRepo(@Req() req: Request) {
    return this.notifications.unreadByRepository(this.userId(req));
  }

  @Patch("mark-read")
  markRead(
    @Req() req: Request,
    @Body() body: { repositoryId?: string; reviewId?: string },
  ) {
    return this.notifications.markRead(this.userId(req), body);
  }
}
