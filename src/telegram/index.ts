import { config } from "dotenv";
import { getChatCompletion } from "../llm/openai";
import {
  storeEmbeddingsWithMetadata,
} from "../memory";
import { TELEGRAM_SYSTEM_PROMPT } from "./prompt";
import { ChatCompletionRequestMessage } from "openai";
import { createTelegramBot, textAdmin } from "@/telegram/utils";
import { Context } from "grammy";
import { interpolateTemplate } from "@/llm/utils";
import { updateHistory, getHistory, getHistoricalContext } from "./history";

config();

const bot = createTelegramBot();

export const handleNewMessage = async (
  ctx: Context
) => {
  try {
    if (!ctx.message) {
      throw new Error("No Message!");
    }

    if (!ctx.chat) {
      throw new Error("No Chat!");
    }

    console.log("Chat Room ->", ctx.chat.id);

    const message = ctx.message.text;
    const author = await ctx.getAuthor();

    if (!message) {
      return;
    }

    let groupId = process.env.TELEGRAM_CHAT_ID;
    if (!groupId) {
      throw new Error("TELEGRAM_CHAT_ID is not configured!");
    }

    if (ctx.chat.id.toString() != groupId) {
      ctx.reply("♡ JOIN NANI DAO ---> https://t.me/+NKbETPq0J9UyODk9");
      return;
    }

    if (!ctx.message.text) {
      return 
    }

    updateHistory(
      author.user.username ?? '',
      ctx.message.text,
      ctx.message.date
    )

    await storeEmbeddingsWithMetadata({
      document: message,
      metadata: {
        content: message,
        username: author.user.username,
        user_id: author.user.id,
        id: ctx.message.message_id,
        timestamp: ctx.message.date,
      },
      indexName: "nani-agi",
      namespace: "telegram",
    });

    let messageChain: ChatCompletionRequestMessage[] = [];
    let msgHistory = await getHistory(5);
    msgHistory.forEach((msg) => {
      messageChain.push({
        role: "user",
        content: msg.message,
        name: msg.username,
      });
    });

    const relevantHistoricalContext = await getHistoricalContext(
      {
        query: `
          ${msgHistory[-1].username}:${msgHistory[-1].message}
        `
      }
    );

    const response = await getChatCompletion({
      messages: [...messageChain],
      system_prompt: interpolateTemplate(TELEGRAM_SYSTEM_PROMPT, {
        context: relevantHistoricalContext,
      }),
      model: "gpt-4",
      callback: (message) => {},
    });

    const reply = await bot.api.sendMessage(ctx.chat.id, response, {
      reply_to_message_id: ctx.message.message_id,
    });

    if (response.length > 0) {
      await storeEmbeddingsWithMetadata({
        document: response,
        metadata: {
          content: response,
          username: reply.from?.username,
          user_id: reply.from?.id,
          id: reply.message_id,
          timestamp: reply.date,
        },
        indexName: "nani-agi",
        namespace: "telegram",
      });
    }
    updateHistory(
      reply.from?.username ?? '',
      response,
      reply.date
    )
  } catch (e) {
    console.error(e);
    await textAdmin(
      `Error @nerderlyne -> ${
        e instanceof Error ? e?.message : "Unknown Error"
      }`
    );
  }
};
