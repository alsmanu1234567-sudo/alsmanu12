import assert from "node:assert/strict";
import test from "node:test";

import {
  getAllowedVideoPageUrl,
  isAllowedLinkVideoGroup,
  isSoloWhatsAppGroup,
} from "../../dist/video-link-guards.mjs";

test("accepts the configured HTTPS video page, including tracking parameters", () => {
  const input =
    "https://ara.thexh.live/videos/pornfidelity-xhULryi?utm_source=ext_shared&utm_medium=referral&utm_campaign=link";
  assert.equal(getAllowedVideoPageUrl(input), input);
});

test("rejects non-allowlisted, insecure, or non-video-page URLs", () => {
  assert.equal(
    getAllowedVideoPageUrl("https://example.com/videos/a"),
    null,
  );
  assert.equal(
    getAllowedVideoPageUrl("http://ara.thexh.live/videos/a"),
    null,
  );
  assert.equal(
    getAllowedVideoPageUrl("https://ara.thexh.live/"),
    null,
  );
  assert.equal(
    getAllowedVideoPageUrl("https://user@ara.thexh.live/videos/a"),
    null,
  );
});

test("rejects messages containing more than one URL", () => {
  assert.equal(
    getAllowedVideoPageUrl(
      "https://ara.thexh.live/videos/a https://example.com/other",
    ),
    null,
  );
});

test("only enables automatic downloads in the selected group", () => {
  const settings = {
    linkVideoEnabled: true,
    linkVideoGroupJid: "120363000000000000@g.us",
  };
  assert.equal(
    isAllowedLinkVideoGroup(settings, "120363000000000000@g.us"),
    true,
  );
  assert.equal(
    isAllowedLinkVideoGroup(settings, "120363000000000001@g.us"),
    false,
  );
  assert.equal(
    isAllowedLinkVideoGroup(settings, "249000000000@s.whatsapp.net"),
    false,
  );
  assert.equal(
    isAllowedLinkVideoGroup(
      { ...settings, linkVideoEnabled: false },
      "120363000000000000@g.us",
    ),
    false,
  );
});

test("requires the linked WhatsApp number to be the group's only participant", () => {
  const socket = { user: { id: "249900000001:7@s.whatsapp.net" } };
  assert.equal(
    isSoloWhatsAppGroup(
      { participants: [{ id: "249900000001@s.whatsapp.net" }] },
      socket,
    ),
    true,
  );
  assert.equal(
    isSoloWhatsAppGroup(
      {
        participants: [
          { id: "249900000001@s.whatsapp.net" },
          { id: "249900000002@s.whatsapp.net" },
        ],
      },
      socket,
    ),
    false,
  );
  assert.equal(
    isSoloWhatsAppGroup({ participants: [{ id: "249900000002@s.whatsapp.net" }] }, socket),
    false,
  );
});
