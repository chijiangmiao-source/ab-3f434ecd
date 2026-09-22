import { useMemo, useState } from 'react';
import { parseInput, solve } from './lib/phylo';
import type { CandidateLine } from './lib/types';
import { CompatMatrix } from './components/CompatMatrix';
import { SplitTable } from './components/SplitTable';

const SAMPLE_SPECIES = ['a', 'b', 'c', 'd'].join(' ');

const SAMPLE_SPLITS = [
  '# 语法：左侧物种 | 右侧物种 [| 正整数权重]，权重缺省为 1',
  'a b | c d | 5',
  'a c | b d | 5',
  'a | b c d | 2',
  'b c | a d | 1',
].join('\n');

export default function App() {
  const [speciesText, setSpeciesText] = useState(SAMPLE_SPECIES);
  const [splitsText, setSplitsText] = useState(SAMPLE_SPLITS);

  const input = useMemo(() => parseInput(speciesText, splitsText), [speciesText, splitsText]);
  const result = useMemo(() => solve(input), [input]);

  const validLines: CandidateLine[] = input.lines.filter((l) => !l.error);
  const errorLines = input.lines.filter((l) => l.error);
  const inDisplay = new Set(result?.displaySolution ?? []);

  return (
    <div className="page">
      <header>
        <h1>系统发育候选分裂审计</h1>
        <p className="subtitle">
          纯浏览器运算 · 精确选择两两兼容分裂集（先最大化总权重，再最大化数量） · 规范序列字典序最小解用于展示
        </p>
      </header>

      <section className="grid-input">
        <div>
          <h2>① 物种名录（4–12 个，唯一 ASCII 名称）</h2>
          <textarea
            value={speciesText}
            onChange={(e) => setSpeciesText(e.target.value)}
            rows={4}
            spellCheck={false}
            aria-label="物种名录"
          />
          <div className="hint">以空白 / 逗号 / 分号分隔；首个物种用作互补规范化锚点。</div>
        </div>
        <div>
          <h2>② 候选分裂（1–28 个，正整数权重）</h2>
          <textarea
            value={splitsText}
            onChange={(e) => setSplitsText(e.target.value)}
            rows={10}
            spellCheck={false}
            aria-label="候选分裂"
          />
          <div className="hint">
            每行：<code>左侧 | 右侧 [| 权重]</code>；平凡分裂、未覆盖全部物种、重复（含互补）均拒绝；# 开头为注释。
          </div>
        </div>
      </section>

      {input.globalErrors.length > 0 && (
        <section className="errors">
          <h2>输入问题</h2>
          <ul>
            {input.globalErrors.map((e, i) => (
              <li key={`g${i}`}>{e}</li>
            ))}
            {errorLines.map((l) => (
              <li key={`l${l.lineNo}`}>
                第 {l.lineNo} 行：{l.error}
                <pre className="raw">{l.raw}</pre>
              </li>
            ))}
          </ul>
        </section>
      )}

      {result ? (
        <>
          <section className="summary">
            <div className="stat">
              <span className="stat-label">最优总权重</span>
              <span className="stat-value">{result.optimalWeight}</span>
            </div>
            <div className="stat">
              <span className="stat-label">最优分裂数</span>
              <span className="stat-value">{result.optimalSize}</span>
            </div>
            <div className="stat">
              <span className="stat-label">前两级同优解数量</span>
              <span className="stat-value">{result.optimalSolutions.length}</span>
            </div>
            <div className="stat">
              <span className="stat-label">有效候选 / 全部行</span>
              <span className="stat-value">
                {validLines.length} / {input.lines.length}
              </span>
            </div>
          </section>

          <section>
            <h2>③ 兼容矩阵（绿色 = 两两兼容）</h2>
            <CompatMatrix lines={validLines} compatibility={result.compatibility} inDisplay={inDisplay} />
          </section>

          <section>
            <h2>④ 分裂表与候选三分类</h2>
            <SplitTable lines={validLines} statuses={result.statuses} inDisplay={inDisplay} />
            <p className="hint">
              分类口径（基于全部前两级同优解）：<b className="tag required">必选</b> 出现在每个同优解；
              <b className="tag optional">可选</b> 出现在部分同优解；<b className="tag never">从不选</b> 不属于任何同优解。
              <br />
              展示解（规范分裂序列字典序最小）：
              {result.displaySolution.length === 0 ? '（空集）' : result.displaySolution.map((i) => `#${i + 1}`).join(' → ')}
            </p>
          </section>
        </>
      ) : (
        input.globalErrors.length === 0 && <p>等待输入……</p>
      )}

      <footer>所有计算在本浏览器内完成，页面不调用任何在线服务。</footer>
    </div>
  );
}
