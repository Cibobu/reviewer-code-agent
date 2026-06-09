import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Req,
  UnauthorizedException,
  BadRequestException,
  Inject,
} from "@nestjs/common";
import type { Request } from "express";
import { prisma, NotificationPreference } from "@gitguardian/db";
import { encrypt, decrypt, maskToken } from "@gitguardian/shared";
import { normalizeChatId, chatIdForApi, isValidChatIdFormat } from "@gitguardian/shared/telegram";
import { AuthService } from "../../auth/auth.service.js";

type TelegramApiResult<T> = { ok: boolean; result?: T; description?: string };
type TelegramChat = {
  id: number;
  type: string;
  title?: string;
  username?: string;
  first_name?: string;
};

async function sendTelegram(token: string, chatId: string, text: string) {
  return fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatIdForApi(chatId), text }),
  });
}

@Controller("integrations/telegram")
export class TelegramController {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  private userId(req: Request): string {
    const token = req.cookies?.access_token as string | undefined;
    if (!token) throw new UnauthorizedException();
    return this.auth.verifyAccess(token).sub;
  }

  @Get("status")
  async status(@Req() req: Request) {
    const userId = this.userId(req);
    const tg = await prisma.telegramIntegration.findUnique({ where: { userId } });
    if (!tg) return { connected: false };
    return {
      connected: true,
      isActive: tg.isActive,
      botUsername: tg.botUsername,
      chatId: tg.chatId,
      tokenMasked: maskToken(decrypt(tg.botTokenEncrypted)),
      notificationPreference: tg.notificationPreference,
      lastDeliveryStatus: tg.lastDeliveryStatus,
    };
  }

  @Get("discover-chats")
  async discoverChats(@Req() req: Request) {
    const userId = this.userId(req);
    const tg = await prisma.telegramIntegration.findUnique({ where: { userId } });
    if (!tg) throw new BadRequestException("Connect bot token first.");

    const token = decrypt(tg.botTokenEncrypted);
    const res = await fetch(`https://api.telegram.org/bot${token}/getUpdates?limit=20`);
    const data = (await res.json()) as TelegramApiResult<
      Array<{ message?: { chat: TelegramChat }; my_chat_member?: { chat: TelegramChat } }>
    >;

    const chats = new Map<number, TelegramChat & { label: string }>();
    for (const update of data.result ?? []) {
      const chat = update.message?.chat ?? update.my_chat_member?.chat;
      if (!chat?.id) continue;
      const label =
        chat.title ??
        (chat.username ? `@${chat.username}` : undefined) ??
        chat.first_name ??
        `Chat ${chat.id}`;
      chats.set(chat.id, { ...chat, label });
    }

    return {
      chats: Array.from(chats.values()).map((c) => ({
        id: String(c.id),
        type: c.type,
        label: c.label,
      })),
      hint:
        chats.size === 0
          ? `No chats found. Open @${tg.botUsername ?? "your_bot"} on Telegram, tap Start, then try again.`
          : undefined,
    };
  }

  @Post("connect")
  async connect(@Req() req: Request, @Body("botToken") botToken: string) {
    const userId = this.userId(req);
    const meRes = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
    const me = (await meRes.json()) as TelegramApiResult<{ username: string }>;
    if (!me.ok || !me.result) {
      return { error: "Telegram bot token is invalid. Please check your token from BotFather." };
    }

    await prisma.telegramIntegration.upsert({
      where: { userId },
      create: {
        userId,
        botTokenEncrypted: encrypt(botToken),
        botUsername: me.result.username,
      },
      update: {
        botTokenEncrypted: encrypt(botToken),
        botUsername: me.result.username,
      },
    });
    return { ok: true, botUsername: me.result.username };
  }

  @Post("verify")
  async verify(@Req() req: Request, @Body("chatId") chatId: string) {
    const userId = this.userId(req);
    const tg = await prisma.telegramIntegration.findUnique({ where: { userId } });
    if (!tg) throw new BadRequestException("Connect bot token first.");

    const normalized = normalizeChatId(chatId);
    if (!isValidChatIdFormat(normalized)) {
      throw new BadRequestException("Invalid Chat ID format. Use numbers only (e.g. 123456789).");
    }

    const token = decrypt(tg.botTokenEncrypted);
    const chatRes = await fetch(
      `https://api.telegram.org/bot${token}/getChat?chat_id=${encodeURIComponent(chatIdForApi(normalized))}`,
    );
    const chatBody = (await chatRes.json()) as TelegramApiResult<TelegramChat>;
    if (!chatBody.ok) {
      return {
        error:
          `Chat not found for this bot. Open @${tg.botUsername ?? "your_bot"} on Telegram, tap Start, then use Discover Chat ID.`,
        detail: chatBody.description,
      };
    }

    await prisma.telegramIntegration.update({
      where: { userId },
      data: { chatId: normalized },
    });
    return { ok: true, chatId: normalized };
  }

  @Post("test-message")
  async testMessage(@Req() req: Request) {
    const userId = this.userId(req);
    const tg = await prisma.telegramIntegration.findUnique({ where: { userId } });
    if (!tg) throw new BadRequestException("Connect bot token first.");
    if (!tg.chatId) {
      return { error: "Chat ID not set. Add chat ID first." };
    }

    const token = decrypt(tg.botTokenEncrypted);
    const res = await sendTelegram(
      token,
      tg.chatId,
      "✅ GitGuardian AI connected successfully!",
    );
    const body = (await res.json()) as { ok: boolean; description?: string };
    if (!body.ok) {
      const hint =
        body.description?.includes("chat not found")
          ? `Open @${tg.botUsername ?? "your_bot"} on Telegram, tap Start, then save Chat ID again (or use Discover Chat ID).`
          : "Make sure your bot has been added to the chat or that you have started the bot.";
      return { error: hint, detail: body.description };
    }

    await prisma.telegramIntegration.update({
      where: { userId },
      data: { isActive: true, lastDeliveryStatus: "ok", lastDeliveryAt: new Date() },
    });
    return { ok: true };
  }

  @Patch("preferences")
  async preferences(
    @Req() req: Request,
    @Body("notificationPreference") pref: NotificationPreference,
  ) {
    const userId = this.userId(req);
    const tg = await prisma.telegramIntegration.findUnique({ where: { userId } });
    if (!tg) throw new BadRequestException("Connect bot token first.");
    await prisma.telegramIntegration.update({
      where: { userId },
      data: { notificationPreference: pref },
    });
    return { ok: true };
  }

  @Delete("disconnect")
  async disconnect(@Req() req: Request) {
    const userId = this.userId(req);
    await prisma.telegramIntegration.deleteMany({ where: { userId } });
    return { ok: true };
  }
}
