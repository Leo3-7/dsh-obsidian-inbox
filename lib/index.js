// dsh-obsidian-inbox — bundled skill provider for the Obsidian knowledge-base
// ingest workflow. Registers `skills/obsidian-inbox/SKILL.md` as a `bundled`
// skill provider on `ctx.skills`, mirroring the @deepseek-ai/dsh-skill-badge and
// dsh-review-skills precedents. Packaged as a dsh profile bundle so
// `dsh plugin --profile <name> add dsh-obsidian-inbox` both mounts this plugin
// row and exposes the skill to the model-facing catalog.

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse as parseYaml } from 'yaml'
import { BUNDLED_SKILL_RANK, isSkillName } from '@deepseek-ai/dsh-skill'

/** Cordis plugin name; also the patch row id and the provider name. */
export const name = 'dsh-obsidian-inbox'
/** The skill registry service required to register the bundled provider. */
export const inject = ['skills']

const PROVIDER_NAME = 'dsh-obsidian-inbox'
const SKILLS_DIR = fileURLToPath(new URL('../skills/', import.meta.url))
const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/

/** Parse one `SKILL.md` bundle; throws loudly on malformed packaging. */
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

/** Parse every `SKILL.md` bundle in the packaged skills root, sorted by name. */
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

/** Read and re-parse one skill body for a previously listed candidate. */
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

/** Register the packaged `skills/` directory as a `bundled` provider. */
export function apply(ctx) {
  const candidates = loadSkillEntries().map(candidateFor)
  ctx.skills.registerProvider(() => ({
    name: PROVIDER_NAME,
    list: async () => candidates,
    get: async (candidate) => loadDefinition(candidate),
  }))
  ctx.logger.info(`dsh-obsidian-inbox: registered bundled provider "${PROVIDER_NAME}"`)
}
