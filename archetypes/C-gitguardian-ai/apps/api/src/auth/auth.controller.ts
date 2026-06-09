import {
  Controller,
  Get,
  Post,
  Req,
  Res,
  Query,
  UnauthorizedException,
  Body,
  Inject,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { AuthService } from "./auth.service.js";
import { COOKIE_OPTS } from "./cookies.js";

@Controller("auth")
export class AuthController {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  @Get("github")
  githubLogin(@Res() res: Response): void {
    const clientId = process.env.GITHUB_CLIENT_ID;
    if (!clientId) {
      res.status(500).json({ error: "GITHUB_CLIENT_ID not configured" });
      return;
    }
    const redirect = encodeURIComponent(
      process.env.GITHUB_CALLBACK_URL ?? "http://localhost:4000/api/auth/github/callback",
    );
    const scope = encodeURIComponent("read:user repo admin:repo_hook");
    res.redirect(
      `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${redirect}&scope=${scope}`,
    );
  }

  @Get("github/callback")
  async githubCallback(
    @Query("code") code: string,
    @Res() res: Response,
  ): Promise<void> {
    if (!code) {
      res.redirect(`${process.env.WEB_URL}/login?error=no_code`);
      return;
    }

    const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
      }),
    });
    const tokenData = (await tokenRes.json()) as { access_token?: string; error?: string };
    if (!tokenData.access_token) {
      res.redirect(`${process.env.WEB_URL}/login?error=oauth_failed`);
      return;
    }

    const userRes = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        Accept: "application/vnd.github+json",
      },
    });
    const ghUser = (await userRes.json()) as {
      id: number;
      login: string;
      email?: string;
      avatar_url?: string;
    };

    const session = await this.auth.upsertGitHubUser({
      githubId: String(ghUser.id),
      username: ghUser.login,
      email: ghUser.email,
      avatarUrl: ghUser.avatar_url,
      accessToken: tokenData.access_token,
    });

    res.cookie("access_token", session.accessToken, COOKIE_OPTS);
    res.cookie("refresh_token", session.refreshToken, COOKIE_OPTS);
    res.redirect(`${process.env.WEB_URL}/dashboard`);
  }

  @Post("refresh")
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken =
      (req.cookies?.refresh_token as string | undefined) ??
      (req.body as { refreshToken?: string })?.refreshToken;
    if (!refreshToken) throw new UnauthorizedException();
    const session = await this.auth.refreshSession(refreshToken);
    res.cookie("access_token", session.accessToken, COOKIE_OPTS);
    return { ok: true };
  }

  @Post("logout")
  async logout(@Req() req: Request, @Res() res: Response): Promise<void> {
    const refresh = req.cookies?.refresh_token as string | undefined;
    if (refresh) {
      try {
        await this.auth.logout(refresh);
      } catch {
        // Session may already be invalid — still clear cookies
      }
    }
    res.clearCookie("access_token", COOKIE_OPTS);
    res.clearCookie("refresh_token", COOKIE_OPTS);
    res.json({ ok: true });
  }

  @Get("me")
  async me(@Req() req: Request) {
    const token = req.cookies?.access_token as string | undefined;
    if (!token) throw new UnauthorizedException();
    const payload = this.auth.verifyAccess(token);
    const { prisma } = await import("@gitguardian/db");
    return prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, username: true, email: true, avatarUrl: true },
    });
  }
}
