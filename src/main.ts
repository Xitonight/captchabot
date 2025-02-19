import { TelegramClient } from "jsr:@mtcute/deno";
import { Dispatcher } from "jsr:@mtcute/dispatcher";

import { captcha } from "./modules/core/captcha.ts";

const tg = new TelegramClient({
  apiId: Number(Deno.env.get("API_ID")!),
  apiHash: Deno.env.get("API_HASH")!,
  storage: "storage/bot",
});

const dp = Dispatcher.for(tg);

dp.addChild(captcha);

const self = await tg.start({
  botToken: Deno.env.get("BOT_TOKEN")!,
});

console.log(`Logged in as ${self.displayName}.`);
