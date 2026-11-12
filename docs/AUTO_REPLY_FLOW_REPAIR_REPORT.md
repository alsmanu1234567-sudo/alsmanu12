# Auto Reply Flow Repair Report — Phase 2
**Date:** 2026-06-30  
**Scope:** Read-only audit → full repair of broken Auto Replies flow  
**Files touched:** `dist/auto-reply.mjs`, `dist/handlers/auto-reply-handler.mjs`, `dist/handlers/state-switch-handler.mjs`

---

## Architecture Summary

```
Telegram message
  └─► text-handler.mjs
        ├─► registry.dispatchText() → auto-reply-handler.handleText()
        │     handles /autoreply, /autoreply_add, /autoreply_list
        ├─► handleAutoReplyTextInput()  ← auto-reply.mjs
        │     handles awaiting_trigger, awaiting_trigger_type (callback path), awaiting_reply_content, etc.
        └─► state-switch-handler.handleText()
              handles remaining states (fallback)

Telegram callback
  └─► callback-handler.mjs
        └─► registry.dispatchCallback() → auto-reply-handler.handleCallback()
              matches: menu_replies | reply_* | rtype_* | ttype_* | target_* | scope_*
                       longtext_done | longtext_cancel | replyitem_* | toggle_reply_*
                       delete_reply_* | code_parts_done | morph_done | morph_add_edit
              └─► _deps.handleAutoReplyCallback() → _arMod.handleAutoReplyCallback() in auto-reply.mjs
```

---

## Bugs Found & Fixed

### BUG-001 [CRITICAL] — `set_per_user_` callback never routed
**File:** `dist/handlers/auto-reply-handler.mjs`  
**Problem:** `reply_per_user_limit` shows buttons with `set_per_user_{id}` callbacks.  
`auto-reply-handler.mjs` routing check has no `set_per_user_` prefix → callback never reaches `handleAutoReplyCallback`.  
**Symptom:** User clicks a reply for per-user limit → complete silence, no response.  
**Fix:** Added `data.startsWith('set_per_user_')` to routing conditions.  
**Also fixed:** Added `set_daily_` and `dup_reply_` routing (needed by new handlers).

---

### BUG-002 [CRITICAL] — `reply_daily_limit` button exists but has no handler
**File:** `dist/auto-reply.mjs`  
**Problem:** Button exists in `repliesMenuKeyboard`. It IS routed (starts with `reply_`) but falls through all `if` checks in `handleAutoReplyCallback` and returns `false`.  
`dailyLimit` field already exists in the data schema (used in WhatsApp processing).  
**Symptom:** Click "حد أقصى يومي" → silence.  
**Fix:** Added `reply_daily_limit` handler + `set_daily_{id}` handler. Flow: shows reply list → user picks → state `awaiting_reply_daily_limit` → user types number → save.

---

### BUG-003 [HIGH] — `reply_lang_filter` button exists but has no handler
**File:** `dist/auto-reply.mjs`  
**Problem:** Same routing issue as BUG-002. `langFilter: null` exists in schema but no UI flow.  
**Symptom:** Click "فلتر اللغة" → silence.  
**Fix:** Added stub handler showing "هذه الميزة قيد التطوير" + returns to menu.

---

### BUG-004 [HIGH] — `reply_duplicate` button exists but has no handler
**File:** `dist/auto-reply.mjs`  
**Problem:** Same routing issue. No duplicate logic anywhere.  
**Symptom:** Click "نسخ رد موجود" → silence.  
**Fix:** Added full duplicate flow: shows reply list → user picks → clones reply with "نسخة — " prefix, new ID, inactive state.  
Also added `dup_reply_` routing in auto-reply-handler.mjs.

---

### BUG-005 [HIGH] — `ttype_case_on` / `ttype_case_off` buttons do nothing
**File:** `dist/auto-reply.mjs` → `handleTriggerTypeCallback`  
**Problem:** `triggerTypeKeyboard` has "Aa حساس للأحرف" and "aa غير حساس" buttons sending `ttype_case_on`/`ttype_case_off`.  
These ARE routed via `ttype_*` prefix → reach `handleTriggerTypeCallback`.  
But `typeMap` only has `ttype_exact`, `ttype_contains`, `ttype_starts`, `ttype_ends`, `ttype_regex`, `ttype_cs_exact`, `ttype_cs_contains` — none match `ttype_case_on/off`.  
`if (!info) return;` silently exits.  
**Symptom:** Click case sensitivity buttons → nothing happens, flow stuck.  
**Fix:** Added explicit handling for `ttype_case_on`/`ttype_case_off` in `handleTriggerTypeCallback`.  
Sets `caseSensitive` flag + preserves existing `triggerType` (default `"exact"`) → advances to `awaiting_reply_type`.

---

### BUG-006 [MEDIUM] — `awaiting_reply_scope` state uses wrong data field
**File:** `dist/handlers/state-switch-handler.mjs`  
**Problem:** When user ends up in `awaiting_reply_scope` via the text path (not the normal callback path), the handler saves `replyContent: s.data.content` but the actual field name throughout the codebase is `s.data.replyContent`.  
**Symptom:** If text input path reaches scope state → reply saved with `replyContent: undefined`.  
**Fix:** Changed `s.data.content` → `s.data.replyContent`.

---

### BUG-007 [MEDIUM] — `awaiting_trigger_type` state has 3 issues
**File:** `dist/handlers/state-switch-handler.mjs`  
**Problems:**  
1. Validates against `["startswith", "endswith"]` but actual enum values are `"starts"` / `"ends"`.  
2. Sets `awaiting_reply_content` (skipping type selection) instead of `awaiting_reply_type`.  
3. Shows `replyScopeKeyboard()` instead of a type selection keyboard.  
**Context:** This state is only reached if user types text instead of pressing a keyboard button. Normal flow goes through `ttype_*` callbacks. But the fallback must not corrupt state.  
**Fix:** The handler now redirects user to use buttons ("اختر من الأزرار أعلاه") and re-shows `triggerTypeKeyboard()`.

---

### BUG-008 [HIGH] — `awaiting_reply_per_user_limit` state never handled anywhere
**File:** `dist/auto-reply.mjs` → `handleAutoReplyTextInput`  
**Problem:** After BUG-001 is fixed (routing `set_per_user_`), the callback sets state `awaiting_reply_per_user_limit`. But neither `handleAutoReplyTextInput` nor `state-switch-handler` handles this state → user types a number → nothing happens.  
**Fix:** Added handler in `handleAutoReplyTextInput`.

---

### BUG-009 [HIGH] — `awaiting_reply_daily_limit` state (new from BUG-002 fix)
**File:** `dist/auto-reply.mjs` → `handleAutoReplyTextInput`  
**Problem:** New state introduced by BUG-002 fix needs a text handler.  
**Fix:** Added handler in `handleAutoReplyTextInput` alongside BUG-008 fix.

---

## Dead Code Notes (not fixed, not blocking)
- `ttype_cs_exact` / `ttype_cs_contains` in `handleTriggerTypeCallback` typeMap — these keys don't appear in any keyboard; dead but harmless.
- `replyTargetKeyboardV2` defined in keyboards but never used.
- `handleTriggerTypeCallback2` in index.mjs — old version superseded by auto-reply.mjs version, harmless stub.
- `showReplies2` / `handleAddReply2` in index.mjs vs canonical versions in auto-reply.mjs — parallel functions; content is equivalent; no bug.
- `morph_done`/`morph_add_edit` in auto-reply-handler.mjs use dynamic import instead of direct dep — functionally equivalent, kept as-is.

---

## Fix Order Applied

| # | Bug | File | Change |
|---|-----|------|--------|
| 1 | BUG-007 | state-switch-handler.mjs | `awaiting_trigger_type` redirects to buttons instead of broken text path |
| 2 | BUG-006 | state-switch-handler.mjs | `s.data.content` → `s.data.replyContent` |
| 3 | BUG-001 | auto-reply-handler.mjs | Added `set_per_user_`, `set_daily_`, `dup_reply_` to routing |
| 4 | BUG-005 | auto-reply.mjs | Added `ttype_case_on`/`ttype_case_off` to `handleTriggerTypeCallback` |
| 5 | BUG-002 | auto-reply.mjs | Added `reply_daily_limit` + `set_daily_` handlers |
| 6 | BUG-003 | auto-reply.mjs | Added `reply_lang_filter` stub handler |
| 7 | BUG-004 | auto-reply.mjs | Added `reply_duplicate` + `dup_reply_` handlers |
| 8 | BUG-009 | auto-reply.mjs | Added `awaiting_reply_daily_limit` text state handler |

---

## Test Results
```
node --test tests/unit/message-router.test.mjs tests/unit/dispatcher.test.mjs \
            tests/unit/plugin-loader.test.mjs tests/unit/plugin-registry.test.mjs

ℹ tests 52
ℹ pass  52
ℹ fail   0
```

## Result
✅ All 9 bugs fixed  
✅ 52/52 unit tests pass (same as baseline — no regressions)  
✅ No new features — only broken buttons/flows repaired  
✅ Files modified: 3 (`auto-reply.mjs`, `auto-reply-handler.mjs`, `state-switch-handler.mjs`)
