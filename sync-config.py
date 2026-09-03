#!/usr/bin/env python3
"""
飞书表格 → game-config.js 同步脚本
读取所有游戏配置表，生成 game-config.js
"""
import subprocess, json, sys, os
from datetime import datetime

WORKSPACE = "/workspace"
OUTPUT = os.path.join(WORKSPACE, "game-config.js")

# 电子表格 token
SHEETS = {
    "角色表": "SY4Rs9CFjhLEL5tiR1kcL4Utnmh",
    "道具表": "P9NBsucKrhu8oyt7TeucPypBnme",
    "技能表": "JEUNsxTIlhGZAztIJDccykoXnyb",
    "仙树表": "SnkfsCnHFhMjQbt0UzsctKdOnSg",
    "奖池表": "DqbisAD8ch8Abvt69gicA8TMn5b",
    "锻造表": "NaCas6rwihqLZgtgmUhcjzGLnFd",
    "商店表": "VwFKsb8UhhWBBvtaSmEcb597nvD",
    "累签表": "TfrNskLjxhOC5HtN5jbcLMPMncc",
}

def lark_cli(*args):
    """执行 lark-cli 命令并返回 JSON"""
    cmd = ["lark-cli"] + list(args)
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
    output = result.stdout
    # 跳过 deprecation 警告行
    lines = [l for l in output.split('\n') if not l.startswith('Flag')]
    return json.loads('\n'.join(lines))

def read_sheet(token, sheet_name, range_str):
    """读取工作表数据，返回二维数组（每行是值列表）"""
    rng = f"{sheet_name}!{range_str}"
    d = lark_cli("sheets", "+cells-get",
                 "--spreadsheet-token", token,
                 "--range", rng)
    if not d.get("ok"):
        print(f"  警告: 读取 {sheet_name}!{range_str} 失败: {d.get('error',{}).get('message','')}")
        return []
    cells = d["data"]["ranges"][0]["cells"]
    rows = []
    for row in cells:
        vals = [c.get("value", "") for c in row]
        rows.append(vals)
    return rows

def to_int(v, default=0):
    try:
        return int(float(str(v).strip()))
    except:
        return default

def to_str(v):
    return str(v).strip() if v else ""

def parse_items(s):
    """解析逗号分隔的ID列表"""
    if not s:
        return []
    return [to_int(x) for x in str(s).split(",") if x.strip()]

def parse_req_items(s):
    """解析 "itemId,count;itemId,count" 或 "itemId,count" 格式"""
    if not s:
        return []
    result = []
    for part in str(s).split(";"):
        part = part.strip()
        if not part:
            continue
        nums = [to_int(x) for x in part.split(",") if x.strip()]
        if len(nums) >= 2:
            result.append({"itemId": str(nums[0]), "count": nums[1]})
        elif len(nums) == 1:
            result.append({"itemId": str(nums[0]), "count": 1})
    return result

# ===== 读取各表数据 =====
print("📖 读取飞书表格...")

# 1. 角色等级经验表
print("  → 角色等级经验表")
rows = read_sheet(SHEETS["角色表"], "角色等级经验表", "A1:B200")
exp_table = []
for row in rows[2:]:  # 跳过表头2行
    if not row[0] or not row[1]:
        continue
    exp_table.append({"level": to_int(row[0]), "exp": to_int(row[1])})
print(f"    {len(exp_table)} 条")

# 2. 角色仙阶表
print("  → 角色仙阶表")
rows = read_sheet(SHEETS["角色表"], "角色仙阶表", "A1:H50")
realm_table = []
for row in rows[2:]:
    if not row[0] or not row[1]:
        continue
    req_items = []
    if len(row) > 5 and row[5]:
        ids = [to_int(x) for x in str(row[5]).split(",") if x.strip()]
        counts = [to_int(x) for x in str(row[6]).split(",") if x.strip()] if len(row) > 6 and row[6] else []
        for i, item_id in enumerate(ids):
            count = counts[i] if i < len(counts) else 1
            req_items.append({"itemId": str(item_id), "count": count})
    realm_table.append({
        "reqLevel": to_int(row[0]),
        "realmId": to_int(row[1]),
        "name": to_str(row[2]),
        "maxAxeQuality": to_int(row[3], 1),
        "characterImage": to_str(row[4]) if len(row) > 4 else "",
        "reqItems": req_items,
        "icon": to_str(row[7]) if len(row) > 7 else "⭐",
    })
print(f"    {len(realm_table)} 条")

# 3. 道具表
print("  → 道具表")
rows = read_sheet(SHEETS["道具表"], "道具表", "A1:I100")
item_table = []
for row in rows[2:]:
    if not row[0]:
        continue
    item_table.append({
        "id": to_int(row[0]),
        "name": to_str(row[1]),
        "type": to_int(row[2]),
        "quality": to_int(row[3]),
        "stackLimit": to_int(row[4], 999),
        "interactionType": to_int(row[5]),
        "interactionParams": to_str(row[6]),
        "description": to_str(row[7]),
        "icon": to_str(row[8]) or "❓",
    })
print(f"    {len(item_table)} 条")

# 4. 品质表
print("  → 品质表")
rows = read_sheet(SHEETS["道具表"], "品质表", "A1:B20")
quality_table = []
for row in rows[2:]:
    if not row[0]:
        continue
    quality_table.append({
        "id": to_int(row[0]),
        "name": to_str(row[1]),
    })
print(f"    {len(quality_table)} 条")

# 5. 交互类型参数表
print("  → 交互类型参数表")
rows = read_sheet(SHEETS["道具表"], "交互类型参数表", "A1:D20")
interaction_table = []
for row in rows[2:]:
    if not row[0]:
        continue
    interaction_table.append({
        "id": to_int(row[0]),
        "description": to_str(row[1]),
        "params": to_str(row[2]),
        "paramsDesc": to_str(row[3]),
    })
print(f"    {len(interaction_table)} 条")

# 6. 技能表
print("  → 技能表")
rows = read_sheet(SHEETS["技能表"], "技能表", "A1:C100")
skill_table = []
for row in rows[2:]:
    if not row[0]:
        continue
    skill_table.append({
        "skillId": to_int(row[0]),
        "buffId": to_int(row[1]),
        "buffParams": to_str(row[2]),
    })
print(f"    {len(skill_table)} 条")

# 7. BUFF表
print("  → BUFF表")
rows = read_sheet(SHEETS["技能表"], "BUFF表", "A1:D20")
buff_table = []
for row in rows[2:]:
    if not row[0]:
        continue
    buff_table.append({
        "buffId": to_int(row[0]),
        "description": to_str(row[1]),
        "paramsTypeDesc": to_str(row[2]),
        "effectDesc": to_str(row[3]),
    })
print(f"    {len(buff_table)} 条")

# 8. 仙树灵阶表
print("  → 仙树灵阶表")
rows = read_sheet(SHEETS["仙树表"], "仙树灵阶表", "A1:F30")
tree_table = []
for row in rows[2:]:
    if not row[0]:
        continue
    tree_table.append({
        "id": to_int(row[0]),
        "name": to_str(row[1]),
        "appearance": to_str(row[2]) if len(row) > 2 else "",
        "poolId": to_int(row[3]),
        "reqItems": parse_req_items(row[4] if len(row) > 4 else ""),
        "note": to_str(row[5]) if len(row) > 5 else "",
    })
print(f"    {len(tree_table)} 条")

# 9. 奖池表（奖池→奖励包权重）
print("  → 奖池表")
rows = read_sheet(SHEETS["奖池表"], "奖池表", "A1:C100")
pool_weight_table = []
for row in rows[2:]:  # 第1行空，第2行表头
    if not row[0] or not row[1]:
        continue
    pool_weight_table.append({
        "poolId": to_int(row[0]),
        "packId": to_int(row[1]),
        "weight": to_int(row[2]),
    })
print(f"    {len(pool_weight_table)} 条")

# 10. 奖励包表（奖励包→道具列表）
print("  → 奖励包表")
rows = read_sheet(SHEETS["奖池表"], "奖励包ID", "A1:D30")
pack_table = []
for row in rows[2:]:
    if not row[0]:
        continue
    pack_table.append({
        "packId": to_int(row[0]),
        "items": parse_items(row[1]),
        "qualityId": to_int(row[2]),
        "qualityNote": to_str(row[3]) if len(row) > 3 else "",
    })
print(f"    {len(pack_table)} 条")

# 11. 锻造表
print("  → 锻造表")
rows = read_sheet(SHEETS["锻造表"], "锻造表", "A1:C10")
forge_table = []
for row in rows[2:]:
    if not row[0]:
        continue
    cost_parts = [to_int(x) for x in str(row[1]).split(",") if x.strip()] if row[1] else []
    forge_table.append({
        "forgePoolId": to_int(row[0]),
        "costItemId": cost_parts[0] if cost_parts else 0,
        "costCount": cost_parts[1] if len(cost_parts) > 1 else 1,
        "note": to_str(row[2]) if len(row) > 2 else "",
    })
print(f"    {len(forge_table)} 条")

# 12. 商店表（天道酬勤商店，售价单位：游戏币）
print("  → 商店表（天道酬勤商店）")
rows = read_sheet(SHEETS["商店表"], "天道酬勤商店表", "A1:G100")
shop_table = []
for row in rows[2:]:  # 跳过表头2行
    if not row[0] or not str(row[0]).strip():
        continue
    shop_table.append({
        "shopId": to_int(row[0]),
        "itemId": str(to_int(row[1])) if str(row[1]).strip() else "",
        "itemCount": to_int(row[2], 1),
        "limitType": to_int(row[3], 1),
        "limitParam": to_str(row[4]) if len(row) > 4 else "",
        "price": to_int(row[5]),
        "note": to_str(row[6]) if len(row) > 6 else "",
    })
print(f"    {len(shop_table)} 条")

# 13. 累签奖励表（本月累计签到里程碑）
print("  → 累签奖励表")
rows = read_sheet(SHEETS["累签表"], "累签奖励配置", "A1:D50")
signin_table = []
for row in rows[2:]:  # 跳过表头2行
    if not row[0] or not str(row[0]).strip():
        continue
    signin_table.append({
        "rewardId": to_int(row[0]),
        "items": parse_req_items(row[1] if len(row) > 1 else ""),
        "note": to_str(row[2]) if len(row) > 2 else "",
        "requiredDays": to_int(row[3]) if len(row) > 3 else 0,
    })
signin_table.sort(key=lambda x: x["requiredDays"])
print(f"    {len(signin_table)} 条")

# ===== 生成 game-config.js =====
print("\n📝 生成 game-config.js...")

now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

js = f"""// ===== 游戏配置文件（由 sync-config.py 从飞书表格自动生成）=====
// 修改飞书表格后运行同步脚本即可更新，请勿手动编辑此文件
// 最后同步: {now}

const GAME_CONFIG = {{
  // 角色等级经验表（共 {len(exp_table)} 条）
  expTable: {json.dumps(exp_table, ensure_ascii=False, indent=2)},

  // 角色仙阶表（共 {len(realm_table)} 条）
  realmTable: {json.dumps(realm_table, ensure_ascii=False, indent=2)},

  // 道具表（共 {len(item_table)} 条）
  itemTable: {json.dumps(item_table, ensure_ascii=False, indent=2)},

  // 品质表（共 {len(quality_table)} 条）
  qualityTable: {json.dumps(quality_table, ensure_ascii=False, indent=2)},

  // 交互类型表（共 {len(interaction_table)} 条）
  interactionTypeTable: {json.dumps(interaction_table, ensure_ascii=False, indent=2)},

  // 技能表（共 {len(skill_table)} 条）
  skillTable: {json.dumps(skill_table, ensure_ascii=False, indent=2)},

  // BUFF表（共 {len(buff_table)} 条）
  buffTable: {json.dumps(buff_table, ensure_ascii=False, indent=2)},

  // 仙树灵阶表（共 {len(tree_table)} 条，含灵阶0初始状态）
  treeTable: {json.dumps(tree_table, ensure_ascii=False, indent=2)},

  // 奖池权重表（奖池→奖励包权重，每个奖池总权重1000）（共 {len(pool_weight_table)} 条）
  poolWeightTable: {json.dumps(pool_weight_table, ensure_ascii=False, indent=2)},

  // 奖励包表（奖励包→道具列表，同包内道具概率均分）（共 {len(pack_table)} 条）
  packTable: {json.dumps(pack_table, ensure_ascii=False, indent=2)},

  // 锻造表（共 {len(forge_table)} 条）
  forgeTable: {json.dumps(forge_table, ensure_ascii=False, indent=2)},

  // 商店表（天道酬勤商店，售价单位：游戏币；limitType 1=不限 2=月限购 3=仙阶限购）（共 {len(shop_table)} 条）
  shopTable: {json.dumps(shop_table, ensure_ascii=False, indent=2)},

  // 累签奖励表（本月累计签到里程碑，按 requiredDays 升序）（共 {len(signin_table)} 条）
  signInTable: {json.dumps(signin_table, ensure_ascii=False, indent=2)},
}};

// ===== 辅助函数 =====

// 品质颜色映射（代码维护，非飞书配置）
const QUALITY_COLORS = {{
  1: '#9e9e9e', // 凡品-灰
  2: '#4a90d9', // 精品-蓝
  3: '#9c6bd4', // 珍品-紫
  4: '#e85a8a', // 神品-粉
  5: '#f0b429', // 仙品-金
}};

// 根据等级获取所需经验
function getExpForLevel(level) {{
  const entry = GAME_CONFIG.expTable.find(e => e.level === level);
  return entry ? entry.exp : 999999;
}}

// 根据技能ID获取技能配置（含buff信息）
function getSkillById(skillId) {{
  const skill = GAME_CONFIG.skillTable.find(s => s.skillId === skillId);
  if (!skill) return null;
  const buff = GAME_CONFIG.buffTable.find(b => b.buffId === skill.buffId);
  return {{ ...skill, buff: buff || null }};
}}

// 根据奖池ID获取奖池配置（含奖励包权重和道具列表）
// 返回: {{ poolId, packs: [{{ packId, qualityId, weight, items }}] }}
function getPoolById(poolId) {{
  const weights = GAME_CONFIG.poolWeightTable.filter(w => w.poolId === poolId);
  const packs = weights.map(w => {{
    const pack = GAME_CONFIG.packTable.find(p => p.packId === w.packId);
    return {{
      packId: w.packId,
      qualityId: pack ? pack.qualityId : 0,
      weight: w.weight,
      items: pack ? pack.items.map(String) : [],
    }};
  }}).filter(p => p.items.length > 0 && p.weight > 0);
  return {{ poolId, packs }};
}}

// 获取本月累签奖励配置（按需要天数升序）
function getSignInRewards() {{
  return (GAME_CONFIG.signInTable || []).slice().sort((a, b) => a.requiredDays - b.requiredDays);
}}

// 获取天道酬勤商店商品配置（合并道具表信息）
function getShopItems() {{
  return (GAME_CONFIG.shopTable || []).map(s => {{
    const def = (GAME_CONFIG.itemTable || []).find(it => String(it.id) === String(s.itemId));
    return {{
      shopId: s.shopId,
      itemId: String(s.itemId),
      itemCount: s.itemCount || 1,
      limitType: s.limitType || 1,
      limitParam: s.limitParam || '',
      price: s.price || 0,
      note: s.note || '',
      name: def ? def.name : ('道具' + s.itemId),
      icon: def ? (def.icon || '❓') : '❓',
      quality: def ? def.quality : 1,
    }};
  }});
}}
"""

with open(OUTPUT, "w", encoding="utf-8") as f:
    f.write(js)

print(f"✅ 已生成 {OUTPUT}")
print(f"   经验: {len(exp_table)} | 仙阶: {len(realm_table)} | 道具: {len(item_table)} | 品质: {len(quality_table)}")
print(f"   交互: {len(interaction_table)} | 技能: {len(skill_table)} | BUFF: {len(buff_table)}")
print(f"   仙树: {len(tree_table)} | 奖池权重: {len(pool_weight_table)} | 奖励包: {len(pack_table)} | 锻造: {len(forge_table)}")
print(f"   商店: {len(shop_table)} | 累签奖励: {len(signin_table)}")
