// dsh-obsidian-inbox — bundled DeepSeek Harness plugin under the
// "everything is a plugin" principle.
//
// Everything this project contributes is provided through the Cordis context:
//   - the Obsidian ingest skill is registered as a `bundled` skill provider on
//     `ctx.skills` (so it composes with the skill catalog);
//   - the two-level vault validation is exposed as a model-facing tool
//     `obsidian_validate_vault` (registered on `ctx.tools`), NOT a bare shell
//     script the agent has to discover and run;
//   - the vault path and caps are declarative, resolved from the plugin's
//     schemastery `Config`, not hardcoded into a script.
//
// The plugin is packaged as a `dsh.bundle` (see package.json), so installing it
// with `dsh plugin --profile <name> add dsh-obsidian-inbox` mounts this plugin
// row (cordis.patch.yml) and exposes both capabilities.

import z from '@deepseek-ai/schemastery'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse as parseYaml } from 'yaml'
import { BUNDLED_SKILL_RANK, isSkillName } from '@deepseek-ai/dsh-skill'
import { validateVault, summarize } from './validate.js'

/** Cordis plugin name; also the skill-provider name and the patch row id. */
export const name = 'dsh-obsidian-inbox'
/** The skill registry is always needed; the tool registry is optional (ctx.get). */
export const inject = ['skills']

const SKILLS_DIR = fileURLToPath(new URL('../skills/', import.meta.url))
const PROVIDER_NAME = 'dsh-obsidian-inbox'
const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/

/** Declarative, schemastery-backed plugin config. Overridable via patch config. */
export const Config = z.object({
  /** Default Obsidian vault to validate when the tool is called without a `vault` arg. Set to your own vault path. */
  defaultVault: z.string().default(''),
})

// ── bundled skill provider ───────────────────────────────────────────────

function parseSkillFile(text, filePath) {
  const match = FRONTMATTER_RE.exec(text)
  if (match === null) {
    throw new Error(`${filePath}: missing YAML frontmatter (--- name/description ---)`)
  }
  const raw = parseYaml(match[1] ?? '')
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new Error(`${filePath}: frontmatter must be a YAML mapping`)
  }
  const record = raw
  const skillName = record['name']
  if (typeof skillName !== 'string' || !isSkillName(skillName)) {
    throw new Error(`${filePath}: frontmatter "name" must be kebab-case, got ${JSON.stringify(skillName)}`)
  }
  const description = record['description']
  if (typeof description !== 'string' || description.length === 0) {
    throw new Error(`${filePath}: frontmatter "description" must be a non-empty string`)
  }
  const whenToUse = record['whenToUse']
  const disableModel = record['disable-model-invocation']
  const userInvocable = record['user-invocable']
  return {
    name: skillName,
    description,
    ...(whenToUse !== undefined ? { whenToUse } : {}),
    modelInvocable: disableModel !== true,
    userInvocable: userInvocable !== false,
    filePath,
    body: match[2] ?? '',
  }
}

function loadSkillEntries() {
  const entries = []
  for (const entry of readdirSync(SKILLS_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const skillFile = join(SKILLS_DIR, entry.name, 'SKILL.md')
    if (!existsSync(skillFile)) continue
    entries.push(parseSkillFile(readFileSync(skillFile, 'utf8'), skillFile))
  }
  return entries.sort((left, right) => left.name.localeCompare(right.name))
}

function candidateFor(entry) {
  return {
    name: entry.name,
    description: entry.description,
    ...(entry.whenToUse !== undefined ? { whenToUse: entry.whenToUse } : {}),
    invocation: {
      modelInvocable: entry.modelInvocable,
      userInvocable: entry.userInvocable,
    },
    source: 'bundled',
    provider: PROVIDER_NAME,
    resourceBase: { kind: 'directory', path: SKILLS_DIR },
    rank: BUNDLED_SKILL_RANK,
    locator: { filePath: entry.filePath },
    path: entry.filePath,
  }
}

async function loadDefinition(candidate) {
  const locator = candidate.locator
  const text = await readFile(locator.filePath, 'utf8')
  const entry = parseSkillFile(text, locator.filePath)
  return {
    name: entry.name,
    description: entry.description,
    ...(entry.whenToUse !== undefined ? { whenToUse: entry.whenToUse } : {}),
    invocation: {
      modelInvocable: entry.modelInvocable,
      userInvocable: entry.userInvocable,
    },
    source: 'bundled',
    provider: PROVIDER_NAME,
    resourceBase: { kind: 'directory', path: SKILLS_DIR },
    content: entry.body,
    path: entry.filePath,
  }
}

// ── plugin apply ─────────────────────────────────────────────────────────

/** Register the skill provider (always) and the validation tool (if `tools` exists). */
export function apply(ctx, config) {
  const candidates = loadSkillEntries().map(candidateFor)
  ctx.skills.registerProvider(() => ({
    name: PROVIDER_NAME,
    list: async () => candidates,
    get: async (candidate) => loadDefinition(candidate),
  }))
  ctx.logger.info(`dsh-obsidian-inbox: registered bundled skill provider "${PROVIDER_NAME}"`)

  // Tool registration is conditional: the skill always composes, the tool only
  // when a tools service is present. This keeps the bundle composable across
  // profiles (plugin-model purist behavior) instead of hard-requiring "tools".
  const tools = ctx.get('tools')
  if (tools) {
    const defaultVault = config.defaultVault
    const tool = defineTool({
      name: 'obsidian_validate_vault',
      description:
        'Run the two-level deterministic validation over an Obsidian vault: formula syntax ($/$$, rejects \\(\\)/\\[\\]), .obsidian JSON parse, [[Wiki Link]] targets, and duplicate-note-name ambiguity. Returns ok/noteCount/problems. Use this to verify a vault (or a note you just edited) before claiming anything was ingested.',
      parameters: {
        vault: {
          type: 'string',
          description: 'Absolute path to the Obsidian vault to validate. Falls back to the plugin Config.defaultVault (set it to your own vault path).',
        },
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            ok: { type: 'boolean', required: true },
            noteCount: { type: 'number', required: true },
            problems: {
              type: 'array',
              required: true,
              items: { type: 'string' },
            },
          },
        },
        render: (_args, value) => [{ type: 'text', text: summarize(value) }],
      },
      async execute(args) {
        const vault = args.vault || defaultVault
        if (!vault) {
          return { ok: false, noteCount: 0, problems: ['未配置 vault：请设置插件 Config.defaultVault，或在调用时传入 vault 参数'] }
        }
        return validateVault(vault)
      },
    })
    tools.register(tool)

    // Model-facing guidance: a short system-prompt section so the model reaches
    // for the plugin tool (not a shell command) when validating an Obsidian vault.
    const systemPrompt = ctx.get('systemPrompt')
    if (systemPrompt) {
      systemPrompt.section({
        name: 'tool:obsidian_validate_vault',
        order: 350,
        text:
          'Use the obsidian_validate_vault tool — never a shell command — to run the two-level deterministic validation of an Obsidian vault (formula $/$$ syntax, .obsidian JSON, [[Wiki Link]] targets, duplicate-note-name ambiguity). It returns { ok, noteCount, problems }; only claim a note was ingested after ok === true.',
      })
    }

    ctx.logger.info('dsh-obsidian-inbox: registered model tool "obsidian_validate_vault"')
  }
}
