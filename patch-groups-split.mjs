import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const IDX = join(__dirname, 'dist/index.mjs');
const GUARD = 'PATCH_GROUPS_SPLIT_APPLIED';

let src = readFileSync(IDX, 'utf8');
if (src.includes(GUARD)) { console.log('\u2139\uFE0F  \u0628\u0627\u062A\u0634 (\u0645\u0637\u0628\u0651\u0642 \u0633\u0627\u0628\u0642\u0627\u064B): \u0641\u0635\u0644 \u0642\u0633\u0645 \u0627\u0644\u0645\u062C\u0645\u0648\u0639\u0627\u062A'); process.exit(0); }

const START = '// src/bot/features/groups/index.ts\ninit_database();\ninit_state();\ninit_keyboards();\nasync function handleGroupsCallback(';
const END   = '\n// src/bot/handlers/callbacks.ts\ninit_status();';

const si = src.indexOf(START);
const ei = src.indexOf(END, si > 0 ? si : 0);
if (si < 0 || ei < 0) { console.error('\u274C \u0644\u0645 \u064A\u062A\u0645 \u0627\u0644\u0639\u062B\u0648\u0631 \u0639\u0644\u0649 \u0642\u0633\u0645 \u0627\u0644\u0645\u062C\u0645\u0648\u0639\u0627\u062A (si=' + si + ', ei=' + ei + ')'); process.exit(1); }

const importLine = "import * as _groupsMod from './groups.mjs';\n";
const alreadyImported = src.includes(importLine);

const replacement =
`// src/bot/features/groups/index.ts \u2014 \u0641\u064F\u0635\u0650\u0644 \u0641\u064A dist/groups.mjs [${GUARD}]
init_database();
init_state();
init_keyboards();
async function handleGroupsCallback(bot2, chatId, userId, data) {
  _groupsMod.setDeps({ getUser, setState, cancelKeyboard, inMemoryDB });
  return _groupsMod.handleGroupsCallback(bot2, chatId, userId, data);
}`;

let newSrc = src.slice(0, si) + replacement + src.slice(ei);

if (!alreadyImported) {
  const anchor = "import * as _aiMod from './ai.mjs';";
  const pos = newSrc.indexOf(anchor);
  if (pos >= 0) newSrc = newSrc.slice(0, pos + anchor.length) + '\n' + importLine + newSrc.slice(pos + anchor.length);
  else { const p2 = newSrc.indexOf("import * as _"); if (p2 >= 0) newSrc = newSrc.slice(0, p2) + importLine + newSrc.slice(p2); }
}

const saved = src.length - newSrc.length;
writeFileSync(IDX, newSrc, 'utf8');
console.log(`\u2705 \u0628\u0627\u062A\u0634 (1 \u062A\u0639\u062F\u064A\u0644): \u0641\u0635\u0644 \u0642\u0633\u0645 \u0627\u0644\u0645\u062C\u0645\u0648\u0639\u0627\u062A \u0625\u0644\u0649 dist/groups.mjs (\u0648\u0641\u0651\u0631 ${saved.toLocaleString()} \u062D\u0631\u0641)`);
