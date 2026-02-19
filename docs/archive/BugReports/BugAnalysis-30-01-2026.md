# Bug Report Analysis - 30.01.2026

Source: Баги 30.01.2026.md (User testing feedback)

---

## Triage Status

| Item | Status | Document |
|------|--------|----------|
| 1 | ⏳ Pending | - |
| 2 | ⏳ Pending | - |
| 3 | ✅ Documented | TASK-003-session-deletion.md |
| 4 | ✅ Documented | TASK-004-block-editor-improvements.md |
| 5 | ✅ Documented | BUG-001-drag-drop-reordering.md |
| 6 | ✅ Covered | By TASK-004 |
| 7 | ⏳ Pending | - |
| 8 | ✅ Documented | TASK-005-block-title-extraction.md |
| 9 | ✅ Documented | TASK-006-zone-move-from-editor.md |
| 10 | ✅ Documented | TASK-002-confirm-dialog.md |
| 11 | ✅ **FIXED** | vercel.json added |
| 12 | ✅ **FIXED** | vercel.json added |
| 13 | ✅ Documented | BUG-002-brainstorm-input-blocked.md |
| 14 | ✅ Documented | BUG-003-test-connection-before-save.md |
| 15 | ✅ Documented | TASK-007-keyboard-shortcuts-system.md |
| 16 | ✅ Covered | By TASK-004 (markdown support) |
| 17 | ⏸️ Skipped | Too big, needs research |
| 18 | ✅ Documented | TASK-008-brainstorm-input-sizing.md |
| 19 | ✅ Documented | DESIGN-brainstorm-questioning.md |
| 20 | ✅ Documented | TASK-009-unsaved-brainstorm-warning.md |
| 21 | ⏸️ Skipped | Domain-specific, use block types |
| 22 | ✅ Documented | BUG-004-save-dropdown-positioning.md |
| 23 | ⏳ Pending | - |
| 24 | ⏳ Pending | - |
| 25 | ⏳ Pending | - |
| 26 | ⏳ Pending | - |
| 27 | ⏳ Pending | - |
| 28 | ⏳ Pending | - |
| 29 | ⏳ Pending | - |

**Legend:** ✅ Done | ⏳ Pending | ⏸️ Skipped

---

## Item 1: Default Templates

**Original (RU):** Можно в систему предложить какой-то свой шаблон, чтобы пользователям не приходилось все загружать вручную, а был какой-то пример

**Translation:** Could provide some default template so users don't have to load everything manually - have some example available

**Type:** Feature Request

**Analysis:**
- User wants pre-built templates as examples
- Currently users start with empty session

**Questions to Answer:**
- [ ] What kind of templates would be useful? (Game design? General?)
- [ ] Should these be system templates or just documentation?
- [ ] Is this blocking adoption or just nice-to-have?

**Decision:** TBD

---

## Item 2: Delete Workflow Button Styling

**Original (RU):** Кнопка "Delete Workflow" не выглядит кликабельной

**Translation:** "Delete Workflow" button doesn't look clickable

**Type:** UI Bug

**Analysis:**
- Visual affordance issue
- Button may lack hover state or proper styling

**Questions to Answer:**
- [ ] Which page is this on?
- [ ] What does the button currently look like?
- [ ] Is it actually non-functional or just looks wrong?

**Decision:** TBD - Need to investigate button styling

---

## Item 3: Session Deletion

**Original (RU):** Как удалять сессии? Если их будет слишком много то, что будет?

**Translation:** How to delete sessions? What happens if there are too many?

**Type:** Feature Gap / UX Question

**Analysis:**
- Users need ability to delete sessions
- Potential scalability concern with many sessions

**Questions to Answer:**
- [ ] Is session deletion currently implemented?
- [ ] If yes, is it discoverable?
- [ ] What's the expected session count per user?

**Decision:** TBD - Check if feature exists

---

## Item 4: Notes Editing Window Size

**Original (RU):** Маленькое окно для редактирование notes. Оно нужно побольше, текст неудобно читать.

**Translation:** Notes editing window is too small. Needs to be bigger, text is hard to read.

**Type:** UI/UX Issue

**Analysis:**
- Editor modal/dialog may be too constrained
- Affects usability for longer content

**Questions to Answer:**
- [ ] What's the current size?
- [ ] Is it a modal or inline editor?
- [ ] Should it be resizable?

**Decision:** TBD - Need to see current implementation

---

## Item 5: Notes Reordering Broken

**Original (RU):** Плохо работает смена "Порядка" в столбце notes. Можно сказать совсем не работает.

**Translation:** Reordering in notes column works poorly. Could say it doesn't work at all.

**Type:** Bug

**Analysis:**
- Drag-and-drop or position change not functioning
- Critical for workflow organization

**Questions to Answer:**
- [ ] Is this drag-and-drop or button-based reordering?
- [ ] Does it fail silently or show errors?
- [ ] Is the backend mutation working?

**Decision:** TBD - Need to reproduce and debug

---

## Item 6: Add Notes Window Size

**Original (RU):** Окошко для добавления новой notes слишком маленькое тоже.

**Translation:** Window for adding new notes is also too small.

**Type:** UI/UX Issue

**Analysis:**
- Related to Item 4
- Input area for new notes is constrained

**Questions to Answer:**
- [ ] Same component as edit window?
- [ ] What's a reasonable size?

**Decision:** TBD - May be fixed together with Item 4

---

## Item 7: Tag Explanations

**Original (RU):** Возможно стоит сделать какое-то объяснение зачем какой тег для notes

**Translation:** Maybe should add explanation of what each note tag is for

**Type:** Feature Request / Documentation

**Analysis:**
- Users don't understand note type purposes
- Could be tooltips, help text, or documentation

**Questions to Answer:**
- [ ] What tags/types exist currently?
- [ ] Is there any existing documentation?
- [ ] Inline help vs separate docs?

**Decision:** TBD

---

## Item 8: Note Titles/Headers

**Original (RU):** Возможно стоит сделать заголовки к заметкам, для того, чтобы можно было идентифицировать их.

**Translation:** Maybe should add titles/headers to notes for identification

**Type:** Feature Request

**Analysis:**
- Notes may be hard to distinguish
- Title field would help organization

**Questions to Answer:**
- [ ] How are notes currently identified? (preview of content?)
- [ ] Would this require schema change?
- [ ] Is first line extraction sufficient?

**Decision:** TBD

---

## Item 9: Zone Move from Edit Mode

**Original (RU):** Возможно стоит добавить перенос в stable/permanent/working из режима редактирование notes

**Translation:** Maybe should add ability to move to stable/permanent/working from notes editing mode

**Type:** Feature Request

**Analysis:**
- Currently may need to exit edit mode to change zone
- Would improve workflow

**Questions to Answer:**
- [ ] How is zone change currently done?
- [ ] Is this a common operation during editing?

**Decision:** TBD

---

## Item 10: Delete Button Placement / Confirmation

**Original (RU):** Возможно это плохая идея размещать кнопку удаления рядом с кнопкой редактирования и без всплывающего окна (она несколько раз уже удалила note)

**Translation:** Maybe bad idea to place delete button next to edit button without confirmation popup (she already deleted notes several times accidentally)

**Type:** UX Bug - Critical

**Analysis:**
- Destructive action too easy to trigger
- No confirmation dialog
- User has lost data multiple times

**Questions to Answer:**
- [ ] Is there really no confirmation?
- [ ] What's the button layout?
- [ ] Can deletions be undone?

**Decision:** TBD - Likely needs fix (data loss issue)

---

## Item 11: 404 on New Tab Links

**Original (RU):** Если ссылки из хедера открыть в новой вкладке то будет окно 404 (Только в вебе, на локалке такого нет)

**Translation:** If links from header are opened in new tab, shows 404 (Only on web, not local)

**Type:** Bug - Production Only

**Analysis:**
- SPA routing issue on Vercel
- Works locally because Vite dev server handles it
- Vercel needs rewrite rules

**Questions to Answer:**
- [ ] Is vercel.json configured?
- [ ] What rewrite rules are needed?

**Decision:** TBD - Likely needs vercel.json fix

---

## Item 12: White Screen on Page Reload

**Original (RU):** Перезагрузка любой страницы кроме home вызывает белый экран (Только в вебе, на локалке такого нет)

**Translation:** Reloading any page except home causes white screen (Only on web, not local)

**Type:** Bug - Production Only

**Analysis:**
- Same root cause as Item 11
- SPA routing not configured for Vercel

**Questions to Answer:**
- [ ] Same fix as Item 11?

**Decision:** TBD - Likely same fix as Item 11

---

## Item 13: Brainstorm Input Blocked Until LLM Switch

**Original (RU):** У меня окно написания сообщения в брейншторм не было доступно, пока я успешно не подключила олламку. Точнее... Окно ввода недоступно пока ты не переключишь метод ллмки хотя бы один раз

**Translation:** Brainstorm message input wasn't available until I successfully connected Ollama. More precisely... Input unavailable until you switch LLM method at least once

**Type:** Bug

**Analysis:**
- Input field disabled/hidden by default
- State not properly initialized
- Requires user action to unlock

**Questions to Answer:**
- [ ] What controls the input disabled state?
- [ ] Is it checking for valid provider?
- [ ] What's the initial state on page load?

**Decision:** TBD - Need to investigate state management

---

## Item 14: Save Before Test Connection

**Original (RU):** Немного странная система, что сначала надо сохранить, а потом тестировать подключение

**Translation:** Slightly strange system that you first need to save, then test connection

**Type:** UX Feedback

**Analysis:**
- Settings flow requires save before test
- User expects test-then-save flow

**Questions to Answer:**
- [ ] Why is save required first?
- [ ] Can we test with unsaved values?
- [ ] Is this a technical limitation?

**Decision:** TBD - May be by design

---

## Item 15: Send Message Keyboard Shortcut Setting

**Original (RU):** Имхо, надо добавить в настройках какими кнопками отправляется сообщение в брейншторм

**Translation:** IMO, should add setting for which keys send message in brainstorm (every site has different convention)

**Type:** Feature Request

**Analysis:**
- Enter vs Ctrl+Enter vs Shift+Enter
- User wants configurability

**Questions to Answer:**
- [ ] What's current behavior?
- [ ] Is this a common request?
- [ ] Priority vs other features?

**Decision:** TBD

---

## Item 16: Table Rendering in Responses

**Original (RU):** Имхо, надо добавить минимум отображение таблиц в ответке от нейронки (нейронка мне вопросы только так и задает)

**Translation:** IMO, should add at minimum table display in neural network response (the AI asks me questions only this way)

**Type:** Feature Request

**Analysis:**
- Markdown table rendering not working
- AI responses with tables display poorly

**Questions to Answer:**
- [ ] Is markdown rendering implemented?
- [ ] What markdown library is used?
- [ ] Does it support tables?

**Decision:** TBD - Check markdown renderer

---

## Item 17: Brainstorm Modes

**Original (RU):** Черновая идея. Чисто в теории это все делается запросами в саму нейронку... Возможно стоить разделить Brainstorm на несколько режимов: 1. Уточнение вопросов 2. Создание версии документа 3. Шлифовка документа 4. Тестирование на согласованность

**Translation:** Draft idea. In theory this is all done via prompts to the AI... Maybe worth splitting Brainstorm into modes: 1. Clarifying questions 2. Document creation 3. Document polishing 4. Consistency testing

**Type:** Feature Request - Major

**Analysis:**
- Different system prompts for different phases
- Workflow guidance for users

**Questions to Answer:**
- [ ] Is this scope creep?
- [ ] Could this be templates instead?
- [ ] How complex to implement?

**Decision:** TBD - Needs design discussion

---

## Item 18: Larger Brainstorm Input

**Original (RU):** Увеличить окно написание в брейншторм

**Translation:** Enlarge brainstorm input window

**Type:** UI/UX Issue

**Analysis:**
- Related to Items 4 and 6
- Input area too small

**Questions to Answer:**
- [ ] Current size?
- [ ] Should it auto-expand?

**Decision:** TBD

---

## Item 19: One Question at a Time

**Original (RU):** Черновая идея. Возможно стоит чтобы нейронка задавала по одному вопросу? Наверно бред, если будет таблица или поля ввода для ответов на все вопросы то тоже решится.

**Translation:** Draft idea. Maybe AI should ask one question at a time? Probably nonsense, would be solved if there were table or input fields for all question answers.

**Type:** Feature Request - Speculative

**Analysis:**
- User self-identifies this as possibly not needed
- Related to Item 16 (table rendering)

**Questions to Answer:**
- [ ] Is this addressed by better table rendering?

**Decision:** TBD - May be resolved by Item 16

---

## Item 20: Unsaved Brainstorm Warning

**Original (RU):** Немного грустно, что брейншторм стирается, когда переходишь по другим вкладкам, никак не сохраняется. Минимум когда ты пытаешься перейти в какую-то вкладку с несохраненным резом, чтобы тебе всплывало окно

**Translation:** Sad that brainstorm is erased when navigating to other tabs, not saved. At minimum show popup warning when trying to navigate with unsaved result

**Type:** UX Bug / Feature Request

**Analysis:**
- Conversation state lost on navigation
- No warning before data loss

**Questions to Answer:**
- [ ] Is state persisted anywhere?
- [ ] Should it auto-save?
- [ ] Or just warn before navigation?

**Decision:** TBD - Data loss issue, needs attention

---

## Item 21: Game Description Section

**Original (RU):** Имхо, нужно как-то отдельно обозначить место под "Описание игры для пользователя".

**Translation:** IMO, need to somehow separately designate place for "Game description for user"

**Type:** Feature Request - Domain Specific

**Analysis:**
- User wants dedicated section for game description
- May be specific to their use case

**Questions to Answer:**
- [ ] Is this a general need or specific to this user?
- [ ] Could existing zones handle this?

**Decision:** TBD

---

## Item 22: Save Dropdown Dismissal

**Original (RU):** Можно пропустить случайно раскрывающееся окошко при save реза brainstorm

**Translation:** Can accidentally dismiss the dropdown when saving brainstorm result

**Type:** UX Issue

**Analysis:**
- Save dialog/dropdown easy to dismiss
- User may lose intended action

**Questions to Answer:**
- [ ] What's the current save flow?
- [ ] Is it a dropdown or modal?

**Decision:** TBD

---

## Item 23: Export Individual Notes

**Original (RU):** Может стоит сделать экспорт конкретно notes из ее редактирования?

**Translation:** Maybe should add export specifically from notes editing?

**Type:** Feature Request

**Analysis:**
- Export single note vs whole context

**Questions to Answer:**
- [ ] Current export functionality?
- [ ] Common use case?

**Decision:** TBD

---

## Item 24: Individual Note MD Export

**Original (RU):** Неудобно, что сразу все экспортируется, мне бы хотелось чтобы я могла мд файлы какой конкретно note делать.

**Translation:** Inconvenient that everything exports at once, would like to make MD files for specific notes

**Type:** Feature Request

**Analysis:**
- Related to Item 23
- Wants granular export

**Questions to Answer:**
- [ ] Same as Item 23?

**Decision:** TBD - Related to Item 23

---

## Item 25: AI Asking Questions

**Original (RU):** Может стоит как-то чтобы сама нейронка могла задавать вопросы?

**Translation:** Maybe AI itself could ask questions somehow?

**Type:** Feature Request - Vague

**Analysis:**
- Unclear what this means beyond current behavior
- AI already can ask questions in responses

**Questions to Answer:**
- [ ] What specifically is requested?
- [ ] How different from current brainstorm?

**Decision:** TBD - Needs clarification

---

## Item 26: Quote/Highlight for Feedback

**Original (RU):** Может можно сразу выделать ту часть текста ответа нейронки для цитировании и сразу сказать что не так?

**Translation:** Maybe could highlight part of AI response text for quoting and immediately say what's wrong?

**Type:** Feature Request

**Analysis:**
- Select text in response
- Reply with that selection quoted
- Useful for iterative refinement

**Questions to Answer:**
- [ ] How complex to implement?
- [ ] Common in other tools?

**Decision:** TBD

---

## Item 27: Cascading Document Changes

**Original (RU):** Я бы подумала, насчет случая, что автор решил изменить что-то в документе level 0 будучи на level 5 и ему придется вручную каждый документ править

**Translation:** I would think about the case where author decides to change something in level 0 document while on level 5 and has to manually edit each document

**Type:** Feature Request - Complex

**Analysis:**
- Cross-level dependency tracking
- Change propagation
- Complex workflow feature

**Questions to Answer:**
- [ ] Is this in scope?
- [ ] How would this work technically?
- [ ] Is this the tool's responsibility?

**Decision:** TBD - Major feature, needs design

---

## Item 28: Add Button Not Disabled

**Original (RU):** Кнопка add не блокируется, у тебя может создаться несколько заметок

**Translation:** Add button doesn't get disabled, you can create multiple notes

**Type:** Bug

**Analysis:**
- Double-click creates duplicates
- Button should disable during submission

**Questions to Answer:**
- [ ] Which add button?
- [ ] Is this during network request?

**Decision:** TBD - Likely needs fix

---

## Item 29: Generator Missing OpenRouter

**Original (RU):** В генераторе есть только олламка. Нет open router

**Translation:** Generator only has Ollama. No OpenRouter

**Type:** Bug / Feature Gap

**Analysis:**
- Generate feature missing provider option
- Brainstorm has it, Generator doesn't?

**Questions to Answer:**
- [ ] Is Generator different from Brainstorm?
- [ ] What's the Generate feature?
- [ ] Was OpenRouter intentionally omitted?

**Decision:** TBD - Need to understand Generate vs Brainstorm

---

## Summary

| Category | Count |
|----------|-------|
| Bugs (Production) | 2 (Items 11, 12) |
| Bugs (Functional) | 5 (Items 5, 10, 13, 28, 29) |
| UI/UX Issues | 6 (Items 2, 4, 6, 14, 18, 22) |
| Feature Requests | 16 |

**Priority Recommendations:**
1. **High**: Items 10, 11, 12, 13, 20, 28 (Data loss / Blocking issues)
2. **Medium**: Items 2, 4, 5, 6, 18, 29 (Usability)
3. **Low/Deferred**: Feature requests (Items 1, 7, 8, 9, 15-17, 19, 21, 23-27)
