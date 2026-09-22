import { describe, expect, it } from 'vitest';
import {
  findOptimalSolutions,
  parseInput,
  parseSpecies,
  parseSplits,
  pickDisplaySolution,
  solutionIndices,
  solve,
  splitsCompatible,
} from '../src/lib/phylo';

const FULL = (m: number) => (1 << m) - 1;

/** 朴素暴力：枚举全部子集，逐一验证两两兼容，两级择优。 */
function bruteForce(m: number, masks: number[], weights: number[]) {
  const n = masks.length;
  const full = FULL(m) >>> 0;
  let bestWeight = -1;
  let bestSize = -1;
  const sols = new Set<number>();
  for (let s = 0; s < 1 << n; s++) {
    let ok = true;
    const idx = solutionIndices(s);
    for (let p = 0; p < idx.length && ok; p++)
      for (let q = p + 1; q < idx.length; q++)
        if (!splitsCompatible(masks[idx[p]], masks[idx[q]], full)) ok = false;
    if (!ok) continue;
    let w = 0;
    for (const i of idx) w += weights[i];
    if (w > bestWeight || (w === bestWeight && idx.length > bestSize)) {
      bestWeight = w;
      bestSize = idx.length;
      sols.clear();
      sols.add(s);
    } else if (w === bestWeight && idx.length === bestSize) {
      sols.add(s);
    }
  }
  return { weight: bestWeight, size: bestSize, sols: [...sols].sort((a, b) => a - b) };
}

/** 生成 m 个物种上互不相同的规范化分裂位集。 */
function randomMasks(m: number, count: number, rng: () => number): number[] {
  const pool: number[] = [];
  for (let bits = 1; bits < (1 << (m - 1)) - 1; bits++) pool.push(bits << 1);
  // 简单洗牌
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count);
}

describe('物种名录解析', () => {
  it('接受 4–12 个唯一 ASCII 名称', () => {
    const ok = parseSpecies('a b c d');
    expect(ok.species).toEqual(['a', 'b', 'c', 'd']);
    expect(ok.errors).toHaveLength(0);
  });
  it('拒绝不足 4 个与超过 12 个', () => {
    expect(parseSpecies('a b c').errors.join()).toContain('4–12');
    expect(parseSpecies(Array.from({ length: 13 }, (_, i) => `s${i}`).join(' ')).errors.join()).toContain('4–12');
  });
  it('拒绝重复名与非 ASCII 名称', () => {
    expect(parseSpecies('a b a d').errors.join()).toContain('重复');
    expect(parseSpecies('a b c 物种').errors.join()).toContain('ASCII');
  });
  it('拒绝含行语法保留字符（|、#）的名称', () => {
    expect(parseSpecies('a b c x|y').errors.join()).toContain('保留字符');
    expect(parseSpecies('a b c #d').errors.join()).toContain('保留字符');
  });
});

describe('候选分裂解析与互补规范化', () => {
  const sp = ['a', 'b', 'c', 'd'];
  it('互补分裂视为同一项并拒绝重复', () => {
    const lines = parseSplits('a b | c d\nc d | a b | 9', sp);
    expect(lines[0].error).toBeUndefined();
    expect(lines[0].mask).toBe(0b1100); // 规范侧不含锚点 a
    expect(lines[1].error).toContain('重复');
    expect(lines[1].raw).toBe('c d | a b | 9'); // 原文保留
  });
  it('拒绝平凡分裂与未覆盖全部物种', () => {
    const lines = parseSplits('a b c d | \na | b c', sp);
    expect(lines[0].error).toContain('两侧都必须');
    expect(lines[1].error).toContain('覆盖');
  });
  it('权重缺省为 1，零/负/非整数拒绝', () => {
    expect(parseSplits('a b | c d', sp)[0].weight).toBe(1);
    expect(parseSplits('a b | c d | 0', sp)[0].error).toContain('正整数');
    expect(parseSplits('a b | c d | 2.5', sp)[0].error).toContain('正整数');
  });
  it('拒绝同一物种跨两侧、未知物种名', () => {
    expect(parseSplits('a b | b c d', sp)[0].error).toContain('不能同时');
    expect(parseSplits('a b | c x', sp)[0].error).toContain('不在物种名录');
  });
  it('注释行与空行忽略', () => {
    const lines = parseSplits('# comment\n\n a b | c d \n', sp);
    expect(lines).toHaveLength(1);
  });
  it('有效候选数量上界 28', () => {
    const six = ['a', 'b', 'c', 'd', 'e', 'f'];
    // 6 物种共 30 个规范分裂；确定性取 28 个（排除 {b} 与 {c}）。
    const pool = randomMasks(6, 30, () => 0.5).sort((a, b) => a - b).filter((m) => m !== 0b0010 && m !== 0b0100);
    expect(pool).toHaveLength(28);
    const toLine = (mask: number, w = 1) =>
      `${six.filter((_, i) => mask & (1 << i)).join(' ')} | ${six
        .filter((_, i) => !(mask & (1 << i)))
        .join(' ')} | ${w}`;
    const lines = pool.map((m) => toLine(m));
    expect(parseInput(six.join(' '), lines.join('\n')).valid).toBe(true);
    // 追加第 29 个不同分裂 -> 超过上界
    const input29 = parseInput(six.join(' '), `${lines.join('\n')}\n${toLine(0b0010, 2)}`);
    expect(input29.valid).toBe(false);
    expect(input29.globalErrors.join()).toContain('1–28');
  });
});

describe('兼容性判定（四种两侧交集）', () => {
  const full = FULL(4);
  it('四分格局（四个交集均非空）冲突', () => {
    // {c,d} vs {b,d}：四个交集 d / c / b / a 均非空
    expect(splitsCompatible(0b1100, 0b1010, full)).toBe(false);
  });
  it('一侧嵌套则兼容，自身恒兼容', () => {
    expect(splitsCompatible(0b1100, 0b1110, full)).toBe(true); // {c,d} ⊂ {b,c,d}
    expect(splitsCompatible(0b0110, 0b0110, full)).toBe(true);
  });
  it('不相交两侧兼容', () => {
    expect(splitsCompatible(0b0010, 0b0100, full)).toBe(true); // {b} ∩ {c} 空
  });
});

describe('最大兼容集求解器', () => {
  it('与朴素暴力枚举一致（随机对拍，含三分类口径）', () => {
    let seed = 20260922;
    const rng = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x80000000;
    };
    for (let trial = 0; trial < 60; trial++) {
      const m = 4 + Math.floor(rng() * 5); // 4..8 物种
      const total = 2 ** (m - 1) - 2;
      const n = 1 + Math.floor(rng() * Math.min(total, 12));
      const masks = randomMasks(m, n, rng);
      const weights = masks.map(() => 1 + Math.floor(rng() * 6));
      const got = findOptimalSolutions(masks, weights, FULL(m));
      const want = bruteForce(m, masks, weights);
      expect(got.weight).toBe(want.weight);
      expect(got.size).toBe(want.size);
      expect([...got.solutions].sort((a, b) => a - b)).toEqual(want.sols);
    }
  });

  it('先最大化总权重，再最大化数量', () => {
    // 5 物种：X={b,d} w2 与 Z={b,d,e} w1 兼容（合 3 分 2）；W={b,c} w3 与二者冲突（合 3 分 1）。
    const species = 'a b c d e';
    const splits = ['b d | a c e | 2', 'a c | b d e | 1', 'b c | a d e | 3'].join('\n');
    const r = solve(parseInput(species, splits))!;
    expect(r.optimalWeight).toBe(3);
    expect(r.optimalSize).toBe(2);
    expect(r.optimalSolutions).toHaveLength(1);
  });

  it('规模上限 28 候选仍可快速精确求解', () => {
    const six = ['a', 'b', 'c', 'd', 'e', 'f'];
    const masks = randomMasks(6, 28, Math.random);
    const weights = masks.map(() => 1);
    const t0 = Date.now();
    const r = findOptimalSolutions(masks, weights, FULL(6));
    expect(Date.now() - t0).toBeLessThan(5000);
    expect(r.weight).toBeGreaterThan(0);
  });
});

describe('展示解与候选三分类', () => {
  it('规范序列取字典序最小', () => {
    const sides = [['c', 'd'], ['b', 'd'], ['b', 'c', 'd'], ['b', 'c']];
    // 两个同优解：下标 {0,2} 与 {1,2}
    const sols = [(1 << 0) | (1 << 2), (1 << 1) | (1 << 2)];
    const seq = pickDisplaySolution(sols, sides);
    expect(seq.map((i) => sides[i])).toEqual([
      ['b', 'c', 'd'],
      ['b', 'd'],
    ]);
  });

  it('按名称元组逐项比较（避免整串拼接的跨长度歧义）', () => {
    // 元组 ['ba'] 与 ['b','c']：逐项 'ba' > 'b'，所以后者更小。
    const sides = [['ba'], ['b', 'c']];
    expect(pickDisplaySolution([1, 2], sides)).toEqual([1]);
    // 前缀元组较短者更小
    expect(pickDisplaySolution([1, 2], [['b'], ['b', 'c']])).toEqual([0]);
  });

  it('跨全部同优解标记必选/可选/从不选', () => {
    const species = 'a b c d e';
    const splits = ['b c | a d e | 5', 'b d | a c e | 5', 'c d | a b e | 4', 'e | a b c d | 2'].join('\n');
    const r = solve(parseInput(species, splits))!;
    expect(r.statuses).toEqual(['optional', 'optional', 'never', 'required']);
    const sides = parseInput(species, splits)
      .lines.filter((l) => !l.error)
      .map((l) => l.sideNames[0]);
    expect(r.displaySolution.map((i) => sides[i])).toEqual([['b', 'c'], ['e']]);
  });
});
