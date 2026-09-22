import type { CandidateLine } from '../lib/types';

interface Props {
  lines: CandidateLine[];
  compatibility: boolean[][];
  inDisplay: Set<number>;
}

/** 兼容矩阵：行为左侧表头，列为顶部表头；对角线恒为兼容。 */
export function CompatMatrix({ lines, compatibility, inDisplay }: Props) {
  return (
    <div className="matrix-scroll">
      <table className="matrix">
        <thead>
          <tr>
            <th className="corner">#</th>
            {lines.map((l, j) => (
              <th key={j} className={inDisplay.has(j) ? 'col-display' : ''} title={l.key}>
                {j + 1}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {lines.map((_, i) => (
            <tr key={i}>
              <th className={inDisplay.has(i) ? 'row-display' : ''}>#{i + 1}</th>
              {lines.map((_, j) => {
                const ok = compatibility[i][j];
                return (
                  <td
                    key={j}
                    className={ok ? 'compat-yes' : 'compat-no'}
                    title={`#${i + 1} × #${j + 1}：${ok ? '兼容' : '冲突'}`}
                  >
                    {ok ? '✓' : '×'}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
