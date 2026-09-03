#!/bin/bash
# ============================================================
# 飞书表格 → game-config.js 同步发布脚本
# 用法: bash scripts/sync-config.sh
# 流程: 读取飞书表格 → 生成 game-config.js → (可选) git push 自动部署
# ============================================================
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PY_SCRIPT="/data/user/work/sync-config.py"

echo "🔄 开始同步飞书表格配置..."
python3 "$PY_SCRIPT"

echo ""
echo "📋 当前配置概览:"
echo "   等级经验: $(python3 -c "import json; d=json.loads(open('/workspace/game-config.js').read().split('expTable:')[1].split('realmTable')[0].rstrip().rstrip(',')); print(len(d), '级')" 2>/dev/null || echo '?')"
echo "   仙阶:     $(python3 -c "import json; d=json.loads(open('/workspace/game-config.js').read().split('realmTable:')[1].rstrip().rstrip('}').rstrip().rstrip(';')); print(len(d), '阶')" 2>/dev/null || echo '?')"
echo ""
echo "✅ 同步完成！game-config.js 已更新。"
