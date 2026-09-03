/* ================================================================
   寻道大千 · 社交修仙系统
   ================================================================ */

// ===== 配置数据（后续迁到飞书表格） =====

// 道具配置
const ITEMS = {
  // 奖金碎片
  money_sm_frag: { id: 'money_sm_frag', name: '铜钱碎片', type: 1, quality: 1, icon: '🪙',
    composeTo: 'money_sm', composeCount: 10, desc: '零散的铜钱，集齐10枚可合成一贯' },
  money_mid_frag: { id: 'money_mid_frag', name: '银锭碎片', type: 1, quality: 2, icon: '🥈',
    composeTo: 'money_mid', composeCount: 5, desc: '银锭碎块，集齐5块可合成一锭' },
  money_lg_frag: { id: 'money_lg_frag', name: '金元宝碎片', type: 1, quality: 3, icon: '🥇',
    composeTo: 'money_lg', composeCount: 3, desc: '金元宝碎片，集齐3片可合成一锭' },
  // 奖金成品
  money_sm: { id: 'money_sm', name: '一贯铜钱', type: 2, quality: 2, icon: '💰',
    value: 10, desc: '可提现10元' },
  money_mid: { id: 'money_mid', name: '一锭白银', type: 2, quality: 3, icon: '🪙',
    value: 50, desc: '可提现50元' },
  money_lg: { id: 'money_lg', name: '金元宝', type: 2, quality: 4, icon: '👑',
    value: 200, desc: '可提现200元' },
  // 突破道具
  stone_break: { id: 'stone_break', name: '破境石', type: 3, quality: 3, icon: '💎',
    desc: '突破仙阶所需的神石' },
  // 锻造道具
  stone_forge: { id: 'stone_forge', name: '锻铁', type: 4, quality: 1, icon: '🔩',
    desc: '锻造仙斧的材料' },
  // 仙斧
  axe_stone: { id: 'axe_stone', name: '石斧', type: 5, quality: 1, icon: '🪓',
    skill: null, sellPrice: 1, desc: '最普通的石斧，勉强能用' },
  axe_iron: { id: 'axe_iron', name: '铁斧', type: 5, quality: 2, icon: '⛏️',
    skill: 'double_common', skillDesc: '砍树掉落凡品时有概率双倍', sellPrice: 3, desc: '铁制斧头，锋利了不少' },
  axe_bronze: { id: 'axe_bronze', name: '青铜斧', type: 5, quality: 3, icon: '🔨',
    skill: 'refund_chopping', skillDesc: '有概率返还砍树次数', sellPrice: 5, desc: '青铜锻造，蕴含灵气' },
  axe_jade: { id: 'axe_jade', name: '玉斧', type: 5, quality: 4, icon: '🗡️',
    skill: 'double_rare', skillDesc: '砍树掉落珍品及以上时有概率双倍', sellPrice: 10, desc: '灵玉雕琢，仙气缭绕' },
  axe_gold: { id: 'axe_gold', name: '开天斧', type: 5, quality: 5, icon: '⚔️',
    skill: 'super_lucky', skillDesc: '大幅提升稀有道具掉落率', sellPrice: 20, desc: '传说中的神器' },
};

// 品质配置
const QUALITY = {
  1: { name: '凡品', color: '#9e9e9e' },
  2: { name: '精品', color: '#4a90d9' },
  3: { name: '珍品', color: '#9c6bd4' },
  4: { name: '神品', color: '#e85a8a' },
  5: { name: '仙品', color: '#f0b429' },
};

// 奖池配置（按树等级）
const TREE_LEVELS = {
  1: {
    name: '小树苗',
    icon: '🌱',
    pools: [
      { quality: 1, weight: 60, items: ['money_sm_frag', 'stone_forge'] },
      { quality: 2, weight: 25, items: ['money_mid_frag', 'stone_forge'] },
      { quality: 3, weight: 12, items: ['money_lg_frag', 'stone_break'] },
      { quality: 4, weight: 2.5, items: ['money_mid', 'stone_break'] },
      { quality: 5, weight: 0.5, items: ['money_lg'] },
    ],
  },
  2: {
    name: '小树',
    icon: '🌿',
    pools: [
      { quality: 1, weight: 50, items: ['money_sm_frag', 'stone_forge'] },
      { quality: 2, weight: 30, items: ['money_mid_frag', 'stone_forge'] },
      { quality: 3, weight: 14, items: ['money_lg_frag', 'stone_break'] },
      { quality: 4, weight: 4.5, items: ['money_mid', 'stone_break'] },
      { quality: 5, weight: 1.5, items: ['money_lg', 'axe_iron'] },
    ],
  },
  3: {
    name: '仙树',
    icon: '🎋',
    pools: [
      { quality: 1, weight: 40, items: ['money_sm_frag', 'stone_forge'] },
      { quality: 2, weight: 32, items: ['money_mid_frag', 'stone_forge'] },
      { quality: 3, weight: 18, items: ['money_lg_frag', 'stone_break'] },
      { quality: 4, weight: 7, items: ['money_mid', 'stone_break'] },
      { quality: 5, weight: 3, items: ['money_lg', 'axe_bronze'] },
    ],
  },
};

// 角色等级经验表
function getExpForLevel(level) {
  return Math.floor(10 * Math.pow(level, 1.5));
}

// 商店（天道酬勤兑换）
const SHOP_ITEMS = [
  { id: 'shop_chopping_5', name: '砍树次数×5', icon: '🪓', costType: 'money', costValue: 10, rewardType: 'chopping', rewardValue: 5 },
  { id: 'shop_money_sm', name: '一贯铜钱', icon: '💰', costType: 'chopping', costValue: 3, rewardType: 'item', rewardId: 'money_sm', rewardValue: 1 },
  { id: 'shop_break', name: '破境石', icon: '💎', costType: 'chopping', costValue: 10, rewardType: 'item', rewardId: 'stone_break', rewardValue: 1 },
  { id: 'shop_forge_10', name: '锻铁×10', icon: '🔩', costType: 'chopping', costValue: 5, rewardType: 'item', rewardId: 'stone_forge', rewardValue: 10 },
];

// 仙阶表
const REALMS = [
  { level: 1, name: '凡人', icon: '👤', reqLevel: 1, reqItems: [], desc: '初入修仙界的凡人' },
  { level: 2, name: '炼气期', icon: '🌬️', reqLevel: 5, reqItems: [{ itemId: 'stone_break', count: 3 }], desc: '感知天地灵气，可使用精品仙斧' },
  { level: 3, name: '筑基期', icon: '🏔️', reqLevel: 15, reqItems: [{ itemId: 'stone_break', count: 8 }], desc: '筑就道基，可使用珍品仙斧' },
  { level: 4, name: '金丹期', icon: '🔮', reqLevel: 30, reqItems: [{ itemId: 'stone_break', count: 20 }], desc: '凝结金丹，可使用神品仙斧' },
  { level: 5, name: '元婴期', icon: '👶', reqLevel: 50, reqItems: [{ itemId: 'stone_break', count: 50 }], desc: '元婴出窍，可使用仙品仙斧' },
];

// 仙树灵阶表
const TREE_REALMS = [
  { level: 1, name: '凡木', icon: '🌱', treeLevel: 1, reqItems: [], desc: '最普通的灵树' },
  { level: 2, name: '灵木', icon: '🌳', treeLevel: 2, reqItems: [{ itemId: 'stone_forge', count: 20 }, { itemId: 'stone_break', count: 2 }], desc: '蕴含灵气的树木，掉落更佳' },
  { level: 3, name: '仙木', icon: '🎋', treeLevel: 3, reqItems: [{ itemId: 'stone_forge', count: 50 }, { itemId: 'stone_break', count: 8 }], desc: '传说中的仙树，有神品掉落' },
];

// 锻造奖池
const FORGE_POOL = [
  { itemId: 'axe_iron', weight: 50, quality: 2 },
  { itemId: 'axe_bronze', weight: 30, quality: 3 },
  { itemId: 'axe_jade', weight: 15, quality: 4 },
  { itemId: 'axe_gold', weight: 5, quality: 5 },
];

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
      treeRealm: data.tree_realm || 1,
      realmLevel: data.realm_level || 1,
      axeId: data.axe_id,
      balance: parseFloat(data.balance),
      totalWithdrawn: parseFloat(data.total_withdrawn),
      lastDailyDate: data.last_daily_date,
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
    if (updates.lastDailyDate !== undefined) dbUpdates.last_daily_date = updates.lastDailyDate || null;
    dbUpdates.updated_at = new Date().toISOString();

    const { error } = await dbClient
      .from('player_state')
      .update(dbUpdates)
      .eq('user_role', 'player');
    if (error) { console.error('DB updatePlayerState error:', error); return false; }
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
      tree_level: 1,
      tree_realm: 1,
      realm_level: 1,
      axe_id: 'axe_stone',
      balance: 0,
      total_withdrawn: 0,
      last_daily_date: null,
    };

    const { error } = await dbClient
      .from('player_state')
      .insert(defaultState);
    if (error) {
      // 如果字段不存在（还没跑升级SQL），降级插入
      if (error.message && error.message.includes('does not exist')) {
        const fallbackState = {
          user_role: 'player',
          level: 1,
          exp: 0,
          chopping_count: 10,
          tree_level: 1,
          axe_id: 'axe_stone',
          balance: 0,
          total_withdrawn: 0,
          last_daily_date: null,
        };
        const { error: err2 } = await dbClient.from('player_state').insert(fallbackState);
        if (err2) { console.error('DB initPlayerState fallback error:', err2); return null; }
      } else {
        console.error('DB initPlayerState error:', error);
        return null;
      }
    }

    return {
      level: 1,
      exp: 0,
      choppingCount: 10,
      treeLevel: 1,
      treeRealm: 1,
      realmLevel: 1,
      axeId: 'axe_stone',
      balance: 0,
      totalWithdrawn: 0,
      lastDailyDate: null,
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
    const { error } = await dbClient
      .from('mails')
      .update({ is_claimed: true, is_read: true })
      .eq('id', id);
    if (error) { console.error('DB claimMail error:', error); return false; }
    return true;
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
};

/* ================================================================
   游戏逻辑
   ================================================================ */
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

  // 砍树
  async chop() {
    if (this.state.choppingCount <= 0) {
      UI.toast('没有砍树次数了，去完成任务吧', 'warn');
      return null;
    }

    // 消耗砍树次数
    this.state.choppingCount -= 1;
    await DB.updatePlayerState({ choppingCount: this.state.choppingCount });

    // 随机掉落
    const treeConfig = TREE_LEVELS[this.state.treeLevel] || TREE_LEVELS[1];
    let item = this._rollDrop(treeConfig);

    // 应用仙斧buff
    item = this._applyAxeBuffs(item);

    // 发奖励
    await DB.addItem(item.itemId, item.quantity);
    const idx = this.inventory.findIndex(i => i.itemId == item.itemId);
    if (idx >= 0) this.inventory[idx].quantity += item.quantity;
    else this.inventory.push({ itemId: item.itemId, quantity: item.quantity });

    // 返还砍树次数buff
    const refund = this._checkRefundBuff();
    if (refund > 0) {
      item.refundChopping = refund;
    }

    // 加经验
    const expGain = 2 + item.quality;
    await this._addExp(expGain);

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

  // 每日签到
  async dailyCheckIn() {
    const today = new Date().toISOString().split('T')[0];
    if (this.state.lastDailyDate === today) {
      UI.toast('今日已签到', 'warn');
      return false;
    }
    this.state.choppingCount += 1;
    this.state.lastDailyDate = today;
    await DB.updatePlayerState({
      choppingCount: this.state.choppingCount,
      lastDailyDate: today,
    });
    UI.updateHeader();
    UI.toast('签到成功！获得 1 次砍树机会', 'success');
    return true;
  },

  // 合成道具
  async compose(itemId) {
    const itemDef = ITEMS[itemId];
    if (!itemDef || itemDef.type !== 1) return false;

    const have = this._getItemQty(itemId);
    if (have < itemDef.composeCount) {
      UI.toast(`需要 ${itemDef.composeCount} 个才能合成`, 'warn');
      return false;
    }

    await DB.removeItem(itemId, itemDef.composeCount);
    await DB.addItem(itemDef.composeTo, 1);
    await this.refresh();

    const targetItem = ITEMS[itemDef.composeTo];
    UI.toast(`合成成功！获得 ${targetItem.name}`, 'success');
    return true;
  },

  // 出售仙斧
  async sellAxe(itemId) {
    const itemDef = ITEMS[itemId];
    if (!itemDef || itemDef.type !== 5) return false;
    if (this.state.axeId === itemId) {
      UI.toast('装备中的斧头无法出售', 'warn');
      return false;
    }
    await DB.removeItem(itemId, 1);
    this.state.choppingCount += itemDef.sellPrice;
    await DB.updatePlayerState({ choppingCount: this.state.choppingCount });
    await this.refresh();
    UI.toast(`出售成功！获得 ${itemDef.sellPrice} 次砍树`, 'success');
    return true;
  },

  // 装备仙斧
  async equipAxe(itemId) {
    const itemDef = ITEMS[itemId];
    if (!itemDef || itemDef.type !== 5) return false;
    if (this.state.axeId === itemId) {
      UI.toast('已经装备了', 'warn');
      return false;
    }
    // 旧斧头放回背包
    if (this.state.axeId && this.state.axeId !== 'axe_stone') {
      await DB.addItem(this.state.axeId, 1);
    }
    // 从背包扣新斧头
    await DB.removeItem(itemId, 1);
    this.state.axeId = itemId;
    await DB.updatePlayerState({ axeId: itemId });
    await this.refresh();
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
    this.state.balance -= amount;
    await DB.updatePlayerState({ balance: this.state.balance });
    await DB.requestWithdrawal(amount);
    await DB.sendMail(
      '提现申请已提交',
      `你申请提现 ${amount} 元，天道审核通过后将发放。`,
      []
    );
    await this.refresh();
    UI.toast('提现申请已提交', 'success');
    return true;
  },

  // 商店购买
  async shopBuy(shopItem) {
    if (shopItem.costType === 'chopping') {
      if (this.state.choppingCount < shopItem.costValue) {
        UI.toast('砍树次数不足', 'warn');
        return false;
      }
      this.state.choppingCount -= shopItem.costValue;
      await DB.updatePlayerState({ choppingCount: this.state.choppingCount });
    } else if (shopItem.costType === 'money') {
      if (this.state.balance < shopItem.costValue) {
        UI.toast('余额不足', 'warn');
        return false;
      }
      this.state.balance -= shopItem.costValue;
      await DB.updatePlayerState({ balance: this.state.balance });
    }

    if (shopItem.rewardType === 'chopping') {
      this.state.choppingCount += shopItem.rewardValue;
      await DB.updatePlayerState({ choppingCount: this.state.choppingCount });
    } else if (shopItem.rewardType === 'item') {
      await DB.addItem(shopItem.rewardId, shopItem.rewardValue);
    }

    await this.refresh();
    UI.toast(`兑换成功！`, 'success');
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
        UI.toast(`${def.name}不足，需要 ${req.count} 个`, 'warn');
        return false;
      }
    }
    // 消耗道具
    for (const req of nextRealm.reqItems) {
      await DB.removeItem(req.itemId, req.count);
    }
    // 升阶
    this.state.realmLevel = nextRealm.level;
    await DB.updatePlayerState({ realmLevel: this.state.realmLevel });
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
        UI.toast(`${def.name}不足，需要 ${req.count} 个`, 'warn');
        return false;
      }
    }
    // 消耗道具
    for (const req of nextTreeRealm.reqItems) {
      await DB.removeItem(req.itemId, req.count);
    }
    // 升阶
    this.state.treeRealm = nextTreeRealm.level;
    this.state.treeLevel = nextTreeRealm.treeLevel;
    await DB.updatePlayerState({ treeRealm: this.state.treeRealm, treeLevel: this.state.treeLevel });
    await this.refresh();
    UI.toast(`仙树升级为 ${nextTreeRealm.name}！`, 'success');
    return true;
  },

  // 锻造
  async forge() {
    if (this._getItemQty('stone_forge') < 1) {
      UI.toast('锻铁不足', 'warn');
      return null;
    }
    await DB.removeItem('stone_forge', 1);

    // 加权随机抽取
    const totalWeight = FORGE_POOL.reduce((sum, p) => sum + p.weight, 0);
    let roll = Math.random() * totalWeight;
    let selected = FORGE_POOL[0];
    for (const pool of FORGE_POOL) {
      roll -= pool.weight;
      if (roll <= 0) { selected = pool; break; }
    }

    const axeDef = ITEMS[selected.itemId];
    await DB.addItem(selected.itemId, 1);
    await this.refresh();
    return { itemId: selected.itemId, quality: selected.quality, item: axeDef };
  },

  // 十连砍
  async chopTen() {
    if (this.state.choppingCount < 10) {
      UI.toast('砍树次数不足10次', 'warn');
      return null;
    }
    const results = [];
    for (let i = 0; i < 10; i++) {
      const item = await this.chop();
      if (item) results.push(item);
    }
    // 十连保底：额外送1件珍品及以上
    const treeConfig = TREE_LEVELS[this.state.treeLevel] || TREE_LEVELS[1];
    const rarePools = treeConfig.pools.filter(p => p.quality >= 3);
    if (rarePools.length > 0) {
      const totalWeight = rarePools.reduce((sum, p) => sum + p.weight, 0);
      let roll = Math.random() * totalWeight;
      let selectedPool = rarePools[0];
      for (const pool of rarePools) {
        roll -= pool.weight;
        if (roll <= 0) { selectedPool = pool; break; }
      }
      const itemId = selectedPool.items[Math.floor(Math.random() * selectedPool.items.length)];
      const itemDef = ITEMS[itemId];
      await DB.addItem(itemId, 1);
      const idx = this.inventory.findIndex(i => i.itemId == itemId);
      if (idx >= 0) this.inventory[idx].quantity += 1;
      else this.inventory.push({ itemId, quantity: 1 });
      results.push({
        itemId, quantity: 1, quality: selectedPool.quality,
        qualityName: QUALITY[selectedPool.quality].name,
        item: itemDef, isBonus: true,
      });
    }
    UI.updateHeader();
    return results;
  },

  // 应用仙斧buff（返回修正后的掉落结果）
  _applyAxeBuffs(dropItem) {
    const axeDef = ITEMS[this.state.axeId] || ITEMS.axe_stone;
    if (!axeDef.skill) return dropItem;

    // 技能1：指定品质掉落时概率双倍
    if (axeDef.skill === 'double_common' && dropItem.quality <= 2) {
      if (Math.random() < 0.2) {
        dropItem.quantity *= 2;
        dropItem.buffText = '双倍掉落！';
      }
    }
    if (axeDef.skill === 'double_rare' && dropItem.quality >= 3) {
      if (Math.random() < 0.3) {
        dropItem.quantity *= 2;
        dropItem.buffText = '双倍掉落！';
      }
    }
    if (axeDef.skill === 'super_lucky') {
      // 提升稀有掉落：重roll一次
      if (dropItem.quality <= 2 && Math.random() < 0.3) {
        dropItem.quality += 1;
        dropItem.qualityName = QUALITY[dropItem.quality]?.name || dropItem.qualityName;
        dropItem.buffText = '幸运暴击！';
      }
    }
    return dropItem;
  },

  // 返还砍树次数buff（砍树后调用）
  _checkRefundBuff() {
    const axeDef = ITEMS[this.state.axeId] || ITEMS.axe_stone;
    if (axeDef.skill === 'refund_chopping') {
      if (Math.random() < 0.15) {
        this.state.choppingCount += 1;
        DB.updatePlayerState({ choppingCount: this.state.choppingCount });
        return 1;
      }
    }
    return 0;
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
    }
  },
};

/* ================================================================
   UI 工具
   ================================================================ */
const UI = {
  updateHeader() {
    if (!Game.state) return;
    // 旧版 header 已移除，这里只更新邮件 badge
    this._updateMailBadge();
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

  // 播放掉落动画
  playDropAnimation(item, treeElement) {
    const container = document.getElementById('floating-items-container');
    const el = document.createElement('div');
    el.className = 'falling-item';
    el.textContent = item.item.icon;

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
    el.textContent = item.item.icon;

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
    const axeDef = ITEMS[Game.state.axeId] || ITEMS.axe_stone;
    const forgeStoneQty = Game.inventory.find(i => i.itemId == 'stone_forge')?.quantity || 0;
    const expMax = getExpForLevel(Game.state.level);

    main.innerHTML = `
      <!-- ① 场景区：仙树 + 人物 -->
      <div class="cult-scene" id="tree-area">
        <div class="cult-tree" id="tree-icon" onclick="PlayerView.showTreeDetail()">
          <span class="tree-emoji">${treeConfig.icon}</span>
          <div class="tree-label">${treeRealm.name} · ${treeConfig.name}</div>
          <div class="tree-sub">灵阶 ${Game.state.treeRealm} · 树 Lv.${Game.state.treeLevel}</div>
        </div>
        <div class="cult-char">
          <span class="char-emoji">🧑‍🌾</span>
        </div>
      </div>

      <!-- ② 状态栏：邮件 / 等级·仙阶 + 经验条 / 突破 -->
      <div class="cult-status">
        <div class="status-mail" onclick="PlayerView.showMailModal()">
          <span>📮</span>
          <span class="mail-badge" id="mail-badge" style="display:none">0</span>
        </div>
        <div class="status-center">
          <div class="status-realm">${realm.icon} ${Game.state.level}级 · ${realm.name}</div>
          <div class="status-exp-row">
            <div class="status-exp-bar"><div class="status-exp-fill" style="width:${Math.min(100, Game.state.exp / expMax * 100)}%"></div></div>
            <span class="status-exp-text">${Game.state.exp}/${expMax}</span>
          </div>
        </div>
        ${nextRealm ? `
          <button class="btn btn-accent btn-sm" onclick="PlayerView.showBreakThrough()">突破</button>
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

      <!-- ④ 操作区：砍树按钮 + 十连勾选 + 锻造 -->
      <div class="cult-action">
        <div class="action-chop-area">
          <button class="chop-circle-btn" id="chop-btn" onclick="PlayerView.doChop()" ${Game.state.choppingCount <= 0 ? 'disabled' : ''}>
            <span class="chop-axe-icon">${axeDef.icon}</span>
          </button>
          <span class="chop-count-badge">${Game.state.choppingCount}</span>
          <label class="ten-toggle ${Game.state.choppingCount < 10 ? 'unavailable' : ''}">
            <input type="checkbox" id="ten-chop-toggle" ${this._tenChopMode ? 'checked' : ''} onchange="PlayerView.toggleTenChop(this.checked)" />
            <span class="ten-toggle-label">十连砍</span>
          </label>
        </div>
        <div class="action-forge-area">
          <button class="forge-circle-btn" onclick="PlayerView.showForge()">
            <span>🔨</span>
          </button>
          <span class="forge-count-badge">🔩 ${forgeStoneQty}</span>
          <div class="forge-label">锻造</div>
        </div>
      </div>

      <!-- 装备信息（紧凑显示） -->
      <div class="equip-info-bar">
        <span style="font-size:28px">${axeDef.icon}</span>
        <div style="flex:1">
          <span style="font-weight:600;font-size:13px">${axeDef.name}</span>
          ${UI.qualityTag(axeDef.quality)}
          ${axeDef.skillDesc ? `<span style="font-size:11px;color:var(--accent);margin-left:6px">🌟 ${axeDef.skillDesc}</span>` : ''}
        </div>
      </div>
    `;

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
    const treeRealm = TREE_REALMS.find(r => r.level == Game.state.treeRealm) || TREE_REALMS[0];
    const nextTreeRealm = TREE_REALMS.find(r => r.level == Game.state.treeRealm + 1);

    UI.modal(`
      <div style="text-align:center;margin-bottom:16px">
        <div style="font-size:72px;margin-bottom:8px">${treeConfig.icon}</div>
        <div style="font-size:18px;font-weight:700">${treeRealm.name} · ${treeConfig.name}</div>
        <div style="font-size:13px;color:var(--text-secondary);margin-top:4px">
          灵阶 ${Game.state.treeRealm} · 树 Lv.${Game.state.treeLevel}
        </div>
        <div style="font-size:12px;color:var(--text-secondary);margin-top:8px">${treeRealm.desc || ''}</div>
      </div>
      ${nextTreeRealm ? `
        <div style="border-top:1px solid var(--border);padding-top:12px;margin-bottom:12px">
          <div style="font-weight:600;font-size:14px;margin-bottom:8px">升阶到：${nextTreeRealm.name}</div>
          <div style="font-size:12px;color:var(--text-secondary);margin-bottom:8px">${nextTreeRealm.desc || ''}</div>
          ${nextTreeRealm.reqItems ? nextTreeRealm.reqItems.map(req => {
            const def = ITEMS[req.itemId];
            const have = Game.inventory.find(i => i.itemId == req.itemId)?.quantity || 0;
            const ok = have >= req.count;
            return `<div style="display:flex;align-items:center;gap:8px;padding:4px 0">
              <span style="font-size:20px">${def.icon}</span>
              <span style="flex:1;font-size:13px">${def.name}</span>
              <span style="font-size:13px;color:${ok ? 'var(--success)' : 'var(--error)'}">${have}/${req.count}</span>
            </div>`;
          }).join('') : ''}
        </div>
      ` : '<div style="text-align:center;color:var(--text-secondary);padding:12px">已达到最高灵阶</div>'}
    `, {
      title: '🌳 仙树详情',
      footer: nextTreeRealm ? `<div class="modal-footer">
        <button class="btn btn-outline btn-sm" onclick="this.closest('.modal-overlay').remove()">关闭</button>
        <button class="btn btn-primary btn-sm" onclick="this.closest('.modal-overlay').remove();PlayerView.showTreeUpgrade()">升阶</button>
      </div>` : undefined
    });
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

    const items = Game.inventory.filter(inv => {
      const def = ITEMS[inv.itemId];
      if (!def) return false;
      if (tab === 'weapons') return def.type === 5;
      return def.type >= 1 && def.type <= 4;
    });

    // 填充空槽位
    const slots = Math.max(20, items.length);
    let html = '';

    items.forEach(inv => {
      const def = ITEMS[inv.itemId];
      if (!def) return;
      html += `
        <div class="item-slot quality-${def.quality}" onclick="PlayerView.showItemDetail('${inv.itemId}')">
          <div class="item-icon">${def.icon}</div>
          <div class="item-count">${inv.quantity}</div>
        </div>
      `;
    });

    // 空槽位
    for (let i = items.length; i < slots; i++) {
      html += `<div class="item-slot empty"></div>`;
    }

    grid.innerHTML = html;
  },

  showItemDetail(itemId) {
    const def = ITEMS[itemId];
    if (!def) return;
    const qty = Game._getItemQty(itemId);
    const q = QUALITY[def.quality];

    let actionBtn = '';
    if (def.type === 1) {
      actionBtn = `<button class="btn btn-primary btn-sm" onclick="PlayerView.composeItem('${itemId}')">合成 (${qty}/${def.composeCount})</button>`;
    } else if (def.type === 2) {
      actionBtn = `<button class="btn btn-primary btn-sm" onclick="PlayerView.cashItem('${itemId}')">提现 ¥${def.value}</button>`;
    } else if (def.type === 5) {
      const isEquipped = Game.state.axeId === itemId;
      actionBtn = `
        ${isEquipped
          ? `<button class="btn btn-outline btn-sm" disabled>已装备</button>`
          : `<button class="btn btn-primary btn-sm" onclick="PlayerView.equipItem('${itemId}')">装备</button>
             <button class="btn btn-outline btn-sm" onclick="PlayerView.sellItem('${itemId}')">出售 +${def.sellPrice}🪓</button>`
        }
      `;
    }

    UI.modal(`
      <div style="text-align:center;margin-bottom:16px">
        <div style="font-size:60px;margin-bottom:8px">${def.icon}</div>
        <div style="font-size:18px;font-weight:700">${def.name}</div>
        <div style="margin-top:4px"><span class="tag" style="background:${q.color}20;color:${q.color}">${q.name}</span></div>
        <div style="margin-top:8px;font-size:13px;color:var(--text-secondary)">数量：${qty}</div>
      </div>
      <p style="font-size:13px;color:var(--text-secondary);text-align:center;margin-bottom:16px">${def.desc || ''}</p>
      ${def.skillDesc ? `<p style="font-size:12px;color:var(--accent);text-align:center;margin-bottom:16px">🌟 ${def.skillDesc}</p>` : ''}
      <div style="display:flex;gap:8px;justify-content:center">
        ${actionBtn}
      </div>
    `, { title: '物品详情' });
  },

  composeItem(itemId) {
    Game.compose(itemId).then(ok => {
      if (ok) {
        this.renderInventory(this.currentInvTab);
        document.querySelector('.modal-overlay')?.remove();
      }
    });
  },

  cashItem(itemId) {
    const def = ITEMS[itemId];
    UI.confirm(`确定要将 ${def.name} 提现 ¥${def.value} 吗？`, async () => {
      const ok = await DB.removeItem(itemId, 1);
      if (!ok) { UI.toast('操作失败', 'error'); return; }
      Game.state.balance += def.value;
      await DB.updatePlayerState({ balance: Game.state.balance });
      await Game.refresh();
      this.renderInventory(this.currentInvTab);
      UI.toast(`到账 ¥${def.value}`, 'success');
      document.querySelector('.modal-overlay')?.remove();
    });
  },

  equipItem(itemId) {
    Game.equipAxe(itemId).then(ok => {
      if (ok) {
        this.renderInventory(this.currentInvTab);
        document.querySelector('.modal-overlay')?.remove();
        UI.updateHeader();
      }
    });
  },

  sellItem(itemId) {
    const def = ITEMS[itemId];
    UI.confirm(`确定出售 ${def.name}，获得 ${def.sellPrice} 次砍树？`, async () => {
      const ok = await Game.sellAxe(itemId);
      if (ok) {
        this.renderInventory(this.currentInvTab);
        document.querySelector('.modal-overlay')?.remove();
      }
    });
  },

  async doChop() {
    // 十连砍模式
    if (this._tenChopMode) {
      this.doChopTen();
      return;
    }

    if (Game.state.choppingCount <= 0) {
      UI.toast('没有砍树次数了', 'warn');
      return;
    }

    const treeIcon = document.getElementById('tree-icon');
    const chopBtn = document.getElementById('chop-btn');
    if (chopBtn) chopBtn.disabled = true;

    // 摇晃动画
    if (treeIcon) {
      treeIcon.classList.add('shaking');
      setTimeout(() => treeIcon.classList.remove('shaking'), 300);
    }

    // 掉落延迟
    setTimeout(async () => {
      try {
        const item = await Game.chop();
        if (item) {
          if (treeIcon) UI.playDropAnimation(item, treeIcon);

          setTimeout(() => {
            this._showRewardModal(item);
          }, 800);
        }

        // 刷新整个修仙界面（包含按钮状态、次数、背包）
        this.renderCultivate();
      } catch (e) {
        console.error('doChop error:', e);
        UI.toast('砍树失败，请重试', 'error');
        if (chopBtn) chopBtn.disabled = false;
      }
    }, 200);
  },

  _showRewardModal(item) {
    const q = QUALITY[item.quality];
    const buffHtml = item.buffText
      ? `<div style="color:var(--quality-4);font-size:14px;font-weight:600;margin-bottom:8px">🌟 ${item.buffText}</div>`
      : '';
    const refundHtml = item.refundChopping
      ? `<div style="color:var(--accent);font-size:13px;margin-bottom:8px">🪓 返还 ${item.refundChopping} 次砍树</div>`
      : '';
    const overlay = UI.modal(`
      <div class="reward-modal">
        <div class="reward-icon">${item.item.icon}</div>
        <div class="reward-name" style="color:${q.color}">${item.item.name}</div>
        <div class="reward-quality">${q.name} · 获得 ×${item.quantity}</div>
        ${buffHtml}
        ${refundHtml}
        <button class="btn btn-primary btn-block" onclick="this.closest('.modal-overlay').remove()">收下</button>
      </div>
    `, { title: '🎉 获得物品' });
  },

  // --- 任务页 ---
  async renderTasks() {
    const main = document.getElementById('player-main');
    const [dailyTasks, weeklyTasks] = await Promise.all([
      DB.getTasks('daily'),
      DB.getTasks('weekly'),
    ]);

    // 检查今日是否已签到
    const today = new Date().toISOString().split('T')[0];
    const dailyChecked = Game.state.lastDailyDate === today;

    // 收集所有主题
    const allTasks = [...dailyTasks, ...weeklyTasks];
    const themes = [...new Set(allTasks.filter(t => t.themeName).map(t => t.themeName))];

    let themeFilters = '';
    themes.forEach(theme => {
      themeFilters += `<div class="filter-chip" data-filter="theme:${theme}" onclick="PlayerView.filterTasks('theme:${theme}')">🎨 ${theme}</div>`;
    });

    main.innerHTML = `
      <div class="page-title">📜 任务</div>
      <div class="page-subtitle">完成任务获得砍树次数，砍树掉落奖励</div>

      <div class="filter-bar">
        <div class="filter-chip active" data-filter="all" onclick="PlayerView.filterTasks('all')">全部</div>
        <div class="filter-chip" data-filter="daily" onclick="PlayerView.filterTasks('daily')">每日</div>
        <div class="filter-chip" data-filter="weekly" onclick="PlayerView.filterTasks('weekly')">每周</div>
        <div class="filter-chip" data-filter="self" onclick="PlayerView.filterTasks('self')">自主申报</div>
        ${themeFilters}
      </div>

      <div id="task-list"></div>

      <button class="btn btn-outline btn-block" style="margin-top:16px" onclick="PlayerView.showSelfSubmit()">
        ✍️ 自主申报任务
      </button>
    `;

    this.currentTaskFilter = 'all';
    this._dailyTasks = dailyTasks;
    this._weeklyTasks = weeklyTasks;
    this._dailyChecked = dailyChecked;

    this._renderTaskList();
  },

  currentTaskFilter: 'all',
  _dailyTasks: [],
  _weeklyTasks: [],
  _submissions: [],
  _dailyChecked: false,

  async filterTasks(filter) {
    this.currentTaskFilter = filter;
    document.querySelectorAll('.filter-chip').forEach(el => {
      el.classList.toggle('active', el.dataset.filter === filter);
    });
    this._renderTaskList();
  },

  async _renderTaskList() {
    const list = document.getElementById('task-list');
    if (!list) return;

    const submissions = await DB.getSubmissions();
    this._submissions = submissions;

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
            if (def) extraRewardHtml += `<span style="font-size:20px;margin:0 4px">${def.icon}×${ri.quantity}</span>`;
          });
        }
        const allDone = completedCount >= totalCount && totalCount > 0;
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
            <button class="btn btn-primary btn-sm btn-block" style="margin-top:10px" ${allDone ? '' : 'disabled'} onclick="PlayerView.claimThemeExtraReward('${themeName}')">
              ${allDone ? '🎁 领取额外奖励' : '完成全部任务后解锁'}
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
      rewardHtml += `<span class="reward-chopping">🪓 ×${task.rewardChopping}</span>`;
    }
    rewardItems.forEach(ri => {
      const def = ITEMS[ri.item_id];
      if (def) rewardHtml += `<span style="font-size:16px" title="${def.name}">${def.icon}×${ri.quantity}</span>`;
    });

    let actionBtn = '';
    if (type === 'daily') {
      if (this._dailyChecked) {
        actionBtn = `<button class="btn btn-outline btn-sm" disabled>已签到</button>`;
      } else {
        actionBtn = `<button class="btn btn-primary btn-sm" onclick="PlayerView.doDailyCheckIn()">签到</button>`;
      }
    } else {
      if (status === 'available') {
        actionBtn = `<button class="btn btn-primary btn-sm" onclick="PlayerView.submitTask('${task.id}')">完成</button>`;
      } else if (status === 'pending') {
        actionBtn = `<button class="btn btn-outline btn-sm" disabled>审核中</button>`;
      } else if (status === 'approved') {
        actionBtn = `<button class="btn btn-accent btn-sm" onclick="PlayerView.claimTaskReward('${task.id}')">领取奖励</button>`;
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
      actionBtn = `<button class="btn btn-accent btn-sm" onclick="PlayerView.claimSubmissionReward('${sub.id}')">领取奖励</button>`;
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

  async doDailyCheckIn() {
    const ok = await Game.dailyCheckIn();
    if (ok) {
      this._dailyChecked = true;
      this._renderTaskList();
    }
  },

  submitTask(taskId) {
    const task = [...this._dailyTasks, ...this._weeklyTasks].find(t => t.id == taskId);
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

      await DB.submitTask({
        taskId: task.id,
        taskType: task.taskType,
        taskTitle: task.title,
        description: desc,
        rewardChopping: task.rewardChopping,
        rewardItems: task.rewardItems,
      });

      UI.closeModal(overlay);
      UI.toast('已提交审核', 'success');
      this._renderTaskList();
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

      await DB.submitTask({
        taskType: 'self',
        taskTitle: title,
        isSelfTask: true,
        selfTitle: title,
        selfDescription: desc,
        description: desc,
      });

      UI.closeModal(overlay);
      UI.toast('已提交审核', 'success');
      this._renderTaskList();
    });
  },

  async claimTaskReward(taskId) {
    const task = [...this._dailyTasks, ...this._weeklyTasks].find(t => t.id == taskId);
    const sub = this._submissions.find(s => s.taskId == taskId);
    if (!task || !sub) return;

    // 发砍树次数
    if (sub.rewardChopping > 0) {
      Game.state.choppingCount += sub.rewardChopping;
      await DB.updatePlayerState({ choppingCount: Game.state.choppingCount });
    }

    // 发道具
    const items = sub.rewardItems || [];
    for (const ri of items) {
      await DB.addItem(ri.item_id, ri.quantity);
    }

    // 更新状态为已完成
    await DB.reviewSubmission(sub.id, 'claimed', '', sub.rewardChopping, sub.rewardItems);

    await Game.refresh();
    UI.toast('奖励已领取！', 'success');
    this._renderTaskList();
  },

  async claimSubmissionReward(subId) {
    const sub = this._submissions.find(s => s.id === subId);
    if (!sub) return;

    if (sub.rewardChopping > 0) {
      Game.state.choppingCount += sub.rewardChopping;
      await DB.updatePlayerState({ choppingCount: Game.state.choppingCount });
    }

    const items = sub.rewardItems || [];
    for (const ri of items) {
      await DB.addItem(ri.item_id, ri.quantity);
    }

    await DB.reviewSubmission(sub.id, 'claimed', '', sub.rewardChopping, sub.rewardItems);
    await Game.refresh();
    UI.toast('奖励已领取！', 'success');
    this._renderTaskList();
  },

  // 已领取的主题额外奖励（内存记录，样例实现）
  _claimedThemeRewards: {},

  async claimThemeExtraReward(themeName) {
    if (this._claimedThemeRewards[themeName]) {
      UI.toast('已领取过主题额外奖励', 'warn');
      return;
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
      return;
    }

    // 发放额外奖励（从第一个主题任务的 themeExtraReward 中获取）
    const extraReward = themeTasks[0]?.themeExtraReward || [];
    let totalChopping = 0;
    for (const ri of extraReward) {
      if (ri.item_id === 'chopping') {
        totalChopping += ri.quantity;
      } else {
        await DB.addItem(ri.item_id, ri.quantity);
      }
    }
    if (totalChopping > 0) {
      Game.state.choppingCount += totalChopping;
      await DB.updatePlayerState({ choppingCount: Game.state.choppingCount });
    }

    // 发送邮件通知
    await DB.sendMail(
      `🎨 主题「${themeName}」完成奖励`,
      `恭喜你完成了主题「${themeName}」的全部任务，额外奖励已发放！`,
      extraReward
    );

    this._claimedThemeRewards[themeName] = true;
    await Game.refresh();
    UI.toast('🎉 主题额外奖励已领取！', 'success');
    this._renderTaskList();
  },

  // --- 天道酬勤 ---
  async renderReward() {
    const main = document.getElementById('player-main');
    const withdrawals = await DB.getWithdrawals();

    main.innerHTML = `
      <div class="page-title">🎁 天道酬勤</div>
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
        <button class="btn btn-primary btn-block" onclick="PlayerView.doWithdraw()">申请提现</button>
        <button class="btn btn-outline btn-block" style="margin-top:8px" onclick="PlayerView.showWithdrawRecords()">📋 提现记录</button>
      </div>

      <!-- 道具兑换商店 -->
      <div class="shop-section">
        <div class="section-header">
          <div class="section-title">🛒 道具兑换</div>
        </div>
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

  doWithdraw() {
    if (this._withdrawAmount <= 0) {
      UI.toast('请选择提现金额', 'warn');
      return;
    }
    UI.confirm(`确定申请提现 ¥${this._withdrawAmount}？天道审核通过后将发放。`, async () => {
      const ok = await Game.withdraw(this._withdrawAmount);
      if (ok) {
        Router.playerTab('reward'); // 刷新页面
      }
    });
  },

  _renderShop() {
    const grid = document.getElementById('shop-grid');
    if (!grid) return;
    let html = '';
    SHOP_ITEMS.forEach(item => {
      let costText = '';
      if (item.costType === 'chopping') costText = `🪓 ${item.costValue} 次`;
      else costText = `¥${item.costValue}`;

      html += `
        <div class="shop-item" onclick="PlayerView.buyShopItem('${item.id}')">
          <div class="shop-icon">${item.icon}</div>
          <div class="shop-name">${item.name}</div>
          <div class="shop-cost">${costText}</div>
        </div>
      `;
    });
    grid.innerHTML = html;
  },

  buyShopItem(itemId) {
    const item = SHOP_ITEMS.find(s => s.id === itemId);
    if (!item) return;
    let costText = item.costType === 'chopping' ? `${item.costValue} 次砍树` : `¥${item.costValue}`;
    UI.confirm(`确定消耗 ${costText} 兑换 ${item.name}？`, async () => {
      const ok = await Game.shopBuy(item);
      if (ok) {
        this._renderShop();
      }
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
            if (def) itemsHtml += `<span style="font-size:13px;background:var(--bg-secondary);padding:2px 8px;border-radius:6px">${def.icon}×${ri.quantity}</span>`;
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
          if (def) itemsHtml += `<span class="mini-item">${def.icon}×${ri.quantity}</span>`;
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
              <div style="font-size:40px">${def.icon}</div>
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
          <button class="btn btn-accent btn-sm" onclick="PlayerView.claimMailReward('${mailId}')">领取奖励</button>
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

  async claimMailReward(mailId) {
    const mails = await DB.getMails();
    const mail = mails.find(m => m.id == mailId);
    if (!mail || !mail.items || mail.items.length === 0) return;

    for (const ri of mail.items) {
      await DB.addItem(ri.item_id, ri.quantity);
    }

    await DB.claimMail(mailId);
    await Game.refresh();

    // 关闭所有弹窗
    document.querySelectorAll('.modal-overlay').forEach(el => el.remove());
    UI.toast('奖励已领取！', 'success');
    this.showMailModal();
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
      return `<div style="display:flex;align-items:center;gap:8px;padding:6px 0">
        <span style="font-size:24px">${def.icon}</span>
        <span style="flex:1">${def.name}</span>
        <span style="color:${ok ? 'var(--success)' : 'var(--error)'}">${have}/${req.count}</span>
      </div>`;
    }).join('');

    UI.modal(`
      <div style="text-align:center;margin-bottom:16px">
        <div style="font-size:48px;margin-bottom:8px">${currentRealm.icon} → ${nextRealm.icon}</div>
        <div style="font-size:18px;font-weight:700">${currentRealm.name} → ${nextRealm.name}</div>
        <div style="font-size:12px;color:var(--text-secondary);margin-top:4px">${nextRealm.desc}</div>
      </div>
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
      btn.disabled = true;
      const ok = await Game.breakThrough();
      if (ok) {
        document.querySelector('.modal-overlay')?.remove();
        PlayerView.renderCultivate();
      } else {
        btn.disabled = false;
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
      return `<div style="display:flex;align-items:center;gap:8px;padding:6px 0">
        <span style="font-size:24px">${def.icon}</span>
        <span style="flex:1">${def.name}</span>
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
      btn.disabled = true;
      const ok = await Game.upgradeTreeRealm();
      if (ok) {
        document.querySelector('.modal-overlay')?.remove();
        PlayerView.renderCultivate();
      } else {
        btn.disabled = false;
      }
    });
  },

  // 锻造弹窗
  showForge() {
    const forgeQty = Game.inventory.find(i => i.itemId == 'stone_forge')?.quantity || 0;

    UI.modal(`
      <div style="text-align:center;margin-bottom:16px">
        <div style="font-size:64px;margin-bottom:8px">🔨</div>
        <div style="font-size:18px;font-weight:700">锻造仙斧</div>
        <div style="font-size:12px;color:var(--text-secondary);margin-top:4px">消耗锻铁，随机获得一把仙斧</div>
      </div>
      <div style="margin-bottom:16px">
        <div style="font-weight:600;margin-bottom:8px">锻造奖池</div>
        ${FORGE_POOL.map(p => {
          const def = ITEMS[p.itemId];
          return `<div style="display:flex;align-items:center;gap:8px;padding:4px 0">
            <span style="font-size:24px">${def.icon}</span>
            <span style="flex:1">${def.name}</span>
            ${UI.qualityTag(p.quality)}
            <span style="font-size:12px;color:var(--text-light)">${p.weight}%</span>
          </div>`;
        }).join('')}
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
      btn.disabled = true;
      const result = await Game.forge();
      if (result) {
        // 显示锻造结果
        const q = QUALITY[result.quality] || QUALITY[1];
        UI.modal(`
          <div style="text-align:center;padding:16px 0">
            <div style="font-size:80px;margin-bottom:12px;animation:tree-shake 0.5s ease-in-out">${result.item.icon}</div>
            <div style="font-size:20px;font-weight:700;color:${q.color}">${result.item.name}</div>
            <div style="margin-top:4px">${UI.qualityTag(result.quality)}</div>
            <div style="font-size:12px;color:var(--text-secondary);margin-top:8px">${result.item.desc}</div>
            ${result.item.skillDesc ? `<div style="font-size:12px;color:var(--accent);margin-top:8px">🌟 ${result.item.skillDesc}</div>` : ''}
          </div>
        `, {
          title: '🎉 锻造成功',
          footer: `<div class="modal-footer">
            <button class="btn btn-primary btn-sm" onclick="this.closest('.modal-overlay').remove();PlayerView.showForge()">继续锻造</button>
            <button class="btn btn-accent btn-sm" onclick="this.closest('.modal-overlay').remove();PlayerView.renderCultivate()">完成</button>
          </div>`
        });
      } else {
        btn.disabled = false;
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
    if (chopBtn) chopBtn.disabled = true;

    const results = [];
    const scatterEls = [];

    // 10次连续砍树 + 散落动画
    for (let i = 0; i < 10; i++) {
      // 摇晃树
      if (treeIcon) {
        treeIcon.classList.add('shaking');
        setTimeout(() => treeIcon && treeIcon.classList.remove('shaking'), 250);
      }

      // 砍树
      const item = await Game.chop();
      if (item) {
        results.push(item);
        // 散落动画
        if (treeIcon) {
          const el = UI.playScatterAnimation(item, treeIcon, i);
          if (el) scatterEls.push(el);
        }
      }

      // 等待下一次砍树
      await new Promise(r => setTimeout(r, 320));
    }

    // 十连保底：额外送1件珍品及以上
    const treeConfig = TREE_LEVELS[Game.state.treeLevel] || TREE_LEVELS[1];
    const rarePools = treeConfig.pools.filter(p => p.quality >= 3);
    if (rarePools.length > 0) {
      const totalWeight = rarePools.reduce((sum, p) => sum + p.weight, 0);
      let roll = Math.random() * totalWeight;
      let selectedPool = rarePools[0];
      for (const pool of rarePools) {
        roll -= pool.weight;
        if (roll <= 0) { selectedPool = pool; break; }
      }
      const itemId = selectedPool.items[Math.floor(Math.random() * selectedPool.items.length)];
      const itemDef = ITEMS[itemId];
      await DB.addItem(itemId, 1);
      const idx = Game.inventory.findIndex(i => i.itemId == itemId);
      if (idx >= 0) Game.inventory[idx].quantity += 1;
      else Game.inventory.push({ itemId, quantity: 1 });

      const bonusItem = {
        itemId, quantity: 1, quality: selectedPool.quality,
        qualityName: QUALITY[selectedPool.quality].name,
        item: itemDef, isBonus: true,
      };
      results.push(bonusItem);

      // 保底物品也散落
      if (treeIcon) {
        if (treeIcon) treeIcon.classList.add('shaking');
        const el = UI.playScatterAnimation(bonusItem, treeIcon, 10);
        if (el) scatterEls.push(el);
        setTimeout(() => treeIcon && treeIcon.classList.remove('shaking'), 250);
      }
      await new Promise(r => setTimeout(r, 400));
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
      const q = QUALITY[r.quality] || QUALITY[1];
      const bonusTag = r.isBonus ? '<div style="font-size:10px;color:var(--accent);font-weight:600">保底</div>' : '';
      const buffTag = r.buffText ? `<div style="font-size:10px;color:var(--quality-4)">${r.buffText}</div>` : '';
      return `<div style="text-align:center;padding:8px;border:1px solid ${q.color}40;border-radius:8px;background:${q.color}10">
        <div style="font-size:32px">${r.item.icon}</div>
        <div style="font-size:11px;font-weight:600;color:${q.color};margin-top:2px">${r.item.name}</div>
        <div style="font-size:10px;color:var(--text-light)">×${r.quantity}</div>
        ${bonusTag}
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
    } else if (f === 'weekly' || f === 'daily') {
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
      if (task.rewardChopping > 0) rewardHtml += `<span class="reward-chopping">🪓 ×${task.rewardChopping}</span>`;
      rewardItems.forEach(ri => {
        const def = ITEMS[ri.item_id];
        if (def) rewardHtml += `<span style="font-size:16px">${def.icon}×${ri.quantity}</span>`;
      });

      const statusBadge = task.status === 'draft'
        ? '<span class="tag" style="background:#fff3cd;color:#856404;font-size:11px">发布池</span>'
        : '<span class="tag" style="background:#d4edda;color:#155724;font-size:11px">已发布</span>';

      const themeBadge = task.themeName
        ? `<span class="tag" style="background:#e8daef;color:#6c3483;font-size:11px">🎨 ${task.themeName}</span>`
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
        <select id="new-task-type">
          <option value="weekly">每周任务</option>
          <option value="daily">每日任务</option>
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
        <input type="text" id="new-task-items" placeholder="比如：stone_forge:2,money_mid_frag:1">
        <div style="font-size:11px;color:var(--text-light);margin-top:4px">
          道具ID：stone_forge(锻铁) / stone_break(破境石) / money_sm_frag(铜钱碎片) / money_mid_frag(银锭碎片) / money_lg_frag(金元宝碎片)
        </div>
      </div>
      <div style="border-top:1px solid var(--border);margin:12px 0;padding-top:12px">
        <div style="font-weight:600;margin-bottom:8px;font-size:13px">🎨 主题设置（可选）</div>
        <div class="form-group">
          <label>主题名称</label>
          <input type="text" id="new-task-theme" placeholder="比如：社交挑战周">
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
        themeName,
        themeStart,
        themeEnd,
        sortOrder: this._adminTasks.length,
      });

      UI.closeModal(overlay);
      UI.toast('任务创建成功', 'success');
      this.renderTaskManage();
    });
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
          <input type="text" id="approve-items" placeholder="比如：stone_forge:2">
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
        await DB.sendMail(
          '任务审核通过',
          `你的自主申报任务已通过！奖励：${chopping} 次砍树${note ? '\n\n评语：' + note : ''}`,
          rewardItems
        );

        UI.closeModal(overlay);
        UI.toast('已通过', 'success');
        this.renderReview();
      });
    } else {
      // 固定任务直接通过
      const sub = this._submissions.find(s => s.id == id);
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
              <button class="btn btn-outline btn-sm" onclick="AdminView.rejectWithdraw('${w.id}')">驳回</button>
              <button class="btn btn-accent btn-sm" onclick="AdminView.approveWithdraw('${w.id}')">通过</button>
            </div>
          ` : ''}
        </div>
      `;
    });
    list.innerHTML = html;
  },

  approveWithdraw(id) {
    UI.confirm('确定通过这笔提现申请？', async () => {
      await DB.reviewWithdrawal(id, 'approved');
      const w = this._withdrawals.find(x => x.id == id);
      // 更新累计提现
      const state = await DB.getPlayerState();
      if (state) {
        await DB.updatePlayerState({ totalWithdrawn: state.totalWithdrawn + w.amount });
      }
      await DB.sendMail(
        '提现已到账',
        `你的提现申请 ¥${w.amount.toFixed(2)} 已通过，款项已发放。`,
        []
      );
      UI.toast('已通过', 'success');
      this.renderWithdrawReview();
    });
  },

  rejectWithdraw(id) {
    UI.confirm('确定驳回这笔提现申请？', async () => {
      // 把钱退回余额
      const w = this._withdrawals.find(x => x.id == id);
      const state = await DB.getPlayerState();
      if (state && w) {
        await DB.updatePlayerState({ balance: state.balance + w.amount });
      }
      await DB.reviewWithdrawal(id, 'rejected');
      await DB.sendMail(
        '提现申请被驳回',
        `你的提现申请 ¥${w.amount.toFixed(2)} 被驳回，金额已退回余额。`,
        []
      );
      UI.toast('已驳回', 'success');
      this.renderWithdrawReview();
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

    const axeDef = ITEMS[state.axeId] || ITEMS.axe_stone;

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
          <div style="font-size:48px">${axeDef.icon}</div>
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
              <div style="font-size:24px">${def.icon}</div>
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
};

// 初始化（登录时调用 Game.init()）
console.log('寻道大千 · 修仙系统加载完成 🎋');
