import { html } from "jsr:@mtcute/html-parser";
import { Dispatcher, filters } from "jsr:@mtcute/dispatcher";
import { md } from "jsr:@mtcute/markdown-parser";
import { BotKeyboard } from "jsr:@mtcute/core";
import redis from "../../utils/redis.ts";

const dp = Dispatcher.child();

function shuffleArray<T>(array: T[]): T[] {
  const shuffledArray = [...array];

  for (let i = shuffledArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));

    [shuffledArray[i], shuffledArray[j]] = [shuffledArray[j], shuffledArray[i]];
  }

  return shuffledArray;
}

function delay(seconds: number) {
  return new Promise((resolve) => setTimeout(resolve, seconds * 1000));
}

dp.onChatMemberUpdate(filters.chatMember("joined"), async (upd) => {
  const firstNum = Math.floor(Math.random() * 11) + 1;
  console.log(firstNum);
  const secondNum = Math.floor(Math.random() * 11) + 1;
  console.log(firstNum);
  const sign = Math.floor(Math.random() * 2);
  let signChar = "";
  let result = 0;

  if (sign) {
    result = firstNum + secondNum;
    signChar = "+";
  } else {
    result = firstNum - secondNum;
    signChar = "-";
  }

  let possibleAnswers = [];
  possibleAnswers.push(result);
  for (let i = 0; i < 7; i++) {
    let answer: number;
    do {
      answer = Math.floor(Math.random() * 40) - 20;
    } while (possibleAnswers.indexOf(answer) != -1);
    possibleAnswers.push(answer);
  }

  possibleAnswers = shuffleArray(possibleAnswers);

  console.log(possibleAnswers);

  const markup = BotKeyboard.builder(4);

  for (const answer of possibleAnswers) {
    markup.append(BotKeyboard.callback(`${answer}`, `${answer}`));
  }

  const response = await upd.client.sendText(
    upd.chat.id,
    md`✨ **Benvenuto, ${upd.user.displayName}!**

⚠️ Leggere attentamente!
Per provare che tu non sia un bot, per favore, risolvi questo semplice problema: \n\n
${html`<pre>${firstNum} ${signChar} ${secondNum} = ?</pre>`}`,
    { replyMarkup: markup.asInline() },
  );

  await redis.set(`captcha_${response.id}_result`, result);
  await redis.set(`captcha_${response.id}_user_id`, upd.user.id);
  await redis.set(`captcha_${response.id}_attempts`, 2);

  await delay(10);

  if (await redis.exists(`captcha_${response.id}_user_id`)) {
    await upd.client.kickChatMember({
      chatId: upd.chat.id,
      userId: upd.user.id,
    });
    await upd.client.editMessage({
      message: response,
      text: `❌ ${upd.user.displayName} non ha completato il captcha nel tempo limite ed è stato espulso.`,
    });
  }
});

dp.onCallbackQuery(async (upd) => {
  if (
    upd.user.id != Number(await redis.get(`captcha_${upd.messageId}_user_id`))
  ) {
    upd.answer({ text: "Il captcha non è per te. 😝" });
    return;
  }
  if (upd.dataStr != (await redis.get(`captcha_${upd.messageId}_result`))) {
    if (Number(await redis.get(`captcha_${upd.messageId}_attempts`)) == 0) {
      upd.answer({
        text: `Hai terminato i tentativi a disposizione. Verrai espulso in 5 secondi.`,
      });
      setTimeout(() => {
        upd.client.kickChatMember({ chatId: upd.chat.id, userId: upd.user.id });
      }, 5 * 1000);
      upd.editMessage({
        text: `❌ ${upd.user.displayName} non ha passato il captcha ed è stato espulso.`,
      });
      await redis.del(`captcha_${upd.messageId}_result`);
      await redis.del(`captcha_${upd.messageId}_user_id`);
      await redis.del(`captcha_${upd.messageId}_attempts`);
      return;
    }
    await redis.set(
      `captcha_${upd.messageId}_attempts`,
      Number(await redis.get(`captcha_${upd.messageId}_attempts`)) - 1,
    );
    upd.answer({
      text: `Risposta errata. Hai ancora ${await redis.get(`captcha_${upd.messageId}_attempts`)} tentativo.`,
    });
  } else {
    const newText = md`✨ **Benvenuto, ${upd.user.displayName}!**

✅ Captcha superato, buona permanenza in ${upd.chat.displayName}.`;
    upd.editMessage({ text: newText });
    await redis.del(`captcha_${upd.messageId}_result`);
    await redis.del(`captcha_${upd.messageId}_user_id`);
    await redis.del(`captcha_${upd.messageId}_attempts`);
    return;
  }
});

export { dp as captcha };
