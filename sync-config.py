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
    "成就表": "HD17s9QeThiH2FtzJ5kcO9CTnge",
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

# ===== 道具图标（飞书单元格内嵌图片）=====
ICONS_DIR_REL = "assets/images/icons"  # 相对 WORKSPACE 的图标目录

def read_sheet_cells(token, sheet_name, range_str):
    """读取工作表，返回原始 cell 对象二维数组（含 value / rich_text 等结构）"""
    rng = f"{sheet_name}!{range_str}"
    d = lark_cli("sheets", "+cells-get",
                 "--spreadsheet-token", token,
                 "--range", rng)
    if not d.get("ok"):
        print(f"  警告: 读取 {sheet_name}!{range_str} 失败: {d.get('error',{}).get('message','')}")
        return []
    return d["data"]["ranges"][0]["cells"]

def cell_text(cell):
    """取单元格文本值"""
    return str(cell.get("value", "")).strip() if cell else ""

def cell_image_token(cell):
    """从单元格的 rich_text 中提取内嵌图片(embed-image)的 image_token，无则 None"""
    if not cell:
        return None
    for rt in cell.get("rich_text") or []:
        if isinstance(rt, dict) and rt.get("type") == "embed-image" and rt.get("image_token"):
            return rt["image_token"]
    return None

def download_sheet_image(file_token, spreadsheet_token, rel_path):
    """下载电子表格内嵌素材图片到 WORKSPACE/rel_path，成功返回 True"""
    abs_path = os.path.join(WORKSPACE, rel_path)
    os.makedirs(os.path.dirname(abs_path), exist_ok=True)
    extra = json.dumps({"bizType": "sheet", "spreadsheetToken": spreadsheet_token})
    params = json.dumps({"extra": extra})
    cmd = ["lark-cli", "api", "GET",
           f"/open-apis/drive/v1/medias/{file_token}/download",
           "--params", params,
           "-o", rel_path]
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=60, cwd=WORKSPACE)
        if r.returncode == 0 and os.path.exists(abs_path) and os.path.getsize(abs_path) > 0:
            return True
        print(f"    ! 图标下载失败 token={file_token}: {(r.stdout or r.stderr)[:200]}")
        return False
    except Exception as e:
        print(f"    ! 图标下载异常 token={file_token}: {e}")
        return False

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

# 3. 道具表（icon 列支持内嵌 PNG 图片，自动下载到 assets/images/icons/{id}.png）
print("  → 道具表")
cells = read_sheet_cells(SHEETS["道具表"], "道具表", "A1:I100")
item_table = []
icon_count = 0
for row in cells[2:]:  # 跳过表头2行
    if not row:
        continue
    def cv(i):
        return cell_text(row[i]) if i < len(row) else ""
    if not cv(0):
        continue
    item_id = to_int(cv(0))
    # icon 列（第 I 列，index 8）：优先取内嵌图片，下载到本地
    icon_image = ""
    icon_cell = row[8] if len(row) > 8 else None
    img_token = cell_image_token(icon_cell)
    if img_token:
        rel_path = f"{ICONS_DIR_REL}/{item_id}.png"
        if download_sheet_image(img_token, SHEETS["道具表"], rel_path):
            icon_image = rel_path
            icon_count += 1
    item_table.append({
        "id": item_id,
        "name": to_str(cv(1)),
        "type": to_int(cv(2)),
        "quality": to_int(cv(3)),
        "stackLimit": to_int(cv(4), 999),
        "interactionType": to_int(cv(5)),
        "interactionParams": to_str(cv(6)),
        "description": to_str(cv(7)),
        "icon": to_str(cv(8)) or "❓",
        "iconImage": icon_image,
    })
print(f"    {len(item_table)} 条（含图标 {icon_count} 个）")

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

# 12. 天道酬勤商店表
print("  → 天道酬勤商店表")
rows = read_sheet(SHEETS["商店表"], "天道酬勤商店表", "A1:H100")
shop_table = []
for row in rows[2:]:
    if not row[0]:
        continue
    shop_table.append({
        "shopId": to_int(row[0]),
        "itemId": to_str(row[1]),
        "itemCount": to_int(row[2], 1),
        "limitType": to_int(row[3]),
        "limitParam": to_str(row[4]),
        "price": to_int(row[5]),
        "note": to_str(row[6]) if len(row) > 6 else "",
    })
print(f"    {len(shop_table)} 条")

# 13. 累签奖励配置表
print("  → 累签奖励配置表")
rows = read_sheet(SHEETS["累签表"], "累签奖励配置", "A1:F50")
signin_table = []
for row in rows[2:]:
    if not row[0]:
        continue
    items = []
    if row[1]:
        for part in str(row[1]).split(";"):
            nums = [to_int(x) for x in part.replace("，", ",").split(",") if str(x).strip()]
            if len(nums) >= 2:
                items.append({"itemId": str(nums[0]), "count": nums[1]})
            elif len(nums) == 1:
                items.append({"itemId": str(nums[0]), "count": 1})
    signin_table.append({
        "rewardId": to_int(row[0]),
        "items": items,
        "note": to_str(row[2]),
        "requiredDays": to_int(row[3]),
    })
signin_table.sort(key=lambda r: r["requiredDays"])
print(f"    {len(signin_table)} 条")

# 14. 成就奖励表（含 页签表 / 成就类型表 / 成就奖励表 三个工作表）
print("  → 成就奖励表")
ach_tabs = []
rows = read_sheet(SHEETS["成就表"], "页签表", "A1:B20")
for row in rows[2:]:
    if not row[0]:
        continue
    ach_tabs.append({"tabId": to_int(row[0]), "tabName": to_str(row[1])})

ach_types = []
rows = read_sheet(SHEETS["成就表"], "成就类型表", "A1:F30")
for row in rows[2:]:
    if not row[0]:
        continue
    ach_types.append({
        "typeId": to_int(row[0]),
        "paramKey": to_str(row[1]),
        "paramNote": to_str(row[2]),
        "displayText": to_str(row[3]),
        "tabId": to_int(row[4]),
    })

ach_table = []
rows = read_sheet(SHEETS["成就表"], "成就奖励表", "A1:F200")
for row in rows[2:]:
    if not row[0]:
        continue
    ach_table.append({
        "achievementId": to_int(row[0]),
        "typeId": to_int(row[1]),
        "typeParam": to_int(row[2]),
        "rewardItemId": to_str(row[3]),
        "rewardCount": to_int(row[4]),
        "note": to_str(row[5]) if len(row) > 5 else "",
    })
ach_table.sort(key=lambda a: (a["typeId"], a["achievementId"]))
print(f"    页签 {len(ach_tabs)} | 类型 {len(ach_types)} | 成就 {len(ach_table)} 条")

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

  // 天道酬勤商店表（共 {len(shop_table)} 条）
  shopTable: {json.dumps(shop_table, ensure_ascii=False, indent=2)},

  // 累签奖励配置表（共 {len(signin_table)} 条）
  signInTable: {json.dumps(signin_table, ensure_ascii=False, indent=2)},

  // 成就页签表（共 {len(ach_tabs)} 条）
  achievementTabTable: {json.dumps(ach_tabs, ensure_ascii=False, indent=2)},

  // 成就类型表（共 {len(ach_types)} 条）
  achievementTypeTable: {json.dumps(ach_types, ensure_ascii=False, indent=2)},

  // 成就奖励表（共 {len(ach_table)} 条）
  achievementTable: {json.dumps(ach_table, ensure_ascii=False, indent=2)},
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

// 成就页签（修身/锻体/致富）
function getAchievementTabs() {{
  return (GAME_CONFIG.achievementTabTable || []).slice().sort((a, b) => a.tabId - b.tabId);
}}

// 成就类型定义
function getAchievementTypes() {{
  return GAME_CONFIG.achievementTypeTable || [];
}}

// 成就奖励配置（按类型、ID排序）
function getAchievements() {{
  return (GAME_CONFIG.achievementTable || []).slice().sort((a, b) =>
    (a.typeId - b.typeId) || (a.achievementId - b.achievementId));
}}
"""

with open(OUTPUT, "w", encoding="utf-8") as f:
    f.write(js)

print(f"✅ 已生成 {OUTPUT}")
print(f"   经验: {len(exp_table)} | 仙阶: {len(realm_table)} | 道具: {len(item_table)} | 品质: {len(quality_table)}")
print(f"   交互: {len(interaction_table)} | 技能: {len(skill_table)} | BUFF: {len(buff_table)}")
print(f"   仙树: {len(tree_table)} | 奖池权重: {len(pool_weight_table)} | 奖励包: {len(pack_table)} | 锻造: {len(forge_table)}")
