import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const IDX = join(__dirname, 'dist/index.mjs');
const GUARD = 'PATCH_STATUS_SPLIT_APPLIED';

let src = readFileSync(IDX, 'utf8');
if (src.includes(GUARD)) { console.log('\u2139\uFE0F  \u0628\u0627\u062A\u0634 (\u0645\u0637\u0628\u0651\u0642 \u0633\u0627\u0628\u0642\u0627\u064B): \u0641\u0635\u0644 \u0642\u0633\u0645 \u0627\u0644\u062D\u0627\u0644\u0627\u062A'); process.exit(0); }

const START = '// src/bot/features/status/index.ts\nvar status_exports = {};';
const END   = '\n// src/bot/handlers/messages.ts\n';

const si = src.indexOf(START);
const ei = src.indexOf(END, si > 0 ? si : 0);

if (si < 0 || ei < 0) {
  console.error('\u274C \u0644\u0645 \u064A\u062A\u0645 \u0627\u0644\u0639\u062B\u0648\u0631 \u0639\u0644\u0649 \u0642\u0633\u0645 \u0627\u0644\u062D\u0627\u0644\u0627\u062A \u0641\u064A index.mjs (si=' + si + ', ei=' + ei + ')');
  process.exit(1);
}

const importLine = "import * as _statusMod from './status.mjs';\n";
const alreadyImported = src.includes(importLine);

const BG_COLORS_OBJ = `{
      "\u{1F535} \u0623\u0632\u0631\u0642": 35020,
      "\u{1F534} \u0623\u062D\u0645\u0631": 15022389,
      "\u{1F7E2} \u0623\u062E\u0636\u0631": 4431943,
      "\u{1F7E1} \u0623\u0635\u0641\u0631": 16361509,
      "\u{1F7E0} \u0628\u0631\u062A\u0642\u0627\u0644\u064A": 16485376,
      "\u{1F7E3} \u0628\u0646\u0641\u0633\u062C\u064A": 9315498,
      "\u26AB \u0623\u0633\u0648\u062F": 2171169,
      "\u26AA \u0623\u0628\u064A\u0636": 16777215,
      "\u{1FA77} \u0648\u0631\u062F\u064A": 15277708,
      "\u{1FA75} \u0633\u0645\u0627\u0648\u064A": 48340
    }`;

const replacement =
`// src/bot/features/status/index.ts \u2014 \u0641\u064F\u0635\u0650\u0644 \u0641\u064A dist/status.mjs [${GUARD}]
var status_exports = {};
__export(status_exports, {
  handleStatusCallback: () => handleStatusCallback,
  handleStatusMedia: () => handleStatusMedia,
  handleStatusTextInput: () => handleStatusTextInput
});
function statusMainKeyboard() { return _statusMod.statusMainKeyboard(); }
function colorKeyboard() { return _statusMod.colorKeyboard(); }
async function handleStatusCallback(bot2, chatId, userId, data) { return _statusMod.handleStatusCallback(bot2, chatId, userId, data); }
async function handleStatusTextInput(bot2, chatId, userId, text, state) { return _statusMod.handleStatusTextInput(bot2, chatId, userId, text, state); }
async function handleStatusMedia(bot2, chatId, userId, msg, state) { return _statusMod.handleStatusMedia(bot2, chatId, userId, msg, state); }
var BG_COLORS;
var init_status = __esm({
  "src/bot/features/status/index.ts"() {
    "use strict";
    init_database();
    init_state();
    init_keyboards();
    BG_COLORS = ${BG_COLORS_OBJ};
    _statusMod.setDeps({ BG_COLORS, getUser, saveUser, inMemoryDB, cancelKeyboard, setState, getState, clearState });
  }
})`;

let newSrc = src.slice(0, si) + replacement + src.slice(ei);

if (!alreadyImported) {
  const importTarget = "import * as _myMsgsMod from './my-msgs.mjs';";
  const importPos = newSrc.indexOf(importTarget);
  if (importPos >= 0) {
    newSrc = newSrc.slice(0, importPos + importTarget.length) + '\n' + importLine + newSrc.slice(importPos + importTarget.length);
  } else {
    const firstImport = newSrc.indexOf("import * as _");
    if (firstImport >= 0) {
      newSrc = newSrc.slice(0, firstImport) + importLine + newSrc.slice(firstImport);
    }
  }
}

const saved = src.length - newSrc.length;
writeFileSync(IDX, newSrc, 'utf8');
console.log(`\u2705 \u0628\u0627\u062A\u0634 (1 \u062A\u0639\u062F\u064A\u0644): \u0641\u0635\u0644 \u0642\u0633\u0645 \u0627\u0644\u062D\u0627\u0644\u0627\u062A \u0625\u0644\u0649 dist/status.mjs (\u0648\u0641\u0651\u0631 ${saved.toLocaleString()} \u062D\u0631\u0641)`);
