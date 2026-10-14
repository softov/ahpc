---
name: do-spec
description: Create and maintain the `.project/ artifacts` that let an agent understand what a project is building, why each decision was made, which rules hold, which problems are open, what has been implemented, and what work remains, so the record survives across agents and sessions. Use when writing, amending or closing a plan, task, decision, problem, spec, rule, research note or implementation record, when moving a task's status, and when templates, paths, references, statuses and cross-links must stay consistent.
metadata:
  artifacts: "0.2"
---

# Writing `.project/ artifacts` files

`.project/` holds what the project is building and why. `.agents/` holds only skills.
Start every file from its template in `assets/`; the template says what goes in each field and section. Replace every `<placeholder>`, delete what you do not fill.

| Kind | Template | Path |
|---|---|---|
| plan | [plan.md](assets/plan.md) | `.project/plans/<domain>/<NN>-<slug>/plan.md` |
| task | [task.md](assets/task.md) | same folder, `task-<NN>-<slug>.md` |
| implemented | [implemented.md](assets/implemented.md) | same folder, `implemented.md` |
| deferred | [deferred.md](assets/deferred.md) | same folder, `deferred.md` |
| domain reference | [domain.md](assets/domain.md) | `.project/plans/<domain>/00-<domain>.md` |
| spec | [spec.md](assets/spec.md) | `.project/specs/<slug>.md` |
| rule | [rule.md](assets/rule.md) | `.project/rules/<slug>.md` |
| decision | [decision.md](assets/decision.md) | `.project/decisions/<slug>.md` |
| problem | [problem.md](assets/problem.md) | `.project/problems/<slug>.md` |
| research | Markdown with a `title` | `.project/research/<slug>.md` |

`.project/plans/index.md` is the entry: one row per plan, kept by hand.

## Conventions

- Frontmatter on every file; `title` always. Slugs are kebab-case; only plans and tasks carry a number.
- A path is an identity: nothing is moved or deleted; what no longer applies gets a `status`. Two exceptions: a problem is deleted once it becomes plan work, and a superseded decision is deleted once the decision that replaces it names it.
- Paths in frontmatter are relative to `.project/`, except a task's `depends`, which names sibling task files.
- `refs` say where something is, never its state, one per line as `<uri> - <one line on why it is here>`. A ref is a URI: `code://<path>#L<n>-L<m>`, `npm://<package>@<range>`, `git://<sha|branch|tag>`, `tasker://<instance>:<project>#<id>`, `https://...`, `file://...`. A plan's files read and patterns to reuse are its refs; nothing lists them twice.
- A `code://` ref is local code, so write it as a Markdown link. Keep the URI as the link text. Make the target the same path, relative to the file you are writing. In a decision at `.project/decisions/`, that is `[code://packages/papo/src/chat.ts#L51](../../packages/papo/src/chat.ts#L51)`. The text keeps the URI searchable and the target makes it clickable in a Markdown view. In a body, the same link reads better with the URI in a code span: ``[`code://<path>`](../../<path>)``.
- Quote the whole ref in frontmatter, because a list item that starts with `[` is YAML flow sequence syntax: `- "[code://packages/papo/src/chat.ts#L51](../../packages/papo/src/chat.ts#L51) - the configured default"`. Escape a `"` in the note as `\"`.
- The target carries one `../` per level between the file's folder and the repository root. That is four from `.project/plans/<domain>/<NN>-<slug>/`, three from `.project/plans/<domain>/00-<domain>.md`, two from `.project/specs/`, `.project/rules/`, `.project/decisions/`, `.project/problems/`, `.project/research/`.
- Only `code://` is linked; `npm://`, `git://`, `tasker://`, `https://` and `file://` stay bare, because they are not files in this repository. Never link a path the repository does not have yet, such as a `CREATE:` entry or a spec named in `creates`.
- Globs (`applies`, `covers`) are relative to the repository root.
- One full sentence per line in prose. Never an em dash.

## Writing

Prose follows the writing rules of ASD-STE100 (Simplified Technical English), without its dictionary.
A procedural section is a task's `## Steps` and `## Validation`; everything else is descriptive.

- A sentence has one topic. A procedural sentence has at most 20 words; a descriptive one at most 25.
- A step gives one instruction, in the imperative: "Read the file", not "The file is read".
- Procedural sentences use the active voice and simple tenses.
- A paragraph has at most six sentences.
- A noun cluster has at most three words: "the limit on a session's attachments", not "session attachment size limit".
- One word names one thing, and one thing has one word. The domain's glossary (`00-<domain>.md`) says which word; a synonym is a second thing to the reader.
- Use a plain verb where one exists, not a phrasal verb: "remove", not "take away".
- A code span, a link and a URL count as one word.

`scripts/lint-prose.mjs` checks sentence length, passive voice in procedural sections and em dashes: `node <skill-dir>/scripts/lint-prose.mjs <file-or-directory>...`.
It prints `file:line: rule` and exits 1 when it finds anything.

## Statuses

- plan: `draft` `planned` `active` `built` `dropped`
- task: `todo` `doing` `done` `blocked` `dropped`
- decision: `proposed` `accepted` `deprecated`
- problem: `open` `mitigated`
- rule: `active` `retired` · spec: `current` `retired`

## Plans

A plan is a folder: `plan.md`, one task file per task, and two files whose presence is their meaning:

- `implemented.md` exists when the plan is built: what exists now, what was verified, where it departed from the plan.
- `deferred.md` exists when the plan set something aside: what waits, why, where it goes.

`plan.md` is forward-action-only: each answer now and its source, never how it changed.
Anything not in *Answers* is undecided; a fork met during a task means stop, ask, add a row.
A task's status moves in its own file and in the plan's *Tasks* table, in the same change.
The plan's *Resume state* and `index.md` move with it.
A plan that spans more than two packages or about eight tasks is a parent whose *Tasks* table lists child plans (`<NN>-<slug>-p<N>-<slug>/`).

To close a plan, every task is `done` or `dropped`, and `implemented.md` is written, with `deferred.md` if anything waits.
Then set `status: built`, correct the specs in `changes` and `creates`, and update the index row.

## Task sections

`## Files` and `## Steps` in a task are read by tools as well as agents, so every line under them has one form.

- A Files line is ``- `<OP>: <path>` - <note>.``, with `OP` one of `CREATE`, `UPDATE`, `DELETE`.
- The path is relative to the repository root and is never linked. Only `UPDATE` may add a line range: `<path>:<n>` or `<path>:<n>-<m>`.
- The note is required and says what the file holds, what changes there, or why it goes.
- A Steps line is `<N>. <step>`, numbered from 1 with no gaps. One step is one line, with no nested list under it.
- Nothing else goes under either heading: no prose between lines, no blank-line groups, no sub-headings.

## Decisions, rules, specs

- An answer is a row in the plan's *Answers* table (`What | Source | Task`): what was chosen, its source, and the task that builds it. The source is the user's words with the date, a `code://` line, or `(defaulted: ...)`, which the user may erase. Every answer starts as a row, and almost every answer stays one.
- A decision is a file in `.project/decisions/` only for a choice that a later reader would undo because it looks wrong. It says why the choice was made that way, and names the option that lost in `Options`. The test before writing one: would someone who reads the code later reverse this? If not, it is a row.
- A decision never says how a feature works. What a command does, its flags, its output and its errors go in the task, a spec or the docs. A choice anyone would make, a fix, a gap against a reference, a spec requirement and scope are rows, not decisions.
- Propose a decision file to the user, and write it only when they agree. The *Answers* row then links it.
- A decision that replaces another is a new file. Its `supersedes` names the old one, and a `git://<sha>` ref names the last commit that holds it. The old file is deleted. Rules and specs that pointed at the old one move to the new one.
- A problem is something wrong that nobody has decided what to do about: a defect, a limitation, an obstacle met while working. It is a file in `.project/problems/` while it is undecided, and it binds nothing. Once the fix is decided, it is plan work. The task carries the fix, the answer that chose it is a row in the plan's *Answers* table, and the problem file is deleted. A problem accepted as it is becomes a decision if the choice is strange, and is deleted either way. The aim is no problem files.
- Only the user writes rules. An agent never creates, edits or retires a rule; it tells the user when something looks like one.
- A rule restating another is removed, not added. To retire one: `status: retired` and one line at the top saying why.
- A spec is corrected in place when behaviour changes; if the change contradicts a listed decision, a new decision comes first.

## Before writing

1. Read `.project/plans/index.md` and the domain's `00-<domain>.md`.
2. Check the thing does not already exist; amend rather than duplicate.
3. Find the refs: the code, package, commit or document it came from.

## Finding what `.project/` already says about a file

The `refs` are the index: every plan, task, decision, rule and spec names the code it is about as `code://<path>`.
To find what has been decided or planned for a file, search `.project/` for its path. The link text keeps `code://<path>`, so these searches match a ref whether it was written as a link or left bare.

- Everything about one file: `rg -n "code://packages/agents/src/run/tools.ts" .project/` (drop the `#L...` so a ref with line numbers still matches).
- Everything about a package or folder: `rg -n "code://packages/agents/src/run/" .project/`.
- The decisions only: `rg -ln "code://packages/agents/src/run/tools.ts" .project/decisions/`.
- What is open against it: `rg -ln "code://packages/agents/src/run/" .project/problems/`.
- Which plan a decision belongs to: `rg -n "decisions/<slug>.md" .project/plans/`.
- A decision by number or subject when the slug is unknown: `rg -n "^title: 116 " .project/decisions/` or `rg -ln -i "deny" .project/decisions/`.

Do this before you propose a change to a file, and before you write a decision about it.
Do it also when a code comment cites a decision number that no plan on disk explains.

## Finishing

- No `<placeholder>` left. Every frontmatter path and every relative link resolves (`creates` may name a spec not yet written).
- Every `status` is one of the values above for its kind.
- `index.md` has the row and the status.
- `scripts/lint-prose.mjs` passes on every file you wrote, or each finding it prints is one you chose to keep.
