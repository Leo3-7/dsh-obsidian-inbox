# obsidian-inbox

把 DeepSeek Harness（DSH）对话里值得长期保存的结论、解释、错题、想法，按一套确定性的流程整理进 Obsidian 知识库的 DSH **技能（skill）**。

## 这是什么

一个面向 DSH 的 `SKILL.md` 技能，规定了「整理入库」的七步标准流程，核心原则：

- **检索优先于归档**：写库前先按文件名 / aliases / 链接 / frontmatter / MOC 检索，已存在的就直接合并。
- **合并优先于新建**：只做局部编辑、只更新 `updated`，不整篇覆盖、不生成副本。
- **只提炼长期价值**：不保存完整聊天、密码令牌、临时噪音。
- **一个主归属**：每个知识只进一个主目录，跨领域用链接和标签表达。
- **两级确定性校验**：公式（`$`/`$$`、拒绝 `\(`/`\[`）+ 结构与 Wiki 链接（`.obsidian` JSON、`[[Link]]` 目标、同名歧义），**校验不通过不宣布「已入库」**。

## 目录结构

```
obsidian-inbox/
├── SKILL.md                       # 技能说明（DSH 加载的入口）
└── scripts/
    └── validate-vault.mjs         # vault 两级确定性校验脚本（Node.js）
```

## 在 DSH 里使用

1. 把这个仓库克隆到本地（或直接把 `SKILL.md` 与 `scripts/` 拷进你的技能目录）。
2. 在 DSH 的 `skill-filesystem` 插件里添加该目录到 `customSkillDirs`（或放进 `$DSH_HOME/skills/<name>/`）。
3. 在会话里说触发词即可触发，例如：**「整理入库」「保存这个结论」「记录为错题」「记录为项目」「更新已有笔记」**。

## 配置 / 个性化

本技能是作者个人的整理流程，有**环境相关**的两处需要按你自己的库修改：

- **vault 路径**：默认 `D:\Obsidian\MyKnowledgeBase`（在 `SKILL.md` 的「唯一 vault」节，以及 `scripts/validate-vault.mjs` 的默认参数）。改成你自己的库即可。
- **主目录分类**：`00_收件箱 / 01_考研 / 02_AI与编程 / 03_智能制造 / 04_项目 / 05_想法 / 06_错题 / 07_对话精华` —— 换成你自己的目录结构。

## 校验脚本

```bash
# 校验默认 vault（D:/Obsidian/MyKnowledgeBase）
node scripts/validate-vault.mjs

# 校验指定 vault
node scripts/validate-vault.mjs D:/your/vault
```

退出码：`0` = 通过；`1` = 发现问题（会逐条列出公式 / JSON / Wiki 链接 / 同名歧义问题）。

## 依赖

- Node.js `>= 18`（`node:fs`、`node:path` 为内置模块，无第三方依赖）。
- 目标为一个 Obsidian vault（含 `.obsidian` 配置目录，`walk` 会跳过 `.obsidian / .dsh / node_modules / .git`）。

## 许可证

[MIT](LICENSE) © Leo3-7
