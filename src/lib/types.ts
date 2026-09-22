// 核心领域类型：物种、候选分裂、审计输入、求解结果

export interface CandidateLine {
  lineNo: number;
  raw: string;
  /** 规范化后的二进制位集：bit i 对应 species[i]，bit 0 恒为 0（不含首个物种的一侧） */
  mask: number;
  /** 正整数权重；非法行为 0 */
  weight: number;
  /** 规范化键：规范侧物种名按全局顺序拼接 */
  key: string;
  /** 规范化两侧的物种名（第 0 侧为不含 species[0] 的规范侧） */
  sideNames: [string[], string[]];
  error?: string;
}

export interface AuditInput {
  species: string[];
  lines: CandidateLine[];
  /** 不依赖具体行的全局错误（物种数量等） */
  globalErrors: string[];
  valid: boolean;
}

export type CandidateStatus = 'required' | 'optional' | 'never';

export interface SolveResult {
  /** 两两兼容布尔矩阵（含对角线 true） */
  compatibility: boolean[][];
  /** 所有“总权重最高、再数量最多”两级同优解（每个为位集） */
  optimalSolutions: number[];
  optimalWeight: number;
  optimalSize: number;
  /** 用于展示的字典序最小规范分裂序列（候选行下标，按 key 升序） */
  displaySolution: number[];
  statuses: CandidateStatus[];
}
