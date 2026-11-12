import test from "node:test";
import assert from "node:assert/strict";
import {
  createButtonMessage,
  createListMessage,
  createQuickReplyMessage,
  extractInteractiveSelection,
  sendInteractiveMessage,
} from "../../dist/services/groups/group-world-interactive.mjs";

test("builds genuine Baileys v7 native-flow quick replies", () => {
  const content = createQuickReplyMessage("Choose", [{ id: "action:one", label: "Open" }]);
  const button = content.interactiveMessage.nativeFlowMessage.buttons[0];
  assert.equal(button.name, "quick_reply");
  assert.deepEqual(JSON.parse(button.buttonParamsJson), { display_text: "Open", id: "action:one" });
});

test("builds a list message with stable row IDs and a button message with optional image", () => {
  const list = createListMessage({
    title: "Menu",
    description: "Choose one",
    sections: [{ title: "Options", rows: [{ id: "row:one", title: "One" }] }],
  });
  assert.equal(list.listMessage.listType, 1);
  assert.equal(list.listMessage.sections[0].rows[0].rowId, "row:one");

  const image = { url: "https://example.test/image.jpg", mimetype: "image/jpeg" };
  const buttons = createButtonMessage("Caption", [{ id: "open", label: "Open" }], "Footer", image);
  assert.equal(buttons.buttonsMessage.headerType, 4);
  assert.equal(buttons.buttonsMessage.imageMessage, image);
});

test("extracts legacy button, list, and native-flow responses", () => {
  assert.equal(extractInteractiveSelection({
    message: { buttonsResponseMessage: { selectedButtonId: "legacy:button", selectedDisplayText: "Button" } },
  }).id, "legacy:button");
  assert.equal(extractInteractiveSelection({
    message: { listResponseMessage: { singleSelectReply: { selectedRowId: "legacy:row" } } },
  }).id, "legacy:row");
  assert.equal(extractInteractiveSelection({
    message: {
      ephemeralMessage: {
        message: {
          interactiveResponseMessage: {
            nativeFlowResponseMessage: { name: "quick_reply", paramsJson: '{"id":"native:button"}' },
          },
        },
      },
    },
  }).id, "native:button");
});

test("relays interactive content through Baileys relayMessage", async () => {
  let received;
  const sock = {
    relayMessage: async (...args) => { received = args; },
  };
  const content = createQuickReplyMessage("Choose", [{ id: "action", label: "Open" }]);
  await sendInteractiveMessage(sock, "120363000000001@g.us", content, { messageId: "stable-message-id" });
  assert.equal(received[0], "120363000000001@g.us");
  assert.equal(received[1], content);
  assert.equal(received[2].messageId, "stable-message-id");
});
