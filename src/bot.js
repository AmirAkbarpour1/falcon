import { Telegraf, Markup, session } from "telegraf";
import TelegrafI18n from "i18n-telegraf";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import { SQLite } from "@telegraf/session/sqlite";
import { getClient } from "./clients/clientsServices.js";
import moment from "moment-timezone";
import { message } from "telegraf/filters";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// create a new bot
const bot = new Telegraf("7472526951:AAHrO5EYKjICUBXmGIIB3kKjdTwHAu8h6YM");

// use session for save lang and ...
const store = SQLite({
  filename: "./telegraf-sessions.sqlite",
});

bot.use(session({ store, defaultSession: () => ({ __language_code: "en" }) }));

const i18n = new TelegrafI18n({
  sessionName: "session",
  useSession: true,
  directory: resolve(__dirname, "../locales"),
});

bot.use(i18n.middleware());

// start HandLer

function sendMenu(ctx, typeOfSend) {
  const lang = ctx.i18n.locale();
  const keyboard = Markup.inlineKeyboard([
    [
      Markup.button.callback(
        ctx.i18n.t("bot.welcome.buttons.buy"),
        "buy_srvice"
      ),
    ],
    [
      Markup.button.callback(
        ctx.i18n.t("bot.welcome.buttons.services"),
        "my_services"
      ),
    ],
    [
      Markup.button.callback(
        ctx.i18n.t("bot.welcome.buttons.wallet"),
        "wallet"
      ),
      Markup.button.callback(ctx.i18n.t("bot.welcome.buttons.price"), "price"),
    ],
    [
      Markup.button.callback(
        ctx.i18n.t("bot.welcome.buttons.instruction"),
        "instruction"
      ),
      Markup.button.callback(
        ctx.i18n.t("bot.welcome.buttons.support"),
        "support"
      ),
    ],
    [
      Markup.button.callback(
        ctx.i18n.t("bot.welcome.buttons.language"),
        "change_language"
      ),
    ],
  ]).resize();

  switch (typeOfSend) {
    case "edit": {
      ctx.editMessageText(ctx.i18n.t("bot.welcome.dec"), keyboard);
      break;
    }
    case "resend": {
      ctx.replyWithMarkdown(ctx.i18n.t("bot.welcome.dec"), keyboard);
      break;
    }
    default: {
      ctx.replyWithMarkdown(ctx.i18n.t("bot.welcome.dec"), keyboard);
      break;
    }
  }
}
bot.start((ctx) => {
  sendMenu(ctx);
});

// change language
bot.action("change_language", async (ctx) => {
  const lang = ctx.i18n.locale();
  ctx.session.__language_code = lang === "en" ? "fa" : "en";
  ctx.i18n.locale(lang === "en" ? "fa" : "en");
  ctx.deleteMessage();
  sendMenu(ctx, "resend");
  ctx.answerCbQuery(ctx.i18n.t("bot.answerQuery.change_language"));
});

// instruction
bot.action("instruction", async (ctx) => {
  const keyboard = Markup.inlineKeyboard([
    [
      Markup.button.callback(
        ctx.i18n.t("bot.instruction.android"),
        "instruction_android"
      ),
    ],
    [
      Markup.button.callback(
        ctx.i18n.t("bot.instruction.iphone"),
        "instruction_iphone"
      ),
    ],
    [
      Markup.button.callback(
        ctx.i18n.t("bot.instruction.windows"),
        "instruction_windows"
      ),
    ],
    [
      Markup.button.callback(
        ctx.i18n.t("bot.instruction.mac"),
        "instruction_mac"
      ),
    ],
    [
      Markup.button.callback(
        ctx.i18n.t("bot.welcome.buttons.back"),
        "back_menu"
      ),
    ],
  ]);
  ctx.editMessageText(ctx.i18n.t("bot.instruction.dec"), keyboard);

  ctx.answerCbQuery(ctx.i18n.t("bot.answerQuery.instruction"));
});

bot.action("back_menu", async (ctx) => {
  sendMenu(ctx, "edit");
  ctx.answerCbQuery(ctx.i18n.t("bot.answerQuery.back_menu"));
});
// check Info
let pendingCheck = null;

bot.command("check", (ctx) => {
  pendingCheck = ctx.from.id;
  ctx.reply(ctx.i18n.t("bot.info.dec"), {
    reply_to_message_id: ctx.message.message_id,
  });
});

bot.on(message("text"), async (ctx) => {
  if (ctx.from.id === pendingCheck) {
    try {
      const client = await getClient(ctx.message.text);
      const status = client.enable
        ? ctx.i18n.t("bot.info.status_active")
        : ctx.i18n.t("bot.info.status_inactive");

      const expirationDay =
        client.expirationDay === "Unlimited"
          ? ctx.i18n.t("bot.info.unlimited")
          : client.expirationDay;

      const remainingTime =
        client.remainingTime === "Unlimited"
          ? ctx.i18n.t("bot.info.unlimited")
          : client.remainingTime;
      const limitIp =
        client.limitIp === 0
          ? ctx.i18n.t("bot.info.unlimited")
          : client.limitIp;

      const message = ctx.i18n.t("bot.info.client_info", {
        name: client.email,
        status: status,
        expiration: expirationDay,
        remaining: remainingTime,
        totalTraffic: client.totalTraffic,
        remainingTraffic: client.remainingTraffic,
        TotalUsage: client.totalUsage,
        download: client.download,
        upload: client.upload,
        limitIp: limitIp,
        ConnectedIps: client.ipsCount,
        time: moment().tz("Asia/Tehran").format("HH:mm:ss"),
      });

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback("update", `update_info:${client.uuid}`)],
      ]);

      ctx.reply(message, keyboard, {
        reply_to_message_id: ctx.message.message_id,
      });
    } catch (error) {
      ctx.reply(ctx.i18n.t("bot.error", { error: error.message }));
    }
    pendingCheck = null;
  }
});

bot.action(/update_info:(.+)/, async (ctx) => {
  const uuid = ctx.match[1];
  try {
    const client = await getClient(uuid);
    const status = client.enable
      ? ctx.i18n.t("bot.info.status_active")
      : ctx.i18n.t("bot.info.status_inactive");

    const expirationDay =
      client.expirationDay === "Unlimited"
        ? ctx.i18n.t("bot.info.unlimited")
        : client.expirationDay;

    const remainingTime =
      client.remainingTime === "Unlimited"
        ? ctx.i18n.t("bot.info.unlimited")
        : client.remainingTime;
    const limitIp =
      client.limitIp === 0 ? ctx.i18n.t("bot.info.unlimited") : client.limitIp;

    const message = ctx.i18n.t("bot.info.client_info", {
      name: client.email,
      status: status,
      expiration: expirationDay,
      remaining: remainingTime,
      totalTraffic: client.totalTraffic,
      remainingTraffic: client.remainingTraffic,
      TotalUsage: client.totalUsage,
      download: client.download,
      upload: client.upload,
      limitIp: limitIp,
      ConnectedIps: client.ipsCount,
      time: moment().tz("Asia/Tehran").format("HH:mm:ss"),
    });

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback("update", `update_info:${client.uuid}`)],
    ]);

    ctx.editMessageText(message, keyboard);
    ctx.answerCbQuery("status updated");
  } catch (error) {
    ctx.answerCbQuery(ctx.i18n.t("bot.error", { error: error.message }));
  }
});

// Start bot on server
bot
  .launch()
  .then(() => console.log("Bot started"))
  .catch((error) => {
    console.error("Error starting bot:", error);
  });

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
