/* ================================================================
   寻道大千 · 社交修仙系统
   ================================================================ */

// ===== 配置数据（后续迁到飞书表格） =====

// emoji 兜底表（飞书 icon 列改为图片后无文本值，纯文本场景如 toast/标题 用此兜底）
const ITEM_EMOJI = {
  '0': '🪙', '1': '🪓',
  '10001': '🟫', '10002': '🪙', '10101': '🌫️', '10102': '🍃',
  '10201': '✨', '10202': '💧', '10301': '🪨', '10302': '🟢',
  '20001': '🔴', '20101': '🥈', '20201': '🥇', '20301': '🔮',
  '30001': '🟤', '30101': '👁️', '30201': '⏳',
  '40001': '🔩', '40002': '💧',
  '51001': '🪓', '51002': '🪚', '52001': '📖', '52002': '🦶',
  '53001': '🪓', '53002': '⚓', '54001': '🍗', '54002': '🪘', '55001': '🌩️',
};

// 道具配置 → 从飞书表格配置动态构建（game-config.js → itemTable）
const ITEMS = {};
(GAME_CONFIG?.itemTable || []).forEach(item => {
  const id = String(item.id);
  const entry = {
    id: id,
    name: item.name,
    type: item.type,
    quality: item.quality,
    stackLimit: item.stackLimit || 999,
    icon: (item.icon && item.icon !== '❓') ? item.icon : (ITEM_EMOJI[id] || '❓'),
    iconImage: item.iconImage || '',  // 飞书道具表 icon 列上传的 PNG（配置驱动，优先于内置映射）
    desc: item.description || '',
    interactionType: item.interactionType || 0,
    interactionParams: item.interactionParams || '',
    // 解析交互参数 → 派生字段
    composeTo: null, composeCount: 0,
    value: 0,
    skillIds: [], skillDesc: '',
    sellPrice: 0,
  };
  // 解析交互参数
  const params = item.interactionParams ? item.interactionParams.split(',') : [];
  if (item.interactionType === 1) {
    // 合成: "目标ID,所需数量"
    entry.composeTo = params[0]?.trim() || null;
    entry.composeCount = parseInt(params[1]?.trim()) || 0;
  } else if (item.interactionType === 2) {
    // 兑现: "奖金数值"
    entry.value = parseInt(params[0]?.trim()) || 0;
  } else if (item.interactionType === 3) {
    // 装备出售: "售价,技能ID[,技能ID2...]"
    entry.sellPrice = parseInt(params[0]?.trim()) || 0;
    entry.skillIds = params.slice(1).map(s => parseInt(s.trim())).filter(s => !isNaN(s));
    if (entry.skillIds.length > 0) {
      const descs = entry.skillIds.map(sid => {
        const sk = getSkillById(sid);
        if (!sk || !sk.buff) return `技能${sid}`;
        // 解析buffParams并替换模板变量
        let text = sk.buff.description || '';
        const bp = sk.buffParams ? sk.buffParams.split(',').map(s => s.trim()) : [];
        if (sk.buffId === 1) {
          // "qualityId,probCenter,multiplier" → {vlaue1}=品质名, {value2}=概率%, {value3}=倍率
          const qName = (GAME_CONFIG?.qualityTable || []).find(q => q.id === parseInt(bp[0]))?.name || `品质${bp[0]}`;
          text = text.replace(/\{vlaue1\}/g, qName).replace(/\{value1\}/g, qName);
          text = text.replace(/\{value2\}/g, `${bp[1]}%`);
          text = text.replace(/\{value3\}/g, bp[2] || '');
        } else if (sk.buffId === 2) {
          // "probCenter,refundAmount" → {value1}=概率%, {value2}=返还次数
          text = text.replace(/\{value1\}/g, `${bp[0]}%`);
          text = text.replace(/\{value2\}/g, bp[1] || '');
        }
        return text;
      });
      entry.skillDesc = descs.join('; ');
    }
  }
  ITEMS[id] = entry;
});
// 向后兼容: 旧字符串ID → 新数字ID 别名
const ITEM_ALIASES = {
  'money_sm_frag': '10001', 'money_mid_frag': '10101', 'money_lg_frag': '10202',
  'money_sm': '20001', 'money_mid': '20101', 'money_lg': '20201',
  'stone_break': '30001', 'stone_forge': '40001',
  'axe_stone': '51001', 'axe_iron': '52001', 'axe_bronze': '53001',
  'axe_jade': '54001', 'axe_gold': '55001',
};
Object.entries(ITEM_ALIASES).forEach(([oldId, newId]) => {
  if (ITEMS[newId] && !ITEMS[oldId]) ITEMS[oldId] = ITEMS[newId];
});

// 品质配置 → 从飞书表格配置构建（game-config.js → qualityTable + QUALITY_COLORS 颜色）
const QUALITY = {};
(GAME_CONFIG?.qualityTable || []).forEach(q => {
  QUALITY[q.id] = { name: q.name, color: QUALITY_COLORS[q.id] || '#9e9e9e' };
});
// fallback 硬编码品质（飞书表为空时）
if (Object.keys(QUALITY).length === 0) {
  QUALITY[1] = { name: '凡品', color: '#9e9e9e' };
  QUALITY[2] = { name: '精品', color: '#4a90d9' };
  QUALITY[3] = { name: '珍品', color: '#9c6bd4' };
  QUALITY[4] = { name: '神品', color: '#e85a8a' };
  QUALITY[5] = { name: '仙品', color: '#f0b429' };
}

// 本地日期字符串（按玩家时区 YYYY-MM-DD，避免 UTC 跨天误差）
function localDateStr(d) {
  const dt = d || new Date();
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// 仙树图标（按灵阶索引）
const TREE_ICONS = ['🌱','🌱','🌿','🎋','🌳','🌲','🪴','🎍','🌴','🎄','🌵','🍀','🍁','🍂','🌾','🌟'];

// 仙树各灵阶配置 → 从飞书表格动态构建（treeTable + poolWeightTable + packTable）
// 每个灵阶对应一个奖池(poolId)，奖池内按奖励包权重分配，同包内道具均分概率
const TREE_LEVELS = {};
(GAME_CONFIG?.treeTable || []).forEach((tree, idx) => {
  const poolData = getPoolById(tree.poolId);
  const pools = poolData.packs.map(p => ({
    quality: p.qualityId,
    weight: p.weight,
    items: p.items,
  }));
  // 构建5品质权重数组（用于UI展示概率）
  const qualityWeights = [0, 0, 0, 0, 0];
  pools.forEach(p => {
    if (p.quality >= 1 && p.quality <= 5) qualityWeights[p.quality - 1] = p.weight;
  });
  TREE_LEVELS[tree.id] = {
    name: tree.name,
    icon: TREE_ICONS[idx] || '🌳',
    pools,
    qualityWeights,
  };
});

// 角色等级经验表 → 使用飞书表格配置（game-config.js）
// getExpForLevel 已在 game-config.js 中定义

// 商店（天道酬勤商店）→ 从飞书「商店表」配置动态构建
// 通过 getShopItems()（game-config.js）读取，售价单位为游戏币(道具type0)
// limitType: 1=不限 2=月限购(limitParam=每月次数) 3=仙阶限购(limitParam=所需仙阶ID)
const SHOP_LIMIT_TYPE = { UNLIMITED: 1, MONTHLY: 2, REALM: 3 };

// 像素艺术道具图标映射（从精灵图切割生成，透明背景PNG）
const ITEM_IMAGES = {
  '0':     'assets/images/icons/0.png',      // 游戏币
  '1':     'assets/images/icons/1.png',       // 砍树次数
  '10001': 'assets/images/icons/10001.png',   // 碎铜
  '10002': 'assets/images/icons/10002.png',   // 铜币
  '10101': 'assets/images/icons/10101.png',   // 银粉
  '10102': 'assets/images/icons/10102.png',   // 银叶
  '10201': 'assets/images/icons/10201.png',   // 金粉
  '10202': 'assets/images/icons/10202.png',   // 金液
  '10301': 'assets/images/icons/10301.png',   // 原石
  '10302': 'assets/images/icons/10302.png',   // 原玉
  '20001': 'assets/images/icons/20001.png',   // 铜珠
  '20101': 'assets/images/icons/20101.png',   // 银锭
  '20201': 'assets/images/icons/20201.png',   // 金元宝
  '20301': 'assets/images/icons/20301.png',   // 灵玉
  '30001': 'assets/images/icons/30001.png',   // 期石
  '30101': 'assets/images/icons/30101.png',   // 望石
  '30201': 'assets/images/icons/30201.png',   // 待石
  '40001': 'assets/images/icons/40001.png',   // 锻造石
  '40002': 'assets/images/icons/40002.png',   // 菩提涎
  '51001': 'assets/images/icons/51001.png',   // 拼夕夕9块9包邮斧
  '51002': 'assets/images/icons/51002.png',   // 光头强淘汰斧
  '52001': 'assets/images/icons/52001.png',   // 物理劝学斧
  '52002': 'assets/images/icons/52002.png',   // 给大树修脚斧
  '53001': 'assets/images/icons/53001.png',   // 河神拒收的金斧
  '53002': 'assets/images/icons/53002.png',   // 二向箔贴纸斧
  '54001': 'assets/images/icons/54001.png',   // 疯狂星期四V我50斧
  '54002': 'assets/images/icons/54002.png',   // 电子木鱼连点斧
  '55001': 'assets/images/icons/55001.png',   // 盘古开天劈歪斧
};

// 纯文本场景取 emoji（toast、标题、option 文本等，不能放 <img>）
function itemEmoji(itemId) {
  const id = String(itemId);
  const def = (typeof ITEMS !== 'undefined') ? ITEMS[id] : null;
  if (def && def.icon && def.icon !== '❓') return def.icon;
  return ITEM_EMOJI[id] || '❓';
}

// 统一道具图标渲染：优先飞书配置的PNG(iconImage) → 本地内置映射(ITEM_IMAGES) → emoji
// 斧头(type5)自动追加竖长 class item-icon-axe
function renderItemIcon(itemId, fallbackEmoji, cls = 'item-icon-img') {
  const id = String(itemId);
  const def = (typeof ITEMS !== 'undefined') ? ITEMS[id] : null;
  const img = (def && def.iconImage) || ITEM_IMAGES[id];
  const fb = (fallbackEmoji && fallbackEmoji !== '❓') ? fallbackEmoji : (ITEM_EMOJI[id] || '❓');
  if (img) {
    const isAxe = def && def.type === 5;
    const axeCls = isAxe ? ' item-icon-axe' : '';
    return `<img src="${img}" class="${cls}${axeCls}" alt="${fb}" />`;
  }
  return fb;
}

const V2_IMAGE_ROOT = 'assets/images/v2';

function renderFeatureIcon(name, alt = '', cls = 'feature-icon') {
  return `<img src="${V2_IMAGE_ROOT}/icons/${name}.png" class="${cls}" alt="${alt}" />`;
}

function getTreeImage(treeLevel) {
  if (treeLevel >= 13) return 'assets/images/v2/trees/divine.png';
  if (treeLevel >= 6) return 'assets/images/v2/trees/spirit.png';
  return 'assets/images/v2/trees/sprout.png';
}

const CULTIVATOR_IDLE_FRAMES = Array.from(
  { length: 6 },
  (_, index) => `assets/images/character/idle/frame-${String(index + 1).padStart(2, '0')}.png`,
);
const CULTIVATOR_CHOP_FRAMES = Array.from(
  { length: 6 },
  (_, index) => `assets/images/character/chop/frame-${String(index + 1).padStart(2, '0')}.png`,
);
const CultivatorAnimator = CharacterAnimator.createFrameAnimator({
  idleFrames: CULTIVATOR_IDLE_FRAMES,
  chopFrames: CULTIVATOR_CHOP_FRAMES,
  idleFrameMs: 200,
  chopFrameMs: 90,
});

if (typeof Image !== 'undefined') {
  [...CULTIVATOR_IDLE_FRAMES, ...CULTIVATOR_CHOP_FRAMES].forEach(src => {
    const image = new Image();
    image.src = src;
  });
}

// 仙阶表 → 从飞书表格配置合并生成（game-config.js）
// 飞书表提供: reqLevel, realmId, name, maxAxeQuality, characterImage, reqItems(数字ID), icon
// 道具ID直接使用飞书道具表的5位数字ID，无需映射
// 仙阶描述 fallback（飞书表无 desc 列，代码维护）
const REALM_FALLBACK = {
  1:  { desc: '初入修仙界' },  2:  { desc: '踏上修仙路' },
  3:  { desc: '渐入佳境' },   4:  { desc: '初窥门径' },
  5:  { desc: '灵气环绕' },   6:  { desc: '功力渐深' },
  7:  { desc: '雷劫初现' },   8:  { desc: '星尘加身' },
  9:  { desc: '月华灌顶' },   10: { desc: '日辉照耀' },
  11: { desc: '星河倒灌' },   12: { desc: '神器认主' },
  13: { desc: '仙界封侯' },   14: { desc: '仙宫待启' },
  15: { desc: '龙气加身' },   16: { desc: '大罗金仙' },
};
const REALMS = (GAME_CONFIG?.realmTable || []).map(r => {
  const fb = REALM_FALLBACK[r.realmId] || {};
  return {
    level: r.realmId,
    name: r.name,
    reqLevel: r.reqLevel,
    maxAxeQuality: r.maxAxeQuality || 1,
    characterImage: r.characterImage || '',
    icon: r.icon || '⭐',
    reqItems: (r.reqItems || []).map(req => ({ ...req, itemId: String(req.itemId) })),
    desc: fb.desc || '',
  };
});

// 仙树灵阶表 → 从飞书表格配置动态构建（game-config.js → treeTable）
const TREE_REALMS = (GAME_CONFIG?.treeTable || []).map((tree, idx) => ({
  level: tree.id,
  name: tree.name,
  icon: TREE_ICONS[idx] || '🌳',
  treeLevel: tree.id,
  reqItems: (tree.reqItems || []).map(req => ({ ...req, itemId: String(req.itemId) })),
  desc: '',
}));

// 锻造奖池 → 从飞书锻造表读取 forgePoolId，动态获取奖池配置
const FORGE_POOL = (() => {
  const forgeConfig = (GAME_CONFIG?.forgeTable || [])[0];
  if (!forgeConfig) return [];
  const poolData = getPoolById(forgeConfig.forgePoolId);
  return poolData.packs.map(p => ({
    quality: p.qualityId,
    weight: p.weight,
    items: p.items,
  }));
})();

// ===== 仙斧装备仙阶限制 =====
// 根据仙斧品质，获取可装备该品质的最低仙阶（realmId最小的满足 maxAxeQuality>=quality 的仙阶）
function getMinRealmForAxeQuality(quality) {
  let result = null;
  for (const r of REALMS) {
    if (r.maxAxeQuality >= quality) {
      if (!result || r.level < result.level) result = r;
    }
  }
  return result;
}

// 判断指定仙阶能否装备某品质仙斧
function canEquipAxeQuality(quality, realmLevel) {
  const realm = REALMS.find(r => r.level == realmLevel) || REALMS[0];
  return (realm.maxAxeQuality || 1) >= quality;
}

// 难度颜色映射
const DIFFICULTY_MAP = {
  S: { name: 'S级', class: 'tag-difficulty-S' },
  A: { name: 'A级', class: 'tag-difficulty-A' },
  B: { name: 'B级', class: 'tag-difficulty-B' },
  C: { name: 'C级', class: 'tag-difficulty-C' },
};

// 任务类型映射
const TASK_TYPE_MAP = {
  daily: { name: '每日', class: 'tag-type-daily' },
  weekly: { name: '每周', class: 'tag-type-weekly' },
  theme: { name: '主题', class: 'tag-type-theme' },
  self: { name: '自主', class: 'tag-type-self' },
};

// ===== Supabase 初始化 =====
let dbClient = null;
try {
  if (window.supabase && window.supabase.createClient) {
    dbClient = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_KEY);
    console.log('Supabase 初始化成功');
  } else {
    console.error('Supabase SDK 未加载');
  }
} catch (e) {
  console.error('Supabase 初始化失败:', e);
}

/* ================================================================
   DB 层
   ================================================================ */
const DB = {
  // --- 玩家状态 ---
  async getPlayerState() {
    const { data, error } = await dbClient
      .from('player_state')
      .select('*')
      .eq('user_role', 'player')
      .single();
    if (error) {
      // PGRST116 = 没有匹配行，正常情况（首次登录）
      if (error.code !== 'PGRST116') {
        console.error('DB getPlayerState error:', error);
      }
      return null;
    }
    return {
      level: data.level,
      exp: data.exp,
      choppingCount: data.chopping_count,
      treeLevel: data.tree_level,
      treeRealm: data.tree_realm !== null && data.tree_realm !== undefined ? data.tree_realm : 0,
      realmLevel: data.realm_level || 1,
      axeId: data.axe_id,
      balance: parseFloat(data.balance) || 0,
      totalWithdrawn: parseFloat(data.total_withdrawn) || 0,
      lastDailyDate: data.last_daily_date,
      // 游戏币（道具type 0）
      coin: parseInt(data.coin) || 0,
      // 本月累签追踪
      signInMonth: data.signin_month || null,
      signInDays: parseInt(data.signin_days) || 0,
      signInClaims: Array.isArray(data.signin_claims) ? data.signin_claims : [],
      // 商店月限购计数：{ "YYYY-MM": { shopId: count } }
      shopPurchases: (data.shop_purchases && typeof data.shop_purchases === 'object') ? data.shop_purchases : {},
      // 成就系统：累计统计 + 已领取成就
      totalChops: parseInt(data.total_chops) || 0,
      totalCoinEarned: parseInt(data.total_coin_earned) || 0,
      achievementClaims: Array.isArray(data.achievement_claims) ? data.achievement_claims : [],
      themeRewardClaims: Array.isArray(data.theme_reward_claims) ? data.theme_reward_claims : [],
    };
  },

  async updatePlayerState(updates) {
    const dbUpdates = {};
    if (updates.level !== undefined) dbUpdates.level = updates.level;
    if (updates.exp !== undefined) dbUpdates.exp = updates.exp;
    if (updates.choppingCount !== undefined) dbUpdates.chopping_count = updates.choppingCount;
    if (updates.treeLevel !== undefined) dbUpdates.tree_level = updates.treeLevel;
    if (updates.treeRealm !== undefined) dbUpdates.tree_realm = updates.treeRealm;
    if (updates.realmLevel !== undefined) dbUpdates.realm_level = updates.realmLevel;
    if (updates.axeId !== undefined) dbUpdates.axe_id = updates.axeId;
    if (updates.balance !== undefined) dbUpdates.balance = updates.balance;
    if (updates.totalWithdrawn !== undefined) dbUpdates.total_withdrawn = updates.totalWithdrawn;
    // 日期字段：空字符串统一转 null，避免 Postgres "invalid input syntax for type date"
    if (updates.lastDailyDate !== undefined) dbUpdates.last_daily_date = updates.lastDailyDate || null;
    // 游戏币
    if (updates.coin !== undefined) dbUpdates.coin = updates.coin;
    // 本月累签
    if (updates.signInMonth !== undefined) dbUpdates.signin_month = updates.signInMonth || null;
    if (updates.signInDays !== undefined) dbUpdates.signin_days = updates.signInDays;
    if (updates.signInClaims !== undefined) dbUpdates.signin_claims = updates.signInClaims;
    // 商店月限购
    if (updates.shopPurchases !== undefined) dbUpdates.shop_purchases = updates.shopPurchases;
    // 成就累计统计
    if (updates.totalChops !== undefined) dbUpdates.total_chops = updates.totalChops;
    if (updates.totalCoinEarned !== undefined) dbUpdates.total_coin_earned = updates.totalCoinEarned;
    if (updates.achievementClaims !== undefined) dbUpdates.achievement_claims = updates.achievementClaims;
    if (updates.themeRewardClaims !== undefined) dbUpdates.theme_reward_claims = updates.themeRewardClaims;
    dbUpdates.updated_at = new Date().toISOString();

    const { error } = await dbClient
      .from('player_state')
      .update(dbUpdates)
      .eq('user_role', 'player');
    if (error) {
      // 新字段（coin/signin_*）若尚未执行升级SQL会报列不存在 → 剔除后重试
      const msg = error.message || '';
      if (msg.includes('does not exist') || msg.includes('Could not find')) {
        const safeUpdates = {};
        for (const k in dbUpdates) {
          if (['coin', 'signin_month', 'signin_days', 'signin_claims', 'shop_purchases', 'total_chops', 'total_coin_earned', 'achievement_claims', 'theme_reward_claims'].includes(k)) continue;
          safeUpdates[k] = dbUpdates[k];
        }
        const { error: err2 } = await dbClient
          .from('player_state')
          .update(safeUpdates)
          .eq('user_role', 'player');
        if (err2) { console.error('DB updatePlayerState fallback error:', err2); return false; }
        console.warn('player_state 缺少新字段，请执行 upgrade_v4.sql');
        return true;
      }
      console.error('DB updatePlayerState error:', error);
      return false;
    }
    return true;
  },

  // 初始化玩家数据（首次登录自动创建）
  async initPlayerState() {
    const existing = await this.getPlayerState();
    if (existing) return existing;

    const defaultState = {
      user_role: 'player',
      level: 1,
      exp: 0,
      chopping_count: 10,
      tree_level: 0,
      tree_realm: 0,
      realm_level: 1,
      axe_id: '51001',
      balance: 0,
      total_withdrawn: 0,
      last_daily_date: null,
      coin: 0,
      signin_month: null,
      signin_days: 0,
      signin_claims: [],
      shop_purchases: {},
      total_chops: 0,
      total_coin_earned: 0,
      achievement_claims: [],
      theme_reward_claims: [],
    };

    const { error } = await dbClient
      .from('player_state')
      .insert(defaultState);
    if (error) {
      // 字段不存在（未跑升级SQL）或日期空值等 → 降级为最小字段插入
      const fallbackState = {
        user_role: 'player',
        level: 1,
        exp: 0,
        chopping_count: 10,
        tree_level: 1,
        axe_id: '51001',
        balance: 0,
        total_withdrawn: 0,
      };
      const { error: err2 } = await dbClient.from('player_state').insert(fallbackState);
      if (err2) {
        console.error('DB initPlayerState fallback error:', err2);
        // 即使插入失败也返回内存默认值，避免整页 null 崩溃
        return this._defaultPlayerState();
      }
      console.warn('player_state 新字段缺失，建议执行 upgrade_v3.sql（coin/累签 将仅本次会话生效）');
    }

    return this._defaultPlayerState();
  },

  // 内存中的默认玩家状态（新建行后立即返回，避免多一次查询）
  _defaultPlayerState() {
    return {
      level: 1,
      exp: 0,
      choppingCount: 10,
      treeLevel: 0,
      treeRealm: 0,
      realmLevel: 1,
      axeId: '51001',
      balance: 0,
      totalWithdrawn: 0,
      lastDailyDate: null,
      coin: 0,
      signInMonth: null,
      signInDays: 0,
      signInClaims: [],
      shopPurchases: {},
      totalChops: 0,
      totalCoinEarned: 0,
      achievementClaims: [],
      themeRewardClaims: [],
    };
  },

  // --- 背包 ---
  async getInventory() {
    const { data, error } = await dbClient
      .from('inventory')
      .select('*')
      .eq('user_role', 'player')
      .gt('quantity', 0)
      .order('updated_at', { ascending: false });
    if (error) { console.error('DB getInventory error:', error); return []; }
    return data.map(item => ({
      itemId: item.item_id,
      quantity: item.quantity,
    }));
  },

  async addItem(itemId, quantity = 1) {
    const { data: existing } = await dbClient
      .from('inventory')
      .select('*')
      .eq('user_role', 'player')
      .eq('item_id', itemId)
      .maybeSingle();

    if (existing) {
      const { error } = await dbClient
        .from('inventory')
        .update({
          quantity: existing.quantity + quantity,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id);
      if (error) { console.error('DB addItem update error:', error); return false; }
    } else {
      const { error } = await dbClient
        .from('inventory')
        .insert({
          user_role: 'player',
          item_id: itemId,
          quantity: quantity,
        });
      if (error) { console.error('DB addItem insert error:', error); return false; }
    }
    return true;
  },

  async removeItem(itemId, quantity = 1) {
    const { data: existing } = await dbClient
      .from('inventory')
      .select('*')
      .eq('user_role', 'player')
      .eq('item_id', itemId)
      .maybeSingle();

    if (!existing || existing.quantity < quantity) return false;

    const newQty = existing.quantity - quantity;
    if (newQty <= 0) {
      const { error } = await dbClient.from('inventory').delete().eq('id', existing.id);
      if (error) { console.error('DB removeItem delete error:', error); return false; }
    } else {
      const { error } = await dbClient
        .from('inventory')
        .update({ quantity: newQty, updated_at: new Date().toISOString() })
        .eq('id', existing.id);
      if (error) { console.error('DB removeItem update error:', error); return false; }
    }
    return true;
  },

  async composeInventoryItem(sourceItemId, sourceQuantity, targetItemId, targetQuantity) {
    const { data, error } = await dbClient.rpc('compose_inventory_item', {
      p_source_item_id: String(sourceItemId),
      p_source_quantity: sourceQuantity,
      p_target_item_id: String(targetItemId),
      p_target_quantity: targetQuantity,
    });
    if (error) {
      console.error('DB composeInventoryItem error:', error);
      return { ok: false, code: 'network_error' };
    }
    return data || { ok: false, code: 'empty_response' };
  },

  async reservePlayerClaim(claimType, claimKey) {
    const { data, error } = await dbClient.rpc('reserve_player_claim', {
      p_claim_type: claimType,
      p_claim_key: String(claimKey),
    });
    if (error) {
      console.error('DB reservePlayerClaim error:', error);
      return { ok: false, code: 'network_error' };
    }
    return data || { ok: false, code: 'empty_response' };
  },

  async dailyCheckIn() {
    const { data, error } = await dbClient.rpc('daily_check_in');
    if (error) {
      console.error('DB dailyCheckIn error:', error);
      return { ok: false, code: 'network_error' };
    }
    return data || { ok: false, code: 'empty_response' };
  },

  // --- 任务 ---
  async getTasks(type = null) {
    let query = dbClient.from('xiu_tasks').select('*').eq('status', 'published');
    if (type) query = query.eq('task_type', type);
    const { data, error } = await query.order('sort_order', { ascending: true });
    if (error) { console.error('DB getTasks error:', error); return []; }
    return data.map(t => ({
      id: t.id,
      taskType: t.task_type,
      title: t.title,
      description: t.description,
      difficulty: t.difficulty,
      rewardChopping: t.reward_chopping,
      rewardItems: t.reward_items || [],
      themeName: t.theme_name || null,
      themeStart: t.theme_start || null,
      themeEnd: t.theme_end || null,
      themeExtraReward: t.theme_extra_reward || [],
      sortOrder: t.sort_order || 0,
    }));
  },

  async getAllTasks(type = null) {
    let query = dbClient.from('xiu_tasks').select('*');
    if (type) query = query.eq('task_type', type);
    const { data, error } = await query.order('sort_order', { ascending: true });
    if (error) { console.error('DB getAllTasks error:', error); return []; }
    return data.map(t => ({
      id: t.id,
      taskType: t.task_type,
      title: t.title,
      description: t.description,
      difficulty: t.difficulty,
      rewardChopping: t.reward_chopping,
      rewardItems: t.reward_items || [],
      status: t.status,
      themeName: t.theme_name || null,
      themeStart: t.theme_start || null,
      themeEnd: t.theme_end || null,
      themeExtraReward: t.theme_extra_reward || [],
    }));
  },

  async createTask(task) {
    const insertData = {
      task_type: task.taskType,
      title: task.title,
      description: task.description,
      difficulty: task.difficulty,
      reward_chopping: task.rewardChopping || 0,
      reward_items: task.rewardItems || [],
      status: task.status || 'draft',
      sort_order: task.sortOrder || 0,
    };

    // 尝试带主题字段插入
    try {
      const { data, error } = await dbClient
        .from('xiu_tasks')
        .insert({
          ...insertData,
          theme_name: task.themeName || null,
          theme_start: task.themeStart || null,
          theme_end: task.themeEnd || null,
          theme_extra_reward: task.themeExtraReward || [],
        })
        .select()
        .single();
      if (!error) return data;
      // 如果是字段不存在错误，走降级插入
      if (error.message && error.message.includes('does not exist')) {
        // fall through to fallback
      } else {
        console.error('DB createTask error:', error);
        return null;
      }
    } catch (e) {}

    // 降级：不带主题字段插入
    const { data: data2, error: err2 } = await dbClient
      .from('xiu_tasks')
      .insert(insertData)
      .select()
      .single();
    if (err2) { console.error('DB createTask fallback error:', err2); return null; }
    return data2;
  },

  async updateTaskStatus(id, status) {
    const { error } = await dbClient.from('xiu_tasks').update({ status }).eq('id', id);
    if (error) { console.error('DB updateTaskStatus error:', error); return false; }
    return true;
  },

  async deleteTask(id) {
    const { error } = await dbClient.from('xiu_tasks').delete().eq('id', id);
    if (error) { console.error('DB deleteTask error:', error); return false; }
    return true;
  },

  // --- 任务提交 ---
  async getSubmissions(status = null) {
    let query = dbClient.from('task_submissions').select('*');
    if (status) query = query.eq('status', status);
    const { data, error } = await query.order('submitted_at', { ascending: false });
    if (error) { console.error('DB getSubmissions error:', error); return []; }
    return data.map(s => ({
      id: s.id,
      taskId: s.task_id,
      taskType: s.task_type,
      taskTitle: s.task_title,
      isSelfTask: s.is_self_task,
      selfTitle: s.self_title,
      selfDescription: s.self_description,
      description: s.description,
      status: s.status,
      submittedAt: s.submitted_at,
      reviewNote: s.review_note,
      rewardChopping: s.reward_chopping || 0,
      rewardItems: s.reward_items || [],
    }));
  },

  async submitTask(submission) {
    const { data, error } = await dbClient
      .from('task_submissions')
      .insert({
        task_id: submission.taskId || null,
        task_type: submission.taskType,
        task_title: submission.taskTitle,
        is_self_task: submission.isSelfTask || false,
        self_title: submission.selfTitle || null,
        self_description: submission.selfDescription || null,
        description: submission.description,
        status: 'pending',
        reward_chopping: submission.rewardChopping || 0,
        reward_items: submission.rewardItems || [],
      })
      .select()
      .single();
    if (error) { console.error('DB submitTask error:', error); return null; }
    return data;
  },

  async reviewSubmission(id, status, note = '', rewardChopping = 0, rewardItems = []) {
    const { error } = await dbClient
      .from('task_submissions')
      .update({
        status: status,
        review_note: note,
        reviewed_at: new Date().toISOString(),
        reward_chopping: rewardChopping,
        reward_items: rewardItems,
      })
      .eq('id', id);
    if (error) { console.error('DB reviewSubmission error:', error); return false; }
    return true;
  },

  async claimSubmission(id) {
    const { data, error } = await dbClient
      .from('task_submissions')
      .update({ status: 'claimed', reviewed_at: new Date().toISOString() })
      .eq('id', id)
      .eq('status', 'approved')
      .select('id')
      .maybeSingle();
    if (error) { console.error('DB claimSubmission error:', error); return false; }
    return Boolean(data);
  },

  // --- 邮件 ---
  async getMails() {
    // 先试带 is_deleted 过滤的查询
    try {
      const { data, error } = await dbClient
        .from('mails')
        .select('*')
        .eq('user_role', 'player')
        .eq('is_deleted', false)
        .order('created_at', { ascending: false });
      if (!error) {
        return data.map(m => ({
          id: m.id,
          title: m.title,
          content: m.content,
          items: m.items || [],
          isRead: m.is_read,
          isClaimed: m.is_claimed,
          createdAt: m.created_at,
        }));
      }
      // 如果是字段不存在错误，走降级查询
      if (error.message && error.message.includes('does not exist')) {
        // fall through to fallback
      } else {
        console.error('DB getMails error:', error);
        return [];
      }
    } catch (e) {}

    // 降级：不带 is_deleted 过滤
    const { data: data2, error: err2 } = await dbClient
      .from('mails')
      .select('*')
      .eq('user_role', 'player')
      .order('created_at', { ascending: false });
    if (err2) { console.error('DB getMails fallback error:', err2); return []; }
    return data2.map(m => ({
      id: m.id,
      title: m.title,
      content: m.content,
      items: m.items || [],
      isRead: m.is_read,
      isClaimed: m.is_claimed,
      createdAt: m.created_at,
    }));
  },

  async sendMail(title, content, items = []) {
    const { error } = await dbClient
      .from('mails')
      .insert({
        user_role: 'player',
        title: title,
        content: content,
        items: items,
      });
    if (error) { console.error('DB sendMail error:', error); return false; }
    return true;
  },

  async markMailRead(id) {
    const { error } = await dbClient
      .from('mails')
      .update({ is_read: true })
      .eq('id', id);
    if (error) { console.error('DB markMailRead error:', error); return false; }
    return true;
  },

  async claimMail(id) {
    const { data, error } = await dbClient
      .from('mails')
      .update({ is_claimed: true, is_read: true })
      .eq('id', id)
      .eq('is_claimed', false)
      .select('id')
      .maybeSingle();
    if (error) { console.error('DB claimMail error:', error); return false; }
    return Boolean(data);
  },

  async deleteMail(id) {
    const { error } = await dbClient
      .from('mails')
      .update({ is_deleted: true })
      .eq('id', id);
    // 如果字段不存在（还没跑升级SQL），直接返回成功
    if (error && error.message && error.message.includes('does not exist')) return true;
    if (error) { console.error('DB deleteMail error:', error); return false; }
    return true;
  },

  // --- 提现 ---
  async getWithdrawals(status = null) {
    let query = dbClient.from('withdrawals').select('*');
    if (status) query = query.eq('status', status);
    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) { console.error('DB getWithdrawals error:', error); return []; }
    return data.map(w => ({
      id: w.id,
      amount: parseFloat(w.amount),
      status: w.status,
      createdAt: w.created_at,
    }));
  },

  async requestWithdrawal(amount) {
    const { data, error } = await dbClient
      .from('withdrawals')
      .insert({
        user_role: 'player',
        amount: amount,
        status: 'pending',
      })
      .select()
      .single();
    if (error) { console.error('DB requestWithdrawal error:', error); return null; }
    return data;
  },

  async reviewWithdrawal(id, status) {
    const { error } = await dbClient
      .from('withdrawals')
      .update({ status: status, reviewed_at: new Date().toISOString() })
      .eq('id', id);
    if (error) { console.error('DB reviewWithdrawal error:', error); return false; }
    return true;
  },

  async reviewWithdrawalOnce(id, status) {
    const { data, error } = await dbClient
      .from('withdrawals')
      .update({ status: status, reviewed_at: new Date().toISOString() })
      .eq('id', id)
      .eq('status', 'pending')
      .select('id')
      .maybeSingle();
    if (error) { console.error('DB reviewWithdrawalOnce error:', error); return false; }
    return Boolean(data);
  },
};

/* ================================================================
   游戏逻辑
   ================================================================ */

// 成就类型 → 玩家状态字段 / 图标 / 文案（页签与类型定义来自飞书成就表）
// typeId 对应「成就类型表」：1角色等级 2仙阶 3仙树灵阶 4消耗砍树次数 5历史获得游戏币 6提现总额
const ACH_TYPE_META = {
  1: { stat: 'level',          icon: '📈', tab: 1 },
  2: { stat: 'realmLevel',     icon: '⭐', tab: 1, isRealm: true },
  3: { stat: 'treeLevel',      icon: '🌳', tab: 2 },
  4: { stat: 'totalChops',     icon: '🪓', tab: 2 },
  5: { stat: 'totalCoinEarned', icon: '🪙', tab: 3 },
  6: { stat: 'totalWithdrawn', icon: '💰', tab: 3 },
};

// 成就目标文案：优先用配置里的展示文案（{value} 占位），否则按类型生成
function achievementGoalText(typeId, value) {
  const type = getAchievementTypes().find(t => t.typeId === typeId);
  const meta = ACH_TYPE_META[typeId];
  if (type && type.displayText) {
    if (meta && meta.isRealm) {
      const realm = REALMS.find(r => r.level == value);
      return type.displayText.replace('{value}', realm ? realm.name : (value + '阶'));
    }
    return type.displayText.replace('{value}', value);
  }
  // 配置未给文案的类型（3~6），按类型生成
  switch (typeId) {
    case 3: return `仙树灵阶达到 ${value} 阶`;
    case 4: return `累计砍树 ${value} 次`;
    case 5: return `累计获得 ${value} 游戏币`;
    case 6: return `累计提现 ¥${value}`;
    default: return `达成成就 ${value}`;
  }
}

const Game = {
  state: null,
  inventory: [],

  async init() {
    this.state = await DB.initPlayerState();
    this.inventory = await DB.getInventory();
    if (!this.state) {
      console.error('玩家状态初始化失败');
      UI.toast('初始化失败，请刷新重试', 'error');
    }
  },

  async refresh() {
    this.state = await DB.getPlayerState();
    this.inventory = await DB.getInventory();
    UI.updateHeader();
  },

  _setInventoryQuantity(itemId, quantity) {
    const id = String(itemId);
    const qty = Math.max(0, parseInt(quantity) || 0);
    const index = this.inventory.findIndex(item => item.itemId == id);
    if (qty === 0) {
      if (index >= 0) this.inventory.splice(index, 1);
      return;
    }
    if (index >= 0) {
      this.inventory[index].quantity = qty;
    } else {
      this.inventory.push({ itemId: id, quantity: qty });
    }
  },

  // 统一发放道具（特殊道具不进背包）：
  //   type 0 游戏币 → state.coin；type 6 砍树次数 → state.choppingCount；其余 → 背包
  // 返回 { kind: 'coin'|'chopping'|'item', id, quantity, def }
  async grantItem(itemId, quantity = 1) {
    const id = String(itemId);
    const qty = Math.max(1, parseInt(quantity) || 1);
    const def = ITEMS[id];
    if (def && def.type === 0) {
      this.state.coin = (this.state.coin || 0) + qty;
      // 成就统计：历史累计获得游戏币
      this.state.totalCoinEarned = (this.state.totalCoinEarned || 0) + qty;
      const saved = await DB.updatePlayerState({
        coin: this.state.coin,
        totalCoinEarned: this.state.totalCoinEarned,
      });
      if (!saved) {
        this.state.coin -= qty;
        this.state.totalCoinEarned -= qty;
        return null;
      }
      return { kind: 'coin', id, quantity: qty, def };
    }
    if (def && def.type === 6) {
      this.state.choppingCount += qty;
      const saved = await DB.updatePlayerState({ choppingCount: this.state.choppingCount });
      if (!saved) {
        this.state.choppingCount -= qty;
        return null;
      }
      return { kind: 'chopping', id, quantity: qty, def };
    }
    // 普通道具 → 背包（本地 + DB）
    const idx = this.inventory.findIndex(i => i.itemId == id);
    if (idx >= 0) this.inventory[idx].quantity += qty;
    else this.inventory.push({ itemId: id, quantity: qty });
    const saved = await DB.addItem(id, qty);
    if (!saved) {
      if (idx >= 0) this.inventory[idx].quantity -= qty;
      else this.inventory = this.inventory.filter(item => item.itemId != id);
      return null;
    }
    return { kind: 'item', id, quantity: qty, def };
  },

  // 砍树
  async chop() {
    if (this.state.choppingCount <= 0) {
      UI.toast('没有砍树次数了，去完成任务吧', 'warn');
      return null;
    }

    const previous = {
      choppingCount: this.state.choppingCount,
      totalChops: this.state.totalChops || 0,
      level: this.state.level,
      exp: this.state.exp,
    };

    // 消耗砍树次数
    this.state.choppingCount -= 1;
    // 成就统计：累计消耗砍树次数
    this.state.totalChops = (this.state.totalChops || 0) + 1;

    // 随机掉落
    const treeConfig = TREE_LEVELS[this.state.treeLevel] || TREE_LEVELS[1];
    let item = this._rollDrop(treeConfig);

    // 应用仙斧buff
    item = this._applyAxeBuffs(item);

    // 加经验（移到grantItem之前，确保前端立即同步更新）
    const expGain = 1;
    this.state.exp += expGain;
    let leveledUp = false;
    while (this.state.exp >= getExpForLevel(this.state.level)) {
      this.state.exp -= getExpForLevel(this.state.level);
      this.state.level += 1;
      leveledUp = true;
    }
    if (leveledUp) {
      UI.toast(`恭喜！升级到 Lv.${this.state.level}`, 'success');
    }

    // 返还砍树次数buff
    const refund = this._checkRefundBuff();
    if (refund > 0) {
      item.refundChopping = refund;
    }

    const stateSaved = await DB.updatePlayerState({
      choppingCount: this.state.choppingCount,
      level: this.state.level,
      exp: this.state.exp,
      totalChops: this.state.totalChops,
    });
    if (!stateSaved) {
      Object.assign(this.state, previous);
      UI._updateCultivateStats();
      UI.toast('砍树未完成，请重试', 'error');
      return null;
    }

    const grant = await this.grantItem(item.itemId, item.quantity);
    if (!grant) {
      Object.assign(this.state, previous);
      const restored = await DB.updatePlayerState(previous);
      if (!restored) console.error('chop compensation failed');
      await this.refresh();
      UI.toast('掉落发放失败，本次砍树已退回', 'error');
      return null;
    }
    item.kind = grant.kind;

    // 每累计砍树 10 次，从奖励包 1003 均匀抽取一件额外奖励。
    if (GameplayRules.isBonusChop(this.state.totalChops)) {
      const extraDrop = this._rollPackDrop(1003);
      if (extraDrop) {
        const extraGrant = await this.grantItem(extraDrop.itemId, extraDrop.quantity);
        if (extraGrant) {
          extraDrop.kind = extraGrant.kind;
          extraDrop.isExtra = true;
          item.extraDrop = extraDrop;
        } else {
          UI.toast('第十砍额外奖励发放失败，请联系天道检查', 'error');
        }
      }
    }

    UI._updateCultivateStats();
    UI.updateHeader();
    return item;
  },

  _rollDrop(treeConfig) {
    const totalWeight = treeConfig.pools.reduce((sum, p) => sum + p.weight, 0);
    let roll = Math.random() * totalWeight;
    let selectedPool = null;

    for (const pool of treeConfig.pools) {
      roll -= pool.weight;
      if (roll <= 0) { selectedPool = pool; break; }
    }
    if (!selectedPool) selectedPool = treeConfig.pools[0];

    const itemId = selectedPool.items[Math.floor(Math.random() * selectedPool.items.length)];
    const itemDef = ITEMS[itemId];

    return {
      itemId: itemId,
      quantity: 1,
      quality: selectedPool.quality,
      qualityName: QUALITY[selectedPool.quality].name,
      item: itemDef,
    };
  },

  // 从指定奖池ID抽取一个奖励（用于额外掉落等场景）
  _rollPoolDrop(poolId) {
    const poolData = getPoolById(poolId);
    if (!poolData || !poolData.packs || poolData.packs.length === 0) return null;

    const totalWeight = poolData.packs.reduce((sum, p) => sum + p.weight, 0);
    if (totalWeight <= 0) return null;
    let roll = Math.random() * totalWeight;
    let selectedPack = null;
    for (const pack of poolData.packs) {
      roll -= pack.weight;
      if (roll <= 0) { selectedPack = pack; break; }
    }
    if (!selectedPack) selectedPack = poolData.packs[0];

    const itemId = selectedPack.items[Math.floor(Math.random() * selectedPack.items.length)];
    const itemDef = ITEMS[itemId];
    if (!itemDef) return null;

    return {
      itemId: itemId,
      quantity: 1,
      quality: selectedPack.qualityId,
      qualityName: QUALITY[selectedPack.qualityId] ? QUALITY[selectedPack.qualityId].name : '',
      item: itemDef,
    };
  },

  async _addExp(amount) {
    this.state.exp += amount;
    let leveledUp = false;
    while (this.state.exp >= getExpForLevel(this.state.level)) {
      this.state.exp -= getExpForLevel(this.state.level);
      this.state.level += 1;
      leveledUp = true;
    }
    if (leveledUp) {
      UI.toast(`恭喜！升级到 Lv.${this.state.level}`, 'success');
    }
    await DB.updatePlayerState({ level: this.state.level, exp: this.state.exp });
    return leveledUp;
  },

  // 每日签到（同时累计本月签到天数）
  async dailyCheckIn() {
    const today = localDateStr();
    if (this.state.lastDailyDate === today) {
      UI.toast('今日已签到', 'warn');
      return false;
    }
    const result = await DB.dailyCheckIn();
    if (!result.ok && result.code !== 'already_checked') {
      UI.toast('签到未完成，请重试', 'error');
      return false;
    }

    this.state.choppingCount = Number(result.choppingCount) || this.state.choppingCount;
    this.state.lastDailyDate = result.date || today;
    this.state.signInMonth = result.month || today.slice(0, 7);
    this.state.signInDays = Number(result.days) || 0;
    this.state.signInClaims = Array.isArray(result.claims) ? result.claims : [];
    UI.updateHeader();
    if (result.code === 'already_checked') {
      UI.toast('今日已签到', 'warn');
      return false;
    }
    UI.toast(`签到成功！获得 1 次砍树机会（本月已签 ${this.state.signInDays} 天）`, 'success');
    return true;
  },

  // 获取本月累签状态（跨月自动归零）
  getSignInState() {
    const month = localDateStr().slice(0, 7);
    if (this.state.signInMonth !== month) {
      return { month, days: 0, claims: [] };
    }
    return {
      month,
      days: this.state.signInDays || 0,
      claims: Array.isArray(this.state.signInClaims) ? this.state.signInClaims : [],
    };
  },

  // 领取累签里程碑奖励
  async claimSignInReward(reward) {
    const si = this.getSignInState();
    if (si.claims.includes(reward.rewardId)) {
      UI.toast('该奖励已领取', 'warn');
      return false;
    }
    if (si.days < reward.requiredDays) {
      UI.toast(`需累计签到 ${reward.requiredDays} 天（本月已签 ${si.days} 天）`, 'warn');
      return false;
    }

    const reserved = await DB.reservePlayerClaim('signin', reward.rewardId);
    if (!reserved.ok) {
      if (reserved.code === 'already_claimed') {
        await this.refresh();
        UI.toast('该奖励已领取', 'warn');
      } else {
        UI.toast('领取未完成，请重试', 'error');
      }
      return false;
    }

    const claims = [...si.claims, reward.rewardId];
    this.state.signInClaims = claims;
    for (const it of reward.items) {
      const granted = await this.grantItem(it.itemId, it.count);
      if (!granted) {
        console.error('claimSignInReward grant failed:', reward.rewardId, it);
        UI.toast('奖励状态已同步，请联系天道检查', 'error');
        return false;
      }
    }
    UI.toast(`累计签到 ${reward.requiredDays} 天奖励已领取！`, 'success');
    return true;
  },

  // ===== 成就系统 =====
  // 计算全部成就进度
  getAchievementProgress() {
    const claims = Array.isArray(this.state.achievementClaims) ? this.state.achievementClaims : [];
    return getAchievements().map(a => {
      const meta = ACH_TYPE_META[a.typeId] || { stat: 'level', icon: '🏅', tab: 1 };
      const current = parseInt(this.state[meta.stat]) || 0;
      const target = a.typeParam || 1;
      const claimed = claims.includes(a.achievementId);
      const done = current >= target;
      return {
        ...a,
        icon: meta.icon,
        tabId: meta.tab,
        current,
        target,
        progress: Math.min(1, current / target),
        claimed,
        claimable: done && !claimed,
      };
    });
  },

  // 是否有可领取成就（用于红点）
  hasClaimableAchievements() {
    return this.getAchievementProgress().some(a => a.claimable);
  },

  // 领取成就奖励
  async claimAchievement(achievementId) {
    const list = this.getAchievementProgress();
    const ach = list.find(x => x.achievementId === achievementId);
    if (!ach) return false;
    const claims = Array.isArray(this.state.achievementClaims) ? this.state.achievementClaims : [];
    if (claims.includes(achievementId)) { UI.toast('该成就已领取', 'warn'); return false; }
    if (!ach.claimable) { UI.toast('尚未达成该成就', 'warn'); return false; }

    const reserved = await DB.reservePlayerClaim('achievement', achievementId);
    if (!reserved.ok) {
      if (reserved.code === 'already_claimed') {
        await this.refresh();
        UI.toast('该成就已领取', 'warn');
      } else {
        UI.toast('领取未完成，请重试', 'error');
      }
      return false;
    }

    const newClaims = [...claims, achievementId];
    this.state.achievementClaims = newClaims;
    const granted = await this.grantItem(ach.rewardItemId, ach.rewardCount);
    if (!granted) {
      console.error('claimAchievement grant failed:', achievementId);
      UI.toast('奖励状态已同步，请联系天道检查', 'error');
      return false;
    }
    UI.updateHeader();
    const def = ITEMS[String(ach.rewardItemId)];
    const rname = def ? def.name : '道具';
    UI.toast(`成就达成！获得 ${rname} ×${ach.rewardCount}`, 'success');
    return true;
  },

  // 合成道具
  async compose(itemId) {
    return this.composeMulti(itemId, 1);
  },

  _rollPackDrop(packId) {
    const pack = GAME_CONFIG.packTable.find(entry => entry.packId === packId);
    const rolled = GameplayRules.rollPackItem(pack);
    if (!rolled) return null;
    const itemDef = ITEMS[rolled.itemId];
    if (!itemDef) return null;
    return {
      itemId: rolled.itemId,
      quantity: 1,
      quality: rolled.quality,
      qualityName: QUALITY[rolled.quality]?.name || '',
      item: itemDef,
    };
  },

  // 批量合成道具
  async composeMulti(itemId, qty) {
    const itemDef = ITEMS[itemId];
    if (!itemDef || itemDef.type !== 1) return false;

    const composeQty = parseInt(qty);
    if (!Number.isInteger(composeQty) || composeQty < 1 || composeQty > 99) {
      UI.toast('合成数量无效', 'warn');
      return false;
    }

    const totalNeed = itemDef.composeCount * composeQty;
    const have = this._getItemQty(itemId);
    if (have < totalNeed) {
      UI.toast(`材料不足，需要 ${totalNeed} 个`, 'warn');
      return false;
    }

    const result = await DB.composeInventoryItem(
      itemId,
      totalNeed,
      itemDef.composeTo,
      composeQty,
    );
    if (!result.ok) {
      if (result.code === 'insufficient_materials') {
        this.inventory = await DB.getInventory();
        UI.toast(`材料不足，需要 ${totalNeed} 个`, 'warn');
      } else {
        UI.toast('合成未完成，请重试', 'error');
      }
      return false;
    }

    this._setInventoryQuantity(itemId, result.sourceQuantity);
    this._setInventoryQuantity(itemDef.composeTo, result.targetQuantity);

    const targetItem = ITEMS[itemDef.composeTo];
    UI.toast(`合成成功！获得 ${targetItem.name} ×${composeQty}`, 'success');
    return true;
  },

  // 出售仙斧（售价为游戏币）
  async sellAxe(itemId) {
    const itemDef = ITEMS[itemId];
    if (!itemDef || itemDef.type !== 5) return false;
    const removed = await DB.removeItem(itemId, 1);
    if (!removed) return false;

    const previousCoin = this.state.coin || 0;
    const previousTotal = this.state.totalCoinEarned || 0;
    this.state.coin = previousCoin + itemDef.sellPrice;
    // 成就统计：出售仙斧获得的游戏币计入累计
    this.state.totalCoinEarned = previousTotal + itemDef.sellPrice;
    const updated = await DB.updatePlayerState({
      coin: this.state.coin,
      totalCoinEarned: this.state.totalCoinEarned,
    });
    if (!updated) {
      this.state.coin = previousCoin;
      this.state.totalCoinEarned = previousTotal;
      const restored = await DB.addItem(itemId, 1);
      if (!restored) console.error('sellAxe rollback failed:', itemId);
      await this.refresh();
      return false;
    }

    this._setInventoryQuantity(itemId, this._getItemQty(itemId) - 1);
    UI.updateHeader();
    UI.toast(`出售成功！获得 ${itemDef.sellPrice} 游戏币`, 'success');
    return true;
  },

  // 装备仙斧
  async equipAxe(itemId) {
    const itemDef = ITEMS[itemId];
    if (!itemDef || itemDef.type !== 5) return false;
    // 仙阶限制校验：仙斧品质不能超过当前仙阶允许的最高品质
    if (!canEquipAxeQuality(itemDef.quality, this.state.realmLevel)) {
      const minRealm = getMinRealmForAxeQuality(itemDef.quality);
      const qName = QUALITY[itemDef.quality]?.name || `品质${itemDef.quality}`;
      const curRealm = REALMS.find(r => r.level == this.state.realmLevel) || REALMS[0];
      UI.toast(`仙阶不足！${qName}仙斧需达到【${minRealm?.name || '?'}】，当前为【${curRealm.name}】`, 'warn');
      return false;
    }

    if (this._getItemQty(itemId) < 1) {
      UI.toast('背包中没有这把斧头', 'warn');
      return false;
    }

    // 同 ID 武器属性完全一致，交换后聚合库存和装备 ID 都不变。
    if (this.state.axeId === itemId) {
      UI.toast(`装备了 ${itemDef.name}`, 'success');
      return true;
    }

    const oldAxeId = this.state.axeId;
    const removed = await DB.removeItem(itemId, 1);
    if (!removed) {
      this.inventory = await DB.getInventory();
      UI.toast('装备失败，背包数量已刷新', 'error');
      return false;
    }

    let oldAxeReturned = false;
    if (oldAxeId && oldAxeId !== '51001') {
      oldAxeReturned = await DB.addItem(oldAxeId, 1);
      if (!oldAxeReturned) {
        await DB.addItem(itemId, 1);
        await this.refresh();
        UI.toast('装备失败，请重试', 'error');
        return false;
      }
    }

    this.state.axeId = itemId;
    const updated = await DB.updatePlayerState({ axeId: itemId });
    if (!updated) {
      this.state.axeId = oldAxeId;
      if (oldAxeReturned) await DB.removeItem(oldAxeId, 1);
      await DB.addItem(itemId, 1);
      await this.refresh();
      UI.toast('装备失败，请重试', 'error');
      return false;
    }

    this._setInventoryQuantity(itemId, this._getItemQty(itemId) - 1);
    if (oldAxeReturned) {
      this._setInventoryQuantity(oldAxeId, this._getItemQty(oldAxeId) + 1);
    }
    UI.toast(`装备了 ${itemDef.name}`, 'success');
    return true;
  },

  // 提现
  async withdraw(amount) {
    if (amount <= 0 || amount > this.state.balance) {
      UI.toast('余额不足', 'error');
      return false;
    }
    if (amount % 100 !== 0) {
      UI.toast('提现需为100的整数倍', 'warn');
      return false;
    }
    const previousBalance = this.state.balance;
    this.state.balance -= amount;
    const balanceSaved = await DB.updatePlayerState({ balance: this.state.balance });
    if (!balanceSaved) {
      this.state.balance = previousBalance;
      return false;
    }

    const withdrawal = await DB.requestWithdrawal(amount);
    if (!withdrawal) {
      this.state.balance = previousBalance;
      await DB.updatePlayerState({ balance: previousBalance });
      return false;
    }

    const mailed = await DB.sendMail(
      '提现申请已提交',
      `你申请提现 ${amount} 元，天道审核通过后将发放。`,
      []
    );
    if (!mailed) console.error('withdraw notification mail failed:', withdrawal.id);
    await this.refresh();
    UI.toast('提现申请已提交', 'success');
    return true;
  },

  // 商店购买（天道酬勤商店，消耗游戏币）
  // shopItem 来自 getShopItems()：{ shopId, itemId, itemCount, limitType, limitParam, price, name, icon }
  async shopBuy(shopItem) {
    const price = parseInt(shopItem.price) || 0;
    const month = new Date().toISOString().slice(0, 7); // YYYY-MM

    // 限购类型3：仙阶限购
    if (parseInt(shopItem.limitType) === SHOP_LIMIT_TYPE.REALM) {
      const needRealm = parseInt(shopItem.limitParam) || 0;
      if ((this.state.realmLevel || 1) < needRealm) {
        const realm = REALMS.find(r => r.level == needRealm);
        UI.toast(`仙阶不足！需达到【${realm ? realm.name : needRealm}】才可购买`, 'warn');
        return false;
      }
    }

    // 限购类型2：月限购
    const previousCoin = this.state.coin || 0;
    const previousPurchases = JSON.parse(JSON.stringify(this.state.shopPurchases || {}));
    const purchases = JSON.parse(JSON.stringify(previousPurchases));
    const monthPurchases = purchases[month] || {};
    if (parseInt(shopItem.limitType) === SHOP_LIMIT_TYPE.MONTHLY) {
      const max = parseInt(shopItem.limitParam) || 0;
      if ((monthPurchases[shopItem.shopId] || 0) >= max) {
        UI.toast(`本月限购 ${max} 次，已达上限（每月1号刷新）`, 'warn');
        return false;
      }
    }

    // 游戏币校验
    if ((this.state.coin || 0) < price) {
      UI.toast('游戏币不足，砍树掉落/出售仙斧可获得游戏币', 'warn');
      return false;
    }

    // 扣游戏币
    this.state.coin -= price;

    // 月限购计数 +1
    if (parseInt(shopItem.limitType) === SHOP_LIMIT_TYPE.MONTHLY) {
      if (!purchases[month]) purchases[month] = {};
      purchases[month][shopItem.shopId] = (purchases[month][shopItem.shopId] || 0) + 1;
      this.state.shopPurchases = purchases;
    }

    const purchaseSaved = await DB.updatePlayerState({
      coin: this.state.coin,
      shopPurchases: this.state.shopPurchases,
    });
    if (!purchaseSaved) {
      this.state.coin = previousCoin;
      this.state.shopPurchases = previousPurchases;
      return false;
    }

    // 发放道具（游戏币/砍树次数自动路由，普通道具进背包）
    const granted = await this.grantItem(shopItem.itemId, shopItem.itemCount);
    if (!granted) {
      this.state.coin = previousCoin;
      this.state.shopPurchases = previousPurchases;
      await DB.updatePlayerState({
        coin: previousCoin,
        shopPurchases: previousPurchases,
      });
      return false;
    }

    await this.refresh();
    UI.toast(`购买成功！获得 ${shopItem.name} ×${shopItem.itemCount}`, 'success');
    return true;
  },

  _getItemQty(itemId) {
    const item = this.inventory.find(i => i.itemId == itemId);
    return item ? item.quantity : 0;
  },

  // 仙阶突破
  async breakThrough() {
    const currentRealm = REALMS.find(r => r.level == this.state.realmLevel) || REALMS[0];
    const nextRealm = REALMS.find(r => r.level == this.state.realmLevel + 1);
    if (!nextRealm) {
      UI.toast('已达最高仙阶', 'warn');
      return false;
    }
    if (this.state.level < nextRealm.reqLevel) {
      UI.toast(`需要等级达到 ${nextRealm.reqLevel} 级才能突破`, 'warn');
      return false;
    }
    // 检查道具
    for (const req of nextRealm.reqItems) {
      if (this._getItemQty(req.itemId) < req.count) {
        const def = ITEMS[req.itemId];
        UI.toast(`${def?.name || '道具'+req.itemId}不足，需要 ${req.count} 个`, 'warn');
        return false;
      }
    }
    const removedItems = [];
    for (const req of nextRealm.reqItems) {
      const removed = await DB.removeItem(req.itemId, req.count);
      if (!removed) {
        for (const item of removedItems) await DB.addItem(item.itemId, item.count);
        await this.refresh();
        UI.toast('突破材料扣除失败，请重试', 'error');
        return false;
      }
      removedItems.push(req);
    }
    const previousRealmLevel = this.state.realmLevel;
    this.state.realmLevel = nextRealm.level;
    const saved = await DB.updatePlayerState({ realmLevel: this.state.realmLevel });
    if (!saved) {
      this.state.realmLevel = previousRealmLevel;
      for (const item of removedItems) await DB.addItem(item.itemId, item.count);
      await this.refresh();
      UI.toast('突破未完成，材料已返还', 'error');
      return false;
    }
    await this.refresh();
    UI.toast(`恭喜突破到 ${nextRealm.name}！`, 'success');
    return true;
  },

  // 仙树灵阶升级
  async upgradeTreeRealm() {
    const currentTreeRealm = TREE_REALMS.find(r => r.level == this.state.treeRealm) || TREE_REALMS[0];
    const nextTreeRealm = TREE_REALMS.find(r => r.level == this.state.treeRealm + 1);
    if (!nextTreeRealm) {
      UI.toast('仙树已达最高灵阶', 'warn');
      return false;
    }
    // 检查道具
    for (const req of nextTreeRealm.reqItems) {
      if (this._getItemQty(req.itemId) < req.count) {
        const def = ITEMS[req.itemId];
        UI.toast(`${def?.name || '道具'+req.itemId}不足，需要 ${req.count} 个`, 'warn');
        return false;
      }
    }
    const removedItems = [];
    for (const req of nextTreeRealm.reqItems) {
      const removed = await DB.removeItem(req.itemId, req.count);
      if (!removed) {
        for (const item of removedItems) await DB.addItem(item.itemId, item.count);
        await this.refresh();
        UI.toast('升阶材料扣除失败，请重试', 'error');
        return false;
      }
      removedItems.push(req);
    }
    const previousTreeRealm = this.state.treeRealm;
    const previousTreeLevel = this.state.treeLevel;
    this.state.treeRealm = nextTreeRealm.level;
    this.state.treeLevel = nextTreeRealm.treeLevel;
    const saved = await DB.updatePlayerState({
      treeRealm: this.state.treeRealm,
      treeLevel: this.state.treeLevel,
    });
    if (!saved) {
      this.state.treeRealm = previousTreeRealm;
      this.state.treeLevel = previousTreeLevel;
      for (const item of removedItems) await DB.addItem(item.itemId, item.count);
      await this.refresh();
      UI.toast('仙树升阶未完成，材料已返还', 'error');
      return false;
    }
    await this.refresh();
    UI.toast(`仙树升级为 ${nextTreeRealm.name}！`, 'success');
    return true;
  },

  // 锻造
  async forge() {
    const forgeConfig = (GAME_CONFIG?.forgeTable || [])[0];
    if (!forgeConfig) {
      UI.toast('锻造配置缺失', 'warn');
      return null;
    }
    const costItemId = String(forgeConfig.costItemId);
    const costCount = forgeConfig.costCount;
    const costItem = ITEMS[costItemId];
    if (this._getItemQty(costItemId) < costCount) {
      UI.toast(`${costItem?.name || '材料'}不足，需要 ${costCount} 个`, 'warn');
      return null;
    }
    const removed = await DB.removeItem(costItemId, costCount);
    if (!removed) {
      await this.refresh();
      UI.toast('锻铁扣除失败，请重试', 'error');
      return null;
    }

    // 加权随机抽取品质，同品质内均分
    const totalWeight = FORGE_POOL.reduce((sum, p) => sum + p.weight, 0);
    let roll = Math.random() * totalWeight;
    let selectedPool = FORGE_POOL[0];
    for (const pool of FORGE_POOL) {
      roll -= pool.weight;
      if (roll <= 0) { selectedPool = pool; break; }
    }
    const itemId = selectedPool.items[Math.floor(Math.random() * selectedPool.items.length)];
    const axeDef = ITEMS[itemId];
    const granted = await DB.addItem(itemId, 1);
    if (!granted) {
      const restored = await DB.addItem(costItemId, costCount);
      if (!restored) console.error('forge compensation failed:', costItemId, costCount);
      await this.refresh();
      UI.toast('锻造未完成，锻铁已返还', 'error');
      return null;
    }
    await this.refresh();
    return { itemId, quality: selectedPool.quality, item: axeDef };
  },

  // 十连砍：额外奖励由每一次 chop 的累计次数统一判定。
  async chopTen() {
    if (this.state.choppingCount < 10) {
      UI.toast('砍树次数不足10次', 'warn');
      return null;
    }
    const results = [];
    for (let i = 0; i < 10; i++) {
      const item = await this.chop();
      if (item) {
        results.push(item);
        if (item.extraDrop) results.push(item.extraDrop);
      }
    }
    UI.updateHeader();
    return results;
  },

  // 应用仙斧buff（返回修正后的掉落结果）→ 动态读取 skillTable/buffTable
  _applyAxeBuffs(dropItem) {
    const axeDef = ITEMS[this.state.axeId] || ITEMS['51001'];
    if (!axeDef.skillIds || axeDef.skillIds.length === 0) return dropItem;

    for (const skillId of axeDef.skillIds) {
      const skill = getSkillById(skillId);
      if (!skill || !skill.buff) continue;

      if (skill.buffId === 1) {
        // BUFF类型1: 品质掉落倍率
        // buffParams: "qualityId,probabilityCenter,multiplier"
        const parts = skill.buffParams.split(',').map(s => parseFloat(s.trim()));
        const targetQuality = parts[0];
        const probCenter = parts[1];
        const multiplier = parts[2];
        if (dropItem.quality === targetQuality) {
          // 概率中值 ±10 范围随机
          const prob = (probCenter + (Math.random() * 20 - 10)) / 100;
          if (Math.random() < prob) {
            dropItem.quantity *= multiplier;
            const qName = QUALITY[targetQuality]?.name || `品质${targetQuality}`;
            dropItem.buffText = `${qName}×${multiplier}倍！`;
          }
        }
      }
    }
    return dropItem;
  },

  // 返还砍树次数buff（砍树后调用）→ 动态读取 skillTable/buffTable
  _checkRefundBuff() {
    const axeDef = ITEMS[this.state.axeId] || ITEMS['51001'];
    if (!axeDef.skillIds || axeDef.skillIds.length === 0) return 0;

    let totalRefund = 0;
    for (const skillId of axeDef.skillIds) {
      const skill = getSkillById(skillId);
      if (!skill || !skill.buff) continue;

      if (skill.buffId === 2) {
        // BUFF类型2: 返还砍树次数
        // buffParams: "probabilityCenter,refundAmount"
        const parts = skill.buffParams.split(',').map(s => parseFloat(s.trim()));
        const probCenter = parts[0];
        const refundAmount = parts[1];
        // 概率中值 ±5 范围随机
        const prob = (probCenter + (Math.random() * 10 - 5)) / 100;
        if (Math.random() < prob) {
          const refund = Math.round(refundAmount);
          this.state.choppingCount += refund;
          // DB写入由chop()批量处理，此处仅更新本地状态
          totalRefund += refund;
        }
      }
    }
    return totalRefund;
  },
};

/* ================================================================
   Auth
   ================================================================ */
const Auth = {
  currentRole: 'player',

  selectRole(role) {
    this.currentRole = role;
    document.querySelectorAll('.role-card').forEach(el => {
      el.classList.toggle('active', el.dataset.role === role);
    });
  },

  async doLogin() {
    const password = document.getElementById('login-password').value;
    const correctPwd = this.currentRole === 'admin' ? 'admin' : 'player';

    if (password !== correctPwd) {
      UI.toast('道号密码错误', 'error');
      return;
    }

    await Game.init();

    // 玩家端必须初始化成功才能进入
    if (this.currentRole === 'player' && !Game.state) {
      UI.toast('初始化失败，请刷新重试', 'error');
      return;
    }

    if (this.currentRole === 'admin') {
      document.getElementById('login-screen').style.display = 'none';
      document.getElementById('admin-dashboard').style.display = 'flex';
      Router.adminTab('task-manage');
    } else {
      document.getElementById('login-screen').style.display = 'none';
      document.getElementById('player-dashboard').style.display = 'flex';
      UI.updateHeader();
      Router.playerTab('cultivate');
    }
  },

  logout() {
    document.getElementById('player-dashboard').style.display = 'none';
    document.getElementById('admin-dashboard').style.display = 'none';
    document.getElementById('login-screen').style.display = 'flex';
    document.getElementById('login-password').value = '';
  },
};

/* ================================================================
   Router
   ================================================================ */
const Router = {
  currentPlayerTab: 'cultivate',
  currentAdminTab: 'task-manage',

  playerTab(tab) {
    this.currentPlayerTab = tab;
    const dashboard = document.getElementById('player-dashboard');
    if (dashboard) dashboard.dataset.playerScene = tab === 'mail' ? 'tasks' : tab;
    document.querySelectorAll('#player-dashboard .bottom-nav .nav-item').forEach(el => {
      el.classList.toggle('active', el.dataset.tab === tab);
    });
    const main = document.getElementById('player-main');

    switch (tab) {
      case 'cultivate': PlayerView.renderCultivate(); break;
      case 'tasks': PlayerView.renderTasks(); break;
      case 'reward': PlayerView.renderReward(); break;
      case 'mail': PlayerView.renderMail(); break;
    }
  },

  adminTab(tab) {
    this.currentAdminTab = tab;
    document.querySelectorAll('#admin-dashboard .bottom-nav .nav-item').forEach(el => {
      el.classList.toggle('active', el.dataset.tab === tab);
    });
    const main = document.getElementById('admin-main');

    switch (tab) {
      case 'task-manage': AdminView.renderTaskManage(); break;
      case 'review': AdminView.renderReview(); break;
      case 'withdraw': AdminView.renderWithdrawReview(); break;
      case 'player-view': AdminView.renderPlayerView(); break;
      case 'gm': AdminView.renderGM(); break;
    }
  },
};

/* ================================================================
   UI 工具
   ================================================================ */
const UI = {
  updateHeader() {
    if (!Game.state) return;
    // 旧版 header 已移除，这里更新邮件 badge + 游戏币显示 + 成就红点
    this._updateMailBadge();
    this._updateAchBadge();
    const coinEl = document.getElementById('coin-count');
    if (coinEl) coinEl.textContent = Game.state.coin || 0;
  },

  // 轻量更新修仙页面的经验/等级/次数/游戏币显示（不重渲染整个页面）
  _updateCultivateStats() {
    if (!Game.state) return;
    const expMax = getExpForLevel(Game.state.level);
    const realm = REALMS.find(r => r.level == Game.state.realmLevel) || REALMS[0];
    const realmEl = document.querySelector('.status-realm');
    if (realmEl) realmEl.textContent = `${realm.icon} ${Game.state.level}级 · ${realm.name}`;
    const expFill = document.querySelector('.status-exp-fill');
    if (expFill) expFill.style.width = `${Math.min(100, Game.state.exp / expMax * 100)}%`;
    const expText = document.querySelector('.status-exp-text');
    if (expText) expText.textContent = `${Game.state.exp}/${expMax}`;
    const chopBadge = document.querySelector('.chop-count-badge');
    if (chopBadge) chopBadge.textContent = Game.state.choppingCount;
    const coinEl = document.getElementById('coin-count');
    if (coinEl) coinEl.textContent = Game.state.coin || 0;
    const chopBtn = document.getElementById('chop-btn');
    if (chopBtn) chopBtn.disabled = Game.state.choppingCount <= 0;
  },

  _updateAchBadge() {
    const dot = document.getElementById('ach-dot');
    if (!dot) return;
    dot.style.display = Game.hasClaimableAchievements() ? 'inline-block' : 'none';
  },

  async _updateMailBadge() {
    const mails = await DB.getMails();
    const unread = mails.filter(m => !m.isRead || (!m.isClaimed && m.items.length > 0)).length;
    const badge = document.getElementById('mail-badge');
    if (badge) {
      if (unread > 0) {
        badge.style.display = 'inline-block';
        badge.textContent = unread > 99 ? '99+' : unread;
      } else {
        badge.style.display = 'none';
      }
    }
  },

  toast(message, type = 'default') {
    const container = document.getElementById('toast-container');
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = message;
    container.appendChild(el);
    setTimeout(() => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(20px)';
      setTimeout(() => el.remove(), 300);
    }, 2500);
  },

  async runLockedAction(key, control, busyText, action) {
    if (OperationGuard.isActive(key)) return { started: false, value: false };

    const originalHtml = control?.innerHTML;
    const originalDisabled = control?.disabled;
    const originalPointerEvents = control?.style?.pointerEvents;
    if (control) {
      control.disabled = true;
      control.style.pointerEvents = 'none';
      control.setAttribute('aria-busy', 'true');
      if (busyText) control.textContent = busyText;
    }

    try {
      return await OperationGuard.run(key, action);
    } catch (error) {
      console.error(`resource action failed [${key}]:`, error);
      this.toast('操作未完成，请重试', 'error');
      return { started: true, value: false, error };
    } finally {
      if (control?.isConnected) {
        control.disabled = originalDisabled;
        control.style.pointerEvents = originalPointerEvents;
        control.removeAttribute('aria-busy');
        if (busyText) control.innerHTML = originalHtml;
      }
    }
  },

  modal(contentHTML, options = {}) {
    const container = document.getElementById('modal-container');
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal">
        <div class="modal-header">
          <div class="modal-title">${options.title || ''}</div>
          <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">×</button>
        </div>
        <div class="modal-body">${contentHTML}</div>
        ${options.footer || ''}
      </div>
    `;
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.remove();
    });
    container.appendChild(overlay);
    return overlay;
  },

  closeModal(overlay) {
    if (overlay && overlay.parentNode) overlay.remove();
  },

  confirm(message, onConfirm) {
    const overlay = this.modal(`
      <p style="margin-bottom:16px">${message}</p>
    `, {
      title: '确认',
      footer: `<div class="modal-footer">
        <button class="btn btn-outline btn-sm" onclick="this.closest('.modal-overlay').remove()">取消</button>
        <button class="btn btn-primary btn-sm" id="confirm-ok-btn">确定</button>
      </div>`
    });
    overlay.querySelector('#confirm-ok-btn').addEventListener('click', () => {
      this.closeModal(overlay);
      onConfirm();
    });
  },

  // 品质标签
  qualityTag(quality) {
    const q = QUALITY[quality] || QUALITY[1];
    return `<span class="tag" style="background:${q.color}20;color:${q.color}">${q.name}</span>`;
  },

  // 难度标签
  difficultyTag(difficulty) {
    if (!difficulty) return '';
    const d = DIFFICULTY_MAP[difficulty];
    if (!d) return '';
    return `<span class="tag ${d.class}">${d.name}</span>`;
  },

  // 任务类型标签
  taskTypeTag(type) {
    const t = TASK_TYPE_MAP[type];
    if (!t) return '';
    return `<span class="tag ${t.class}">${t.name}</span>`;
  },

  // 状态标签
  statusTag(status) {
    const map = {
      available: ['可领取', 'tag-status-available'],
      pending: ['待审核', 'tag-status-pending'],
      review: ['审核中', 'tag-status-review'],
      done: ['已完成', 'tag-status-done'],
      approved: ['已通过', 'tag-status-approved'],
      rejected: ['已驳回', 'tag-status-rejected'],
    };
    const s = map[status];
    if (!s) return '';
    return `<span class="tag ${s[1]}">${s[0]}</span>`;
  },

  // 掉落物图标 HTML（兼容游戏币/砍树次数/普通道具）
  _dropIconHtml(item) {
    if (item.kind === 'coin') return renderItemIcon('0', '🪙');
    if (item.kind === 'chopping') return renderItemIcon('1', '🪓');
    return renderItemIcon(item.itemId, item.item?.icon || '🎁');
  },

  // 播放掉落动画
  playDropAnimation(item, treeElement) {
    const container = document.getElementById('floating-items-container');
    const el = document.createElement('div');
    el.className = 'falling-item';
    el.innerHTML = this._dropIconHtml(item);

    const treeRect = treeElement.getBoundingClientRect();
    const startX = treeRect.left + treeRect.width / 2 - 18;
    const startY = treeRect.top + treeRect.height / 3;

    el.style.left = startX + 'px';
    el.style.top = startY + 'px';
    el.style.animation = `fall-down 1.2s ease-out forwards`;

    container.appendChild(el);
    setTimeout(() => el.remove(), 1200);
  },

  playScatterAnimation(item, treeElement, index) {
    const container = document.getElementById('floating-items-container');
    const el = document.createElement('div');
    el.className = 'scatter-item';
    el.innerHTML = this._dropIconHtml(item);

    const treeRect = treeElement.getBoundingClientRect();
    const startX = treeRect.left + treeRect.width / 2 - 16;
    const startY = treeRect.top + treeRect.height / 3;

    // 随机散落位置：以树底部为中心，左右散开
    const sceneRect = treeElement.parentElement.getBoundingClientRect();
    const groundY = sceneRect.bottom - 30;
    const scatterRange = 100;
    const offsetX = (Math.random() - 0.5) * scatterRange * 2;
    const offsetY = groundY - startY + (Math.random() * 10);

    el.style.left = startX + 'px';
    el.style.top = startY + 'px';
    el.style.zIndex = 400 + index;

    container.appendChild(el);

    // 下一帧开始动画
    requestAnimationFrame(() => {
      el.style.transform = `translate(${offsetX}px, ${offsetY}px) rotate(${(Math.random() - 0.5) * 30}deg)`;
      el.classList.add('scatter-landed');
    });

    return el;
  },
};

/* ================================================================
   玩家视图
   ================================================================ */
const PlayerView = {
  // --- 修仙主页 ---
  _tenChopMode: false,

  async renderCultivate() {
    const main = document.getElementById('player-main');
    const treeConfig = TREE_LEVELS[Game.state.treeLevel] || TREE_LEVELS[1];
    const treeRealm = TREE_REALMS.find(r => r.level == Game.state.treeRealm) || TREE_REALMS[0];
    const realm = REALMS.find(r => r.level == Game.state.realmLevel) || REALMS[0];
    const nextRealm = REALMS.find(r => r.level == Game.state.realmLevel + 1);
    const nextTreeRealm = TREE_REALMS.find(r => r.level == Game.state.treeRealm + 1);
    const axeDef = ITEMS[Game.state.axeId] || ITEMS['51001'];
    const forgeStoneQty = Game.inventory.find(i => i.itemId == '40001')?.quantity || 0;
    const expMax = getExpForLevel(Game.state.level);

    // 仙树插画映射（按树等级分3档）
    const treeImg = getTreeImage(Game.state.treeLevel);

    main.innerHTML = `
      <!-- ⓪ 顶栏：邮件 / 成就 / 金币 -->
      <div class="cult-topbar">
        <div class="topbar-left">
          <div class="status-mail" onclick="PlayerView.showMailModal()">
            ${renderFeatureIcon('icon-mail', '邮件', 'topbar-feature-icon')}
            <span class="mail-badge" id="mail-badge" style="display:none">0</span>
          </div>
          <div class="status-mail" onclick="PlayerView.showAchievements()" title="成就">
            ${renderFeatureIcon('icon-achievement', '成就', 'topbar-feature-icon')}
            <span class="ach-dot" id="ach-dot" style="display:none"></span>
          </div>
        </div>
        <div class="res-pill res-coin" id="coin-pill" title="游戏币 · 可在「天道酬勤」商店购买道具，砍树/出售仙斧可获得">
          <span class="res-icon">${renderItemIcon('0', '🪙', 'res-coin-img')}</span><span class="res-val" id="coin-count">${Game.state.coin || 0}</span>
        </div>
      </div>

      <!-- ① 场景区：人物 + 仙树 -->
      <div class="cult-scene" id="tree-area">
        <div class="cult-char">
          <img id="cultivator-sprite" src="assets/images/character/idle/frame-01.png" class="char-img" alt="修炼者" />
        </div>
        <div class="cult-tree" id="tree-icon" onclick="PlayerView.showTreeDetail()">
          <img src="${treeImg}" class="tree-img" alt="${treeConfig.name}" />
          <div class="tree-label">${treeConfig.name}</div>
        </div>
      </div>

      <!-- ② 状态栏：等级·仙阶 + 经验条 / 突破 -->
      <div class="cult-status">
        <div class="status-center">
          <div class="status-realm">${realm.icon} ${Game.state.level}级 · ${realm.name}</div>
          <div class="status-exp-row">
            <div class="status-exp-bar"><div class="status-exp-fill" style="width:${Math.min(100, Game.state.exp / expMax * 100)}%"></div></div>
            <span class="status-exp-text">${Game.state.exp}/${expMax}</span>
          </div>
        </div>
        ${nextRealm ? `
          <button class="btn btn-accent btn-sm" onclick="PlayerView.showBreakThrough()">${renderFeatureIcon('icon-breakthrough', '', 'button-feature-icon')}突破</button>
        ` : '<span class="tag" style="background:var(--quality-5)20;color:var(--quality-5)">已满阶</span>'}
      </div>

      <!-- ③ 背包区（页签在右侧） -->
      <div class="cult-inventory">
        <div class="inventory-grid" id="inventory-grid"></div>
        <div class="inv-tabs-v">
          <div class="inv-tab-v active" data-tab="items" onclick="PlayerView.switchInvTab('items')">道具</div>
          <div class="inv-tab-v" data-tab="weapons" onclick="PlayerView.switchInvTab('weapons')">武器</div>
        </div>
      </div>

      <!-- ④ 操作区：砍树按钮 + 十连勾选 -->
      <div class="cult-action">
        <div class="action-chop-area">
          <button class="chop-circle-btn" id="chop-btn" onclick="PlayerView.doChop()" ${Game.state.choppingCount <= 0 ? 'disabled' : ''}>
            <span class="chop-axe-icon">${renderItemIcon(Game.state.axeId, axeDef.icon, 'chop-axe-img')}</span>
          </button>
          <span class="chop-count-badge">${Game.state.choppingCount}</span>
          <label class="ten-toggle ${Game.state.choppingCount < 10 ? 'unavailable' : ''}">
            <input type="checkbox" id="ten-chop-toggle" ${this._tenChopMode ? 'checked' : ''} onchange="PlayerView.toggleTenChop(this.checked)" />
            <span class="ten-toggle-label">十连砍</span>
          </label>
        </div>
      </div>

      <!-- 装备信息 + 锻造按钮 -->
      <div class="equip-info-bar">
        <span class="equip-icon">${renderItemIcon(Game.state.axeId, axeDef.icon, 'equip-axe-img')}</span>
        <div class="equip-detail">
          <div class="equip-name-row">
            <span class="equip-name">${axeDef.name}</span>
            ${UI.qualityTag(axeDef.quality)}
          </div>
          ${axeDef.skillDesc ? `<div class="equip-skill">🌟 ${axeDef.skillDesc}</div>` : ''}
        </div>
        <button class="forge-btn" onclick="PlayerView.showForge()">
          <span class="forge-btn-icon">${renderFeatureIcon('icon-forge', '锻造', 'forge-feature-icon')}</span>
          <span class="forge-btn-stone">🔩${forgeStoneQty}</span>
        </button>
      </div>
    `;

    CultivatorAnimator.attach(document.getElementById('cultivator-sprite'));
    this.renderInventory('items');
    UI._updateMailBadge();
  },

  toggleTenChop(checked) {
    if (checked && Game.state.choppingCount < 10) {
      UI.toast('砍树次数不足10次，无法开启十连砍', 'warn');
      this._tenChopMode = false;
      const cb = document.getElementById('ten-chop-toggle');
      if (cb) cb.checked = false;
      return;
    }
    this._tenChopMode = checked;
  },

  showTreeDetail() {
    const treeConfig = TREE_LEVELS[Game.state.treeLevel] || TREE_LEVELS[1];
    const treeImg = getTreeImage(Game.state.treeLevel);
    const treeRealm = TREE_REALMS.find(r => r.level == Game.state.treeRealm) || TREE_REALMS[0];
    const nextTreeRealm = TREE_REALMS.find(r => r.level == Game.state.treeRealm + 1);
    const nextTreeConfig = nextTreeRealm ? (TREE_LEVELS[nextTreeRealm.treeLevel] || null) : null;

    // 计算当前各品质概率（总权重1000，转百分比）
    const curWeights = treeConfig.qualityWeights || [0, 0, 0, 0, 0];
    const curTotal = curWeights.reduce((a, b) => a + b, 0) || 1000;
    const nextWeights = nextTreeConfig ? (nextTreeConfig.qualityWeights || [0, 0, 0, 0, 0]) : null;
    const nextTotal = nextWeights ? (nextWeights.reduce((a, b) => a + b, 0) || 1000) : 0;

    // 构建品质概率行
    const qualityRows = [];
    for (let q = 1; q <= 5; q++) {
      const qInfo = QUALITY[q] || { name: `品质${q}`, color: '#999' };
      const curPct = curWeights[q - 1] / curTotal * 100;
      let nextPct = null;
      let arrow = '';
      if (nextWeights) {
        nextPct = nextWeights[q - 1] / nextTotal * 100;
        const diff = nextPct - curPct;
        if (Math.abs(diff) < 0.01) {
          arrow = '<span style="color:var(--text-secondary)">—</span>';
        } else if (diff > 0) {
          arrow = `<span style="color:var(--success)">↑</span>`;
        } else {
          arrow = `<span style="color:var(--error)">↓</span>`;
        }
      }
      qualityRows.push(`
        <div style="display:flex;align-items:center;padding:6px 0">
          <div style="width:60px;text-align:right">
            <span style="display:inline-block;padding:2px 8px;border-radius:10px;font-size:12px;background:${qInfo.color}20;color:${qInfo.color}">${qInfo.name}</span>
          </div>
          <div style="flex:1;text-align:center;font-weight:600;font-size:16px">${curPct.toFixed(1)}%</div>
          <div style="width:40px;text-align:center;font-size:20px">${nextWeights ? '➡' : ''}</div>
          <div style="flex:1;text-align:center;font-weight:600;font-size:16px;display:flex;align-items:center;justify-content:center;gap:4px">
            ${nextWeights ? `${nextPct.toFixed(1)}% ${arrow}` : '—'}
          </div>
        </div>
      `);
    }

    // 升阶消耗
    let costHtml = '';
    let canUpgrade = false;
    if (nextTreeRealm && nextTreeRealm.reqItems && nextTreeRealm.reqItems.length > 0) {
      canUpgrade = nextTreeRealm.reqItems.every(req =>
        (Game.inventory.find(i => i.itemId == req.itemId)?.quantity || 0) >= req.count
      );
      costHtml = nextTreeRealm.reqItems.map(req => {
        const def = ITEMS[req.itemId];
        const have = Game.inventory.find(i => i.itemId == req.itemId)?.quantity || 0;
        const ok = have >= req.count;
        return `<div style="display:flex;align-items:center;gap:8px;justify-content:center;padding:4px 0">
          <span style="display:inline-flex;align-items:center">${renderItemIcon(req.itemId, def?.icon, 'item-icon-xs')}</span>
          <span>${def?.name || req.itemId}</span>
          <span style="color:${ok ? 'var(--success)' : 'var(--error)'};font-weight:600">${have}/${req.count}</span>
        </div>`;
      }).join('');
    }

    UI.modal(`
      <div style="text-align:center;margin-bottom:20px">
        <img src="${treeImg}" class="tree-detail-img" alt="${treeConfig.name}" />
        <div style="font-size:20px;font-weight:700">${treeConfig.name}</div>
      </div>
      <div style="display:flex;margin-bottom:8px">
        <div style="flex:1;text-align:center;font-size:14px;font-weight:600;color:var(--text-secondary)">当前</div>
        <div style="width:40px"></div>
        <div style="flex:1;text-align:center;font-size:14px;font-weight:600;color:var(--text-secondary)">下一级</div>
      </div>
      <div style="background:var(--bg-secondary);border-radius:12px;padding:8px 12px;margin-bottom:16px">
        ${qualityRows.join('')}
      </div>
      ${nextTreeRealm ? `
        <div style="margin-bottom:8px">
          ${costHtml}
        </div>
      ` : '<div style="text-align:center;color:var(--text-secondary);padding:12px">已达到最高灵阶</div>'}
    `, {
      title: '🌳 仙树详情',
      footer: nextTreeRealm ? `<div class="modal-footer">
        <button class="btn btn-outline btn-sm" onclick="this.closest('.modal-overlay').remove()">关闭</button>
        <button class="btn btn-primary btn-sm" id="tree-upgrade-btn" ${canUpgrade ? '' : 'disabled'}>升阶</button>
      </div>` : `<div class="modal-footer">
        <button class="btn btn-outline btn-sm" onclick="this.closest('.modal-overlay').remove()">关闭</button>
      </div>`
    });

    const upgradeBtn = document.getElementById('tree-upgrade-btn');
    if (upgradeBtn) {
      upgradeBtn.addEventListener('click', async () => {
        upgradeBtn.disabled = true;
        const ok = await Game.upgradeTreeRealm();
        if (ok) {
          document.querySelector('.modal-overlay')?.remove();
          PlayerView.renderCultivate();
        } else {
          upgradeBtn.disabled = false;
        }
      });
    }
  },

  currentInvTab: 'items',

  switchInvTab(tab) {
    this.currentInvTab = tab;
    document.querySelectorAll('.inv-tab-v').forEach(el => {
      el.classList.toggle('active', el.dataset.tab === tab);
    });
    this.renderInventory(tab);
  },

  renderInventory(tab) {
    const grid = document.getElementById('inventory-grid');
    if (!grid) return;

    const isWeapons = tab === 'weapons';
    // 武器 tab 整个 grid 进入竖格模式（含空槽位），道具 tab 保持方格
    grid.classList.toggle('weapons-grid', isWeapons);

    const items = Game.inventory.filter(inv => {
      const def = ITEMS[inv.itemId];
      if (!def) return false;
      if (isWeapons) return def.type === 5;
      return def.type >= 1 && def.type <= 4;
    });

    // 已占用格子数：道具每种占1格（数量显示角标），武器每把占1格
    const filledSlots = isWeapons
      ? items.reduce((sum, inv) => sum + inv.quantity, 0)
      : items.length;
    // 填充空槽位（至少 20 格）
    const slots = Math.max(20, filledSlots);
    let html = '';

    items.forEach(inv => {
      const def = ITEMS[inv.itemId];
      if (!def) return;
      if (def.type === 5) {
        // 武器：每把占一个格子，不显示数量
        // 注：装备中的斧子已从背包扣除（手持状态，显示在砍树按钮/装备栏），
        // 背包里的都是备用斧子，因此不标记“装备中”，避免同种斧子全部误亮
        const axeLocked = !canEquipAxeQuality(def.quality, Game.state.realmLevel);
        for (let i = 0; i < inv.quantity; i++) {
          html += `
            <div class="item-slot weapon-slot quality-${def.quality} ${axeLocked ? 'item-locked' : ''}" onclick="PlayerView.showItemDetail('${inv.itemId}')">
              <div class="item-icon">${renderItemIcon(inv.itemId, def.icon)}</div>
              ${axeLocked ? '<div class="item-lock-badge">🔒</div>' : ''}
            </div>
          `;
        }
      } else {
        html += `
          <div class="item-slot quality-${def.quality}" onclick="PlayerView.showItemDetail('${inv.itemId}')">
            <div class="item-icon">${renderItemIcon(inv.itemId, def.icon)}</div>
            <div class="item-count">${inv.quantity}</div>
          </div>
        `;
      }
    });

    // 空槽位（武器 tab 用竖格保持行高一致）
    for (let i = filledSlots; i < slots; i++) {
      html += `<div class="item-slot empty${isWeapons ? ' weapon-slot' : ''}"></div>`;
    }

    grid.innerHTML = html;
  },

  showItemDetail(itemId) {
    const def = ITEMS[itemId];
    if (!def) return;
    const qty = Game._getItemQty(itemId);
    const q = QUALITY[def.quality];

    // 仙斧专属：仙阶限制
    let axeRealmHtml = '';
    let axeLocked = false;
    if (def.type === 5) {
      const minRealm = getMinRealmForAxeQuality(def.quality);
      const canEquip = canEquipAxeQuality(def.quality, Game.state.realmLevel);
      axeLocked = !canEquip;
      const curRealm = REALMS.find(r => r.level == Game.state.realmLevel) || REALMS[0];
      axeRealmHtml = `
        <div style="background:${canEquip ? 'var(--success)' : 'var(--error)'}15;border:1px solid ${canEquip ? 'var(--success)' : 'var(--error)'}40;border-radius:8px;padding:8px 12px;margin-bottom:12px;font-size:13px;display:flex;align-items:center;gap:8px;justify-content:center">
          <span>${canEquip ? '✅' : '🔒'}</span>
          <span style="color:${canEquip ? 'var(--success)' : 'var(--error)'}">
            适配仙阶：<b>${minRealm?.name || '?'}</b>及以上
            ${canEquip ? '' : `（当前：${curRealm.name}）`}
          </span>
        </div>
      `;
    }

    let actionBtn = '';
    if (def.type === 1) {
      actionBtn = `<button class="btn btn-primary btn-sm" onclick="PlayerView.composeItem('${itemId}')">合成 (${qty}/${def.composeCount})</button>`;
    } else if (def.type === 2) {
      actionBtn = `<button class="btn btn-primary btn-sm" onclick="PlayerView.cashItem('${itemId}')">提现 ¥${def.value}</button>`;
    } else if (def.type === 5) {
      if (axeLocked) {
        actionBtn = `
          <button class="btn btn-outline btn-sm" disabled style="opacity:0.5">🔒 仙阶不足</button>
          <button class="btn btn-outline btn-sm" onclick="PlayerView.sellItem('${itemId}',this)">出售 +${renderItemIcon('0', '🪙', 'item-icon-xs')} ${def.sellPrice}</button>
        `;
      } else {
        actionBtn = `
          <button class="btn btn-primary btn-sm" onclick="PlayerView.equipItem('${itemId}',this)">装备</button>
          <button class="btn btn-outline btn-sm" onclick="PlayerView.sellItem('${itemId}',this)">出售 +${renderItemIcon('0', '🪙', 'item-icon-xs')} ${def.sellPrice}</button>
        `;
      }
    }

    UI.modal(`
      <div style="text-align:center;margin-bottom:16px">
        <div style="font-size:60px;margin-bottom:8px;position:relative;display:inline-block">
          ${renderItemIcon(itemId, def.icon, 'item-icon-lg')}
          ${axeLocked ? '<span style="position:absolute;top:-4px;right:-16px;font-size:24px">🔒</span>' : ''}
        </div>
        <div style="font-size:18px;font-weight:700">${def.name}</div>
        <div style="margin-top:4px"><span class="tag" style="background:${q.color}20;color:${q.color}">${q.name}</span></div>
        <div style="margin-top:8px;font-size:13px;color:var(--text-secondary)">数量：${qty}</div>
      </div>
      ${axeRealmHtml}
      <p style="font-size:13px;color:var(--text-secondary);text-align:center;margin-bottom:16px">${def.desc || ''}</p>
      ${def.skillDesc ? `<p style="font-size:12px;color:var(--accent);text-align:center;margin-bottom:16px">🌟 ${def.skillDesc}</p>` : ''}
      <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap">
        ${actionBtn}
      </div>
    `, { title: '物品详情' });
  },

  composeItem(itemId) {
    const def = ITEMS[itemId];
    const have = Game._getItemQty(itemId);
    const need = def.composeCount || 1;
    const maxCompose = Math.floor(have / need);
    if (maxCompose < 1) {
      UI.toast(`需要 ${need} 个才能合成`, 'warn');
      return;
    }
    const targetDef = ITEMS[def.composeTo];
    const max = Math.min(maxCompose, 99);

    UI.modal(`
      <div style="text-align:center;margin-bottom:16px">
        <div style="font-size:48px;margin-bottom:4px;display:flex;justify-content:center">${renderItemIcon(itemId, def.icon, 'item-icon-lg')}</div>
        <div style="font-size:14px;color:var(--text-secondary)">${def.name}</div>
        <div style="margin:4px 0;font-size:20px">⬇️</div>
        <div style="font-size:48px;margin-bottom:4px;display:flex;justify-content:center">${renderItemIcon(def.composeTo, targetDef?.icon, 'item-icon-lg')}</div>
        <div style="font-size:16px;font-weight:700">${targetDef?.name || '?'}</div>
      </div>
      <div style="text-align:center;font-size:13px;color:var(--text-secondary);margin-bottom:16px">
        每次消耗 ${need} 个 · 可合成 ${maxCompose} 次
      </div>
      <div style="display:flex;align-items:center;justify-content:center;gap:12px;margin-bottom:16px">
        <button class="btn btn-outline btn-sm" onclick="this.parentNode.querySelector('.qty-input').stepDown()" style="font-size:18px;padding:4px 12px">−</button>
        <input type="number" class="qty-input" min="1" max="${max}" value="1" style="width:60px;text-align:center;font-size:18px;border:1px solid var(--border);border-radius:6px;padding:4px" oninput="document.getElementById('compose-cost').textContent=this.value*${need}+'个'" />
        <button class="btn btn-outline btn-sm" onclick="this.parentNode.querySelector('.qty-input').stepUp()" style="font-size:18px;padding:4px 12px">+</button>
        <button class="btn btn-outline btn-sm" onclick="const i=this.parentNode.querySelector('.qty-input');i.value=${max};document.getElementById('compose-cost').textContent=${max}*${need}+'个'" style="font-size:12px">全部</button>
      </div>
      <div style="text-align:center;margin-bottom:16px">
        <div style="font-size:13px;color:var(--text-secondary)">消耗 ${def.name}：<span id="compose-cost">${need}个</span></div>
      </div>
      <button class="btn btn-primary btn-block" onclick="
        const q=parseInt(this.parentNode.querySelector('.qty-input').value)||1;
        PlayerView._doCompose('${itemId}',q,this);
      ">确认合成</button>
    `, { title: '合成' });
  },

  async _doCompose(itemId, qty, button) {
    const operationKey = `compose:${itemId}`;
    if (OperationGuard.isActive(operationKey)) return;

    const originalText = button?.textContent || '确认合成';
    if (button) {
      button.disabled = true;
      button.textContent = '合成中...';
    }

    try {
      const outcome = await OperationGuard.run(
        operationKey,
        () => Game.composeMulti(itemId, qty),
      );
      if (outcome.started && outcome.value) {
        this.renderInventory(this.currentInvTab);
        document.querySelectorAll('.modal-overlay').forEach(el => el.remove());
      }
    } catch (error) {
      console.error('compose action error:', error);
      UI.toast('合成未完成，请重试', 'error');
    } finally {
      if (button?.isConnected) {
        button.disabled = false;
        button.textContent = originalText;
      }
    }
  },

  cashItem(itemId) {
    const def = ITEMS[itemId];
    const have = Game._getItemQty(itemId);
    const max = Math.min(have, 99);
    if (max < 1) { UI.toast('数量不足', 'warn'); return; }

    let qty = 1;
    UI.modal(`
      <div style="text-align:center;margin-bottom:16px">
        <div style="font-size:48px;margin-bottom:8px;display:flex;justify-content:center">${renderItemIcon(itemId, def.icon, 'item-icon-lg')}</div>
        <div style="font-size:16px;font-weight:700">${def.name}</div>
        <div style="font-size:13px;color:var(--text-secondary);margin-top:4px">持有 ${have} 个 · 每个 ¥${def.value}</div>
      </div>
      <div style="display:flex;align-items:center;justify-content:center;gap:12px;margin-bottom:16px">
        <button class="btn btn-outline btn-sm" onclick="this.parentNode.querySelector('.qty-input').stepDown()" style="font-size:18px;padding:4px 12px">−</button>
        <input type="number" class="qty-input" min="1" max="${max}" value="1" style="width:60px;text-align:center;font-size:18px;border:1px solid var(--border);border-radius:6px;padding:4px" oninput="document.getElementById('cash-total').textContent='¥'+(this.value*${def.value}).toFixed(2)" />
        <button class="btn btn-outline btn-sm" onclick="this.parentNode.querySelector('.qty-input').stepUp()" style="font-size:18px;padding:4px 12px">+</button>
        <button class="btn btn-outline btn-sm" onclick="const i=this.parentNode.querySelector('.qty-input');i.value=${max};document.getElementById('cash-total').textContent='¥'+(${max}*${def.value}).toFixed(2)" style="font-size:12px">全部</button>
      </div>
      <div style="text-align:center;margin-bottom:16px">
        <div style="font-size:13px;color:var(--text-secondary)">提现金额</div>
        <div id="cash-total" style="font-size:24px;font-weight:700;color:var(--success)">¥${def.value.toFixed(2)}</div>
      </div>
      <button class="btn btn-primary btn-block" onclick="
        const q=parseInt(this.parentNode.querySelector('.qty-input').value)||1;
        PlayerView._doCash('${itemId}',q,this);
      ">确认提现</button>
    `, { title: '提现' });
  },

  async _doCash(itemId, qty, button) {
    const def = ITEMS[itemId];
    if (!def) return false;
    const cashQty = Math.max(1, parseInt(qty) || 1);
    const outcome = await UI.runLockedAction(
      `cash:${itemId}`,
      button,
      '处理中...',
      async () => {
        const removed = await DB.removeItem(itemId, cashQty);
        if (!removed) {
          Game.inventory = await DB.getInventory();
          UI.toast('数量不足，背包已刷新', 'warn');
          return false;
        }

        const previousBalance = Game.state.balance;
        const total = def.value * cashQty;
        Game.state.balance += total;
        const saved = await DB.updatePlayerState({ balance: Game.state.balance });
        if (!saved) {
          Game.state.balance = previousBalance;
          await DB.addItem(itemId, cashQty);
          await Game.refresh();
          return false;
        }

        Game._setInventoryQuantity(itemId, Game._getItemQty(itemId) - cashQty);
        this.renderInventory(this.currentInvTab);
        UI.toast(`到账 ¥${total.toFixed(2)}`, 'success');
        document.querySelector('.modal-overlay')?.remove();
        return true;
      },
    );
    return outcome.started && outcome.value;
  },

  async equipItem(itemId, button) {
    const operationKey = 'equip-axe';
    if (OperationGuard.isActive(operationKey)) return;
    const originalHtml = button?.innerHTML;
    if (button) {
      button.disabled = true;
      button.textContent = '装备中...';
    }
    try {
      const outcome = await OperationGuard.run(operationKey, () => Game.equipAxe(itemId));
      if (outcome.started && outcome.value) {
        this.renderInventory(this.currentInvTab);
        document.querySelector('.modal-overlay')?.remove();
        this.renderCultivate();
      }
    } catch (error) {
      console.error('equipItem action error:', error);
      UI.toast('装备失败，请重试', 'error');
    } finally {
      if (button?.isConnected) {
        button.disabled = false;
        button.innerHTML = originalHtml;
      }
    }
  },

  // 锻造结果页直接装备
  async _equipFromForge(itemId, button) {
    const operationKey = 'equip-axe';
    if (OperationGuard.isActive(operationKey)) return;
    const originalText = button?.textContent || '立即装备';
    if (button) {
      button.disabled = true;
      button.textContent = '装备中...';
    }
    try {
      const outcome = await OperationGuard.run(operationKey, () => Game.equipAxe(itemId));
      if (outcome.started && outcome.value) {
        document.querySelectorAll('.modal-overlay').forEach(el => el.remove());
        this.renderInventory('weapons');
        this.renderCultivate();
      }
    } finally {
      if (button?.isConnected) {
        button.disabled = false;
        button.textContent = originalText;
      }
    }
  },

  sellItem(itemId, button) {
    const def = ITEMS[itemId];
    UI.confirm(`确定出售 ${def.name}，获得 ${def.sellPrice} 游戏币？`, async () => {
      const operationKey = `sell-axe:${itemId}`;
      if (OperationGuard.isActive(operationKey)) return;
      const originalHtml = button?.innerHTML;
      if (button?.isConnected) {
        button.disabled = true;
        button.textContent = '出售中...';
      }
      try {
        const outcome = await OperationGuard.run(operationKey, () => Game.sellAxe(itemId));
        if (outcome.started && outcome.value) {
          this.renderInventory(this.currentInvTab);
          document.querySelector('.modal-overlay')?.remove();
          this.renderCultivate();
        } else if (outcome.started) {
          UI.toast('出售失败，背包数量已刷新', 'error');
        }
      } catch (error) {
        console.error('sellItem action error:', error);
        UI.toast('出售失败，请重试', 'error');
      } finally {
        if (button?.isConnected) {
          button.disabled = false;
          button.innerHTML = originalHtml;
        }
      }
    });
  },

  async doChop() {
    // 十连砍模式
    if (this._tenChopMode) {
      return this.doChopTen();
    }

    if (Game.state.choppingCount <= 0) {
      UI.toast('没有砍树次数了', 'warn');
      return;
    }

    const treeIcon = document.getElementById('tree-icon');
    const scene = document.getElementById('tree-area');
    const chopBtn = document.getElementById('chop-btn');
    const outcome = await UI.runLockedAction('chop', chopBtn, '', async () => {
      const characterAnimation = CultivatorAnimator.playChop();
      CultivationEffects.playHit({ scene, tree: treeIcon, intensity: 1 });
      if (treeIcon) {
        treeIcon.classList.add('shaking');
        setTimeout(() => treeIcon.classList.remove('shaking'), 300);
      }

      try {
        const item = await Game.chop();
        await characterAnimation;
        if (item) {
          if (treeIcon) UI.playDropAnimation(item, treeIcon);

          if (item.extraDrop && treeIcon) {
            setTimeout(() => UI.playDropAnimation(item.extraDrop, treeIcon), 180);
          }

          setTimeout(() => {
            this._showRewardModal(item);
          }, 800);
        }

        this.renderCultivate();
        return Boolean(item);
      } catch (e) {
        console.error('doChop error:', e);
        UI.toast('砍树失败，请重试', 'error');
        return false;
      }
    });
    return outcome.started && outcome.value;
  },

  _showRewardModal(item) {
    const buffHtml = item.buffText
      ? `<div style="color:var(--quality-4);font-size:14px;font-weight:600;margin-bottom:8px">🌟 ${item.buffText}</div>`
      : '';
    const refundHtml = item.refundChopping
      ? `<div style="color:var(--accent);font-size:13px;margin-bottom:8px">🪓 返还 ${item.refundChopping} 次砍树</div>`
      : '';
    const extraHtml = item.extraDrop ? `
      <div class="bonus-drop-row">
        <span class="bonus-drop-label">第十砍额外奖励</span>
        ${renderItemIcon(item.extraDrop.itemId, item.extraDrop.item?.icon, 'item-icon-sm')}
        <span>${item.extraDrop.item?.name || '道具'} ×${item.extraDrop.quantity}</span>
      </div>` : '';

    // 特殊道具（游戏币/砍树次数）单独展示
    let icon, name, color, label;
    if (item.kind === 'coin') {
      icon = renderItemIcon('0', '🪙', 'item-icon-lg'); name = '游戏币'; color = '#d4af37';
      label = `货币 · 获得 ×${item.quantity}`;
    } else if (item.kind === 'chopping') {
      icon = renderItemIcon('1', '🪓', 'item-icon-lg'); name = '砍树次数'; color = '#4a90d9';
      label = `体力 · 获得 ×${item.quantity}`;
    } else {
      const q = QUALITY[item.quality] || { name: '', color: '#9e9e9e' };
      icon = item.item ? renderItemIcon(item.itemId, item.item.icon, 'item-icon-lg') : '🎁';
      name = item.item ? item.item.name : '道具';
      color = q.color;
      label = `${q.name} · 获得 ×${item.quantity}`;
    }

    UI.modal(`
      <div class="reward-modal">
        <div class="reward-icon">${icon}</div>
        <div class="reward-name" style="color:${color}">${name}</div>
        <div class="reward-quality">${label}</div>
        ${buffHtml}
        ${refundHtml}
        ${extraHtml}
        <button class="btn btn-primary btn-block" onclick="this.closest('.modal-overlay').remove()">收下</button>
      </div>
    `, { title: '🎉 获得物品' });
  },

  // --- 任务页 ---
  async renderTasks() {
    const main = document.getElementById('player-main');
    const [dailyTasks, weeklyTasks, themeTasks, submissions] = await Promise.all([
      DB.getTasks('daily'),
      DB.getTasks('weekly'),
      DB.getTasks('theme'),
      DB.getSubmissions(),
    ]);

    // 检查今日是否已签到（本地日期，与 dailyCheckIn 保持一致）
    const today = localDateStr();
    const dailyChecked = Game.state.lastDailyDate === today;

    // 数据去重：飞书/后台可能误插入重复任务（同类型+同标题+同排序），玩家侧只展示一条
    this._dailyTasks = this._dedupeTasks(dailyTasks, submissions, 'daily');
    this._weeklyTasks = this._dedupeTasks(weeklyTasks, submissions, 'weekly');
    this._themeTasks = this._dedupeTasks(themeTasks, submissions, 'theme');
    this._submissions = submissions;
    this._dailyChecked = dailyChecked;

    main.innerHTML = `
      <div class="page-title page-title-art">${renderFeatureIcon('icon-tasks', '', 'page-title-icon')}<span>任务</span></div>
      <div class="page-subtitle">完成任务获得砍树次数，砍树掉落奖励</div>

      <div id="theme-section">${this._themeSectionHtml()}</div>

      <div class="filter-bar">
        <div class="filter-chip active" data-filter="all" onclick="PlayerView.filterTasks('all')">全部</div>
        <div class="filter-chip" data-filter="daily" onclick="PlayerView.filterTasks('daily')">每日</div>
        <div class="filter-chip" data-filter="weekly" onclick="PlayerView.filterTasks('weekly')">每周</div>
        <div class="filter-chip" data-filter="self" onclick="PlayerView.filterTasks('self')">自主申报</div>
      </div>

      <div id="task-list"></div>

      <button class="btn btn-outline btn-block" style="margin-top:16px" onclick="PlayerView.showSelfSubmit()">
        ✍️ 自主申报任务
      </button>
    `;

    this.currentTaskFilter = 'all';

    this._renderTaskList();
  },

  currentTaskFilter: 'all',
  _dailyTasks: [],
  _weeklyTasks: [],
  _themeTasks: [],
  _submissions: [],
  _dailyChecked: false,

  // 计算当前进行中的主题活动：今天落在 [start, end] 区间内的主题；
  // 多个重叠时取开始时间最新的一个；无则返回 null（前端显示“尽情期待”）。
  _getActiveTheme() {
    const today = localDateStr();
    const groups = new Map();
    this._themeTasks.forEach(t => {
      if (!t.themeName) return;
      if (!groups.has(t.themeName)) {
        groups.set(t.themeName, { name: t.themeName, start: t.themeStart, end: t.themeEnd, tasks: [] });
      }
      const g = groups.get(t.themeName);
      g.tasks.push(t);
      // 同一主题内取最宽的时间区间，避免单条任务时间不一致
      if (t.themeStart && (!g.start || t.themeStart < g.start)) g.start = t.themeStart;
      if (t.themeEnd && (!g.end || t.themeEnd > g.end)) g.end = t.themeEnd;
    });

    let active = null;
    groups.forEach(g => {
      const started = !g.start || today >= g.start;
      const notEnded = !g.end || today <= g.end;
      if (started && notEnded) {
        if (!active || (g.start && (!active.start || g.start > active.start))) active = g;
      }
    });
    return active;
  },

  // 主题活动区：进行中 → 活动卡片（含系列任务）；否则 → 尽情期待占位
  _themeSectionHtml() {
    const theme = this._getActiveTheme();
    if (!theme) {
      return `
        <div class="theme-card">
          <div class="theme-soon">
            <span class="soon-emoji">🎨</span>
            <div class="soon-title">主题活动 · 尽情期待</div>
            <div class="soon-sub">下一期主题活动正在筹备中，敬请期待～</div>
          </div>
        </div>
      `;
    }

    const submissions = this._submissions || [];
    const rangeText = (theme.start && theme.end)
      ? `${theme.start.replace(/-/g, '.')} - ${theme.end.replace(/-/g, '.')}`
      : '限时活动';

    // 剩余天数（结束日当天也算）
    let countdown = '';
    if (theme.end) {
      const today = new Date(localDateStr() + 'T00:00:00');
      const end = new Date(theme.end + 'T00:00:00');
      const days = Math.round((end - today) / 86400000) + 1;
      countdown = days > 1 ? `剩 ${days} 天` : (days === 1 ? '今日结束' : '已结束');
    }

    let tasksHtml = '';
    let doneCount = 0;
    theme.tasks.forEach(task => {
      const sub = submissions.find(s => s.taskId === task.id);
      const status = sub ? sub.status : 'available';
      if (status === 'claimed' || status === 'done' || status === 'approved') doneCount += (status === 'claimed' || status === 'done') ? 1 : 0;
      tasksHtml += this._renderTaskCard(task, status, 'theme');
    });
    const total = theme.tasks.length;

    return `
      <div class="theme-card">
        <div class="theme-head">
          <span class="theme-badge">主题活动</span>
          <span class="theme-name">🎨 ${theme.name}</span>
          <span class="theme-countdown">${countdown}</span>
        </div>
        <div class="theme-meta">${rangeText} · 共 ${total} 个系列任务 · 已完成 ${doneCount}/${total}</div>
        <div class="theme-tasks">${tasksHtml || '<div style="font-size:13px;color:#8a6bb0;text-align:center;padding:8px">活动任务陆续上架中～</div>'}</div>
      </div>
    `;
  },

  async filterTasks(filter) {
    this.currentTaskFilter = filter;
    document.querySelectorAll('.filter-chip').forEach(el => {
      el.classList.toggle('active', el.dataset.filter === filter);
    });
    this._renderTaskList();
  },

  // 任务去重：后台/表格可能误插入重复任务（同类型 + 同标题 + 同排序），
  // 玩家侧每个逻辑任务只展示一条，避免「每日签到」等出现两遍。
  // weekly 重复副本可能各自带提交记录，取进度最靠前的一条作为代表，防止重复领取。
  _dedupeTasks(tasks, submissions, type) {
    const groups = new Map();
    tasks.forEach(t => {
      const key = `${t.taskType}|${t.title}|${t.sortOrder ?? 0}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(t);
    });

    // 提交状态优先级：已领取 > 已通过(待领) > 审核中 > 已驳回 > 未提交
    const statusRank = { claimed: 5, approved: 4, pending: 3, rejected: 2 };
    const result = [];
    groups.forEach(group => {
      if (group.length === 1) { result.push(group[0]); return; }
      if (type === 'daily') {
        // 每日签到是全局动作，任意一条副本触发的都是同一个签到，取第一条即可
        result.push(group[0]);
      } else {
        let best = group[0];
        let bestRank = -1;
        group.forEach(t => {
          const sub = submissions.find(s => s.taskId === t.id);
          const rank = sub ? (statusRank[sub.status] ?? 1) : 0;
          if (rank > bestRank) { bestRank = rank; best = t; }
        });
        result.push(best);
      }
    });
    // 保持原有排序
    result.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    return result;
  },

  async _renderTaskList() {
    const list = document.getElementById('task-list');
    if (!list) return;

    const submissions = await DB.getSubmissions();
    this._submissions = submissions;

    // 主题活动区随提交状态一起刷新（领取/审核状态变化）
    const themeSec = document.getElementById('theme-section');
    if (themeSec) themeSec.innerHTML = this._themeSectionHtml();

    const filter = this.currentTaskFilter;
    let html = '';

    // 主题筛选
    if (filter.startsWith('theme:')) {
      const themeName = filter.substring(6);
      const themeTasks = [...this._dailyTasks, ...this._weeklyTasks].filter(t => t.themeName === themeName);
      html += `<div style="font-size:13px;font-weight:600;color:var(--text-secondary);margin:12px 4px 8px">🎨 ${themeName} · 主题任务</div>`;
      if (themeTasks.length === 0) {
        html += `<div class="empty-state" style="padding:24px"><div class="emoji">🎨</div><p>该主题暂无任务</p></div>`;
      } else {
        themeTasks.forEach(task => {
          const type = task.taskType;
          let status = 'available';
          if (type === 'daily') {
            status = this._dailyChecked ? 'done' : 'available';
          } else {
            const sub = submissions.find(s => s.taskId === task.id);
            status = sub ? sub.status : 'available';
          }
          html += this._renderTaskCard(task, status, type);
        });

        // 主题额外奖励（样例：硬编码显示主题完成进度）
        const completedCount = themeTasks.filter(t => {
          if (t.taskType === 'daily') return this._dailyChecked;
          const sub = submissions.find(s => s.taskId === t.id);
          return sub && (sub.status === 'approved' || sub.status === 'done');
        }).length;
        const totalCount = themeTasks.length;
        const extraReward = themeTasks[0]?.themeExtraReward || [];
        let extraRewardHtml = '';
        if (extraReward.length > 0) {
          extraReward.forEach(ri => {
            const def = ITEMS[ri.item_id];
            if (def) extraRewardHtml += `<span style="display:inline-flex;align-items:center;gap:2px;margin:0 6px;font-size:14px">${renderItemIcon(ri.item_id, def.icon, 'item-icon-xs')}×${ri.quantity}</span>`;
          });
        }
        const allDone = completedCount >= totalCount && totalCount > 0;
        const themeClaimed = (Game.state.themeRewardClaims || []).includes(themeName);
        html += `
          <div style="margin-top:16px;padding:12px;background:linear-gradient(135deg,#f3e5f5,#e1bee7);border-radius:12px">
            <div style="font-weight:600;font-size:14px;margin-bottom:8px;color:#6a1b9a">🎁 主题额外奖励</div>
            <div style="font-size:12px;color:#7b1fa2;margin-bottom:8px">完成全部 ${totalCount} 个主题任务即可领取</div>
            <div style="margin-bottom:8px">${extraRewardHtml || '<span style="color:#9e9e9e">暂无额外奖励</span>'}</div>
            <div style="display:flex;align-items:center;gap:8px">
              <div style="flex:1;height:6px;background:#fff;border-radius:3px;overflow:hidden">
                <div style="height:100%;width:${(completedCount/totalCount*100)||0}%;background:#9c27b0;border-radius:3px;transition:width 0.3s"></div>
              </div>
              <span style="font-size:12px;color:#7b1fa2;font-weight:600">${completedCount}/${totalCount}</span>
            </div>
            <button class="btn btn-primary btn-sm btn-block" style="margin-top:10px" ${(allDone && !themeClaimed) ? '' : 'disabled'} onclick="PlayerView.claimThemeExtraReward('${themeName}',this)">
              ${themeClaimed ? '已领取' : (allDone ? '🎁 领取额外奖励' : '完成全部任务后解锁')}
            </button>
          </div>
        `;
      }
      list.innerHTML = html;
      return;
    }

    // 每日任务
    if (filter === 'all' || filter === 'daily') {
      html += `<div style="font-size:13px;font-weight:600;color:var(--text-secondary);margin:12px 4px 8px">☀️ 每日任务</div>`;
      this._dailyTasks.forEach(task => {
        const checked = this._dailyChecked;
        html += this._renderTaskCard(task, checked ? 'done' : 'available', 'daily');
      });
      // 本月累签奖励时间轴
      html += this._signInTimelineHtml();
    }

    // 每周任务
    if (filter === 'all' || filter === 'weekly') {
      html += `<div style="font-size:13px;font-weight:600;color:var(--text-secondary);margin:16px 4px 8px">📅 每周任务</div>`;
      this._weeklyTasks.forEach(task => {
        const sub = submissions.find(s => s.taskId === task.id);
        const status = sub ? sub.status : 'available';
        html += this._renderTaskCard(task, status, 'weekly');
      });
    }

    // 自主申报
    if (filter === 'all' || filter === 'self') {
      html += `<div style="font-size:13px;font-weight:600;color:var(--text-secondary);margin:16px 4px 8px">✍️ 自主申报</div>`;
      const selfSubs = submissions.filter(s => s.isSelfTask);
      if (selfSubs.length === 0) {
        html += `<div class="empty-state" style="padding:24px"><div class="emoji">📝</div><p>还没有自主申报的任务</p></div>`;
      } else {
        selfSubs.forEach(sub => {
          html += this._renderSelfSubCard(sub);
        });
      }
    }

    list.innerHTML = html;
  },

  _renderTaskCard(task, status, type) {
    const rewardItems = task.rewardItems || [];
    let rewardHtml = '';
    if (task.rewardChopping > 0) {
      rewardHtml += `<span class="reward-chopping" style="display:inline-flex;align-items:center;gap:3px">${renderItemIcon('1', '🪓', 'item-icon-xs')} ×${task.rewardChopping}</span>`;
    }
    rewardItems.forEach(ri => {
      const def = ITEMS[ri.item_id];
      if (def) rewardHtml += `<span style="display:inline-flex;align-items:center;gap:2px;font-size:14px" title="${def.name}">${renderItemIcon(ri.item_id, def.icon, 'item-icon-xs')}×${ri.quantity}</span>`;
    });

    let actionBtn = '';
    if (type === 'daily') {
      if (this._dailyChecked) {
        actionBtn = `<button class="btn btn-outline btn-sm" disabled>已签到</button>`;
      } else {
        actionBtn = `<button class="btn btn-primary btn-sm" onclick="PlayerView.doDailyCheckIn(this)">签到</button>`;
      }
    } else {
      if (status === 'available') {
        actionBtn = `<button class="btn btn-primary btn-sm" onclick="PlayerView.submitTask('${task.id}')">完成</button>`;
      } else if (status === 'pending') {
        actionBtn = `<button class="btn btn-outline btn-sm" disabled>审核中</button>`;
      } else if (status === 'approved') {
        actionBtn = `<button class="btn btn-accent btn-sm" onclick="PlayerView.claimTaskReward('${task.id}',this)">领取奖励</button>`;
      } else if (status === 'rejected') {
        actionBtn = `<button class="btn btn-primary btn-sm" onclick="PlayerView.submitTask('${task.id}')">重新提交</button>`;
      } else {
        actionBtn = `<button class="btn btn-outline btn-sm" disabled>已完成</button>`;
      }
    }

    return `
      <div class="task-card">
        <div class="task-card-header">
          <div class="task-title">${task.title}</div>
          <div style="display:flex;gap:4px;flex-wrap:wrap;justify-content:flex-end">
            ${task.themeName ? `<span class="tag" style="background:#e8daef;color:#6c3483;font-size:10px">🎨 ${task.themeName}</span>` : ''}
            ${task.difficulty ? UI.difficultyTag(task.difficulty) : ''}
          </div>
        </div>
        <div class="task-desc">${task.description || ''}</div>
        <div class="task-meta">
          ${UI.taskTypeTag(type)}
          ${rewardHtml}
        </div>
        <div class="task-actions">${actionBtn}</div>
      </div>
    `;
  },

  _renderSelfSubCard(sub) {
    let actionBtn = '';
    if (sub.status === 'pending') {
      actionBtn = `<button class="btn btn-outline btn-sm" disabled>审核中</button>`;
    } else if (sub.status === 'approved') {
      actionBtn = `<button class="btn btn-accent btn-sm" onclick="PlayerView.claimSubmissionReward('${sub.id}',this)">领取奖励</button>`;
    } else if (sub.status === 'rejected') {
      actionBtn = `<button class="btn btn-outline btn-sm" disabled>已驳回</button>`;
    }

    return `
      <div class="task-card">
        <div class="task-card-header">
          <div class="task-title">${sub.selfTitle || sub.taskTitle}</div>
          ${UI.statusTag(sub.status)}
        </div>
        <div class="task-desc">${sub.selfDescription || sub.description || ''}</div>
        ${sub.reviewNote ? `<div class="task-desc" style="color:var(--accent)">💬 ${sub.reviewNote}</div>` : ''}
        <div class="task-actions">${actionBtn}</div>
      </div>
    `;
  },

  async doDailyCheckIn(button) {
    const outcome = await UI.runLockedAction(
      'daily-check-in',
      button,
      '签到中...',
      () => Game.dailyCheckIn(),
    );
    if (outcome.started && outcome.value) {
      this._dailyChecked = true;
      this._renderTaskList();
    }
  },

  // 本月累签奖励时间轴
  _signInTimelineHtml() {
    const rewards = getSignInRewards();
    if (!rewards || rewards.length === 0) return '';
    const si = Game.getSignInState();
    const { days, claims } = si;

    // 进度线填充：到达最后一个已达成节点
    let reachedIdx = -1;
    rewards.forEach((r, i) => {
      if (claims.includes(r.rewardId) || days >= r.requiredDays) reachedIdx = i;
    });
    const fillPct = rewards.length > 1
      ? (reachedIdx / (rewards.length - 1)) * 100
      : (reachedIdx >= 0 ? 100 : 0);

    let nodes = '';
    rewards.forEach(r => {
      const claimed = claims.includes(r.rewardId);
      const claimable = !claimed && days >= r.requiredDays;
      const state = claimed ? 'claimed' : (claimable ? 'claimable' : 'locked');
      const first = (r.items && r.items[0]) || null;
      const def = first ? ITEMS[String(first.itemId)] : null;
      const icon = def ? renderItemIcon(first.itemId, def.icon, 'item-icon-xs') : '🎁';
      const count = first ? first.count : '';
      const circleContent = claimed ? '✓' : icon;
      const click = claimable ? `onclick="PlayerView.claimSignIn(${r.rewardId},this)"` : '';
      nodes += `
        <div class="signin-node ${state}" ${click}>
          <div class="node-reward">${icon}${count ? '×' + count : ''}</div>
          <div class="node-circle">${circleContent}</div>
          <div class="node-day">${r.requiredDays}天</div>
        </div>
      `;
    });

    return `
      <div class="signin-card">
        <div class="signin-head">
          <span class="signin-title">🎯 本月累签奖励</span>
          <span class="signin-days">本月已签 <b>${days}</b> 天</span>
        </div>
        <div class="signin-track-wrap">
          <div class="signin-line"><div class="signin-line-fill" style="width:${fillPct}%"></div></div>
          <div class="signin-nodes">${nodes}</div>
        </div>
        <div class="signin-hint">累计签到 3 / 7 / 14 / 28 天可领取对应奖励，每月 1 号重置</div>
      </div>
    `;
  },

  async claimSignIn(rewardId, control) {
    const reward = getSignInRewards().find(r => r.rewardId === parseInt(rewardId));
    if (!reward) return;
    const outcome = await UI.runLockedAction(
      `signin:${rewardId}`,
      control,
      '',
      () => Game.claimSignInReward(reward),
    );
    if (outcome.started && outcome.value) this._renderTaskList();
  },

  submitTask(taskId) {
    const task = [...this._dailyTasks, ...this._weeklyTasks, ...(this._themeTasks || [])].find(t => t.id == taskId);
    if (!task) return;

    const overlay = UI.modal(`
      <div class="form-group">
        <label>完成描述</label>
        <textarea id="submit-desc" placeholder="说说你是怎么完成这个任务的..."></textarea>
      </div>
    `, {
      title: `提交：${task.title}`,
      footer: `<div class="modal-footer">
        <button class="btn btn-outline btn-sm" onclick="this.closest('.modal-overlay').remove()">取消</button>
        <button class="btn btn-primary btn-sm" id="submit-ok">提交</button>
      </div>`
    });

    overlay.querySelector('#submit-ok').addEventListener('click', async () => {
      const desc = document.getElementById('submit-desc').value.trim();
      if (!desc) { UI.toast('请填写完成描述', 'warn'); return; }

      const button = overlay.querySelector('#submit-ok');
      const outcome = await UI.runLockedAction(
        `task-submit:${task.id}`,
        button,
        '提交中...',
        () => DB.submitTask({
          taskId: task.id,
          taskType: task.taskType,
          taskTitle: task.title,
          description: desc,
          rewardChopping: task.rewardChopping,
          rewardItems: task.rewardItems,
        }),
      );

      if (outcome.started && outcome.value) {
        UI.closeModal(overlay);
        UI.toast('已提交审核', 'success');
        this._renderTaskList();
      }
    });
  },

  showSelfSubmit() {
    const overlay = UI.modal(`
      <div class="form-group">
        <label>任务名称</label>
        <input type="text" id="self-title" placeholder="比如：主动帮同学带饭">
      </div>
      <div class="form-group">
        <label>完成描述</label>
        <textarea id="self-desc" placeholder="详细描述一下你做了什么..."></textarea>
      </div>
    `, {
      title: '自主申报任务',
      footer: `<div class="modal-footer">
        <button class="btn btn-outline btn-sm" onclick="this.closest('.modal-overlay').remove()">取消</button>
        <button class="btn btn-primary btn-sm" id="self-ok">提交申报</button>
      </div>`
    });

    overlay.querySelector('#self-ok').addEventListener('click', async () => {
      const title = document.getElementById('self-title').value.trim();
      const desc = document.getElementById('self-desc').value.trim();
      if (!title || !desc) { UI.toast('请填写完整', 'warn'); return; }

      const button = overlay.querySelector('#self-ok');
      const outcome = await UI.runLockedAction(
        'self-task-submit',
        button,
        '提交中...',
        () => DB.submitTask({
          taskType: 'self',
          taskTitle: title,
          isSelfTask: true,
          selfTitle: title,
          selfDescription: desc,
          description: desc,
        }),
      );

      if (outcome.started && outcome.value) {
        UI.closeModal(overlay);
        UI.toast('已提交审核', 'success');
        this._renderTaskList();
      }
    });
  },

  async claimTaskReward(taskId, button) {
    const task = [...this._dailyTasks, ...this._weeklyTasks, ...(this._themeTasks || [])].find(t => t.id == taskId);
    const sub = this._submissions.find(s => s.taskId == taskId);
    if (!task || !sub) return;
    return this._claimStoredSubmissionReward(
      sub,
      `task-reward:${taskId}`,
      button,
    );
  },

  async claimSubmissionReward(subId, button) {
    const sub = this._submissions.find(s => s.id === subId);
    if (!sub) return;
    return this._claimStoredSubmissionReward(
      sub,
      `submission-reward:${subId}`,
      button,
    );
  },

  async _claimStoredSubmissionReward(sub, operationKey, button) {
    const outcome = await UI.runLockedAction(operationKey, button, '领取中...', async () => {
      const reserved = await DB.claimSubmission(sub.id);
      if (!reserved) {
        await Game.refresh();
        UI.toast('该奖励已领取', 'warn');
        return false;
      }

      if (sub.rewardChopping > 0) {
        Game.state.choppingCount += sub.rewardChopping;
        const saved = await DB.updatePlayerState({ choppingCount: Game.state.choppingCount });
        if (!saved) {
          console.error('submission chopping reward failed:', sub.id);
          UI.toast('奖励状态已同步，请联系天道检查', 'error');
          return false;
        }
      }

      for (const ri of (sub.rewardItems || [])) {
        const granted = await Game.grantItem(ri.item_id, ri.quantity);
        if (!granted) {
          console.error('submission item reward failed:', sub.id, ri);
          UI.toast('奖励状态已同步，请联系天道检查', 'error');
          return false;
        }
      }

      await Game.refresh();
      UI.toast('奖励已领取！', 'success');
      this._renderTaskList();
      return true;
    });
    return outcome.started && outcome.value;
  },

  async claimThemeExtraReward(themeName, button) {
    if ((Game.state.themeRewardClaims || []).includes(themeName)) {
      UI.toast('已领取过主题额外奖励', 'warn');
      return false;
    }

    const allTasks = [...this._dailyTasks, ...this._weeklyTasks];
    const themeTasks = allTasks.filter(t => t.themeName === themeName);
    if (themeTasks.length === 0) return;

    // 检查是否全部完成
    const submissions = this._submissions;
    const allDone = themeTasks.every(t => {
      if (t.taskType === 'daily') return this._dailyChecked;
      const sub = submissions.find(s => s.taskId === t.id);
      return sub && (sub.status === 'approved' || sub.status === 'claimed' || sub.status === 'done');
    });

    if (!allDone) {
      UI.toast('请先完成全部主题任务', 'warn');
      return false;
    }

    const outcome = await UI.runLockedAction(
      `theme-reward:${themeName}`,
      button,
      '领取中...',
      async () => {
        const reserved = await DB.reservePlayerClaim('theme', themeName);
        if (!reserved.ok) {
          if (reserved.code === 'already_claimed') {
            await Game.refresh();
            UI.toast('已领取过主题额外奖励', 'warn');
          } else {
            UI.toast('领取未完成，请重试', 'error');
          }
          return false;
        }

        Game.state.themeRewardClaims = [
          ...(Game.state.themeRewardClaims || []),
          themeName,
        ];
        const extraReward = themeTasks[0]?.themeExtraReward || [];
        let totalChopping = 0;
        for (const ri of extraReward) {
          if (ri.item_id === 'chopping') {
            totalChopping += ri.quantity;
          } else {
            const granted = await Game.grantItem(ri.item_id, ri.quantity);
            if (!granted) {
              console.error('theme reward failed:', themeName, ri);
              UI.toast('奖励状态已同步，请联系天道检查', 'error');
              return false;
            }
          }
        }
        if (totalChopping > 0) {
          Game.state.choppingCount += totalChopping;
          const saved = await DB.updatePlayerState({ choppingCount: Game.state.choppingCount });
          if (!saved) {
            console.error('theme chopping reward failed:', themeName);
            UI.toast('奖励状态已同步，请联系天道检查', 'error');
            return false;
          }
        }

        const mailed = await DB.sendMail(
          `🎨 主题「${themeName}」完成奖励`,
          `恭喜你完成了主题「${themeName}」的全部任务，额外奖励已发放！`,
          extraReward,
        );
        if (!mailed) console.error('theme reward mail failed:', themeName);

        UI.toast('🎉 主题额外奖励已领取！', 'success');
        this._renderTaskList();
        return true;
      }
    );
    return outcome.started && outcome.value;
  },

  // --- 天道酬勤 ---
  async renderReward() {
    const main = document.getElementById('player-main');
    const withdrawals = await DB.getWithdrawals();

    main.innerHTML = `
      <div class="page-title page-title-art">${renderFeatureIcon('icon-reward', '', 'page-title-icon')}<span>天道酬勤</span></div>
      <div class="page-subtitle">努力修仙，天道自会酬勤</div>

      <div class="balance-card">
        <div class="balance-label">当前余额</div>
        <div class="balance-value"><small>¥</small>${Game.state.balance.toFixed(2)}</div>
        <div class="total-withdrawn">累计提现：¥${Game.state.totalWithdrawn.toFixed(2)}</div>
        <div class="withdraw-controls">
          <button class="withdraw-btn-round" onclick="PlayerView.adjustWithdraw(-100)" id="withdraw-minus">−</button>
          <div class="withdraw-amount" id="withdraw-amount">100</div>
          <button class="withdraw-btn-round" onclick="PlayerView.adjustWithdraw(100)" id="withdraw-plus">+</button>
        </div>
        <button class="btn btn-primary btn-block" onclick="PlayerView.doWithdraw(this)">申请提现</button>
        <button class="btn btn-outline btn-block" style="margin-top:8px" onclick="PlayerView.showWithdrawRecords()">📋 提现记录</button>
      </div>

      <!-- 天道酬勤商店（游戏币购买） -->
      <div class="shop-section">
        <div class="section-header" style="align-items:center">
          <div class="section-title">🛒 天道酬勤商店</div>
          <div class="res-pill res-coin" title="游戏币余额">
            <span class="res-icon">${renderItemIcon('0', '🪙', 'res-coin-img')}</span><span class="res-val" id="shop-coin-balance">${Game.state.coin || 0}</span>
          </div>
        </div>
        <div class="shop-tip">砍树掉落、出售仙斧可获得游戏币，用于在此兑换道具</div>
        <div class="shop-grid" id="shop-grid"></div>
      </div>

      <!-- 提现记录 -->
      <div style="margin-top:20px">
        <div class="section-header">
          <div class="section-title">📋 提现记录</div>
        </div>
        <div id="withdraw-list"></div>
      </div>
    `;

    this._withdrawAmount = 100;
    this._renderShop();
    this._renderWithdrawList(withdrawals);
  },

  _withdrawAmount: 100,

  adjustWithdraw(delta) {
    this._withdrawAmount += delta;
    if (this._withdrawAmount < 100) this._withdrawAmount = 100;
    if (this._withdrawAmount > Math.floor(Game.state.balance / 100) * 100) {
      this._withdrawAmount = Math.floor(Game.state.balance / 100) * 100;
    }
    if (this._withdrawAmount < 0) this._withdrawAmount = 0;
    document.getElementById('withdraw-amount').textContent = this._withdrawAmount;
  },

  doWithdraw(button) {
    if (this._withdrawAmount <= 0) {
      UI.toast('请选择提现金额', 'warn');
      return;
    }
    UI.confirm(`确定申请提现 ¥${this._withdrawAmount}？天道审核通过后将发放。`, async () => {
      const outcome = await UI.runLockedAction(
        'withdraw',
        button,
        '处理中...',
        () => Game.withdraw(this._withdrawAmount),
      );
      if (outcome.started && outcome.value) {
        Router.playerTab('reward'); // 刷新页面
      }
    });
  },

  _renderShop() {
    const grid = document.getElementById('shop-grid');
    if (!grid) return;
    const items = getShopItems();
    const coin = Game.state.coin || 0;
    const month = new Date().toISOString().slice(0, 7);
    const monthPurchases = (Game.state.shopPurchases || {})[month] || {};

    if (items.length === 0) {
      grid.innerHTML = '<div class="empty-state" style="padding:24px;grid-column:1/-1"><div class="emoji">🛒</div><p>商店暂未上架商品</p></div>';
      return;
    }

    let html = '';
    items.forEach(item => {
      const qColor = QUALITY_COLORS[item.quality] || '#9e9e9e';
      const limitType = parseInt(item.limitType);
      let badge = '';
      let disabled = false;

      // 限购类型3：仙阶限购
      if (limitType === SHOP_LIMIT_TYPE.REALM) {
        const needRealm = parseInt(item.limitParam) || 0;
        const realm = REALMS.find(r => r.level == needRealm);
        const realmName = realm ? realm.name : `仙阶${needRealm}`;
        if ((Game.state.realmLevel || 1) < needRealm) {
          disabled = true;
          badge = `<div class="shop-tag shop-lock">🔒 ${realmName}</div>`;
        } else {
          badge = `<div class="shop-tag">${realmName}可购</div>`;
        }
      }
      // 限购类型2：月限购
      if (limitType === SHOP_LIMIT_TYPE.MONTHLY) {
        const max = parseInt(item.limitParam) || 0;
        const bought = monthPurchases[item.shopId] || 0;
        if (bought >= max) {
          disabled = true;
          badge = `<div class="shop-tag shop-soldout">本月已达上限</div>`;
        } else {
          badge = `<div class="shop-tag shop-monthly">月限 ${bought}/${max}</div>`;
        }
      }

      const afford = coin >= item.price;
      const countText = item.itemCount > 1 ? ` ×${item.itemCount}` : '';
      html += `
        <div class="shop-item ${disabled ? 'shop-disabled' : ''}" ${disabled ? '' : `onclick="PlayerView.buyShopItem(${item.shopId},this)"`}>
          <div class="shop-badge-slot">${badge}</div>
          <div class="shop-icon" style="box-shadow:inset 0 0 0 2px ${qColor}66;border-radius:12px">${renderItemIcon(item.itemId, item.icon)}</div>
          <div class="shop-name">${item.name}${countText}</div>
          <div class="shop-cost ${afford ? '' : 'shop-cost-no'}" style="display:inline-flex;align-items:center;gap:3px">${renderItemIcon('0', '🪙', 'item-icon-xs')} ${item.price}</div>
        </div>
      `;
    });
    grid.innerHTML = html;

    const bal = document.getElementById('shop-coin-balance');
    if (bal) bal.textContent = coin;
  },

  buyShopItem(shopId, control) {
    const item = getShopItems().find(s => s.shopId === parseInt(shopId));
    if (!item) return;
    const countText = item.itemCount > 1 ? ` ×${item.itemCount}` : '';
    UI.confirm(`确定花费 🪙${item.price} 游戏币购买 ${item.name}${countText}？`, async () => {
      const outcome = await UI.runLockedAction(
        `shop:${shopId}`,
        control,
        '',
        () => Game.shopBuy(item),
      );
      if (outcome.started && outcome.value) this._renderShop();
    });
  },

  _renderWithdrawList(list) {
    const el = document.getElementById('withdraw-list');
    if (!el) return;
    if (list.length === 0) {
      el.innerHTML = `<div class="empty-state" style="padding:24px"><div class="emoji">💸</div><p>暂无提现记录</p></div>`;
      return;
    }
    let html = '';
    list.slice(0, 10).forEach(w => {
      const statusMap = { pending: '审核中', approved: '已通过', rejected: '已驳回' };
      const date = new Date(w.createdAt).toLocaleDateString('zh-CN');
      html += `
        <div class="task-card" style="padding:12px">
          <div class="task-card-header">
            <div class="task-title" style="font-size:14px">提现 ¥${w.amount.toFixed(2)}</div>
            ${UI.statusTag(w.status)}
          </div>
          <div class="task-desc" style="font-size:12px;margin-bottom:0">${date}</div>
        </div>
      `;
    });
    el.innerHTML = html;
  },

  // --- 邮件 ---
  async showMailModal() {
    // 关闭已有弹窗，防止堆叠
    document.querySelectorAll('.modal-overlay').forEach(el => el.remove());

    const mails = await DB.getMails();
    let listHtml = '';
    if (mails.length === 0) {
      listHtml = '<div style="text-align:center;padding:32px;color:var(--text-secondary)"><div style="font-size:48px">📭</div><p>暂无邮件</p></div>';
    } else {
      mails.forEach(mail => {
        const hasItems = mail.items && mail.items.length > 0;
        const canClaim = hasItems && !mail.isClaimed;
        const unread = !mail.isRead || canClaim;
        let itemsHtml = '';
        if (hasItems) {
          itemsHtml = '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">';
          mail.items.forEach(ri => {
            const def = ITEMS[ri.item_id];
            if (def) itemsHtml += `<span style="display:inline-flex;align-items:center;gap:3px;font-size:13px;background:var(--bg-secondary);padding:2px 8px;border-radius:6px">${renderItemIcon(ri.item_id, def.icon, 'item-icon-xs')}×${ri.quantity}</span>`;
          });
          itemsHtml += '</div>';
        }
        const date = new Date(mail.createdAt).toLocaleDateString('zh-CN');
        listHtml += `
          <div onclick="PlayerView.openMail('${mail.id}')" style="padding:12px;border-radius:10px;background:${unread ? 'var(--bg-secondary)' : 'var(--card-solid)'};border:1px solid var(--border);margin-bottom:8px;cursor:pointer;transition:var(--transition)" onmouseover="this.style.borderColor='var(--primary-light)'" onmouseout="this.style.borderColor='var(--border)'">
            <div style="display:flex;justify-content:space-between;align-items:center">
              <span style="font-weight:${unread ? '700' : '500'};font-size:14px">${unread ? '🔵 ' : ''}${mail.title}</span>
              <span style="font-size:11px;color:var(--text-light)">${date}</span>
            </div>
            <div style="font-size:12px;color:var(--text-secondary);margin-top:4px">${mail.content || ''}</div>
            ${itemsHtml}
            ${canClaim ? '<div style="margin-top:6px"><span style="font-size:11px;color:var(--accent);font-weight:600">可领取</span></div>' : ''}
            ${mail.isClaimed && hasItems ? '<div style="margin-top:6px"><span style="font-size:11px;color:var(--text-light)">已领取</span></div>' : ''}
          </div>
        `;
      });
    }

    UI.modal(listHtml, { title: '📮 邮件' });
    UI._updateMailBadge();
  },

  // --- 成就 ---
  _achTab: 1,
  showAchievements() {
    document.querySelectorAll('.modal-overlay').forEach(el => el.remove());
    const tabs = getAchievementTabs();
    if (!this._achTab || !tabs.find(t => t.tabId === this._achTab)) {
      this._achTab = tabs[0] ? tabs[0].tabId : 1;
    }
    const overlay = UI.modal(`
      <div class="ach-tabs" id="ach-tabs"></div>
      <div class="ach-summary" id="ach-summary"></div>
      <div class="ach-list" id="ach-list"></div>
    `, { title: '🏆 成就' });

    this._achOverlay = overlay;
    this._renderAchTabs();
    this._renderAchList();
  },

  _renderAchTabs() {
    const tabs = getAchievementTabs();
    const all = Game.getAchievementProgress();
    const wrap = this._achOverlay.querySelector('#ach-tabs');
    wrap.innerHTML = tabs.map(t => {
      const claimable = all.filter(a => a.tabId === t.tabId && a.claimable).length;
      const active = this._achTab === t.tabId;
      return `<button class="ach-tab ${active ? 'active' : ''}" onclick="PlayerView.switchAchTab(${t.tabId})">
        ${t.tabName}${claimable > 0 ? `<span class="ach-tab-dot">${claimable}</span>` : ''}
      </button>`;
    }).join('');

    // 顶部汇总
    const claimedCount = all.filter(a => a.claimed).length;
    const sum = this._achOverlay.querySelector('#ach-summary');
    sum.innerHTML = `已达成 <b>${claimedCount}</b> / ${all.length} 项成就`;
  },

  switchAchTab(tabId) {
    this._achTab = tabId;
    this._renderAchTabs();
    this._renderAchList();
  },

  _renderAchList() {
    const all = Game.getAchievementProgress();
    const rows = all.filter(a => a.tabId === this._achTab);
    // 排序：可领取 → 进行中 → 已领取；同组按目标值升序
    const rank = a => a.claimable ? 0 : (a.claimed ? 2 : 1);
    rows.sort((a, b) => (rank(a) - rank(b)) || (a.target - b.target));

    const list = this._achOverlay.querySelector('#ach-list');
    if (rows.length === 0) {
      list.innerHTML = '<div class="empty-state"><div class="emoji">🏅</div><p>暂无成就</p></div>';
      return;
    }

    list.innerHTML = rows.map(a => {
      const def = ITEMS[String(a.rewardItemId)];
      const rewardIcon = def ? renderItemIcon(a.rewardItemId, def.icon, 'item-icon-xs') : '🎁';
      const rewardName = def ? def.name : '道具';
      const pct = Math.round(a.progress * 100);
      let action;
      if (a.claimed) {
        action = '<button class="btn btn-outline btn-sm" disabled style="opacity:.55;cursor:default">已领取</button>';
      } else if (a.claimable) {
        action = `<button class="btn btn-primary btn-sm" onclick="PlayerView.claimAchievement(${a.achievementId},this)">领取</button>`;
      } else {
        action = '<button class="btn btn-outline btn-sm" disabled style="opacity:.55;cursor:default">未达成</button>';
      }
      return `
        <div class="ach-row ${a.claimed ? 'claimed' : (a.claimable ? 'claimable' : '')}">
          <div class="ach-icon">${a.icon}</div>
          <div class="ach-info">
            <div class="ach-name">${achievementGoalText(a.typeId, a.target)}</div>
            <div class="ach-prog">
              <div class="ach-prog-bar"><div class="ach-prog-fill" style="width:${pct}%"></div></div>
              <span class="ach-prog-text">${Math.min(a.current, a.target)}/${a.target}</span>
            </div>
          </div>
          <div class="ach-reward" title="${rewardName}">${rewardIcon}×${a.rewardCount}</div>
          <div class="ach-action">${action}</div>
        </div>
      `;
    }).join('');
  },

  async claimAchievement(achievementId, button) {
    const outcome = await UI.runLockedAction(
      `achievement:${achievementId}`,
      button,
      '领取中...',
      () => Game.claimAchievement(achievementId),
    );
    if (outcome.started && outcome.value) {
      this._renderAchTabs();
      this._renderAchList();
      UI._updateAchBadge();
    }
  },

  async renderMail() {
    const main = document.getElementById('player-main');
    const mails = await DB.getMails();

    main.innerHTML = `
      <div class="page-title">📮 邮件</div>
      <div class="page-subtitle">天道消息和奖励都在这里</div>
      <div id="mail-list"></div>
    `;

    const list = document.getElementById('mail-list');
    if (mails.length === 0) {
      list.innerHTML = `<div class="empty-state"><div class="emoji">📭</div><p>暂无邮件</p></div>`;
      return;
    }

    let html = '';
    mails.forEach(mail => {
      const hasItems = mail.items && mail.items.length > 0;
      const canClaim = hasItems && !mail.isClaimed;
      const unread = !mail.isRead || canClaim;

      let itemsHtml = '';
      if (hasItems) {
        itemsHtml = '<div class="mail-items">';
        mail.items.forEach(ri => {
          const def = ITEMS[ri.item_id];
          if (def) itemsHtml += `<span class="mini-item" style="display:inline-flex;align-items:center;gap:3px">${renderItemIcon(ri.item_id, def.icon, 'item-icon-xs')}×${ri.quantity}</span>`;
        });
        itemsHtml += '</div>';
      }

      const date = new Date(mail.createdAt).toLocaleDateString('zh-CN');

      html += `
        <div class="mail-item ${unread ? 'unread' : ''}" onclick="PlayerView.openMail('${mail.id}')">
          <div class="mail-header">
            <div class="mail-title">${mail.title}</div>
            <div class="mail-date">${date}</div>
          </div>
          <div class="mail-preview">${mail.content || ''}</div>
          ${itemsHtml}
          ${canClaim ? `<div style="margin-top:8px"><span class="tag tag-status-review">可领取</span></div>` : ''}
        </div>
      `;
    });
    list.innerHTML = html;

    UI._updateMailBadge();
  },

  async openMail(mailId) {
    // 先关闭邮件列表弹窗
    document.querySelectorAll('.modal-overlay').forEach(el => el.remove());

    const mails = await DB.getMails();
    const mail = mails.find(m => m.id == mailId);
    if (!mail) return;

    await DB.markMailRead(mailId);

    const hasItems = mail.items && mail.items.length > 0;
    const canClaim = hasItems && !mail.isClaimed;

    let itemsHtml = '';
    if (hasItems) {
      itemsHtml = '<div style="display:flex;gap:12px;justify-content:center;margin:16px 0;flex-wrap:wrap">';
      mail.items.forEach(ri => {
        const def = ITEMS[ri.item_id];
        if (def) {
          const q = QUALITY[def.quality] || QUALITY[1];
          itemsHtml += `
            <div style="text-align:center">
              <div style="font-size:40px;display:flex;justify-content:center;align-items:center;height:56px">${renderItemIcon(ri.item_id, def.icon, 'item-icon-lg')}</div>
              <div style="font-size:12px;color:${q.color}">${def.name} ×${ri.quantity}</div>
            </div>
          `;
        }
      });
      itemsHtml += '</div>';
    }

    const footer = canClaim
      ? `<div class="modal-footer">
          <button class="btn btn-outline btn-sm" onclick="PlayerView.showMailModal()">关闭</button>
          <button class="btn btn-outline btn-sm btn-danger" onclick="PlayerView.deleteMail('${mailId}')">删除</button>
          <button class="btn btn-accent btn-sm" onclick="PlayerView.claimMailReward('${mailId}',this)">领取奖励</button>
        </div>`
      : `<div class="modal-footer">
          <button class="btn btn-outline btn-sm btn-danger" onclick="PlayerView.deleteMail('${mailId}')">删除</button>
          <button class="btn btn-primary btn-sm" onclick="PlayerView.showMailModal()">关闭</button>
        </div>`;

    UI.modal(`
      <p style="font-size:14px;line-height:1.8;color:var(--text-secondary)">${mail.content || ''}</p>
      ${itemsHtml}
      ${mail.isClaimed && hasItems ? '<div style="text-align:center;margin-top:12px"><span style="font-size:12px;color:var(--text-light)">奖励已领取</span></div>' : ''}
    `, { title: mail.title, footer });
  },

  async claimMailReward(mailId, button) {
    const outcome = await UI.runLockedAction(
      `mail-reward:${mailId}`,
      button,
      '领取中...',
      async () => {
        const mails = await DB.getMails();
        const mail = mails.find(m => m.id == mailId);
        if (!mail || !mail.items || mail.items.length === 0) return false;

        const reserved = await DB.claimMail(mailId);
        if (!reserved) {
          UI.toast('该奖励已领取', 'warn');
          return false;
        }

        for (const ri of mail.items) {
          const granted = await Game.grantItem(ri.item_id, ri.quantity);
          if (!granted) {
            console.error('mail reward failed:', mailId, ri);
            UI.toast('奖励状态已同步，请联系天道检查', 'error');
            return false;
          }
        }

        await Game.refresh();
        document.querySelectorAll('.modal-overlay').forEach(el => el.remove());
        UI.toast('奖励已领取！', 'success');
        this.showMailModal();
        return true;
      },
    );
    return outcome.started && outcome.value;
  },

  // 仙阶突破弹窗
  showBreakThrough() {
    const currentRealm = REALMS.find(r => r.level == Game.state.realmLevel) || REALMS[0];
    const nextRealm = REALMS.find(r => r.level == Game.state.realmLevel + 1);
    if (!nextRealm) return;

    const canBreak = Game.state.level >= nextRealm.reqLevel &&
      nextRealm.reqItems.every(req => (Game.inventory.find(i => i.itemId == req.itemId)?.quantity || 0) >= req.count);

    const reqItemsHtml = nextRealm.reqItems.map(req => {
      const def = ITEMS[req.itemId];
      const have = Game.inventory.find(i => i.itemId == req.itemId)?.quantity || 0;
      const ok = have >= req.count;
      const icon = renderItemIcon(req.itemId, def?.icon, 'item-icon-sm');
      const name = def?.name || `道具${req.itemId}`;
      return `<div style="display:flex;align-items:center;gap:8px;padding:6px 0">
        <span style="display:inline-flex;align-items:center">${icon}</span>
        <span style="flex:1">${name}</span>
        <span style="color:${ok ? 'var(--success)' : 'var(--error)'}">${have}/${req.count}</span>
      </div>`;
    }).join('');

    // 突破后解锁的仙斧品质
    let unlockHtml = '';
    const curMaxQ = currentRealm.maxAxeQuality || 1;
    const nextMaxQ = nextRealm.maxAxeQuality || 1;
    if (nextMaxQ > curMaxQ) {
      const newQualities = [];
      for (let q = curMaxQ + 1; q <= nextMaxQ; q++) {
        const qInfo = QUALITY[q];
        if (qInfo) {
          newQualities.push(`<span style="display:inline-block;padding:2px 10px;border-radius:10px;font-size:12px;font-weight:600;background:${qInfo.color}20;color:${qInfo.color};margin:2px">${qInfo.name}仙斧</span>`);
        }
      }
      if (newQualities.length > 0) {
        unlockHtml = `
          <div style="background:var(--accent)12;border:1px solid var(--accent)30;border-radius:8px;padding:10px 12px;margin:12px 0">
            <div style="font-size:13px;font-weight:600;color:var(--accent);margin-bottom:6px">🎁 突破解锁</div>
            <div style="font-size:12px;color:var(--text-secondary);margin-bottom:6px">可装备更高品质仙斧：</div>
            <div>${newQualities.join('')}</div>
          </div>
        `;
      }
    }

    UI.modal(`
      <div style="text-align:center;margin-bottom:16px">
        <div style="font-size:48px;margin-bottom:8px">${currentRealm.icon} → ${nextRealm.icon}</div>
        <div style="font-size:18px;font-weight:700">${currentRealm.name} → ${nextRealm.name}</div>
        <div style="font-size:12px;color:var(--text-secondary);margin-top:4px">${nextRealm.desc}</div>
      </div>
      ${unlockHtml}
      <div style="margin-bottom:12px;font-weight:600">突破条件</div>
      <div style="font-size:13px;margin-bottom:8px">等级要求：${Game.state.level}/${nextRealm.reqLevel} ${Game.state.level >= nextRealm.reqLevel ? '✅' : '❌'}</div>
      ${reqItemsHtml}
    `, {
      title: '仙阶突破',
      footer: `<div class="modal-footer">
        <button class="btn btn-outline btn-sm" onclick="this.closest('.modal-overlay').remove()">取消</button>
        <button class="btn btn-accent btn-sm" id="breakthrough-ok" ${canBreak ? '' : 'disabled'}>突破</button>
      </div>`
    });

    const btn = document.getElementById('breakthrough-ok');
    if (btn) btn.addEventListener('click', async () => {
      const outcome = await UI.runLockedAction(
        'breakthrough',
        btn,
        '突破中...',
        () => Game.breakThrough(),
      );
      if (outcome.started && outcome.value) {
        document.querySelector('.modal-overlay')?.remove();
        PlayerView.renderCultivate();
      }
    });
  },

  // 仙树升阶弹窗
  showTreeUpgrade() {
    const current = TREE_REALMS.find(r => r.level == Game.state.treeRealm) || TREE_REALMS[0];
    const next = TREE_REALMS.find(r => r.level == Game.state.treeRealm + 1);
    if (!next) return;

    const canUpgrade = next.reqItems.every(req =>
      (Game.inventory.find(i => i.itemId == req.itemId)?.quantity || 0) >= req.count
    );

    const reqItemsHtml = next.reqItems.map(req => {
      const def = ITEMS[req.itemId];
      const have = Game.inventory.find(i => i.itemId == req.itemId)?.quantity || 0;
      const ok = have >= req.count;
      const icon = renderItemIcon(req.itemId, def?.icon, 'item-icon-sm');
      const name = def?.name || `道具${req.itemId}`;
      return `<div style="display:flex;align-items:center;gap:8px;padding:6px 0">
        <span style="display:inline-flex;align-items:center">${icon}</span>
        <span style="flex:1">${name}</span>
        <span style="color:${ok ? 'var(--success)' : 'var(--error)'}">${have}/${req.count}</span>
      </div>`;
    }).join('');

    UI.modal(`
      <div style="text-align:center;margin-bottom:16px">
        <div style="font-size:64px;margin-bottom:8px">${current.icon} → ${next.icon}</div>
        <div style="font-size:18px;font-weight:700">${current.name} → ${next.name}</div>
        <div style="font-size:12px;color:var(--text-secondary);margin-top:4px">${next.desc}</div>
      </div>
      <div style="margin-bottom:12px;font-weight:600">升阶消耗</div>
      ${reqItemsHtml}
      <div style="margin-top:12px;font-size:12px;color:var(--text-secondary)">
        升阶后奖池品质提升，有机会获得更稀有的道具
      </div>
    `, {
      title: '仙树升阶',
      footer: `<div class="modal-footer">
        <button class="btn btn-outline btn-sm" onclick="this.closest('.modal-overlay').remove()">取消</button>
        <button class="btn btn-accent btn-sm" id="tree-upgrade-ok" ${canUpgrade ? '' : 'disabled'}>升阶</button>
      </div>`
    });

    const btn = document.getElementById('tree-upgrade-ok');
    if (btn) btn.addEventListener('click', async () => {
      const outcome = await UI.runLockedAction(
        'tree-upgrade',
        btn,
        '升阶中...',
        () => Game.upgradeTreeRealm(),
      );
      if (outcome.started && outcome.value) {
        document.querySelector('.modal-overlay')?.remove();
        PlayerView.renderCultivate();
      }
    });
  },

  // 锻造弹窗
  showForge() {
    // 清除可能残留的弹窗（避免锻造结果弹窗叠加导致按钮状态异常）
    document.querySelectorAll('.modal-overlay').forEach(el => el.remove());
    const forgeQty = Game.inventory.find(i => i.itemId == '40001')?.quantity || 0;

    // 计算锻造奖池各品质概率（总权重1000）
    const forgeTotalWeight = FORGE_POOL.reduce((sum, p) => sum + p.weight, 0);
    const qualityList = FORGE_POOL.map(pool => {
      const qInfo = QUALITY[pool.quality] || { name: `品质${pool.quality}`, color: '#999' };
      const pct = pool.weight / forgeTotalWeight * 100;
      return {
        quality: pool.quality,
        name: qInfo.name,
        color: qInfo.color,
        pct: pct,
      };
    }).sort((a, b) => a.quality - b.quality);

    const poolHtml = qualityList.map(q => `
      <div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--border)">
        <span style="display:inline-block;padding:4px 12px;border-radius:12px;font-size:13px;font-weight:600;background:${q.color}20;color:${q.color};min-width:48px;text-align:center">${q.name}</span>
        <div style="flex:1;height:8px;background:var(--border);border-radius:4px;overflow:hidden">
          <div style="height:100%;width:${Math.max(q.pct, 2)}%;background:${q.color};border-radius:4px;transition:width 0.6s ease"></div>
        </div>
        <span style="font-weight:700;font-size:15px;color:${q.color};min-width:52px;text-align:right">${q.pct.toFixed(1)}%</span>
      </div>
    `).join('');

    UI.modal(`
      <div style="text-align:center;margin-bottom:16px">
        <div style="font-size:64px;margin-bottom:8px">🔨</div>
        <div style="font-size:18px;font-weight:700">锻造仙斧</div>
        <div style="font-size:12px;color:var(--text-secondary);margin-top:4px">消耗锻铁，随机获得一把仙斧</div>
      </div>
      <div style="margin-bottom:16px">
        <div style="font-weight:600;margin-bottom:8px">奖池概率</div>
        ${poolHtml}
      </div>
      <div style="text-align:center;font-size:13px;color:var(--text-secondary)">
        当前锻铁：🔩 ${forgeQty} 个
      </div>
    `, {
      title: '锻造',
      footer: `<div class="modal-footer">
        <button class="btn btn-outline btn-sm" onclick="this.closest('.modal-overlay').remove()">关闭</button>
        <button class="btn btn-primary btn-sm" id="forge-ok" ${forgeQty > 0 ? '' : 'disabled'}>锻造（消耗1个锻铁）</button>
      </div>`
    });

    const btn = document.getElementById('forge-ok');
    if (btn) btn.addEventListener('click', async () => {
      const outcome = await UI.runLockedAction('forge', btn, '锻造中...', () => Game.forge());
      const result = outcome.started ? outcome.value : null;
      if (result) {
        // 显示锻造结果
        const q = QUALITY[result.quality] || QUALITY[1];
        const canEquip = canEquipAxeQuality(result.quality, Game.state.realmLevel);
        const minRealm = getMinRealmForAxeQuality(result.quality);
        const lockHint = canEquip ? '' : `
          <div style="margin-top:10px;font-size:12px;color:var(--error);background:var(--error)12;border-radius:8px;padding:6px 10px;display:inline-block">
            🔒 需达到【${minRealm?.name || '?'}】才能装备，已放入背包
          </div>
        `;
        const resultOverlay = UI.modal(`
          <div style="text-align:center;padding:16px 0">
            <div style="margin-bottom:12px;animation:tree-shake 0.5s ease-in-out;display:flex;align-items:center;justify-content:center;height:80px">${renderItemIcon(result.itemId || result.item.id, result.item.icon, 'item-icon-lg')}</div>
            <div style="font-size:20px;font-weight:700;color:${q.color}">${result.item.name}</div>
            <div style="margin-top:4px">${UI.qualityTag(result.quality)}</div>
            <div style="font-size:12px;color:var(--text-secondary);margin-top:8px">${result.item.desc}</div>
            ${result.item.skillDesc ? `<div style="font-size:12px;color:var(--accent);margin-top:8px">🌟 ${result.item.skillDesc}</div>` : ''}
            ${lockHint}
          </div>
        `, {
          title: '🎉 锻造成功',
          footer: `<div class="modal-footer">
            <button class="btn btn-primary btn-sm" onclick="PlayerView.showForge()">继续锻造</button>
            ${canEquip ? `<button class="btn btn-accent btn-sm" onclick="PlayerView._equipFromForge('${result.itemId}',this)">立即装备</button>` : ''}
          </div>`
        });
        // X按钮和遮罩关闭后，回到锻造弹窗（刷新按钮状态和锻铁数量）
        const closeBtn = resultOverlay.querySelector('.modal-close');
        if (closeBtn) {
          closeBtn.onclick = () => { resultOverlay.remove(); PlayerView.showForge(); };
        }
        resultOverlay.addEventListener('click', (e) => {
          if (e.target === resultOverlay) { resultOverlay.remove(); PlayerView.showForge(); }
        });
      }
    });
  },

  // 十连砍
  async doChopTen() {
    if (Game.state.choppingCount < 10) {
      UI.toast('砍树次数不足10次，已自动取消十连砍', 'warn');
      this._tenChopMode = false;
      this.renderCultivate();
      return;
    }

    const chopBtn = document.getElementById('chop-btn');
    const treeIcon = document.getElementById('tree-icon');
    const scene = document.getElementById('tree-area');
    const outcome = await UI.runLockedAction('chop', chopBtn, '', async () => {

    const results = [];
    const scatterEls = [];

    // 连砍期间保留砍树末帧，避免网络等待时插入待机动作。
    try {
      for (let i = 0; i < 10; i++) {
        const characterAnimation = CultivatorAnimator.playChop({ resumeIdle: false });
        CultivationEffects.playHit({ scene, tree: treeIcon, intensity: 1 });
        if (treeIcon) {
          treeIcon.classList.add('shaking');
          setTimeout(() => treeIcon && treeIcon.classList.remove('shaking'), 250);
        }

        const item = await Game.chop();
        await characterAnimation;
        if (item) {
          results.push(item);
          if (treeIcon) {
            const el = UI.playScatterAnimation(item, treeIcon, i);
            if (el) scatterEls.push(el);
          }
          if (item.extraDrop) {
            results.push(item.extraDrop);
            if (treeIcon) {
              const extraEl = UI.playScatterAnimation(item.extraDrop, treeIcon, i + 0.5);
              if (extraEl) scatterEls.push(extraEl);
            }
          }
        }
      }
    } finally {
      CultivatorAnimator.resumeIdle();
    }

    // 等待一会儿让玩家看清地上的物品
    await new Promise(r => setTimeout(r, 700));

    // 淡出所有散落物品
    scatterEls.forEach(el => {
      if (el) el.classList.add('scatter-fade');
    });
    await new Promise(r => setTimeout(r, 500));
    scatterEls.forEach(el => { if (el) el.remove(); });

    // 显示结果弹窗
    const itemsHtml = results.map(r => {
      const extraTag = r.isExtra ? '<div style="font-size:10px;color:var(--warning);font-weight:600">额外掉落</div>' : '';
      const buffTag = r.buffText ? `<div style="font-size:10px;color:var(--quality-4)">${r.buffText}</div>` : '';
      let icon, name, color;
      if (r.kind === 'coin') { icon = renderItemIcon('0', '🪙', 'item-icon-sm'); name = '游戏币'; color = '#d4af37'; }
      else if (r.kind === 'chopping') { icon = renderItemIcon('1', '🪓', 'item-icon-sm'); name = '砍树次数'; color = '#4a90d9'; }
      else {
        const q = QUALITY[r.quality] || QUALITY[1];
        icon = r.item ? renderItemIcon(r.itemId, r.item.icon, 'item-icon-sm') : '🎁';
        name = r.item ? r.item.name : '道具';
        color = q.color;
      }
      return `<div style="text-align:center;padding:8px;border:1px solid ${color}40;border-radius:8px;background:${color}10">
        <div style="display:flex;align-items:center;justify-content:center;height:40px">${icon}</div>
        <div style="font-size:11px;font-weight:600;color:${color};margin-top:2px">${name}</div>
        <div style="font-size:10px;color:var(--text-light)">×${r.quantity}</div>
        ${extraTag}
        ${buffTag}
      </div>`;
    }).join('');

    UI.modal(`
      <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:6px">
        ${itemsHtml}
      </div>
    `, {
      title: `🎉 十连砍结果（共 ${results.length} 件）`,
      footer: `<div class="modal-footer">
        <button class="btn btn-primary btn-sm" onclick="this.closest('.modal-overlay').remove();PlayerView.renderCultivate()">确定</button>
      </div>`
    });

    PlayerView.renderCultivate();
    return true;
    });
    return outcome.started && outcome.value;
  },

  // 删除邮件
  async deleteMail(mailId) {
    UI.confirm('确定删除这封邮件吗？', async () => {
      await DB.deleteMail(mailId);
      UI.toast('已删除', 'success');
      // 关闭所有弹窗并重新打开邮件列表
      document.querySelectorAll('.modal-overlay').forEach(el => el.remove());
      this.showMailModal();
    });
  },

  // 提现记录
  showWithdrawRecords() {
    DB.getWithdrawals().then(records => {
      if (records.length === 0) {
        UI.modal('<p style="text-align:center;padding:24px;color:var(--text-secondary)">暂无提现记录</p>', { title: '提现记录' });
        return;
      }
      const html = records.map(r => `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--border-light)">
          <div>
            <div style="font-weight:600">¥${r.amount.toFixed(2)}</div>
            <div style="font-size:11px;color:var(--text-light)">${r.createdAt?.split('T')[0] || ''}</div>
          </div>
          ${UI.statusTag(r.status)}
        </div>
      `).join('');
      UI.modal(html, { title: '提现记录' });
    });
  },
};

/* ================================================================
   天道视图
   ================================================================ */
const AdminView = {
  // --- 任务管理 ---
  async renderTaskManage() {
    const main = document.getElementById('admin-main');
    const tasks = await DB.getAllTasks();

    main.innerHTML = `
      <div class="page-title">📜 任务管理</div>
      <div class="page-subtitle">发布和管理修仙任务</div>

      <button class="btn btn-primary btn-block" style="margin-bottom:16px" onclick="AdminView.showCreateTask()">
        ➕ 新建任务
      </button>

      <div class="filter-bar">
        <div class="filter-chip active" data-filter="all" onclick="AdminView.filterAdminTasks('all')">全部</div>
        <div class="filter-chip" data-filter="published" onclick="AdminView.filterAdminTasks('published')">已发布</div>
        <div class="filter-chip" data-filter="draft" onclick="AdminView.filterAdminTasks('draft')">发布池</div>
        <div class="filter-chip" data-filter="theme" onclick="AdminView.filterAdminTasks('theme')">🎨 主题</div>
        <div class="filter-chip" data-filter="weekly" onclick="AdminView.filterAdminTasks('weekly')">每周</div>
        <div class="filter-chip" data-filter="daily" onclick="AdminView.filterAdminTasks('daily')">每日</div>
      </div>

      <div id="admin-task-list"></div>
    `;

    this._adminTasks = tasks;
    this._adminTaskFilter = 'all';
    this._renderAdminTaskList();
  },

  _adminTasks: [],
  _adminTaskFilter: 'all',

  filterAdminTasks(filter) {
    this._adminTaskFilter = filter;
    document.querySelectorAll('.filter-chip').forEach(el => {
      el.classList.toggle('active', el.dataset.filter === filter);
    });
    this._renderAdminTaskList();
  },

  _renderAdminTaskList() {
    const list = document.getElementById('admin-task-list');
    if (!list) return;

    let tasks = this._adminTasks;
    const f = this._adminTaskFilter;
    if (f === 'published' || f === 'draft') {
      tasks = tasks.filter(t => t.status === f);
    } else if (f === 'weekly' || f === 'daily' || f === 'theme') {
      tasks = tasks.filter(t => t.taskType === f);
    }

    if (tasks.length === 0) {
      list.innerHTML = `<div class="empty-state"><div class="emoji">📭</div><p>暂无任务</p></div>`;
      return;
    }

    let html = '';
    tasks.forEach(task => {
      const rewardItems = task.rewardItems || [];
      let rewardHtml = '';
      if (task.rewardChopping > 0) rewardHtml += `<span class="reward-chopping" style="display:inline-flex;align-items:center;gap:3px">${renderItemIcon('1', '🪓', 'item-icon-xs')} ×${task.rewardChopping}</span>`;
      rewardItems.forEach(ri => {
        const def = ITEMS[ri.item_id];
        if (def) rewardHtml += `<span style="display:inline-flex;align-items:center;gap:2px;font-size:14px">${renderItemIcon(ri.item_id, def.icon, 'item-icon-xs')}×${ri.quantity}</span>`;
      });

      const statusBadge = task.status === 'draft'
        ? '<span class="tag" style="background:#fff3cd;color:#856404;font-size:11px">发布池</span>'
        : '<span class="tag" style="background:#d4edda;color:#155724;font-size:11px">已发布</span>';

      const themeBadge = task.themeName
        ? `<span class="tag" style="background:#e8daef;color:#6c3483;font-size:11px">🎨 ${task.themeName}${task.themeStart && task.themeEnd ? ` · ${task.themeStart}~${task.themeEnd}` : ''}</span>`
        : '';

      const statusBtn = task.status === 'draft'
        ? `<button class="btn btn-primary btn-sm" onclick="AdminView.publishTask('${task.id}')">发布</button>`
        : `<button class="btn btn-outline btn-sm" onclick="AdminView.unpublishTask('${task.id}')">撤回</button>`;

      html += `
        <div class="task-card">
          <div class="task-card-header">
            <div class="task-title">${task.title}</div>
            <div style="display:flex;gap:4px;flex-wrap:wrap;justify-content:flex-end">
              ${themeBadge}
              ${statusBadge}
              ${task.difficulty ? UI.difficultyTag(task.difficulty) : ''}
            </div>
          </div>
          <div class="task-desc">${task.description || ''}</div>
          <div class="task-meta">
            ${UI.taskTypeTag(task.taskType)}
            ${rewardHtml}
          </div>
          <div class="task-actions">
            ${statusBtn}
            <button class="btn btn-outline btn-sm btn-danger" onclick="AdminView.deleteTask('${task.id}')">删除</button>
          </div>
        </div>
      `;
    });
    list.innerHTML = html;
  },

  showCreateTask() {
    const overlay = UI.modal(`
      <div class="form-group">
        <label>任务类型</label>
        <select id="new-task-type" onchange="PlayerView._onCreateTaskTypeChange(this.closest('.modal-overlay'))">
          <option value="weekly">每周任务</option>
          <option value="daily">每日任务</option>
          <option value="theme">🎨 主题任务（周期活动）</option>
        </select>
      </div>
      <div class="form-group">
        <label>任务名称</label>
        <input type="text" id="new-task-title" placeholder="比如：主动和室友一起吃饭">
      </div>
      <div class="form-group">
        <label>任务描述</label>
        <textarea id="new-task-desc" placeholder="描述一下这个任务..."></textarea>
      </div>
      <div class="form-group">
        <label>难度</label>
        <select id="new-task-diff">
          <option value="C">C级</option>
          <option value="B">B级</option>
          <option value="A">A级</option>
          <option value="S">S级</option>
        </select>
      </div>
      <div class="form-group">
        <label>奖励砍树次数</label>
        <input type="number" id="new-task-chopping" value="3" min="0">
      </div>
      <div class="form-group">
        <label>奖励道具（格式：道具ID:数量，用逗号分隔）</label>
        <input type="text" id="new-task-items" placeholder="比如：40001:2,20001:1">
        <div style="font-size:11px;color:var(--text-light);margin-top:4px">
          道具ID：40001(锻造石) / 30001(期石) / 30101(望石) / 30201(待石) / 20001(铜珠) / 20101(银锭) / 20201(金元宝) / 20301(灵玉)
        </div>
      </div>
      <div style="border-top:1px solid var(--border);margin:12px 0;padding-top:12px" id="new-task-theme-box">
        <div style="font-weight:600;margin-bottom:8px;font-size:13px">🎨 主题设置<span id="theme-required-hint" style="color:var(--danger);display:none">（主题任务必填）</span></div>
        <div class="form-group">
          <label>主题名称（如：开学季）</label>
          <input type="text" id="new-task-theme" placeholder="比如：开学季 · 收心行动">
        </div>
        <div style="display:flex;gap:8px">
          <div class="form-group" style="flex:1">
            <label>开始日期</label>
            <input type="date" id="new-task-theme-start">
          </div>
          <div class="form-group" style="flex:1">
            <label>结束日期</label>
            <input type="date" id="new-task-theme-end">
          </div>
        </div>
        <div style="font-size:11px;color:var(--text-light);margin-top:-4px">
          主题任务仅在起止时间内对玩家展示；活动结束后自动隐藏，显示“尽情期待”。
        </div>
      </div>
      <div class="form-group">
        <label>发布状态</label>
        <select id="new-task-status">
          <option value="draft">放入发布池（不立即发布）</option>
          <option value="published">直接发布</option>
        </select>
      </div>
    `, {
      title: '新建任务',
      footer: `<div class="modal-footer">
        <button class="btn btn-outline btn-sm" onclick="this.closest('.modal-overlay').remove()">取消</button>
        <button class="btn btn-primary btn-sm" id="create-task-ok">创建</button>
      </div>`
    });

    overlay.querySelector('#create-task-ok').addEventListener('click', async () => {
      const taskType = document.getElementById('new-task-type').value;
      const title = document.getElementById('new-task-title').value.trim();
      const desc = document.getElementById('new-task-desc').value.trim();
      const difficulty = document.getElementById('new-task-diff').value;
      const rewardChopping = parseInt(document.getElementById('new-task-chopping').value) || 0;
      const itemsStr = document.getElementById('new-task-items').value.trim();
      const themeName = document.getElementById('new-task-theme').value.trim() || null;
      const themeStart = document.getElementById('new-task-theme-start').value || null;
      const themeEnd = document.getElementById('new-task-theme-end').value || null;
      const status = document.getElementById('new-task-status').value;

      if (!title) { UI.toast('请填写任务名称', 'warn'); return; }

      // 主题任务：主题名 + 起止时间必填；非主题任务强制清空主题字段
      let finalThemeName = null, finalThemeStart = null, finalThemeEnd = null;
      if (taskType === 'theme') {
        if (!themeName) { UI.toast('请填写主题名称', 'warn'); return; }
        if (!themeStart || !themeEnd) { UI.toast('请设置主题活动的起止日期', 'warn'); return; }
        if (themeEnd < themeStart) { UI.toast('结束日期不能早于开始日期', 'warn'); return; }
        finalThemeName = themeName; finalThemeStart = themeStart; finalThemeEnd = themeEnd;
      }

      let rewardItems = [];
      if (itemsStr) {
        rewardItems = itemsStr.split(',').map(s => {
          const [itemId, qty] = s.trim().split(':');
          return { item_id: itemId.trim(), quantity: parseInt(qty) || 1 };
        }).filter(i => i.item_id && ITEMS[i.item_id]);
      }

      await DB.createTask({
        taskType,
        title,
        description: desc,
        difficulty,
        rewardChopping,
        rewardItems,
        status,
        themeName: finalThemeName,
        themeStart: finalThemeStart,
        themeEnd: finalThemeEnd,
        sortOrder: this._adminTasks.length,
      });

      UI.closeModal(overlay);
      UI.toast(taskType === 'theme' ? '主题任务创建成功' : '任务创建成功', 'success');
      this.renderTaskManage();
    });

    // 初始化主题必填提示的显隐
    this._onCreateTaskTypeChange(overlay);
  },

  // 创建任务弹窗：切换任务类型时，主题任务高亮主题设置为必填
  _onCreateTaskTypeChange(overlayArg) {
    const ov = overlayArg || document.querySelector('.modal-overlay:last-child');
    if (!ov) return;
    const typeEl = ov.querySelector('#new-task-type');
    const hint = ov.querySelector('#theme-required-hint');
    if (!typeEl || !hint) return;
    const isTheme = typeEl.value === 'theme';
    hint.style.display = isTheme ? 'inline' : 'none';
  },

  deleteTask(id) {
    UI.confirm('确定删除这个任务吗？', async () => {
      await DB.deleteTask(id);
      UI.toast('已删除', 'success');
      this.renderTaskManage();
    });
  },

  async publishTask(id) {
    const ok = await DB.updateTaskStatus(id, 'published');
    if (ok) {
      UI.toast('任务已发布', 'success');
      this.renderTaskManage();
    }
  },

  async unpublishTask(id) {
    UI.confirm('确定撤回这个任务吗？玩家将看不到它。', async () => {
      const ok = await DB.updateTaskStatus(id, 'draft');
      if (ok) {
        UI.toast('任务已撤回到发布池', 'success');
        this.renderTaskManage();
      }
    });
  },

  // --- 审核 ---
  async renderReview() {
    const main = document.getElementById('admin-main');
    const submissions = await DB.getSubmissions();

    main.innerHTML = `
      <div class="page-title">✅ 任务审核</div>
      <div class="page-subtitle">审批修炼者提交的任务</div>

      <div class="filter-bar">
        <div class="filter-chip active" data-filter="pending" onclick="AdminView.filterReview('pending')">待审核</div>
        <div class="filter-chip" data-filter="approved" onclick="AdminView.filterReview('approved')">已通过</div>
        <div class="filter-chip" data-filter="rejected" onclick="AdminView.filterReview('rejected')">已驳回</div>
        <div class="filter-chip" data-filter="all" onclick="AdminView.filterReview('all')">全部</div>
      </div>

      <div id="review-list"></div>
    `;

    this._submissions = submissions;
    this._reviewFilter = 'pending';
    this._renderReviewList();
  },

  _submissions: [],
  _reviewFilter: 'pending',

  filterReview(filter) {
    this._reviewFilter = filter;
    document.querySelectorAll('.filter-chip').forEach(el => {
      el.classList.toggle('active', el.dataset.filter === filter);
    });
    this._renderReviewList();
  },

  _renderReviewList() {
    const list = document.getElementById('review-list');
    if (!list) return;

    let subs = this._submissions;
    if (this._reviewFilter !== 'all') {
      subs = subs.filter(s => s.status === this._reviewFilter);
    }

    if (subs.length === 0) {
      list.innerHTML = `<div class="empty-state"><div class="emoji">🎉</div><p>暂无${this._reviewFilter === 'pending' ? '待审核' : ''}任务</p></div>`;
      return;
    }

    let html = '';
    subs.forEach(sub => {
      const date = new Date(sub.submittedAt).toLocaleDateString('zh-CN');
      const isSelf = sub.isSelfTask;

      html += `
        <div class="task-card">
          <div class="task-card-header">
            <div class="task-title">${sub.selfTitle || sub.taskTitle}</div>
            ${UI.statusTag(sub.status)}
          </div>
          <div class="task-meta">
            ${UI.taskTypeTag(sub.taskType)}
            ${isSelf ? '<span class="tag tag-type-self">自主申报</span>' : ''}
            <span style="font-size:12px;color:var(--text-light)">${date}</span>
          </div>
          <div class="task-desc">📝 ${sub.description || ''}</div>
          ${sub.reviewNote ? `<div class="task-desc" style="color:var(--accent)">💬 ${sub.reviewNote}</div>` : ''}
          ${sub.status === 'pending' ? `
            <div class="task-actions" style="margin-top:10px">
              <button class="btn btn-outline btn-sm" onclick="AdminView.rejectSub('${sub.id}')">驳回</button>
              <button class="btn btn-accent btn-sm" onclick="AdminView.approveSub('${sub.id}', ${sub.isSelfTask})">通过</button>
            </div>
          ` : ''}
        </div>
      `;
    });
    list.innerHTML = html;
  },

  approveSub(id, isSelf) {
    if (isSelf) {
      // 自主任务需要配置奖励
      const overlay = UI.modal(`
        <div class="form-group">
          <label>奖励砍树次数</label>
          <input type="number" id="approve-chopping" value="3" min="0">
        </div>
        <div class="form-group">
          <label>奖励道具（道具ID:数量，逗号分隔）</label>
          <input type="text" id="approve-items" placeholder="比如：40001:2,20001:1">
        </div>
        <div class="form-group">
          <label>难度评级</label>
          <select id="approve-diff">
            <option value="C">C级</option>
            <option value="B" selected>B级</option>
            <option value="A">A级</option>
            <option value="S">S级</option>
          </select>
        </div>
        <div class="form-group">
          <label>评语</label>
          <textarea id="approve-note" placeholder="给修炼者一些鼓励的话..."></textarea>
        </div>
      `, {
        title: '审批通过 - 配置奖励',
        footer: `<div class="modal-footer">
          <button class="btn btn-outline btn-sm" onclick="this.closest('.modal-overlay').remove()">取消</button>
          <button class="btn btn-accent btn-sm" id="approve-ok">确认通过</button>
        </div>`
      });

      overlay.querySelector('#approve-ok').addEventListener('click', async () => {
        const chopping = parseInt(document.getElementById('approve-chopping').value) || 0;
        const itemsStr = document.getElementById('approve-items').value.trim();
        const note = document.getElementById('approve-note').value.trim();

        let rewardItems = [];
        if (itemsStr) {
          rewardItems = itemsStr.split(',').map(s => {
            const [itemId, qty] = s.trim().split(':');
            return { item_id: itemId.trim(), quantity: parseInt(qty) || 1 };
          }).filter(i => i.item_id && ITEMS[i.item_id]);
        }

        await DB.reviewSubmission(id, 'approved', note, chopping, rewardItems);
        // 邮件只做通知，奖励物品在任务列表领取（防止双倍领取）
        await DB.sendMail(
          '任务审核通过',
          `你的自主申报任务已通过！奖励：${chopping} 次砍树${note ? '\n\n评语：' + note : ''}\n\n请前往任务列表领取奖励。`,
          []
        );

        UI.closeModal(overlay);
        UI.toast('已通过', 'success');
        this.renderReview();
      });
    } else {
      // 固定任务直接通过
      const sub = this._submissions.find(s => s.id == id);
      if (sub && (sub.status === 'approved' || sub.status === 'claimed')) {
        UI.toast('该任务已审核通过，请勿重复操作', 'warn');
        return;
      }
      UI.confirm('确定通过这个任务？', async () => {
        await DB.reviewSubmission(id, 'approved', '任务完成得很好！', sub.rewardChopping, sub.rewardItems);
        await DB.sendMail(
          '任务审核通过',
          `你的任务"${sub.taskTitle}"已通过审核，奖励已发放至任务列表，请前往领取。`,
          []
        );
        UI.toast('已通过', 'success');
        this.renderReview();
      });
    }
  },

  rejectSub(id) {
    const overlay = UI.modal(`
      <div class="form-group">
        <label>驳回原因</label>
        <textarea id="reject-note" placeholder="告诉修炼者为什么被驳回..."></textarea>
      </div>
    `, {
      title: '驳回任务',
      footer: `<div class="modal-footer">
        <button class="btn btn-outline btn-sm" onclick="this.closest('.modal-overlay').remove()">取消</button>
        <button class="btn btn-primary btn-sm" id="reject-ok">确认驳回</button>
      </div>`
    });

    overlay.querySelector('#reject-ok').addEventListener('click', async () => {
      const note = document.getElementById('reject-note').value.trim() || '任务未完成，请继续努力';
      await DB.reviewSubmission(id, 'rejected', note, 0, []);
      const sub = this._submissions.find(s => s.id == id);
      await DB.sendMail(
        '任务审核未通过',
        `你的任务"${sub?.selfTitle || sub?.taskTitle || ''}"未通过审核。\n\n原因：${note}`,
        []
      );
      UI.closeModal(overlay);
      UI.toast('已驳回', 'success');
      this.renderReview();
    });
  },

  // --- 提现审批 ---
  async renderWithdrawReview() {
    const main = document.getElementById('admin-main');
    const withdrawals = await DB.getWithdrawals();

    main.innerHTML = `
      <div class="page-title">💰 提现审批</div>
      <div class="page-subtitle">审批修炼者的提现申请</div>

      <div class="filter-bar">
        <div class="filter-chip active" data-filter="pending" onclick="AdminView.filterWithdraw('pending')">待处理</div>
        <div class="filter-chip" data-filter="approved" onclick="AdminView.filterWithdraw('approved')">已通过</div>
        <div class="filter-chip" data-filter="rejected" onclick="AdminView.filterWithdraw('rejected')">已驳回</div>
        <div class="filter-chip" data-filter="all" onclick="AdminView.filterWithdraw('all')">全部</div>
      </div>

      <div id="withdraw-review-list"></div>
    `;

    this._withdrawals = withdrawals;
    this._withdrawFilter = 'pending';
    this._renderWithdrawReviewList();
  },

  _withdrawals: [],
  _withdrawFilter: 'pending',

  filterWithdraw(filter) {
    this._withdrawFilter = filter;
    document.querySelectorAll('.filter-chip').forEach(el => {
      el.classList.toggle('active', el.dataset.filter === filter);
    });
    this._renderWithdrawReviewList();
  },

  _renderWithdrawReviewList() {
    const list = document.getElementById('withdraw-review-list');
    if (!list) return;

    let ws = this._withdrawals;
    if (this._withdrawFilter !== 'all') {
      ws = ws.filter(w => w.status === this._withdrawFilter);
    }

    if (ws.length === 0) {
      list.innerHTML = `<div class="empty-state"><div class="emoji">💸</div><p>暂无提现申请</p></div>`;
      return;
    }

    let html = '';
    ws.forEach(w => {
      const date = new Date(w.createdAt).toLocaleString('zh-CN');
      html += `
        <div class="task-card">
          <div class="task-card-header">
            <div class="task-title">提现 ¥${w.amount.toFixed(2)}</div>
            ${UI.statusTag(w.status)}
          </div>
          <div class="task-desc" style="font-size:12px">申请时间：${date}</div>
          ${w.status === 'pending' ? `
            <div class="task-actions" style="margin-top:10px">
              <button class="btn btn-outline btn-sm" onclick="AdminView.rejectWithdraw('${w.id}',this)">驳回</button>
              <button class="btn btn-accent btn-sm" onclick="AdminView.approveWithdraw('${w.id}',this)">通过</button>
            </div>
          ` : ''}
        </div>
      `;
    });
    list.innerHTML = html;
  },

  approveWithdraw(id, button) {
    UI.confirm('确定通过这笔提现申请？', async () => {
      const outcome = await UI.runLockedAction(
        `withdraw-review:${id}`,
        button,
        '处理中...',
        async () => {
          const reserved = await DB.reviewWithdrawalOnce(id, 'approved');
          if (!reserved) {
            UI.toast('该申请已审核，请刷新查看', 'warn');
            return false;
          }

          const w = this._withdrawals.find(x => x.id == id);
          const state = await DB.getPlayerState();
          if (!state || !w) return false;
          const saved = await DB.updatePlayerState({
            totalWithdrawn: state.totalWithdrawn + w.amount,
          });
          if (!saved) return false;

          const mailed = await DB.sendMail(
            '提现已到账',
            `你的提现申请 ¥${w.amount.toFixed(2)} 已通过，款项已发放。`,
            [],
          );
          if (!mailed) console.error('withdraw approval mail failed:', id);
          UI.toast('已通过', 'success');
          await this.renderWithdrawReview();
          return true;
        },
      );
      return outcome.started && outcome.value;
    });
  },

  rejectWithdraw(id, button) {
    UI.confirm('确定驳回这笔提现申请？', async () => {
      const outcome = await UI.runLockedAction(
        `withdraw-review:${id}`,
        button,
        '处理中...',
        async () => {
          const reserved = await DB.reviewWithdrawalOnce(id, 'rejected');
          if (!reserved) {
            UI.toast('该申请已审核，请刷新查看', 'warn');
            return false;
          }

          const w = this._withdrawals.find(x => x.id == id);
          const state = await DB.getPlayerState();
          if (!state || !w) return false;
          const saved = await DB.updatePlayerState({ balance: state.balance + w.amount });
          if (!saved) return false;

          const mailed = await DB.sendMail(
            '提现申请被驳回',
            `你的提现申请 ¥${w.amount.toFixed(2)} 被驳回，金额已退回余额。`,
            [],
          );
          if (!mailed) console.error('withdraw rejection mail failed:', id);
          UI.toast('已驳回', 'success');
          await this.renderWithdrawReview();
          return true;
        },
      );
      return outcome.started && outcome.value;
    });
  },

  // --- 查看玩家 ---
  async renderPlayerView() {
    const main = document.getElementById('admin-main');
    const state = await DB.getPlayerState();
    const inventory = state ? await DB.getInventory() : [];
    const mails = state ? await DB.getMails() : [];

    if (!state) {
      main.innerHTML = `
        <div class="page-title">👁️ 查看玩家</div>
        <div class="page-subtitle">了解修炼者的修行进度</div>
        <div class="empty-state" style="padding:48px 24px">
          <div class="emoji">😶</div>
          <p>修炼者尚未开始修仙</p>
          <p style="font-size:12px;color:var(--text-light)">等待修炼者首次登录后即可查看数据</p>
        </div>
      `;
      return;
    }

    const axeDef = ITEMS[state.axeId] || ITEMS['51001'];

    main.innerHTML = `
      <div class="page-title">👁️ 查看玩家</div>
      <div class="page-subtitle">了解修炼者的修行进度</div>

      <div class="stats-row">
        <div class="stat-card">
          <div class="stat-num">${state.level}</div>
          <div class="stat-label">等级</div>
        </div>
        <div class="stat-card">
          <div class="stat-num">${state.choppingCount}</div>
          <div class="stat-label">🪓 砍树次数</div>
        </div>
        <div class="stat-card">
          <div class="stat-num" style="font-size:18px">¥${state.balance.toFixed(2)}</div>
          <div class="stat-label">余额</div>
        </div>
      </div>

      <div class="card">
        <div class="card-title">🪓 装备：${axeDef.name}</div>
        <div style="display:flex;align-items:center;gap:12px">
          <div style="display:flex;align-items:center;height:60px">${renderItemIcon(state.axeId, axeDef.icon, 'item-icon-lg')}</div>
          <div>
            <div style="font-weight:600">${axeDef.name}</div>
            <div style="font-size:12px;color:var(--text-secondary)">${axeDef.desc}</div>
            ${axeDef.skillDesc ? `<div style="font-size:12px;color:var(--accent);margin-top:4px">🌟 ${axeDef.skillDesc}</div>` : ''}
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-title">🎒 背包（${inventory.length} 种道具）</div>
        <div style="display:flex;flex-wrap:wrap;gap:8px">
          ${inventory.slice(0, 20).map(inv => {
            const def = ITEMS[inv.itemId];
            if (!def) return '';
            return `<div style="text-align:center;width:48px">
              <div style="display:flex;justify-content:center;align-items:center;height:36px">${renderItemIcon(inv.itemId, def.icon, 'item-icon-sm')}</div>
              <div style="font-size:10px;color:var(--text-light)">×${inv.quantity}</div>
            </div>`;
          }).join('')}
        </div>
      </div>

      <div class="card">
        <div class="card-title">📊 数据</div>
        <table class="data-table">
          <tr><td>仙树等级</td><td>Lv.${state.treeLevel} (${TREE_LEVELS[state.treeLevel]?.name || ''})</td></tr>
          <tr><td>经验值</td><td>${state.exp} / ${getExpForLevel(state.level)}</td></tr>
          <tr><td>累计提现</td><td>¥${state.totalWithdrawn.toFixed(2)}</td></tr>
          <tr><td>邮件数</td><td>${mails.length} 封</td></tr>
        </table>
      </div>
    `;
  },

  // --- GM工具 ---
  async renderGM() {
    const main = document.getElementById('admin-main');
    const state = await DB.getPlayerState();
    const inventory = state ? await DB.getInventory() : [];

    // 按类型分组道具列表
    const typeNames = { 1: '合成材料', 2: '兑现道具', 3: '突破道具', 4: '锻造道具', 5: '仙斧装备' };
    let itemOptions = '<option value="">-- 选择道具 --</option>';
    const groupedItems = {};
    (GAME_CONFIG?.itemTable || []).forEach(item => {
      const t = item.type;
      if (!groupedItems[t]) groupedItems[t] = [];
      groupedItems[t].push(item);
    });
    Object.keys(groupedItems).sort().forEach(t => {
      itemOptions += `<optgroup label="${typeNames[t] || '类型' + t}">`;
      groupedItems[t].forEach(item => {
        const qName = QUALITY[item.quality]?.name || '';
        itemOptions += `<option value="${item.id}">${itemEmoji(item.id)} ${item.name} (${qName}) [${item.id}]</option>`;
      });
      itemOptions += '</optgroup>';
    });

    main.innerHTML = `
      <div class="page-title">🛠️ GM工具</div>
      <div class="page-subtitle">测试用·发放资源与道具</div>

      ${state ? `
      <div class="stats-row">
        <div class="stat-card">
          <div class="stat-num">${state.choppingCount}</div>
          <div class="stat-label">🪓 砍树次数</div>
        </div>
        <div class="stat-card">
          <div class="stat-num">${state.level}</div>
          <div class="stat-label">等级</div>
        </div>
        <div class="stat-card">
          <div class="stat-num" style="font-size:16px">${ITEMS[state.axeId]?.name || '未知'}</div>
          <div class="stat-label">🪓 装备</div>
        </div>
      </div>
      ` : '<div class="empty-state" style="padding:24px"><p>玩家尚未初始化，先去玩家端登录一次</p></div>'}

      <!-- 发放砍树次数 -->
      <div class="card">
        <div class="card-title">🪓 发放砍树次数</div>
        <div style="display:flex;gap:8px;align-items:flex-end">
          <div class="form-group" style="flex:1;margin-bottom:0">
            <label>数量</label>
            <input type="number" id="gm-chopping-count" value="100" min="1" style="width:100%">
          </div>
          <button class="btn btn-primary" onclick="AdminView.gmGiveChopping()">发放</button>
        </div>
        <div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap">
          <button class="btn btn-outline btn-sm" onclick="AdminView.gmSetChopping(1000)">设为1000</button>
          <button class="btn btn-outline btn-sm" onclick="AdminView.gmSetChopping(9999)">设为9999</button>
          <button class="btn btn-outline btn-sm" onclick="AdminView.gmGiveChopping(10)">+10</button>
          <button class="btn btn-outline btn-sm" onclick="AdminView.gmGiveChopping(100)">+100</button>
        </div>
      </div>

      <!-- 发放道具 -->
      <div class="card">
        <div class="card-title">🎒 发放道具</div>
        <div class="form-group">
          <label>选择道具</label>
          <select id="gm-item-id" style="width:100%">
            ${itemOptions}
          </select>
        </div>
        <div class="form-group">
          <label>数量</label>
          <input type="number" id="gm-item-qty" value="10" min="1" style="width:100%">
        </div>
        <button class="btn btn-primary btn-block" onclick="AdminView.gmGiveItem()">发放道具</button>
        <div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap">
          <button class="btn btn-outline btn-sm" onclick="AdminView.gmGiveAllMaterials()">发放全套材料×10</button>
          <button class="btn btn-outline btn-sm" onclick="AdminView.gmGiveAllAxes()">发放全套仙斧×1</button>
          <button class="btn btn-outline btn-sm" onclick="AdminView.gmGiveBreakthroughItems()">发放突破道具×9</button>
        </div>
      </div>

      <!-- 等级/仙阶控制 -->
      <div class="card">
        <div class="card-title">⭐ 等级/仙阶控制</div>
        <div class="form-group">
          <label>设置等级</label>
          <input type="number" id="gm-level" value="${state?.level || 1}" min="1" max="150" style="width:100%">
        </div>
        <div style="display:flex;gap:8px">
          <button class="btn btn-primary btn-sm" style="flex:1" onclick="AdminView.gmSetLevel()">设置等级</button>
          <button class="btn btn-outline btn-sm" style="flex:1" onclick="AdminView.gmSetLevel(150)">直接满级</button>
        </div>
      </div>

      <!-- 重置数据 -->
      <div class="card" style="border:2px solid var(--danger,#e85a5a)">
        <div class="card-title" style="color:var(--danger,#e85a5a)">⚠️ 危险操作</div>
        <button class="btn btn-outline btn-block" style="border-color:var(--danger,#e85a5a);color:var(--danger,#e85a5a)" onclick="AdminView.gmClearInventory()">清空背包</button>
        <button class="btn btn-outline btn-block" style="border-color:var(--danger,#e85a5a);color:var(--danger,#e85a5a);margin-top:8px" onclick="AdminView.gmResetAll()">重置全部数据</button>
      </div>

      <!-- 当前背包 -->
      ${inventory.length > 0 ? `
      <div class="card">
        <div class="card-title">📋 当前背包（${inventory.length} 种）</div>
        <table class="data-table">
          ${inventory.map(inv => {
            const def = ITEMS[inv.itemId];
            const name = def ? `${itemEmoji(inv.itemId)} ${def.name}` : inv.itemId;
            return `<tr><td>${name}</td><td>×${inv.quantity}</td><td style="font-size:11px;color:var(--text-light)">${inv.itemId}</td></tr>`;
          }).join('')}
        </table>
      </div>
      ` : ''}
    `;
  },

  async gmGiveChopping(extra) {
    const count = extra || parseInt(document.getElementById('gm-chopping-count')?.value) || 0;
    if (count <= 0) { UI.toast('数量无效', 'error'); return; }
    const state = await DB.getPlayerState();
    if (!state) { UI.toast('玩家未初始化', 'error'); return; }
    const newCount = state.choppingCount + count;
    await DB.updatePlayerState({ choppingCount: newCount });
    UI.toast(`发放 ${count} 次砍树，当前 ${newCount} 次`, 'success');
    this.renderGM();
  },

  async gmSetChopping(count) {
    const state = await DB.getPlayerState();
    if (!state) { UI.toast('玩家未初始化', 'error'); return; }
    await DB.updatePlayerState({ choppingCount: count });
    UI.toast(`砍树次数设为 ${count}`, 'success');
    this.renderGM();
  },

  async gmGiveItem() {
    const itemId = document.getElementById('gm-item-id')?.value;
    const qty = parseInt(document.getElementById('gm-item-qty')?.value) || 1;
    if (!itemId) { UI.toast('请选择道具', 'error'); return; }
    const def = ITEMS[String(itemId)];
    if (def && def.type === 0) {
      // 游戏币 → 写入 player_state.coin
      const state = await DB.getPlayerState();
      const newCoin = (state?.coin || 0) + qty;
      await DB.updatePlayerState({ coin: newCoin });
      UI.toast(`发放 ${itemEmoji(itemId)} ${def.name} ×${qty}（当前 ${newCoin}）`, 'success');
    } else if (def && def.type === 6) {
      // 砍树次数 → 写入 player_state.choppingCount
      const state = await DB.getPlayerState();
      const newCount = (state?.choppingCount || 0) + qty;
      await DB.updatePlayerState({ choppingCount: newCount });
      UI.toast(`发放 ${itemEmoji(itemId)} ${def.name} ×${qty}（当前 ${newCount}）`, 'success');
    } else {
      await DB.addItem(itemId, qty);
      UI.toast(`发放 ${itemEmoji(itemId)} ${def?.name || itemId} ×${qty}`, 'success');
    }
    this.renderGM();
  },

  async gmGiveAllMaterials() {
    const materials = (GAME_CONFIG?.itemTable || []).filter(i => i.type === 1 || i.type === 2 || i.type === 4);
    for (const item of materials) {
      await DB.addItem(String(item.id), 10);
    }
    UI.toast(`已发放全套材料（${materials.length}种×10）`, 'success');
    this.renderGM();
  },

  async gmGiveAllAxes() {
    const axes = (GAME_CONFIG?.itemTable || []).filter(i => i.type === 5);
    for (const item of axes) {
      await DB.addItem(String(item.id), 1);
    }
    UI.toast(`已发放全套仙斧（${axes.length}种×1）`, 'success');
    this.renderGM();
  },

  async gmGiveBreakthroughItems() {
    const items = ['30101', '30201', '30301'];
    for (const id of items) {
      await DB.addItem(id, 9);
    }
    UI.toast('已发放突破道具（望石/待石/期石×9）', 'success');
    this.renderGM();
  },

  async gmSetLevel(level) {
    const lvl = level || parseInt(document.getElementById('gm-level')?.value) || 1;
    const state = await DB.getPlayerState();
    if (!state) { UI.toast('玩家未初始化', 'error'); return; }
    await DB.updatePlayerState({ level: lvl, exp: 0 });
    // 根据等级自动设置仙阶
    const realm = getRealmByLevel(lvl);
    await DB.updatePlayerState({ realmLevel: realm.realmId });
    UI.toast(`等级设为 ${lvl}（${realm.name}）`, 'success');
    this.renderGM();
  },

  async gmClearInventory() {
    UI.confirm('确定清空背包中所有道具？此操作不可恢复！', async () => {
      const { error } = await dbClient.from('inventory').delete().eq('user_role', 'player');
      if (error) { UI.toast('清空失败: ' + error.message, 'error'); return; }
      UI.toast('背包已清空', 'success');
      this.renderGM();
    });
  },

  async gmResetAll() {
    UI.confirm('确定重置全部数据？等级、背包、仙阶都会回到初始状态！', async () => {
      // 清空背包
      await dbClient.from('inventory').delete().eq('user_role', 'player');
      // 清空邮件
      await dbClient.from('mails').delete().eq('user_role', 'player');
      // 清空提现记录
      await dbClient.from('withdrawals').delete().eq('user_role', 'player');
      // 清空任务提交记录
      await dbClient.from('task_submissions').delete().eq('user_role', 'player');
      // 重置玩家状态
      await dbClient.from('player_state').delete().eq('user_role', 'player');
      UI.toast('全部数据已重置，请重新登录', 'success');
      // 重新初始化
      await Game.init();
      this.renderGM();
    });
  },
};

// 初始化（登录时调用 Game.init()）
console.log('寻道大千 · 修仙系统加载完成 🎋');
