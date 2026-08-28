# obsidian-inbox

> **中文 / Chinese**: [README.md](README.md)
> [![npm version](https://img.shields.io/npm/v/dsh-obsidian-inbox.svg)](https://www.npmjs.com/package/dsh-obsidian-inbox) · `dsh-obsidian-inbox` · [GitHub](https://github.com/Leo3-7/dsh-obsidian-inbox)

A **DeepSeek Harness (DSH) skill** that files the conclusions, explanations, mistakes, and ideas worth keeping from a DSH conversation into an **Obsidian vault** — through a deterministic, 7-step workflow.

## What it is

A `SKILL.md` skill for DSH that defines a standard "ingest into the vault" process. Core principles:

- **Retrieve before archiving**: before writing, search by filename / aliases / links / frontmatter / MOC; if the note already exists, merge into it.
- **Merge before duplicating**: use local edits and update only `updated`; never overwrite whole notes or create copies.
- **Keep only long-term value**: no full chats, passwords/tokens, or one-off noise.
- **One primary home**: each piece of knowledge belongs to exactly one main folder; cross-domain relationships are expressed with links and tags, not copies.
- **Two-level deterministic validation**: formulas (`$`/`$$`, reject `\(`/`\[`) plus structure & Wiki links (`.obsidian` JSON, `[[Link]]` targets, duplicate names) — **if validation fails, never claim "saved".**

## Structure

This is a **DSH plugin (`dsh.bundle` skill-pack)** installable into any profile:

```
dsh-obsidian-inbox/
├── package.json                   # dsh.bundle → cordis.patch.yml; main → lib/index.js
├── lib/
│   ├── index.js                   # plugin body: registers bundled skill + obsidian_validate_vault tool
│   └── validate.js                # two-level validation logic (plugin-owned, shared)
├── cordis.patch.yml               # activates the plugin (one insert row)
├── skills/obsidian-inbox/
│   └── SKILL.md                   # skill description (DSH entry point)
├── README.md / README.en.md
├── LICENSE
└── .gitignore
```

> Every capability is provided by the plugin: the skill is registered on `ctx.skills` as a `bundled` provider, the validation is registered on `ctx.tools` as the `obsidian_validate_vault` model tool, and the vault path comes from the plugin's declarative `Config.defaultVault` — no loose shell scripts or hardcoded paths.

## Using it in DSH

**Option A: install from npm (recommended, published to npm)**

```bash
dsh plugin --profile web add dsh-obsidian-inbox
# or adjust the profile name: dsh plugin --profile <name> add dsh-obsidian-inbox
```

**Option B: install from GitHub source (fallback)**

```bash
dsh plugin --profile web add https://github.com/Leo3-7/dsh-obsidian-inbox
```

**Option C: copy the skill directory into DSH's skills dir**

```bash
# place skills/obsidian-inbox/ under $DSH_HOME/skills/, or add it to
# the skill-filesystem plugin's customSkillDirs
```

Any of these registers `skills/obsidian-inbox/` as a `bundled` skill in the model catalog; vault validation goes through the `obsidian_validate_vault` tool.

Use a trigger phrase in the conversation, e.g. **"整理入库" (file this away)**, **"保存这个结论" (save this conclusion)**, **"记录为错题" (log this mistake)**, **"记录为项目" (log this project)**, **"更新已有笔记" (update an existing note)**.

## Configuration / customization

This skill is the author's personal workflow and has **environment-specific** settings you should adjust for your own vault:

- **Vault path**: resolved from the plugin `Config.defaultVault` (default empty — set it to your own vault path); override it in the plugin config, or pass a `vault` argument to `obsidian_validate_vault`.
- **Main folder categories**: `00_收件箱 / 01_考研 / 02_AI与编程 / 03_智能制造 / 04_项目 / 05_想法 / 06_错题 / 07_对话精华` — replace these with your own folder structure.

## Validation (plugin tool)

Validation is a **model-facing tool `obsidian_validate_vault`** exposed by the plugin (not a shell script). Call it in the conversation:

```text
obsidian_validate_vault                    # uses the plugin config defaultVault (needs your Config.defaultVault set)
obsidian_validate_vault (vault: "...")     # validate a specific vault
```

It returns `{ ok, noteCount, problems }`; when `ok=false`, it lists formula / JSON / Wiki link / duplicate-name issues one by one. The single implementation lives in `lib/validate.js`, shared by the tool and any optional CLI.

Exit code: `0` = passed; `1` = problems found (lists formula / JSON / Wiki link / duplicate-name issues one by one).

## Requirements

- Node.js `>= 18` (uses only built-in `node:fs` and `node:path`; no third-party dependencies).
- Targets an Obsidian vault (contains a `.obsidian` config directory; `walk` skips `.obsidian / .dsh / node_modules / .git`).

## License

[MIT](LICENSE) © Leo3-7
