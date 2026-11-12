import assert from "node:assert/strict";
import test from "node:test";

import {
  getMyMsgsSettingsForNumber,
  handleMyMsgsCallback,
  myMsgsFeatureSubMenu,
  myMsgsMenuKeyboard,
  saveMyMsgsSettingsForNumber,
  setDeps,
} from "../../dist/my-msgs.mjs";

test("stores the selected video-download group on the correct WhatsApp number", () => {
  const phoneNumber = "+249900000001";
  const user = {
    telegramId: "telegram-user",
    whatsappNumbers: [{ number: phoneNumber, settings: {} }],
  };
  const saved = [];
  setDeps({
    getUser: () => user,
    saveUser: (_userId, update) => {
      Object.assign(user, update);
      saved.push(update);
    },
  });

  const settings = saveMyMsgsSettingsForNumber(
    user.telegramId,
    phoneNumber,
    { linkVideoGroupJid: "120363000000000000@g.us" },
  );

  assert.equal(settings.linkVideoEnabled, true);
  assert.equal(
    getMyMsgsSettingsForNumber(user, phoneNumber).linkVideoGroupJid,
    "120363000000000000@g.us",
  );
  assert.equal(saved.length, 1);
});

test("shows the link-video feature and valid toggle controls in My Messages", () => {
  const menu = myMsgsMenuKeyboard({ linkVideoEnabled: true });
  assert.ok(
    menu.inline_keyboard.flat().some(
      (button) => button.callback_data === "mymsgs_show_linkvid",
    ),
  );

  const submenu = myMsgsFeatureSubMenu({ linkVideoEnabled: true }, "linkvid");
  assert.equal(submenu.keyboard.inline_keyboard[0][0].callback_data, "mymsgs_toggle_linkvid");
  assert.ok(
    submenu.keyboard.inline_keyboard.flat().every(
      (button) => typeof button.callback_data === "string",
    ),
  );
  assert.equal(submenu.text.includes("null"), false);
});

test("the My Messages toggle can disable link downloads", async () => {
  const phoneNumber = "+249900000002";
  const user = {
    telegramId: "telegram-toggle",
    whatsappNumbers: [
      {
        number: phoneNumber,
        settings: {
          linkVideoEnabled: true,
          linkVideoGroupJid: "120363000000000000@g.us",
        },
      },
    ],
  };
  setDeps({
    getUser: () => user,
    saveUser: (_userId, update) => Object.assign(user, update),
  });
  const sent = [];
  const bot = {
    sendMessage: async (_chatId, text, options) => sent.push({ text, options }),
  };

  await handleMyMsgsCallback(bot, 123, user.telegramId, "mymsgs_toggle_linkvid");

  assert.equal(
    getMyMsgsSettingsForNumber(user, phoneNumber).linkVideoEnabled,
    false,
  );
  assert.equal(sent.length, 1);
});
