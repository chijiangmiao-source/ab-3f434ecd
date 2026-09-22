// 验收重放：以固定样例核对三项关键能力——
//  1) 互补规范化与重复/非法行处理（原文保留）；
//  2) 最大两两兼容集（先权重、再数量、规范序列字典序展示解）；
//  3) 候选三分类（必选 / 可选 / 从不选）。
// 由 verify 服务在容器内执行：node --import tsx scripts/replay.ts

import { parseInput, solve, solutionIndices } from '../src/lib/phylo.ts';

let failures = 0;

function check(name: string, cond: boolean, detail = ''): void {
  if (cond) {
    console.log(`PASS  ${name}`);
  } else {
    failures++;
    console.error(`FAIL  ${name}${detail ? `\n      ${detail}` : ''}`);
  }
}

function maskSet(sols: number[]): string {
  return [...sols]
    .map((s) => solutionIndices(s).join(','))
    .sort()
    .map((s) => `{${s}}`)
    .join(' ');
}

// ---------- 样例 1：互补规范化与非法输入 ----------
{
  const species = 'a b c d';
  const splits = ['a b | c d | 5', 'c d | a b | 4', 'a b c d |', 'a | b c | 9', 'ab | c d | 3'].join('\n');
  const input = parseInput(species, splits);
  const valid = input.lines.filter((l) => !l.error);
  check('规范-1：仅一条有效候选（互补重复被合并拒绝）', valid.length === 1, `valid=${valid.length}`);
  check('规范-2：互补分裂判定为重复', input.lines[1].error?.includes('重复') ?? false);
  check('规范-3：平凡分裂（一侧为空）被拒绝', input.lines[2].error?.includes('两侧都必须') ?? false);
  check('规范-4：未覆盖全部物种被拒绝', input.lines[3].error?.includes('覆盖') ?? false);
  check('规范-5：未知物种名被拒绝', input.lines[4].error?.includes('不在物种名录') ?? false);
  check('规范-6：非法行保留原文', input.lines[1].raw === 'c d | a b | 4');
  const result = solve(input)!;
  check('规范-7：唯一候选即最优且必选', result.optimalWeight === 5 && result.statuses[0] === 'required');
}

// ---------- 样例 2：权重持平，数量决胜 ----------
// W={b,c} w3 与 X={b,d} w2、Z={b,d,e} w1 都冲突；X 与 Z 互相兼容（Z 一侧嵌套）。
// {X,Z} 总权 3、数量 2  对  {W} 总权 3、数量 1 —— 数量决胜；Y={b,e} w1 无法入最优。
{
  const species = 'a b c d e';
  const splits = ['b d | a c e | 2', 'a c | b d e | 1', 'b c | a d e | 3', 'b e | a c d | 1'].join('\n');
  const input = parseInput(species, splits);
  const result = solve(input)!;
  check('权重-1：最优总权重为 3', result.optimalWeight === 3, `w=${result.optimalWeight}`);
  check('权重-2：数量决胜，最优分裂数为 2', result.optimalSize === 2, `n=${result.optimalSize}`);
  check('权重-3：同优解唯一', result.optimalSolutions.length === 1, maskSet(result.optimalSolutions));
  const seq = result.displaySolution.map((i) => input.lines.filter((l) => !l.error)[i].key).join(' / ');
  check('权重-4：展示解为 {b,d}+{b,d,e}', seq === 'b|d / b|d|e', seq);
  check(
    '权重-5：X/Z 必选，W 与 Y 从不选',
    result.statuses[0] === 'required' &&
      result.statuses[1] === 'required' &&
      result.statuses[2] === 'never' &&
      result.statuses[3] === 'never',
    result.statuses.join(','),
  );
}

// ---------- 样例 3：多个同优解 -> 可选/必选/从不选 ----------
// A={b,c} w5、B={b,d} w5 互相冲突；C={c,d} w4 与两者冲突；E={e} w2 与万物兼容。
// 同优解：{A,E} 与 {B,E}（总权 7、数量 2）。
{
  const species = 'a b c d e';
  const splits = ['b c | a d e | 5', 'b d | a c e | 5', 'c d | a b e | 4', 'e | a b c d | 2'].join('\n');
  const input = parseInput(species, splits);
  const result = solve(input)!;
  check('分类-1：最优总权重 7、数量 2', result.optimalWeight === 7 && result.optimalSize === 2);
  check('分类-2：前两级同优解恰好 2 个', result.optimalSolutions.length === 2, maskSet(result.optimalSolutions));
  check(
    '分类-3：A/B 可选、C 从不选、E 必选',
    result.statuses[0] === 'optional' &&
      result.statuses[1] === 'optional' &&
      result.statuses[2] === 'never' &&
      result.statuses[3] === 'required',
    result.statuses.join(','),
  );
  const seq = result.displaySolution.map((i) => input.lines.filter((l) => !l.error)[i].key).join(' / ');
  check('分类-4：字典序最小展示解选 A（b|c < b|d）', seq === 'b|c / e', seq);
}

// ---------- 样例 4：页面默认样例（4 物种）可解 ----------
{
  const species = 'a b c d';
  const splits = ['a b | c d | 5', 'a c | b d | 5', 'a | b c d | 2', 'b c | a d | 1'].join('\n');
  const input = parseInput(species, splits);
  const result = solve(input)!;
  check('默认-1：最优总权重 7、数量 2', result.optimalWeight === 7 && result.optimalSize === 2);
  check('默认-2：两个同优解', result.optimalSolutions.length === 2, maskSet(result.optimalSolutions));
  check(
    '默认-3：平凡锚点分裂必选；两个 5 权分裂可选；1 权分裂从不选',
    result.statuses[2] === 'required' &&
      result.statuses[0] === 'optional' &&
      result.statuses[1] === 'optional' &&
      result.statuses[3] === 'never',
    result.statuses.join(','),
  );
}

if (failures > 0) {
  console.error(`\nreplay: ${failures} 项断言失败`);
  process.exit(1);
}
console.log('\nreplay: 全部样例断言通过');
