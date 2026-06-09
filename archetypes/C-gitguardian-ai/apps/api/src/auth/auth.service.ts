import { Injectable, UnauthorizedException } from "@nestjs/common";
import jwt from "jsonwebtoken";
import { prisma } from "@gitguardian/db";
import { encrypt } from "@gitguardian/shared";

const JWT_SECRET = () => process.env.JWT_SECRET ?? "dev-secret-change-me";
const JWT_REFRESH = () => process.env.JWT_REFRESH_SECRET ?? "dev-refresh-change-me";

export interface JwtPayload {
  sub: string;
  username: string;
}

@Injectable()
export class AuthService {
  signAccess(payload: JwtPayload): string {
    return jwt.sign(payload, JWT_SECRET(), { expiresIn: "15m" });
  }

  signRefresh(payload: JwtPayload): string {
    return jwt.sign(payload, JWT_REFRESH(), { expiresIn: "7d" });
  }

  verifyAccess(token: string): JwtPayload {
    try {
      return jwt.verify(token, JWT_SECRET()) as JwtPayload;
    } catch {
      throw new UnauthorizedException("Session expired. Please sign in again.");
    }
  }

  verifyRefresh(token: string): JwtPayload {
    try {
      return jwt.verify(token, JWT_REFRESH()) as JwtPayload;
    } catch {
      throw new UnauthorizedException("Refresh token expired");
    }
  }

  async upsertGitHubUser(profile: {
    githubId: string;
    username: string;
    email?: string;
    avatarUrl?: string;
    accessToken: string;
  }) {
    const user = await prisma.user.upsert({
      where: { githubId: profile.githubId },
      create: {
        githubId: profile.githubId,
        username: profile.username,
        email: profile.email,
        avatarUrl: profile.avatarUrl,
        accessToken: encrypt(profile.accessToken),
      },
      update: {
        username: profile.username,
        email: profile.email,
        avatarUrl: profile.avatarUrl,
        accessToken: encrypt(profile.accessToken),
      },
    });

    const refreshToken = this.signRefresh({ sub: user.id, username: user.username });
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await prisma.session.create({
      data: { userId: user.id, refreshToken, expiresAt },
    });

    return {
      user,
      accessToken: this.signAccess({ sub: user.id, username: user.username }),
      refreshToken,
    };
  }

  async refreshSession(refreshToken: string) {
    const payload = this.verifyRefresh(refreshToken);
    const session = await prisma.session.findUnique({ where: { refreshToken } });
    if (!session || session.expiresAt < new Date()) {
      throw new UnauthorizedException("Invalid refresh token");
    }
    const user = await prisma.user.findUniqueOrThrow({ where: { id: payload.sub } });
    return {
      accessToken: this.signAccess({ sub: user.id, username: user.username }),
      refreshToken,
    };
  }

  async logout(refreshToken: string): Promise<void> {
    await prisma.session.deleteMany({ where: { refreshToken } });
  }
}
