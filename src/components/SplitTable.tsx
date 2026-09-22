import type { CandidateLine, CandidateStatus } from '../lib/types';

interface Props {
  lines: CandidateLine[];
  statuses: CandidateStatus[];
  inDisplay: Set<number>;
}

const LABEL: Record<CandidateStatus, string> = {
  required: '必选',
  optional: '可选',
  never: '从不选',
};

export function SplitTable({ lines, statuses, inDisplay }: Props) {
  return (
    <div className="table-scroll">
      <table className="splits">
        <thead>
          <tr>
            <th>#</th>
            <th>权重</th>
            <th>规范分裂（锚点物种在右侧）</th>
            <th>分类</th>
            <th>展示解</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l, i) => (
            <tr key={i} className={inDisplay.has(i) ? 'row-in-display' : ''}>
              <td>{i + 1}</td>
              <td className="num">{l.weight}</td>
              <td className="split-text">
                <span className="side">{l.sideNames[0].join(', ')}</span>
                <span className="bar"> | </span>
                <span className="side">{l.sideNames[1].join(', ')}</span>
              </td>
              <td>
                <span className={`tag ${statuses[i]}`}>{LABEL[statuses[i]]}</span>
              </td>
              <td>{inDisplay.has(i) ? '✓' : ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
