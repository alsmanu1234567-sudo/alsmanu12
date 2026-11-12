import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const IDX = join(__dirname, 'dist/index.mjs');
const GUARD = 'PATCH_PERSONS_SPLIT_APPLIED';

let src = readFileSync(IDX, 'utf8');
if (src.includes(GUARD)) { console.log('\u2139\uFE0F  \u0628\u0627\u062A\u0634 (\u0645\u0637\u0628\u0651\u0642 \u0633\u0627\u0628\u0642\u0627\u064B): \u0641\u0635\u0644 \u0642\u0633\u0645 \u0627\u0644\u0623\u0634\u062E\u0627\u0635'); process.exit(0); }

const START = '// src/bot/features/persons/index.ts\ninit_database();\ninit_state();\ninit_keyboards();\nasync function handlePersonsCallback(';
const END   = '\n// src/bot/features/developer/index.ts\n';

const si = src.indexOf(START);
const ei = src.indexOf(END, si > 0 ? si : 0);
if (si < 0 || ei < 0) { console.error('\u274C \u0644\u0645 \u064A\u062A\u0645 \u0627\u0644\u0639\u062B\u0648\u0631 \u0639\u0644\u0649 \u0642\u0633\u0645 \u0627\u0644\u0623\u0634\u062E\u0627\u0635 (si=' + si + ', ei=' + ei + ')'); process.exit(1); }

const importLine = "import * as _personsMod from './persons.mjs';\n";
const alreadyImported = src.includes(importLine);

const replacement =
`// src/bot/features/persons/index.ts \u2014 \u0641\u064F\u0635\u0650\u0644 \u0641\u064A dist/persons.mjs [${GUARD}]
init_database();
init_state();
init_keyboards();
async function handlePersonsCallback(bot2, chatId, userId, data) {
  _personsMod.setDeps({ getUser, saveUser, setState, cancelKeyboard, personsMenuKeyboard, personPickerKeyboard, contactsListKeyboard, personChatKeyboard, personSettingsKeyboard, getContacts, getPersonSettings, savePersonSettings, inMemoryDB });
  return _personsMod.handlePersonsCallback(bot2, chatId, userId, data);
}
async function handlePersonPicFromJid(bot2, chatId, userId, jid) {
  _personsMod.setDeps({ getUser, saveUser, setState, cancelKeyboard, personsMenuKeyboard, personPickerKeyboard, contactsListKeyboard, personChatKeyboard, personSettingsKeyboard, getContacts, getPersonSettings, savePersonSettings, inMemoryDB });
  return _personsMod.handlePersonPicFromJid(bot2, chatId, userId, jid);
}
async function handlePersonStatusFromJid(bot2, chatId, userId, jid) {
  _personsMod.setDeps({ getUser, saveUser, setState, cancelKeyboard, personsMenuKeyboard, personPickerKeyboard, contactsListKeyboard, personChatKeyboard, personSettingsKeyboard, getContacts, getPersonSettings, savePersonSettings, inMemoryDB });
  return _personsMod.handlePersonStatusFromJid(bot2, chatId, userId, jid);
}`;

let newSrc = src.slice(0, si) + replacement + src.slice(ei);

if (!alreadyImported) {
  const anchor = "import * as _reportsMod from './reports.mjs';";
  const pos = newSrc.indexOf(anchor);
  if (pos >= 0) newSrc = newSrc.slice(0, pos + anchor.length) + '\n' + importLine + newSrc.slice(pos + anchor.length);
  else { const p2 = newSrc.indexOf("import * as _"); if (p2 >= 0) newSrc = newSrc.slice(0, p2) + importLine + newSrc.slice(p2); }
}

const saved = src.length - newSrc.length;
writeFileSync(IDX, newSrc, 'utf8');
console.log(`\u2705 \u0628\u0627\u062A\u0634 (1 \u062A\u0639\u062F\u064A\u0644): \u0641\u0635\u0644 \u0642\u0633\u0645 \u0627\u0644\u0623\u0634\u062E\u0627\u0635 \u0625\u0644\u0649 dist/persons.mjs (\u0648\u0641\u0651\u0631 ${saved.toLocaleString()} \u062D\u0631\u0641)`);
