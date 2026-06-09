import { Module } from "@nestjs/common";
import { AuthModule } from "../../auth/auth.module.js";
import { TelegramController } from "./telegram.controller.js";

@Module({
  imports: [AuthModule],
  controllers: [TelegramController],
})
export class TelegramModule {}
