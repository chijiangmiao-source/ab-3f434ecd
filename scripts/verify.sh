#!/bin/sh
# verify 一次性验收服务入口：
#   单元测试 -> 生产构建检查 -> 样例重放 -> HTTP 冒烟，然后自行退出并返回汇总退出码。
set -u

WEB_URL="${WEB_URL:-http://web:80}"
fail=0

run() {
  name="$1"
  shift
  echo "==> $name"
  "$@"
  code=$?
  echo "    [$name] exit=$code"
  [ "$code" -eq 0 ] || fail=1
}

run "单元测试" npm test
run "生产构建检查（tsc 类型检查 + vite build）" npm run build
run "样例重放（互补规范化 / 最大兼容集 / 候选三分类）" node --import tsx scripts/replay.ts

echo "==> HTTP 冒烟：等待 $WEB_URL/healthz"
ok=0
i=0
while [ "$i" -lt 60 ]; do
  body="$(wget -q -O - "$WEB_URL/healthz" 2>/dev/null)"
  if [ "$body" = "ok" ]; then ok=1; break; fi
  i=$((i + 1))
  sleep 1
done

if [ "$ok" -eq 1 ]; then
  echo "    [healthz] 200 ok"
else
  echo "    [healthz] FAIL：等待超时"
  fail=1
fi

html="$(wget -q -O - "$WEB_URL/" 2>/dev/null)"
if [ -n "$html" ]; then
  case "$html" in
    *'<div id="root"></div>'*) echo "    [index] 根节点存在" ;;
    *) echo "    [index] FAIL：缺少 #root 根节点"; fail=1 ;;
  esac
  asset="$(printf '%s' "$html" | sed -n 's/.*src="\(\/assets\/[^"]*\.js\)".*/\1/p' | head -n1)"
  if [ -n "$asset" ] && wget -q -O /dev/null "$WEB_URL$asset"; then
    echo "    [asset] $asset 200"
  else
    echo "    [asset] FAIL：前端产物不可达（$asset）"
    fail=1
  fi
else
  echo "    [index] FAIL：无法获取首页"
  fail=1
fi

if [ "$fail" -ne 0 ]; then
  echo "verify: 验收未通过，退出码 1"
  exit 1
fi
echo "verify: 全部验收通过，退出码 0"
exit 0
