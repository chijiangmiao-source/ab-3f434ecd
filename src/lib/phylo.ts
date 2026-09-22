// 系统发育分裂（split / bipartition）核心逻辑：
// 规范化（互补视为同项）、解析校验、两两兼容性、最大兼容集精确求解、候选三分类。
// 全部为纯函数，不依赖 DOM 或网络，可直接在浏览器与 Node 测试中运行。

import type { AuditInput, CandidateLine, CandidateStatus, SolveResult } from './types';

const SPECIES_RE = /^[\x21-\x7E]+$/; // 非空、仅可打印 ASCII、不含空白
const RESERVED_CHARS = ['|', '#']; // 行语法保留字符，不允许出现在物种名中

export function parseSpecies(text: string): { species: string[]; errors: string[] } {
  const errors: string[] = [];
  const tokens = text.split(/[\s,;]+/).map((t) => t.trim()).filter(Boolean);
  const seen = new Set<string>();
  const species: string[] = [];
  for (const tok of tokens) {
    if (!SPECIES_RE.test(tok) || RESERVED_CHARS.some((c) => tok.includes(c))) {
      errors.push(`物种名含非 ASCII 或非法字符（含保留字符 |、#）：“${tok}”`);
      continue;
    }
    if (seen.has(tok)) {
      errors.push(`物种名重复：“${tok}”`);
      continue;
    }
    seen.add(tok);
    species.push(tok);
  }
  if (tokens.length === 0) errors.push('未录入任何物种名。');
  else if (species.length < 4) errors.push(`物种数量需为 4–12 个，当前 ${species.length} 个唯一物种。`);
  else if (species.length > 12) errors.push(`物种数量需为 4–12 个，当前 ${species.length} 个唯一物种。`);
  return { species, errors };
}

function parseSide(field: string): string[] {
  return field
    .split(/[\s,]+/)
    .map((t) => t.trim())
    .filter(Boolean);
}

/**
 * 解析候选分裂文本。
 * 行语法：<物种,物种...> | <物种,物种...> [| 正整数权重]
 * - 两侧以 | 分隔；第三段（可选）为权重，缺省为 1。
 * - # 开头的行与空行忽略。
 * - 非法行保留原文并附错误信息，不参与求解。
 */
export function parseSplits(text: string, species: string[]): CandidateLine[] {
  const index = new Map<string, number>();
  species.forEach((s, i) => index.set(s, i));
  const full = (1 << species.length) - 1;

  const lines: CandidateLine[] = [];
  const rawLines = text.split(/\r?\n/);
  const seenKeys = new Set<string>();

  rawLines.forEach((raw, i) => {
    const lineNo = i + 1;
    const trimmed = raw.trim();
    if (!trimmed || trimmed.startsWith('#')) return;

    const base: CandidateLine = {
      lineNo,
      raw,
      mask: 0,
      weight: 0,
      key: '',
      sideNames: [[], []],
    };

    const fail = (msg: string): CandidateLine => ({ ...base, error: msg });

    const fields = trimmed.split('|').map((f) => f.trim());
    if (fields.length !== 2 && fields.length !== 3) {
      lines.push(fail('语法：左侧物种 | 右侧物种 [| 权重]；恰好 2 段（含权重时 3 段）。'));
      return;
    }

    let weight = 1;
    if (fields.length === 3) {
      if (!/^\d+$/.test(fields[2])) {
        lines.push(fail(`权重必须是正整数，读到“${fields[2]}”。`));
        return;
      }
      weight = Number(fields[2]);
      if (!Number.isSafeInteger(weight) || weight < 1) {
        lines.push(fail('权重必须是 ≥ 1 的正整数（不超过安全整数范围）。'));
        return;
      }
    }

    const left = parseSide(fields[0]);
    const right = parseSide(fields[1]);
    if (left.length === 0 || right.length === 0) {
      lines.push(fail('分裂两侧都必须至少含一个物种。'));
      return;
    }

    let maskA = 0;
    let maskB = 0;
    const bad: string[] = [];
    for (const name of left) {
      const bit = index.get(name);
      if (bit === undefined) bad.push(name);
      else maskA |= 1 << bit;
    }
    for (const name of right) {
      const bit = index.get(name);
      if (bit === undefined) bad.push(name);
      else maskB |= 1 << bit;
    }
    if (bad.length) {
      lines.push(fail(`存在不在物种名录中的名称：${bad.map((b) => `“${b}”`).join('、')}。`));
      return;
    }
    if (maskA & maskB) {
      lines.push(fail('同一物种不能同时出现在分裂两侧。'));
      return;
    }
    if ((maskA | maskB) !== full) {
      const missing = species.filter((_, i) => !((maskA | maskB) & (1 << i)));
      lines.push(fail(`分裂必须覆盖全部物种，缺少：${missing.join('、')}。`));
      return;
    }
    if (maskA === 0 || maskB === 0) {
      lines.push(fail('拒绝平凡分裂（其中一侧为空）。'));
      return;
    }

    // 互补规范化：固定以“不含物种名录首个物种”的一侧为规范侧。
    let mask = maskA;
    if (mask & 1) mask = full ^ mask;
    const sideANames = species.filter((_, i) => mask & (1 << i));
    const sideBNames = species.filter((_, i) => (full ^ mask) & (1 << i));
    const key = sideANames.join('|');

    if (seenKeys.has(key)) {
      lines.push(
        fail(`与先前候选分裂重复（互补分裂视为同一项）：${sideANames.join(',')} | ${sideBNames.join(',')}。`),
      );
      return;
    }
    seenKeys.add(key);

    lines.push({ ...base, mask, weight, key, sideNames: [sideANames, sideBNames] });
  });

  return lines;
}

export function parseInput(speciesText: string, splitsText: string): AuditInput {
  const { species, errors: globalErrors } = parseSpecies(speciesText);
  const lines = species.length >= 4 ? parseSplits(splitsText, species) : [];
  const validCount = lines.filter((l) => !l.error).length;
  const errors = [...globalErrors];
  if (species.length >= 4 && (validCount < 1 || validCount > 28)) {
    errors.push(`有效候选分裂需为 1–28 个，当前 ${validCount} 个（非法行不计入）。`);
  }
  return { species, lines, globalErrors: errors, valid: errors.length === 0 };
}

/** 两个分裂是否兼容：四种两侧交集 A∩A、A∩B、B∩A、B∩B 至少一个为空。 */
export function splitsCompatible(a: number, b: number, full: number): boolean {
  const notA = full ^ a;
  const notB = full ^ b;
  return (
    (a & b) === 0 || // A∩A
    (a & notB) === 0 || // A∩B
    (notA & b) === 0 || // B∩A
    (notA & notB) === 0 // B∩B
  );
}

/**
 * 精确枚举所有两两兼容子集（候选数 ≤ 28），按两级目标择优：
 * 1) 总权重最大；2) 总权重并列时分裂数量最多。
 * 返回所有两级同优解（位集）。
 */
export function findOptimalSolutions(
  masks: number[],
  weights: number[],
  full: number,
): {
  solutions: number[];
  weight: number;
  size: number;
} {
  const n = masks.length;
  const fullMask = (1 << n) - 1;
  // compatBits[i]：与 i 兼容的候选位（含自身）
  const compatBits = new Int32Array(n);
  for (let i = 0; i < n; i++) {
    let bits = 0;
    for (let j = 0; j < n; j++) {
      if (splitsCompatible(masks[i], masks[j], full)) bits |= 1 << j;
    }
    compatBits[i] = bits;
  }

  let bestWeight = -1;
  let bestSize = -1;
  const solutions: number[] = [];

  // 深度优先；allowed 为当前仍可加入（与已选全部兼容且未处理）的候选位集。
  const dfs = (idx: number, chosen: number, count: number, weight: number, allowed: number): void => {
    if (idx === n) {
      if (weight > bestWeight || (weight === bestWeight && count > bestSize)) {
        bestWeight = weight;
        bestSize = count;
        solutions.length = 0;
        solutions.push(chosen);
      } else if (weight === bestWeight && count === bestSize) {
        solutions.push(chosen);
      }
      return;
    }
    const bit = 1 << idx;
    // 剪枝 1：剩余可选权重之和不足以追平当前最优权重（权重均为正）。
    let maxPossible = weight;
    for (let j = idx; j < n; j++) if (allowed & (1 << j)) maxPossible += weights[j];
    if (maxPossible < bestWeight) return;
    // 剪枝 2：权重至多持平且剩余数量（不含当前待定候选）连当前最优数量都追不上。
    if (maxPossible === bestWeight) {
      let remaining = 0;
      for (let j = idx + 1; j < n; j++) if (allowed & (1 << j)) remaining++;
      if (count + 1 + remaining < bestSize) return;
    }

    // 选 idx（前提：与已选全部兼容）
    if (allowed & bit) {
      dfs(idx + 1, chosen | bit, count + 1, weight + weights[idx], allowed & compatBits[idx]);
    }
    // 不选 idx
    dfs(idx + 1, chosen, count, weight, allowed);
  };

  dfs(0, 0, 0, 0, fullMask);
  return { solutions, weight: Math.max(bestWeight, 0), size: Math.max(bestSize, 0) };
}

/** 名称元组逐项字典序（短前缀优先），避免整串拼接在跨长度名称上的歧义。 */
function tupleLess(a: string[], b: string[]): boolean {
  const len = Math.min(a.length, b.length);
  for (let k = 0; k < len; k++) {
    if (a[k] < b[k]) return true;
    if (a[k] > b[k]) return false;
  }
  return a.length < b.length;
}

/**
 * 在全部同优解中挑出“规范分裂序列字典序最小”的一个，返回候选下标。
 * 候选先按规范侧名称元组升序排列；序列按候选顺序逐项比较（短序列前缀优先）。
 */
export function pickDisplaySolution(solutions: number[], canonicalSides: string[][]): number[] {
  const order = canonicalSides
    .map((_, i) => i)
    .sort((a, b) => (tupleLess(canonicalSides[a], canonicalSides[b]) ? -1 : tupleLess(canonicalSides[b], canonicalSides[a]) ? 1 : 0));

  const toSequence = (sol: number): number[] => order.filter((i) => sol & (1 << i));
  const lexLess = (a: number[], b: number[]): boolean => {
    const len = Math.min(a.length, b.length);
    for (let k = 0; k < len; k++) {
      const sa = canonicalSides[a[k]];
      const sb = canonicalSides[b[k]];
      if (tupleLess(sa, sb)) return true;
      if (tupleLess(sb, sa)) return false;
    }
    return a.length < b.length;
  };

  let best = toSequence(solutions[0]);
  for (let s = 1; s < solutions.length; s++) {
    const cand = toSequence(solutions[s]);
    if (lexLess(cand, best)) best = cand;
  }
  return best;
}

export function solve(input: AuditInput): SolveResult | null {
  if (!input.valid) return null;
  const validLines = input.lines.filter((l) => !l.error);
  const n = validLines.length;
  const masks = validLines.map((l) => l.mask);
  const weights = validLines.map((l) => l.weight);
  const canonicalSides = validLines.map((l) => l.sideNames[0]);
  const full = input.species.reduce((acc, _, i) => acc | (1 << i), 0);

  const compatibility: boolean[][] = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => splitsCompatible(masks[i], masks[j], full)),
  );

  const { solutions, weight, size } = findOptimalSolutions(masks, weights, full);
  const displaySolution = pickDisplaySolution(solutions, canonicalSides);

  const statuses: CandidateStatus[] = validLines.map((_, i) => {
    const bit = 1 << i;
    let inAll = true;
    let inAny = false;
    for (const sol of solutions) {
      const has = (sol & bit) !== 0;
      inAll = inAll && has;
      inAny = inAny || has;
    }
    if (inAll) return 'required';
    if (!inAny) return 'never';
    return 'optional';
  });

  return {
    compatibility,
    optimalSolutions: solutions,
    optimalWeight: weight,
    optimalSize: size,
    displaySolution,
    statuses,
  };
}

/** 将位集翻译回候选在 validLines 中的下标列表。 */
export function solutionIndices(sol: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < 31; i++) if (sol & (1 << i)) out.push(i);
  return out;
}
