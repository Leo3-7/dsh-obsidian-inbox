# obsidian-inbox

> **中文 / Chinese**: [README.md](README.md)

A **DeepSeek Harness (DSH) skill** that files the conclusions, explanations, mistakes, and ideas worth keeping from a DSH conversation into an **Obsidian vault** — through a deterministic, 7-step workflow.

## What it is

A `SKILL.md` skill for DSH that defines a standard "ingest into the vault" process. Core principles:

- **Retrieve before archiving**: before writing, search by filename / aliases / links / frontmatter / MOC; if the note already exists, merge into it.
- **Merge before duplicating**: use local edits and update only `updated`; never overwrite whole notes or create copies.
- **Keep only long-term value**: no full chats, passwords/tokens, or one-off noise.
- **One primary home**: each piece of knowledge belongs to exactly one main folder; cross-domain relationships are expressed with links and tags, not copies.
- **Two-level deterministic validation**: formulas (`$`/`$$`, reject `\(`/`\[`) plus structure & Wiki links (`.obsidian` JSON, `[[Link]]` targets, duplicate names) — **if validation fails, never claim "saved".**

## Structure

```
obsidian-inbox/
├── SKILL.md                       # skill description (DSH entry point)
└── scripts/
    └── validate-vault.mjs         # two-level vault validation script (Node.js)
```

## Using it in DSH

1. Clone this repo locally (or copy `SKILL.md` and `scripts/` into your skills directory).
2. Add this directory to the DSH `skill-filesystem` plugin's `customSkillDirs` (or place it under `$DSH_HOME/skills/<name>/`).
3. Use a trigger phrase in the conversation, e.g. **"整理入库" (file this away)**, **"保存这个结论" (save this conclusion)**, **"记录为错题" (log this mistake)**, **"记录为项目" (log this project)**, **"更新已有笔记" (update an existing note)**.

## Configuration / customization

This skill is the author's personal workflow and has **environment-specific** settings you should adjust for your own vault:

- **Vault path**: defaults to `D:\Obsidian\MyKnowledgeBase` (in the `SKILL.md` "Single vault" section and as the `validate-vault.mjs` default argument). Point it at your own vault.
- **Main folder categories**: `00_收件箱 / 01_考研 / 02_AI与编程 / 03_智能制造 / 04_项目 / 05_想法 / 06_错题 / 07_对话精华` — replace these with your own folder structure.

## Validation script

```bash
# Validate the default vault (D:/Obsidian/MyKnowledgeBase)
node scripts/validate-vault.mjs

# Validate a specific vault
node scripts/validate-vault.mjs D:/your/vault
```

Exit code: `0` = passed; `1` = problems found (lists formula / JSON / Wiki link / duplicate-name issues one by one).

## Requirements

- Node.js `>= 18` (uses only built-in `node:fs` and `node:path`; no third-party dependencies).
- Targets an Obsidian vault (contains a `.obsidian` config directory; `walk` skips `.obsidian / .dsh / node_modules / .git`).

## License

[MIT](LICENSE) © Leo3-7
