import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const IDX = join(__dirname, 'dist/index.mjs');
const GUARD = 'PATCH_CALLS_SPLIT_APPLIED';

let src = readFileSync(IDX, 'utf8');
if (src.includes(GUARD)) { console.log('\u2139\uFE0F  \u0628\u0627\u062A\u0634 (\u0645\u0637\u0628\u0651\u0642 \u0633\u0627\u0628\u0642\u0627\u064B): \u0641\u0635\u0644 \u0642\u0633\u0645 \u0627\u0644\u0645\u0643\u0627\u0644\u0645\u0627\u062A'); process.exit(0); }

const START = '// src/bot/features/calls/index.ts\ninit_database();\ninit_state();\ninit_keyboards();\nasync function handleCallsCallback(';
const END   = '\n// src/bot/features/persons/index.ts\n';

const si = src.indexOf(START);
const ei = src.indexOf(END, si > 0 ? si : 0);

if (si < 0 || ei < 0) {
  console.error('\u274C \u0644\u0645 \u064A\u062A\u0645 \u0627\u0644\u0639\u062B\u0648\u0631 \u0639\u0644\u0649 \u0642\u0633\u0645 \u0627\u0644\u0645\u0643\u0627\u0644\u0645\u0627\u062A \u0641\u064A index.mjs (si=' + si + ', ei=' + ei + ')');
  process.exit(1);
}

const importLine = "import * as _callsMod from './calls.mjs';\n";
const alreadyImported = src.includes(importLine);

const replacement =
`// src/bot/features/calls/index.ts \u2014 \u0641\u064F\u0635\u0650\u0644 \u0641\u064A dist/calls.mjs [${GUARD}]
init_database();
init_state();
init_keyboards();
async function handleCallsCallback(bot2, chatId, userId, data) {
  _callsMod.setDeps({ getUser, saveUser, setState, cancelKeyboard, callsMenuKeyboard, callsSettingsKeyboard });
  return _callsMod.handleCallsCallback(bot2, chatId, userId, data);
}`;

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
console.log(`\u2705 \u0628\u0627\u062A\u0634 (1 \u062A\u0639\u062F\u064A\u0644): \u0641\u0635\u0644 \u0642\u0633\u0645 \u0627\u0644\u0645\u0643\u0627\u0644\u0645\u0627\u062A \u0625\u0644\u0649 dist/calls.mjs (\u0648\u0641\u0651\u0631 ${saved.toLocaleString()} \u062D\u0631\u0641)`);
