# 系统发育候选分裂审计（split-audit）

纯浏览器运行的 TypeScript + React 单页应用：录入物种与带权候选分裂，精确求解**两两兼容**的
最大权重分裂集，并把每个候选跨全部同优解分为**必选 / 可选 / 从不选**。无业务后端、不调用任何
在线服务；发布物仅为 nginx 托管的静态文件。

## 录入规则

- **物种**：4–12 个，名称唯一、仅含可打印 ASCII 且无空白（空白 / `,` / `;` 分隔）。
- **候选分裂**：1–28 个有效行，每行语法

  ```
  左侧物种 | 右侧物种 [| 正整数权重]
  ```

  权重缺省为 1，必须为正整数；`#` 开头为注释。
- 每行必须恰好把物种名录分成两个非空集合（拒绝平凡分裂、未覆盖全部物种、同一物种跨两侧、
  未知物种名）。
- **互补分裂视为同一项**：以“不含名录首个物种”的一侧为规范侧；与已有项相同（含左右颠倒）
  即拒绝重复。非法行保留原文并显示错误，不参与求解。

## 求解口径

1. 两个分裂兼容当且仅当四种两侧交集 `A∩A'、A∩B'、B∩A'、B∩B'` 至少一个为空。
2. 精确枚举所有两两兼容子集（候选 ≤ 28，深度优先 + 权重/数量剪枝），依次按
   **总权重最大 → 分裂数量最多** 两级择优，保留全部同优解。
3. 展示解取**规范分裂序列字典序最小**者（按规范侧物种名序列升序逐项比较，较短前缀优先）。
4. 候选三分类（在全部前两级同优解上统计）：
   - 必选：出现在每个同优解；
   - 可选：出现在部分同优解；
   - 从不选：不出现在任何同优解。

页面联动展示兼容矩阵（展示解成员高亮）、分裂表、三分类标签与最优指标；所有计算在浏览器本地完成。

## 本地开发

```bash
npm install
npm test          # 单元测试（含与朴素暴力枚举的随机对拍）
npm run build     # tsc 类型检查 + Vite 生产构建 -> dist/
node --import tsx scripts/replay.ts   # 三组样例重放断言
npm run dev       # 本地开发服务器
```

## Docker 发布

宿主机端口通过 `HOST_PORT` 配置（默认 `8080`）：

```bash
docker compose up -d --build
# 或自定义端口
HOST_PORT=9090 docker compose up -d --build
# 健康检查
curl -s http://localhost:8080/healthz   # -> ok
```

健康状态同时通过容器 HEALTHCHECK 暴露。

## 一次性验收服务 verify

`verify` 服务（独立 profile，不会随 `up` 启动）依次执行：

1. Vitest 单元测试；
2. 生产构建检查（`tsc --noEmit` + `vite build`）；
3. 样例重放（互补规范化、最大兼容集两级择优、候选三分类）；
4. 对 `web` 服务的 HTTP 冒烟（`/healthz`、首页根节点、构建产物可达）。

全部通过后容器自行退出，**退出码 0；任一步失败则退出码 1**：

```bash
docker compose --profile verify run --rm verify
echo $?
```

## 目录结构

```
src/lib/phylo.ts        解析/规范化/兼容性/精确求解/三分类（纯函数，核心）
src/components/         兼容矩阵、分裂表
scripts/replay.ts       验收样例重放断言
scripts/verify.sh       verify 服务入口
Dockerfile              Node 构建 -> nginx 静态镜像（含 /healthz）
docker-compose.yml      web（可配置宿主端口）+ 一次性 verify
```
