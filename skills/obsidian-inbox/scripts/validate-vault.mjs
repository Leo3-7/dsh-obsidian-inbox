// Obsidian vault 两级确定性校验脚本
// 用法: node validate-vault.mjs [vaultRoot]
// 默认 vaultRoot = D:/Obsidian/MyKnowledgeBase
// 退出码: 0 = 通过, 1 = 存在问题

import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, relative, basename } from 'node:path';

const VAULT = (process.argv[2] || 'D:/Obsidian/MyKnowledgeBase').replace(/\\/g, '/');
const problems = [];
const notes = []; // { abs, relPath, base, content, cleanLines, cleanContent }

function walk(dir, rel) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const abs = join(dir, entry.name);
    const relPath = rel ? `${rel}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      if (['.obsidian', '.dsh', 'node_modules', '.git'].includes(entry.name)) continue;
      walk(abs, relPath);
    } else if (entry.name.endsWith('.md')) {
      notes.push({ abs, relPath, base: basename(entry.name, '.md'), content: readFileSync(abs, 'utf8') });
    }
  }
}

if (!existsSync(VAULT)) {
  console.error(`[FATAL] vault 不存在: ${VAULT}`);
  process.exit(1);
}

walk(VAULT, '');

// 预处理：去掉代码块与行内代码，得到用于公式/链接校验的"纯文本"
for (const note of notes) {
  const lines = note.content.split(/\r?\n/);
  note.cleanLines = [];
  let inFence = false;
  for (const line of lines) {
    const t = line.trim();
    if (t.startsWith('```')) { inFence = !inFence; note.cleanLines.push(''); continue; }
    if (inFence) { note.cleanLines.push(''); continue; }
    note.cleanLines.push(line.replace(/\x60[^\x60]*\x60/g, ''));
  }
  note.cleanContent = note.cleanLines.join('\n');
}

// ---------- 第一层：公式校验 ----------
for (const note of notes) {
  const { relPath, cleanContent, cleanLines } = note;

  // 拒绝 \( 与 \[
  if (/\\\(|\\\[/.test(cleanContent)) {
    problems.push(`[公式] ${relPath}: 使用了 \\( 或 \\[ 定界符，应改用 $ 或 $$`);
  }

  // $$ 块公式成对
  const dd = (cleanContent.match(/\$\$/g) || []).length;
  if (dd % 2 === 1) {
    problems.push(`[公式] ${relPath}: $$ 块公式未配对（出现 ${dd} 次）`);
  }

  // 行内 $ 成对 + 表格裸 |
  for (let i = 0; i < cleanLines.length; i++) {
    const line = cleanLines[i];
    const withoutBlock = line.replace(/\$\$/g, '');
    const singles = (withoutBlock.match(/\$/g) || []).length;
    if (singles % 2 === 1) {
      problems.push(`[公式] ${relPath}:${i + 1}: 行内 $ 未配对`);
    }

    if (line.trim().startsWith('|')) {
      let inMath = false;
      for (let j = 0; j < line.length; j++) {
        const ch = line[j];
        if (ch === '$') {
          if (line[j + 1] === '$') { j++; continue; } // $$ 跳过
          inMath = !inMath;
        } else if (ch === '|' && inMath && line[j - 1] !== '\\') {
          problems.push(`[公式] ${relPath}:${i + 1}: 表格行内公式出现裸 |（应写为 \\|）`);
          inMath = false; // 每行只报告一次
        }
      }
    }
  }
}

// ---------- 第二层：.obsidian 顶层 JSON ----------
const obsidianDir = join(VAULT, '.obsidian');
if (existsSync(obsidianDir)) {
  for (const entry of readdirSync(obsidianDir)) {
    if (entry.endsWith('.json')) {
      try {
        JSON.parse(readFileSync(join(obsidianDir, entry), 'utf8'));
      } catch (e) {
        problems.push(`[JSON] .obsidian/${entry}: 解析失败: ${e.message}`);
      }
    }
  }
}

// ---------- 第二层：Wiki 链接 ----------
const byBase = new Map(); // basename -> [absPath]
for (const note of notes) {
  if (!byBase.has(note.base)) byBase.set(note.base, []);
  byBase.get(note.base).push(note.abs);
}

// 同名笔记歧义
for (const [base, paths] of byBase) {
  if (paths.length > 1) {
    problems.push(`[歧义] 笔记名 "${base}" 存在 ${paths.length} 份: ${paths.map((p) => relative(VAULT, p)).join('; ')}`);
  }
}

// 链接目标存在性（跳过图片嵌入 ![[...]]，在"纯文本"上检查）
const linkRe = /(?<!!)\[\[([^\[\]]+)\]\]/g;
for (const note of notes) {
  let m;
  linkRe.lastIndex = 0;
  while ((m = linkRe.exec(note.cleanContent)) !== null) {
    const raw = m[1].trim();
    let target = raw.split('|')[0].split('#')[0].split('^')[0].trim();
    if (!target) continue; // 纯锚点 [[#...]]，指向自身

    const direct = join(VAULT, target + '.md');
    if (existsSync(direct)) continue;

    // 按 basename 全库解析
    const hits = byBase.get(basename(target)) || [];
    if (hits.length === 1) continue;
    if (hits.length === 0) {
      problems.push(`[链接] ${note.relPath}: 目标不存在 [[${raw}]]`);
    } else {
      problems.push(`[链接] ${note.relPath}: 目标歧义 [[${raw}]]，命中 ${hits.length} 份`);
    }
  }
}

// ---------- 汇总 ----------
if (problems.length === 0) {
  console.log(`[OK] vault 校验通过：${notes.length} 个 .md 文件，无公式/JSON/链接问题。`);
  process.exit(0);
} else {
  console.error(`[FAIL] 发现 ${problems.length} 个问题:`);
  for (const p of problems) console.error('  - ' + p);
  process.exit(1);
}
