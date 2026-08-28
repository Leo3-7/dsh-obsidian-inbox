// dsh-obsidian-inbox — two-level vault validation, plugin-owned.
//
// Under the "everything is a plugin" idea this is NOT a bare shell script the
// agent has to discover and run: the logic lives here so the plugin can expose
// it as a model-facing tool (`obsidian_validate_vault`) and reuse it from a
// manual CLI runner through the same single implementation.

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, relative, basename } from 'node:path'

const FRONTMATTER_IGNORED_DIRS = new Set(['.obsidian', '.dsh', 'node_modules', '.git', '.trash'])

/** One validation result: pass/fail plus the deterministic problem list. */
export function validateVault(vaultArg, options = {}) {
  const vault = (vaultArg || '').replace(/\\/g, '/')
  const problems = []
  const notes = [] // { abs, relPath, base, content, cleanLines, cleanContent }

  if (!existsSync(vault)) {
    return { ok: false, noteCount: 0, problems: [`vault 不存在: ${vault}`] }
  }

  function walk(dir, rel) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const abs = join(dir, entry.name)
      const relPath = rel ? `${rel}/${entry.name}` : entry.name
      if (entry.isDirectory()) {
        if (FRONTMATTER_IGNORED_DIRS.has(entry.name)) continue
        walk(abs, relPath)
      } else if (entry.name.endsWith('.md')) {
        notes.push({ abs, relPath, base: basename(entry.name, '.md'), content: readFileSync(abs, 'utf8') })
      }
    }
  }
  walk(vault, '')

  // Preprocess: strip code fences and inline code so we validate the "plain text".
  for (const note of notes) {
    const lines = note.content.split(/\r?\n/)
    note.cleanLines = []
    let inFence = false
    for (const line of lines) {
      const t = line.trim()
      if (t.startsWith('```')) { inFence = !inFence; note.cleanLines.push(''); continue }
      if (inFence) { note.cleanLines.push(''); continue }
      note.cleanLines.push(line.replace(/\x60[^\x60]*\x60/g, ''))
    }
    note.cleanContent = note.cleanLines.join('\n')
  }

  // Layer 1 — formulas.
  for (const note of notes) {
    const { relPath, cleanContent, cleanLines } = note
    if (/\\\(|\\\[/.test(cleanContent)) {
      problems.push(`[公式] ${relPath}: 使用了 \\( 或 \\[ 定界符，应改用 $ 或 $$`)
    }
    const dd = (cleanContent.match(/\$\$/g) || []).length
    if (dd % 2 === 1) problems.push(`[公式] ${relPath}: $$ 块公式未配对（出现 ${dd} 次）`)
    for (let i = 0; i < cleanLines.length; i++) {
      const line = cleanLines[i]
      const singles = (line.replace(/\$\$/g, '').match(/\$/g) || []).length
      if (singles % 2 === 1) problems.push(`[公式] ${relPath}:${i + 1}: 行内 $ 未配对`)
      if (line.trim().startsWith('|')) {
        let inMath = false
        for (let j = 0; j < line.length; j++) {
          const ch = line[j]
          if (ch === '$') {
            if (line[j + 1] === '$') { j++; continue }
            inMath = !inMath
          } else if (ch === '|' && inMath && line[j - 1] !== '\\') {
            problems.push(`[公式] ${relPath}:${i + 1}: 表格行内公式出现裸 |（应写为 \\|）`)
            inMath = false
          }
        }
      }
    }
  }

  // Layer 2 — .obsidian top-level JSON (tolerate a leading UTF-8 BOM / whitespace).
  const obsidianDir = join(vault, '.obsidian')
  if (existsSync(obsidianDir)) {
    for (const entry of readdirSync(obsidianDir)) {
      if (!entry.endsWith('.json')) continue
      try {
        const jsonText = readFileSync(join(obsidianDir, entry), 'utf8').replace(/^\uFEFF/, '')
        if (jsonText.trim().length === 0) continue
        JSON.parse(jsonText.trim())
      }
      catch (e) { problems.push(`[JSON] .obsidian/${entry}: 解析失败: ${e.message}`) }
    }
  }

  // Layer 2 — Wiki links + duplicate names.
  const byBase = new Map()
  for (const note of notes) {
    if (!byBase.has(note.base)) byBase.set(note.base, [])
    byBase.get(note.base).push(note.abs)
  }
  for (const [base, paths] of byBase) {
    if (paths.length > 1) {
      problems.push(`[歧义] 笔记名 "${base}" 存在 ${paths.length} 份: ${paths.map((p) => relative(vault, p)).join('; ')}`)
    }
  }
  const linkRe = /(?<!!)\[\[([^\[\]]+)\]\]/g
  for (const note of notes) {
    let m
    linkRe.lastIndex = 0
    while ((m = linkRe.exec(note.cleanContent)) !== null) {
      const raw = m[1].trim()
      const target = raw.split('|')[0].split('#')[0].split('^')[0].trim()
      if (!target) continue
      if (existsSync(join(vault, target + '.md'))) continue
      const hits = byBase.get(basename(target)) || []
      if (hits.length === 1) continue
      if (hits.length === 0) problems.push(`[链接] ${note.relPath}: 目标不存在 [[${raw}]]`)
      else problems.push(`[链接] ${note.relPath}: 目标歧义 [[${raw}]]，命中 ${hits.length} 份`)
    }
  }

  return { ok: problems.length === 0, noteCount: notes.length, problems }
}

/** Human-readable one-line summary, for the tool's render/CLI. */
export function summarize(result) {
  if (result.ok) return `[OK] vault 校验通过：${result.noteCount} 个 .md 文件，无公式/JSON/链接问题。`
  return `[FAIL] 发现 ${result.problems.length} 个问题：\n${result.problems.map((p) => `  - ${p}`).join('\n')}`
}
