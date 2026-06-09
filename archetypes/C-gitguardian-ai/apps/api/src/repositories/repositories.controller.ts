import {
  Controller,
  Get,
  Post,
  Param,
  Req,
  UnauthorizedException,
  Inject,
} from "@nestjs/common";
import type { Request } from "express";
import { AuthService } from "../auth/auth.service.js";
import { RepositoriesService } from "./repositories.service.js";

@Controller("repositories")
export class RepositoriesController {
  constructor(
    @Inject(RepositoriesService) private readonly repos: RepositoriesService,
    @Inject(AuthService) private readonly auth: AuthService,
  ) {}

  private userId(req: Request): string {
    const token = req.cookies?.access_token as string | undefined;
    if (!token) throw new UnauthorizedException();
    return this.auth.verifyAccess(token).sub;
  }

  @Get()
  list(@Req() req: Request) {
    return this.repos.listForUser(this.userId(req));
  }

  @Post("sync")
  sync(@Req() req: Request) {
    return this.repos.syncFromGitHub(this.userId(req));
  }

  @Post(":id/connect")
  connect(@Req() req: Request, @Param("id") id: string) {
    return this.repos.connectAgent(this.userId(req), id);
  }

  @Post(":id/disconnect")
  disconnect(@Req() req: Request, @Param("id") id: string) {
    return this.repos.disconnectAgent(this.userId(req), id);
  }
}
