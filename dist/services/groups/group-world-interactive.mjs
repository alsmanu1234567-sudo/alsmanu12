/**
 * Interactive WhatsApp message helpers for Group World.
 * Uses Baileys v7's protobuf Message fields through relayMessage.
 */

import { randomBytes } from "node:crypto";

const MAX_BUTTONS = 20;
const MAX_LIST_ROWS = 10;

function unwrap(message) {
  let content = message?.message || {};
  for (let index = 0; index < 6; index += 1) {
    const wrapped =
      content.ephemeralMessage?.message ||
      content.viewOnceMessage?.message ||
      content.viewOnceMessageV2?.message ||
      content.documentWithCaptionMessage?.message;
    if (!wrapped) break;
    content = wrapped;
  }
  return content;
}

export function extractInteractiveSelection(message) {
  const content = unwrap(message);
  const button = content.buttonsResponseMessage;
  if (button?.selectedButtonId) {
    return {
      id: String(button.selectedButtonId),
      label: String(button.selectedDisplayText || ""),
      source: "button",
    };
  }

  const template = content.templateButtonReplyMessage;
  if (template?.selectedId) {
    return {
      id: String(template.selectedId),
      label: String(template.selectedDisplayText || ""),
      source: "template",
    };
  }

  const list = content.listResponseMessage?.singleSelectReply;
  if (list?.selectedRowId) {
    return {
      id: String(list.selectedRowId),
      label: String(content.listResponseMessage?.title || ""),
      source: "list",
    };
  }

  const native = content.interactiveResponseMessage?.nativeFlowResponseMessage;
  if (native?.paramsJson) {
    try {
      const params = JSON.parse(native.paramsJson);
      const id = params.id || params.selectedId || params.rowId || params.buttonId;
      if (id) {
        return {
          id: String(id),
          label: String(params.display_text || params.title || native.name || ""),
          source: "native-flow",
        };
      }
    } catch {
      return null;
    }
  }

  return null;
}

function messageId() {
  return randomBytes(10).toString("hex").toUpperCase();
}

export function createQuickReplyMessage(text, buttons, footer = "", imageMessage = null) {
  const items = Array.isArray(buttons) ? buttons.slice(0, MAX_BUTTONS) : [];
  if (!items.length) throw new Error("تحتاج الرسالة إلى زر تفاعلي واحد على الأقل");
  return {
    interactiveMessage: {
      ...(imageMessage ? { header: { hasMediaAttachment: true, imageMessage } } : {}),
      body: { text: String(text || "").slice(0, 3_500) },
      ...(footer ? { footer: { text: String(footer).slice(0, 60) } } : {}),
      nativeFlowMessage: {
        messageVersion: 1,
        buttons: items.map((button) => ({
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: String(button.label || "").slice(0, 24),
            id: String(button.id || "").slice(0, 180),
          }),
        })),
      },
    },
  };
}

export function createListMessage({ title, description, buttonText = "اختر", footer = "", sections }) {
  const rows = (Array.isArray(sections) ? sections : [])
    .map((section) => ({
      title: String(section.title || "").slice(0, 24),
      rows: (Array.isArray(section.rows) ? section.rows : []).slice(0, MAX_LIST_ROWS).map((row) => ({
        rowId: String(row.id || "").slice(0, 200),
        title: String(row.title || "").slice(0, 24),
        description: String(row.description || "").slice(0, 72),
      })),
    }))
    .filter((section) => section.rows.length);
  if (!rows.length) throw new Error("القائمة تحتاج إلى خيار واحد على الأقل");
  if (rows.reduce((count, section) => count + section.rows.length, 0) > MAX_LIST_ROWS) {
    throw new Error(`القائمة تدعم ${MAX_LIST_ROWS} خيارات كحد أقصى`);
  }
  return {
    listMessage: {
      title: String(title || "").slice(0, 24),
      description: String(description || "").slice(0, 1_024),
      buttonText: String(buttonText || "اختر").slice(0, 20),
      listType: 1,
      sections: rows,
      ...(footer ? { footerText: String(footer).slice(0, 60) } : {}),
    },
  };
}

export function createButtonMessage(text, buttons, footer = "", imageMessage = null) {
  const items = Array.isArray(buttons) ? buttons.slice(0, 3) : [];
  if (!items.length) throw new Error("تحتاج الرسالة إلى زر تفاعلي واحد على الأقل");
  return {
    buttonsMessage: {
      contentText: String(text || "").slice(0, 3_500),
      footerText: String(footer || "").slice(0, 60),
      headerType: imageMessage ? 4 : 1,
      ...(imageMessage ? { imageMessage } : {}),
      buttons: items.map((button) => ({
        buttonId: String(button.id || "").slice(0, 180),
        buttonText: { displayText: String(button.label || "").slice(0, 20) },
        type: 1,
      })),
    },
  };
}

export async function sendInteractiveMessage(sock, groupId, content, options = {}) {
  if (typeof sock?.relayMessage !== "function") {
    throw new Error("إرسال الرسائل التفاعلية غير متاح في اتصال WhatsApp الحالي");
  }
  const id = String(options.messageId || messageId());
  await sock.relayMessage(groupId, content, {
    messageId: id,
    useCachedGroupMetadata: true,
  });
  return id;
}

export async function prepareInteractiveImage(sock, image) {
  if (!image) return null;
  if (typeof sock?.waUploadToServer !== "function") {
    throw new Error("رفع الصور للرسائل التفاعلية غير متاح في اتصال WhatsApp الحالي");
  }
  const baileys = await import("@whiskeysockets/baileys");
  const content = await baileys.prepareWAMessageMedia(
    { image: { url: String(image) } },
    {
      upload: sock.waUploadToServer,
      mediaCache: sock.mediaCache,
      logger: sock.logger,
    },
  );
  return content.imageMessage || null;
}

