import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const IDX = join(__dirname, 'dist/index.mjs');
const GUARD = 'PATCH_SECURITY_SPLIT_APPLIED';

let src = readFileSync(IDX, 'utf8');
if (src.includes(GUARD)) { console.log('\u2139\uFE0F  \u0628\u0627\u062A\u0634 (\u0645\u0637\u0628\u0651\u0642 \u0633\u0627\u0628\u0642\u0627\u064B): \u0641\u0635\u0644 \u0642\u0633\u0645 \u0627\u0644\u0623\u0645\u0627\u0646'); process.exit(0); }

const START = '// src/bot/features/security/index.ts\ninit_database();\ninit_state();\ninit_keyboards();\nasync function handleSecurityCallback';
const END   = '\n// src/bot/features/calls/index.ts';

const si = src.indexOf(START);
const ei = src.indexOf(END, si > 0 ? si : 0);

if (si < 0 || ei < 0) {
  console.error('\u274C \u0644\u0645 \u064A\u062A\u0645 \u0627\u0644\u0639\u062B\u0648\u0631 \u0639\u0644\u0649 \u0642\u0633\u0645 \u0627\u0644\u0623\u0645\u0627\u0646 \u0641\u064A index.mjs (si=' + si + ', ei=' + ei + ')');
  process.exit(1);
}

const importLine = "import * as _securityMod from './security.mjs';\n";
const alreadyImported = src.includes(importLine);

const replacement =
`// src/bot/features/security/index.ts \u2014 \u0641\u064F\u0635\u0650\u0644 \u0641\u064A dist/security.mjs [${GUARD}]
async function handleSecurityCallback(bot2, chatId, userId, data) { _securityMod.setDeps({ getUser, saveUser, setState, cancelKeyboard, securityMenuKeyboard, _getNumberMgr: () => { init_number_manager(); return number_manager_exports; }, _getBaileys: () => { init_baileys_session(); return baileys_session_exports; } }); return _securityMod.handleSecurityCallback(bot2, chatId, userId, data); }`;

let newSrc = src.slice(0, si) + replacement + src.slice(ei);

if (!alreadyImported) {
  const importTarget = "import * as _scheduleMod from './schedule.mjs';";
  const importPos = newSrc.indexOf(importTarget);
  if (importPos >= 0) {
    newSrc = newSrc.slice(0, importPos + importTarget.length) + '\n' + importLine + newSrc.slice(importPos + importTarget.length);
  } else {
    const importTarget2 = "import * as _groupsMod from './groups.mjs';";
    const importPos2 = newSrc.indexOf(importTarget2);
    if (importPos2 >= 0) {
      newSrc = newSrc.slice(0, importPos2 + importTarget2.length) + '\n' + importLine + newSrc.slice(importPos2 + importTarget2.length);
    } else {
      const firstImport = newSrc.indexOf("import * as _");
      if (firstImport >= 0) {
        newSrc = newSrc.slice(0, firstImport) + importLine + newSrc.slice(firstImport);
      }
    }
  }
}

const saved = src.length - newSrc.length;
writeFileSync(IDX, newSrc, 'utf8');
console.log(`\u2705 \u0628\u0627\u062A\u0634 (1 \u062A\u0639\u062F\u064A\u0644): \u0641\u0635\u0644 \u0642\u0633\u0645 \u0627\u0644\u0623\u0645\u0627\u0646 \u0625\u0644\u0649 dist/security.mjs (\u0648\u0641\u0651\u0631 ${saved.toLocaleString()} \u062D\u0631\u0641)`);
