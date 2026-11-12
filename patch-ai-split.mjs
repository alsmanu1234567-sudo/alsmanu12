import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const IDX = join(__dirname, 'dist/index.mjs');
const GUARD = 'PATCH_AI_SPLIT_APPLIED';

let src = readFileSync(IDX, 'utf8');
if (src.includes(GUARD)) { console.log('\u2139\uFE0F  \u0628\u0627\u062A\u0634 (\u0645\u0637\u0628\u0651\u0642 \u0633\u0627\u0628\u0642\u0627\u064B): \u0641\u0635\u0644 \u0642\u0633\u0645 \u0627\u0644\u0630\u0643\u0627\u0621 \u0627\u0644\u0627\u0635\u0637\u0646\u0627\u0639\u064A'); process.exit(0); }

const START = '// src/bot/features/ai/index.ts\ninit_database();\ninit_state();\ninit_keyboards();\nasync function handleAiCallback2(';
const END   = '\n// src/bot/features/groups/index.ts\n';

const si = src.indexOf(START);
const ei = src.indexOf(END, si > 0 ? si : 0);
if (si < 0 || ei < 0) { console.error('\u274C \u0644\u0645 \u064A\u062A\u0645 \u0627\u0644\u0639\u062B\u0648\u0631 \u0639\u0644\u0649 \u0642\u0633\u0645 AI (si=' + si + ', ei=' + ei + ')'); process.exit(1); }

const importLine = "import * as _aiMod from './ai.mjs';\n";
const alreadyImported = src.includes(importLine);

const replacement =
`// src/bot/features/ai/index.ts \u2014 \u0641\u064F\u0635\u0650\u0644 \u0641\u064A dist/ai.mjs [${GUARD}]
init_database();
init_state();
init_keyboards();
async function handleAiCallback2(bot2, chatId, userId, data) {
  _aiMod.setDeps({ getUser, saveUser, setState, cancelKeyboard, aiMenuKeyboard, init_ai_manager, ai_manager_exports });
  return _aiMod.handleAiCallback2(bot2, chatId, userId, data);
}`;

let newSrc = src.slice(0, si) + replacement + src.slice(ei);

if (!alreadyImported) {
  const anchor = "import * as _personsMod from './persons.mjs';";
  const pos = newSrc.indexOf(anchor);
  if (pos >= 0) newSrc = newSrc.slice(0, pos + anchor.length) + '\n' + importLine + newSrc.slice(pos + anchor.length);
  else { const p2 = newSrc.indexOf("import * as _"); if (p2 >= 0) newSrc = newSrc.slice(0, p2) + importLine + newSrc.slice(p2); }
}

const saved = src.length - newSrc.length;
writeFileSync(IDX, newSrc, 'utf8');
console.log(`\u2705 \u0628\u0627\u062A\u0634 (1 \u062A\u0639\u062F\u064A\u0644): \u0641\u0635\u0644 \u0642\u0633\u0645 \u0627\u0644\u0630\u0643\u0627\u0621 \u0627\u0644\u0627\u0635\u0637\u0646\u0627\u0639\u064A \u0625\u0644\u0649 dist/ai.mjs (\u0648\u0641\u0651\u0631 ${saved.toLocaleString()} \u062D\u0631\u0641)`);
