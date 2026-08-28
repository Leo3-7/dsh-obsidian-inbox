# obsidian-inbox

> **English / 英文**: [README.en.md](README.en.md)

把 DeepSeek Harness（DSH）对话里值得长期保存的结论、解释、错题、想法，按一套确定性的流程整理进 Obsidian 知识库的 DSH **技能（skill）**。

## 这是什么

一个面向 DSH 的 `SKILL.md` 技能，规定了「整理入库」的七步标准流程，核心原则：

- **检索优先于归档**：写库前先按文件名 / aliases / 链接 / frontmatter / MOC 检索，已存在的就直接合并。
- **合并优先于新建**：只做局部编辑、只更新 `updated`，不整篇覆盖、不生成副本。
- **只提炼长期价值**：不保存完整聊天、密码令牌、临时噪音。
- **一个主归属**：每个知识只进一个主目录，跨领域用链接和标签表达。
- **两级确定性校验**：公式（`$`/`$$`、拒绝 `\(`/`\[`）+ 结构与 Wiki 链接（`.obsidian` JSON、`[[Link]]` 目标、同名歧义），**校验不通过不宣布「已入库」**。

## 目录结构

这是一个 **DSH 插件（`dsh.bundle` skill-pack）**，可安装进任意 profile：

```
dsh-obsidian-inbox/
├── package.json                   # dsh.bundle → cordis.patch.yml；main → lib/index.js
├── lib/
│   ├── index.js                   # 插件本体：注册 bundled 技能 + obsidian_validate_vault 工具
│   └── validate.js                # 两级确定性校验逻辑（插件所有，工具/复用同一实现）
├── cordis.patch.yml               # 激活该插件（insert 一行）
├── skills/obsidian-inbox/
│   └── SKILL.md                   # 技能说明（DSH 加载的入口）
├── README.md / README.en.md
├── LICENSE
└── .gitignore
```

> 一切能力都由插件提供：技能经 `ctx.skills` 注册为 `bundled` provider，校验经 `ctx.tools` 注册为模型工具 `obsidian_validate_vault`，vault 路径由插件 `Config.defaultVault` 声明式配置——没有散落的裸脚本或硬编码路径。

## 在 DSH 里使用

**方式 A：作为插件安装（推荐）**

```bash
dsh plugin --profile web add https://github.com/Leo3-7/dsh-obsidian-inbox
# 或按你的实际 profile 名调整：dsh plugin --profile <name> add <上面URL>
```

安装后插件会把自己的 `skills/obsidian-inbox/` 注册为 `bundled` 技能，模型目录里即可看到。

**方式 B：直接把技能目录拷进 DSH 的技能目录**

```bash
# 把 skills/obsidian-inbox/ 放到 $DSH_HOME/skills/ 下，或加到
# skill-filesystem 的 customSkillDirs
```

在会话里说触发词即可触发，例如：**「整理入库」「保存这个结论」「记录为错题」「记录为项目」「更新已有笔记」**。

## 配置 / 个性化

本技能是作者个人的整理流程，有**环境相关**的两处需要按你自己的库修改：

- **vault 路径**：默认 `D:\Obsidian\MyKnowledgeBase`（在 `SKILL.md` 的「唯一 vault」节，以及 `scripts/validate-vault.mjs` 的默认参数）。改成你自己的库即可。
- **主目录分类**：`00_收件箱 / 01_考研 / 02_AI与编程 / 03_智能制造 / 04_项目 / 05_想法 / 06_错题 / 07_对话精华` —— 换成你自己的目录结构。

## 校验（插件工具）

校验是插件暴露的**模型工具 `obsidian_validate_vault`**（不是 shell 脚本），在对话里调用即可：

```text
obsidian_validate_vault                    # 用插件配置 defaultVault（默认 D:/Obsidian/MyKnowledgeBase）
obsidian_validate_vault (vault: "...")     # 校验指定 vault
```

返回 `{ ok, noteCount, problems }`，`ok=false` 时逐条列出公式 / JSON / Wiki 链接 / 同名歧义问题。实现集中在 `lib/validate.js`，工具与（可选）CLI 复用同一份逻辑。

退出码：`0` = 通过；`1` = 发现问题（会逐条列出公式 / JSON / Wiki 链接 / 同名歧义问题）。

## 依赖

- Node.js `>= 18`（`node:fs`、`node:path` 为内置模块，无第三方依赖）。
- 目标为一个 Obsidian vault（含 `.obsidian` 配置目录，`walk` 会跳过 `.obsidian / .dsh / node_modules / .git`）。

## 许可证

[MIT](LICENSE) © Leo3-7
