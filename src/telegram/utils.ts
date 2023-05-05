import { Bot } from "grammy";
import { config } from "dotenv";
import { memoize } from "lodash-es";

config();

export const createTelegramBot = memoize(() => {
    const token = process.env.TELEGRAM_TOKEN;
    
    if (!token) throw Error("TELEGRAM_TOKEN is not configured!");
  
    return new Bot(process.env.TELEGRAM_TOKEN!)
});

export const textAdmin = async (message: string) => {
  try {
    const bot = createTelegramBot();
    await bot.api.sendMessage(process.env.ADMIN_CHAT_ID!, message);
  } catch (e) {
    console.log(e);
  }
};
