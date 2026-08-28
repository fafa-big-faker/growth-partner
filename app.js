/* ==========================================================================
   星途远航 · 社交成长星际系统 — 应用逻辑（Supabase 云端版）
   模块: DB(数据层) | Auth(认证) | Router(路由) | Task(任务)
         | SelfReport(自主申报) | SupplyStation(补给站) | StarMap(星图)
         | Dashboard(看板) | Report(报告) | UI(辅助) | Charts(图表)
   ========================================================================== */

const CATEGORIES = ['校园人际', '家庭情感', '自我突破'];
const STAR_LEVELS = [
  { stars: 1, name: '流星任务', energyRange: [3, 8] },
  { stars: 2, name: '卫星任务', energyRange: [8, 15] },
  { stars: 3, name: '行星任务', energyRange: [15, 25] },
  { stars: 4, name: '恒星任务', energyRange: [25, 40] },
  { stars: 5, name: '黑洞任务', energyRange: [40, 60] },
];
const STAR_NAMES = { 1: '流星', 2: '卫星', 3: '行星', 4: '恒星', 5: '黑洞' };
const DIFFICULTIES = ['极低', '低', '中等', '较高', '高'];
const STATUS_MAP = {
  available: { label: '待领取', cls: 'available' },
  in_progress: { label: '进行中', cls: 'progress' },
  pending_review: { label: '待审核', cls: 'review' },
  completed: { label: '已完成', cls: 'done' },
  abandoned: { label: '已放弃', cls: 'abandoned' },
};

// 星图配置
const PLANETS = [
  { id: 'moon', name: '月尘站', icon: '🌙', energyNeeded: 0, type: 'station', desc: '起点站 · 熟悉飞船操作' },
  { id: 'red', name: '赤焰星', icon: '🔴', energyNeeded: 30, type: 'planet', desc: '热情的红色星球 · 校园人际任务' },
  { id: 'supply1', name: '晶蓝补给站', icon: '🛸', energyNeeded: 80, type: 'supply', desc: '星际补给站 · 可兑换奖励' },
  { id: 'ice', name: '冰晶星', icon: '💙', energyNeeded: 150, type: 'planet', desc: '静谧的冰雪世界 · 家庭情感任务' },
  { id: 'purple', name: '迷雾星', icon: '🟣', energyNeeded: 250, type: 'planet', desc: '神秘的紫色星云 · 自我突破任务' },
  { id: 'supply2', name: '彩虹补给站', icon: '🌈', energyNeeded: 400, type: 'supply', desc: '高级补给站 · 更多奖励' },
  { id: 'galaxy', name: '银河中心', icon: '🌌', energyNeeded: 600, type: 'final', desc: '最终目的地 · 传说中的银河核心' },
];

// 补给站可兑换物品
const SUPPLY_ITEMS = [
  { id: 'redpacket_s', name: '小红包', emoji: '🧧', cost: 50, value: 30, desc: '30元微信红包' },
  { id: 'redpacket_m', name: '中红包', emoji: '💰', cost: 150, value: 100, desc: '100元微信红包' },
  { id: 'redpacket_l', name: '大红包', emoji: '🏆', cost: 500, value: 500, desc: '500元成长奖励' },
  { id: 'buff_engine', name: '引擎升级', emoji: '⚡', cost: 100, value: 'buff', desc: '星能获取 +10%（永久）' },
  { id: 'buff_radar', name: '雷达升级', emoji: '📡', cost: 200, value: 'buff', desc: '解锁隐藏任务（永久）' },
  { id: 'skin_gold', name: '金色涂装', emoji: '✨', cost: 80, value: 'skin', desc: '飞船金色外观' },
];

/* ==========================================================================
   DB Layer — Supabase
   ========================================================================== */
const DB = {
  supabase: null,
  init() {
    this.supabase = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_KEY);
  },

  // Tasks
  async getTasks() {
    const { data, error } = await this.supabase.from('tasks').select('*').order('created_at', { ascending: true });
    if (error) { console.error('DB getTasks error:', error); return []; }
    return data.map(this._camelCaseTask);
  },
  async createTask(task) {
    const dbTask = this._snakeCaseTask(task);
    const { data, error } = await this.supabase.from('tasks').insert(dbTask).select().single();
    if (error) { console.error('DB createTask error:', error); return null; }
    return this._camelCaseTask(data);
  },
  async updateTask(id, updates) {
    const dbUpdates = this._snakeCaseTask(updates);
    const { data, error } = await this.supabase.from('tasks').update(dbUpdates).eq('id', id).select().single();
    if (error) { console.error('DB updateTask error:', error); return null; }
    return this._camelCaseTask(data);
  },
  async deleteTask(id) {
    const { error } = await this.supabase.from('tasks').delete().eq('id', id);
    if (error) { console.error('DB deleteTask error:', error); return false; }
    return true;
  },
  _camelCaseTask(t) {
    // 兼容旧表结构：level → starLevel, growth_value → energy
    let starLevel = t.star_level;
    if (starLevel === undefined || starLevel === null) {
      // 从旧的 level 字段映射
      if (t.level === '基础礼仪项') starLevel = 2;
      else if (t.level === '进阶挑战项') starLevel = 3;
      else if (t.level === '突破挑战项') starLevel = 4;
      else starLevel = 3; // 默认3星
    }
    let energy = t.energy;
    if (energy === undefined || energy === null) {
      energy = t.growth_value || 10;
    }
    return {
      id: t.id,
      title: t.title,
      description: t.description,
      category: t.category,
      starLevel: starLevel,
      energy: energy,
      difficulty: t.difficulty,
      status: t.status,
      claimedBy: t.claimed_by,
      submittedAt: t.submitted_at,
      submittedNote: t.submitted_note,
      reviewedAt: t.reviewed_at,
      reviewNote: t.review_note,
      createdAt: t.created_at,
    };
  },
  _snakeCaseTask(t) {
    // 注意：只用旧字段名写入，避免 Supabase 因字段不存在报错
    // level 和 growth_value 是旧表字段，新功能通过这两个字段映射
    const out = {};
    if (t.title !== undefined) out.title = t.title;
    if (t.description !== undefined) out.description = t.description;
    if (t.category !== undefined) out.category = t.category;
    if (t.starLevel !== undefined) {
      const levelMap = { 1: '基础礼仪项', 2: '基础礼仪项', 3: '进阶挑战项', 4: '突破挑战项', 5: '突破挑战项' };
      out.level = levelMap[t.starLevel] || '进阶挑战项';
    }
    if (t.energy !== undefined) {
      out.growth_value = t.energy;
    }
    if (t.difficulty !== undefined) out.difficulty = t.difficulty;
    if (t.status !== undefined) out.status = t.status;
    if (t.claimedBy !== undefined) out.claimed_by = t.claimedBy;
    if (t.submittedAt !== undefined) out.submitted_at = t.submittedAt;
    if (t.submittedNote !== undefined) out.submitted_note = t.submittedNote;
    if (t.reviewedAt !== undefined) out.reviewed_at = t.reviewedAt;
    if (t.reviewNote !== undefined) out.review_note = t.reviewNote;
    return out;
  },

  // Self Reports
  async getSelfReports() {
    const { data, error } = await this.supabase.from('self_reports').select('*').order('created_at', { ascending: false });
    if (error) { console.error('DB getSelfReports error:', error); return []; }
    return data.map(r => ({
      id: r.id,
      title: r.title,
      description: r.description,
      category: r.category,
      energy: r.energy || r.growth_value || 10,
      status: r.status,
      submittedBy: r.submitted_by,
      reviewNote: r.review_note,
      createdAt: r.created_at,
      reviewedAt: r.reviewed_at,
    }));
  },
  async createSelfReport(report) {
    const insertData = {
      title: report.title,
      description: report.description,
      category: report.category,
      energy: report.energy,
      growth_value: report.energy, // 同时写入旧字段
      status: 'pending',
      submitted_by: report.submittedBy,
    };
    const { data, error } = await this.supabase.from('self_reports').insert(insertData).select().single();
    if (error) { console.error('DB createSelfReport error:', error); return null; }
    return data;
  },
  async reviewSelfReport(id, status, reviewNote) {
    const { error } = await this.supabase.from('self_reports').update({
      status, review_note: reviewNote, reviewed_at: new Date().toISOString()
    }).eq('id', id);
    if (error) { console.error('DB reviewSelfReport error:', error); return false; }
    return true;
  },

  // Rewards / Supply Station Records
  async getRewards() {
    const { data, error } = await this.supabase.from('rewards').select('*').order('created_at', { ascending: false });
    if (error) { console.error('DB getRewards error:', error); return []; }
    return data.map(r => ({
      id: r.id,
      type: r.type,
      name: r.name,
      amount: r.amount,
      energyCost: r.energy_cost || 0,
      note: r.note,
      grantedBy: r.granted_by,
      createdAt: r.created_at,
      redeemed: r.redeemed || false,
      redeemedAt: r.redeemed_at,
    }));
  },
  async addReward(reward) {
    const insertData = {
      type: reward.type,
      name: reward.name,
      amount: reward.amount,
      energy_cost: reward.energyCost,
      note: reward.note,
      granted_by: reward.grantedBy,
      redeemed: reward.redeemed || false,
    };
    const { data, error } = await this.supabase.from('rewards').insert(insertData).select().single();
    if (error) { console.error('DB addReward error:', error); return null; }
    return data;
  },
  async redeemReward(id) {
    const updateData = {
      redeemed: true,
      redeemed_at: new Date().toISOString(),
    };
    const { error } = await this.supabase.from('rewards').update(updateData).eq('id', id);
    if (error) { console.error('DB redeemReward error:', error); return false; }
    return true;
  },

  // App Config
  async getConfig() {
    const { data, error } = await this.supabase.from('app_config').select('*').single();
    if (error) { console.error('DB getConfig error:', error); return null; }
    // 兼容旧表结构：growth_score → star_energy
    const starEnergy = data.star_energy !== undefined && data.star_energy !== null
      ? data.star_energy
      : (data.growth_score || 0);
    const shipLevel = data.ship_level || Math.floor(starEnergy / 50) + 1;
    return {
      starEnergy: starEnergy,
      shipLevel: shipLevel,
      currentPlanet: data.current_planet || 'moon',
      engineBuff: data.engine_buff || false,
      radarBuff: data.radar_buff || false,
      shipSkin: data.ship_skin || 'default',
      totalTasksCompleted: data.total_tasks_completed,
      monthlyTasks: data.monthly_tasks,
      currentMonth: data.current_month,
      adminPassword: data.admin_password,
      userPassword: data.user_password,
      userName: data.user_name,
      adminName: data.admin_name,
    };
  },
  async updateConfig(config) {
    const updates = {};
    if (config.starEnergy !== undefined) {
      updates.star_energy = config.starEnergy;
      updates.growth_score = config.starEnergy; // 同时写入旧字段
    }
    if (config.shipLevel !== undefined) updates.ship_level = config.shipLevel;
    if (config.currentPlanet !== undefined) updates.current_planet = config.currentPlanet;
    if (config.engineBuff !== undefined) updates.engine_buff = config.engineBuff;
    if (config.radarBuff !== undefined) updates.radar_buff = config.radarBuff;
    if (config.shipSkin !== undefined) updates.ship_skin = config.shipSkin;
    if (config.totalTasksCompleted !== undefined) updates.total_tasks_completed = config.totalTasksCompleted;
    if (config.monthlyTasks !== undefined) updates.monthly_tasks = config.monthlyTasks;
    if (config.currentMonth !== undefined) updates.current_month = config.currentMonth;
    if (config.adminPassword !== undefined) updates.admin_password = config.adminPassword;
    if (config.userPassword !== undefined) updates.user_password = config.userPassword;
    if (config.userName !== undefined) updates.user_name = config.userName;
    if (config.adminName !== undefined) updates.admin_name = config.adminName;
    const { error } = await this.supabase.from('app_config').update(updates).eq('id', 1);
    if (error) { console.error('DB updateConfig error:', error); return false; }
    return true;
  },
};

/* ==========================================================================
   Auth
   ========================================================================== */
const Auth = {
  currentRole: 'user',
  selectRole(role) {
    this.currentRole = role;
    document.querySelectorAll('.role-card').forEach(el => {
      el.classList.toggle('active', el.dataset.role === role);
    });
  },
  async doLogin() {
    const password = document.getElementById('login-password').value;
    const config = await DB.getConfig();
    if (!config) { UI.toast('连接数据库失败', 'error'); return; }

    const correctPwd = this.currentRole === 'admin' ? config.adminPassword : config.userPassword;
    if (password !== correctPwd) {
      UI.toast('密码错误', 'error');
      return;
    }

    // 检查月度重置
    const now = new Date();
    const monthKey = `${now.getFullYear()}-${now.getMonth() + 1}`;
    if (config.currentMonth !== monthKey) {
      await DB.updateConfig({ currentMonth: monthKey, monthlyTasks: 0 });
    }

    if (this.currentRole === 'admin') {
      document.getElementById('admin-name').textContent = config.adminName || '指挥官';
      document.getElementById('login-screen').style.display = 'none';
      document.getElementById('admin-dashboard').style.display = 'flex';
      Router.adminTab('tasks');
    } else {
      document.getElementById('user-name').textContent = config.userName || '舰长';
      document.getElementById('login-screen').style.display = 'none';
      document.getElementById('user-dashboard').style.display = 'flex';
      Router.userTab('starmap');
    }
  },
  logout() {
    document.getElementById('admin-dashboard').style.display = 'none';
    document.getElementById('user-dashboard').style.display = 'none';
    document.getElementById('login-screen').style.display = 'flex';
    document.getElementById('login-password').value = '';
  },
};

/* ==========================================================================
   Router
   ========================================================================== */
const Router = {
  currentAdminTab: 'tasks',
  currentUserTab: 'starmap',

  adminTab(tab) {
    this.currentAdminTab = tab;
    document.querySelectorAll('#admin-nav .nav-item').forEach(el => {
      el.classList.toggle('active', el.dataset.tab === tab);
    });
    const main = document.getElementById('admin-main');
    main.innerHTML = '<div style="text-align:center;padding:40px;"><div style="font-size:32px;">🚀</div><p style="color:var(--text-secondary);margin-top:8px;">加载中...</p></div>';
    this._renderAdmin(tab);
  },
  userTab(tab) {
    this.currentUserTab = tab;
    document.querySelectorAll('#user-nav .nav-item').forEach(el => {
      el.classList.toggle('active', el.dataset.tab === tab);
    });
    const main = document.getElementById('user-main');
    main.innerHTML = '<div style="text-align:center;padding:40px;"><div style="font-size:32px;">🚀</div><p style="color:var(--text-secondary);margin-top:8px;">加载中...</p></div>';
    this._renderUser(tab);
  },

  async _renderAdmin(tab) {
    switch (tab) {
      case 'tasks': await AdminView.renderTasks(); break;
      case 'review': await AdminView.renderReview(); break;
      case 'rewards': await AdminView.renderRewards(); break;
      case 'dashboard': await AdminView.renderDashboard(); break;
      case 'reports': await AdminView.renderReports(); break;
    }
  },
  async _renderUser(tab) {
    switch (tab) {
      case 'starmap': await UserView.renderStarMap(); break;
      case 'tasks': await UserView.renderTasks(); break;
      case 'growth': await UserView.renderGrowth(); break;
      case 'rewards': await UserView.renderRewards(); break;
    }
  },
};

/* ==========================================================================
   UI Helpers
   ========================================================================== */
const UI = {
  toast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = message;
    container.appendChild(el);
    setTimeout(() => el.remove(), 2500);
  },

  confirm(title, message, onConfirm) {
    const html = `
      <div class="modal-overlay" onclick="if(event.target===this)UI.closeModal()">
        <div class="modal">
          <div class="modal-header">
            <div class="modal-title">${title}</div>
            <button class="modal-close" onclick="UI.closeModal()">×</button>
          </div>
          <p style="color:var(--text-secondary);">${message}</p>
          <div class="modal-footer">
            <button class="btn btn-outline" onclick="UI.closeModal()">取消</button>
            <button class="btn btn-primary" id="confirm-ok">确认</button>
          </div>
        </div>
      </div>`;
    document.getElementById('modal-container').innerHTML = html;
    document.getElementById('confirm-ok').onclick = () => { UI.closeModal(); onConfirm(); };
  },

  modal(title, bodyHtml, footerHtml = '') {
    const html = `
      <div class="modal-overlay" onclick="if(event.target===this)UI.closeModal()">
        <div class="modal">
          <div class="modal-header">
            <div class="modal-title">${title}</div>
            <button class="modal-close" onclick="UI.closeModal()">×</button>
          </div>
          ${bodyHtml}
          ${footerHtml ? `<div class="modal-footer">${footerHtml}</div>` : ''}
        </div>
      </div>`;
    document.getElementById('modal-container').innerHTML = html;
  },

  closeModal() {
    document.getElementById('modal-container').innerHTML = '';
  },

  starRating(stars) {
    let html = '<span class="star-rating">';
    for (let i = 1; i <= 5; i++) {
      html += `<span class="star ${i <= stars ? 'filled' : ''}">★</span>`;
    }
    html += '</span>';
    return html;
  },

  starTag(starLevel) {
    return `<span class="tag tag-star">${this.starRating(starLevel)} ${STAR_NAMES[starLevel] || ''}</span>`;
  },

  statusTag(status) {
    const info = STATUS_MAP[status] || { label: status, cls: '' };
    return `<span class="tag tag-status-${info.cls}">${info.label}</span>`;
  },

  categoryTag(category) {
    return `<span class="tag tag-category">${category}</span>`;
  },

  formatDate(dateStr) {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return `${d.getFullYear()}/${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getDate().toString().padStart(2,'0')}`;
  },

  energyBadge(energy) {
    return `<span class="energy-reward">⚡ ${energy}</span>`;
  },
};

/* ==========================================================================
   Charts (SVG)
   ========================================================================== */
const Charts = {
  radar(categories, values, size = 260) {
    const cx = size / 2, cy = size / 2;
    const maxVal = 100;
    const levels = 5;
    const angleStep = (Math.PI * 2) / categories.length;
    const radius = size * 0.38;

    let svg = `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">`;

    // Grid polygons
    for (let i = levels; i >= 1; i--) {
      const r = (radius * i) / levels;
      let points = '';
      for (let j = 0; j < categories.length; j++) {
        const angle = -Math.PI / 2 + j * angleStep;
        const x = cx + r * Math.cos(angle);
        const y = cy + r * Math.sin(angle);
        points += `${x},${y} `;
      }
      svg += `<polygon points="${points}" fill="none" stroke="rgba(129,140,248,0.15)" stroke-width="1"/>`;
    }

    // Axes
    for (let j = 0; j < categories.length; j++) {
      const angle = -Math.PI / 2 + j * angleStep;
      const x = cx + radius * Math.cos(angle);
      const y = cy + radius * Math.sin(angle);
      svg += `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="rgba(129,140,248,0.1)" stroke-width="1"/>`;
    }

    // Data polygon
    let dataPoints = '';
    for (let j = 0; j < categories.length; j++) {
      const val = Math.min(values[j], maxVal);
      const r = (radius * val) / maxVal;
      const angle = -Math.PI / 2 + j * angleStep;
      const x = cx + r * Math.cos(angle);
      const y = cy + r * Math.sin(angle);
      dataPoints += `${x},${y} `;
    }
    svg += `<polygon points="${dataPoints}" fill="rgba(244,114,182,0.25)" stroke="#f472b6" stroke-width="2"/>`;

    // Data points
    for (let j = 0; j < categories.length; j++) {
      const val = Math.min(values[j], maxVal);
      const r = (radius * val) / maxVal;
      const angle = -Math.PI / 2 + j * angleStep;
      const x = cx + r * Math.cos(angle);
      const y = cy + r * Math.sin(angle);
      svg += `<circle cx="${x}" cy="${y}" r="4" fill="#f472b6"/>`;
    }

    // Labels
    for (let j = 0; j < categories.length; j++) {
      const angle = -Math.PI / 2 + j * angleStep;
      const labelR = radius + 20;
      const x = cx + labelR * Math.cos(angle);
      const y = cy + labelR * Math.sin(angle);
      svg += `<text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="middle" fill="#a5a0c0" font-size="12">${categories[j]}</text>`;
    }

    svg += '</svg>';
    return svg;
  },

  donut(value, max, size = 180, color = '#818cf8') {
    const cx = size / 2, cy = size / 2;
    const r = size * 0.38;
    const circumference = 2 * Math.PI * r;
    const percent = Math.min(value / max, 1);
    const dashOffset = circumference * (1 - percent);

    return `
      <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
        <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="rgba(129,140,248,0.15)" stroke-width="12"/>
        <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color}" stroke-width="12"
          stroke-dasharray="${circumference}" stroke-dashoffset="${dashOffset}"
          stroke-linecap="round" transform="rotate(-90 ${cx} ${cy})"
          style="transition: stroke-dashoffset 0.6s ease;"/>
        <text x="${cx}" y="${cy - 6}" text-anchor="middle" fill="#e8e6f5" font-size="24" font-weight="700">${value}</text>
        <text x="${cx}" y="${cy + 18}" text-anchor="middle" fill="#a5a0c0" font-size="12">/ ${max}</text>
      </svg>`;
  },

  bar(labels, values, width = 300, height = 200) {
    const maxVal = Math.max(...values, 10);
    const barWidth = (width - 40) / labels.length * 0.6;
    const gap = (width - 40) / labels.length * 0.4;
    const chartTop = 20, chartBottom = height - 30;
    const chartHeight = chartBottom - chartTop;

    let svg = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`;

    // Grid lines
    for (let i = 0; i <= 4; i++) {
      const y = chartTop + (chartHeight * i) / 4;
      svg += `<line x1="30" y1="${y}" x2="${width - 10}" y2="${y}" stroke="rgba(129,140,248,0.1)" stroke-width="1"/>`;
    }

    // Bars
    labels.forEach((label, i) => {
      const x = 30 + i * (barWidth + gap) + gap / 2;
      const barHeight = (chartHeight * values[i]) / maxVal;
      const y = chartBottom - barHeight;
      svg += `<rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" rx="4"
        fill="url(#barGradient${i})" style="transition: height 0.6s ease;"/>`;
      svg += `<defs><linearGradient id="barGradient${i}" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" style="stop-color:#f472b6;stop-opacity:1" />
        <stop offset="100%" style="stop-color:#818cf8;stop-opacity:1" />
      </linearGradient></defs>`;
      svg += `<text x="${x + barWidth / 2}" y="${chartBottom + 18}" text-anchor="middle" fill="#a5a0c0" font-size="11">${label}</text>`;
    });

    svg += '</svg>';
    return svg;
  },

  progressBar(value, max, width = '100%') {
    const percent = Math.min((value / max) * 100, 100);
    return `
      <div class="progress-bar-wrap" style="width:${width};">
        <div class="progress-bar" style="width:${percent}%;"></div>
      </div>`;
  },
};

/* ==========================================================================
   Task Operations
   ========================================================================== */
const Task = {
  async claim(taskId) {
    const task = (await DB.getTasks()).find(t => t.id === taskId);
    if (!task || task.status !== 'available') return;
    const config = await DB.getConfig();
    await DB.updateTask(taskId, { status: 'in_progress', claimedBy: config.userName });
    UI.toast('任务已领取，祝航行顺利！', 'success');
    await this._refreshView();
  },

  async submit(taskId) {
    const body = `
      <div class="form-group">
        <label>完成情况说明</label>
        <textarea id="submit-note" placeholder="描述一下你是怎么完成的，有什么感受..."></textarea>
      </div>`;
    const footer = `
      <button class="btn btn-outline" onclick="UI.closeModal()">取消</button>
      <button class="btn btn-primary" onclick="Task.doSubmit(${taskId})">提交审核</button>`;
    UI.modal('提交任务完成', body, footer);
  },

  async doSubmit(taskId) {
    const note = document.getElementById('submit-note').value.trim();
    if (!note) { UI.toast('请填写完成情况说明', 'warn'); return; }
    await DB.updateTask(taskId, {
      status: 'pending_review',
      submittedAt: new Date().toISOString(),
      submittedNote: note,
    });
    UI.closeModal();
    UI.toast('已提交，等待指挥官审核 ⚡', 'success');
    await this._refreshView();
  },

  async abandon(taskId) {
    UI.confirm('放弃任务', '确定要放弃这个任务吗？放弃后可以重新领取。', async () => {
      await DB.updateTask(taskId, { status: 'available', claimedBy: null, submittedAt: null, submittedNote: null });
      UI.toast('已放弃任务', 'warn');
      await this._refreshView();
    });
  },

  async approve(taskId) {
    const task = (await DB.getTasks()).find(t => t.id === taskId);
    if (!task) return;
    const body = `
      <div class="form-group">
        <label>审核评语（可选）</label>
        <textarea id="review-note" placeholder="给舰长一些鼓励..."></textarea>
      </div>`;
    const footer = `
      <button class="btn btn-outline" onclick="UI.closeModal()">取消</button>
      <button class="btn btn-primary" onclick="Task.doApprove(${taskId})">通过并发放星能</button>`;
    UI.modal('审核通过', body, footer);
  },

  async doApprove(taskId) {
    const note = document.getElementById('review-note').value.trim();
    const task = (await DB.getTasks()).find(t => t.id === taskId);
    if (!task) return;

    const config = await DB.getConfig();
    let energyGain = task.energy;
    if (config.engineBuff) energyGain = Math.floor(energyGain * 1.1);

    const newEnergy = config.starEnergy + energyGain;
    const newTotal = config.totalTasksCompleted + 1;
    const newMonthly = config.monthlyTasks + 1;

    // 计算飞船等级
    const newLevel = Math.floor(newEnergy / 50) + 1;

    // 检查是否跃迁到新星球
    const newPlanet = this._calcCurrentPlanet(newEnergy);
    const oldPlanet = config.currentPlanet;
    const jumped = newPlanet !== oldPlanet;

    await DB.updateTask(taskId, {
      status: 'completed',
      reviewedAt: new Date().toISOString(),
      reviewNote: note,
    });
    await DB.updateConfig({
      starEnergy: newEnergy,
      totalTasksCompleted: newTotal,
      monthlyTasks: newMonthly,
      shipLevel: newLevel,
      currentPlanet: newPlanet,
    });

    UI.closeModal();
    if (jumped) {
      UI.toast(`🎉 跃迁成功！抵达 ${PLANETS.find(p=>p.id===newPlanet)?.name}`, 'success');
    } else {
      UI.toast(`审核通过，获得 ${energyGain} 星能 ⚡`, 'success');
    }
    await this._refreshView();
  },

  async reject(taskId) {
    const body = `
      <div class="form-group">
        <label>退回原因</label>
        <textarea id="reject-note" placeholder="说明一下为什么需要改进..."></textarea>
      </div>`;
    const footer = `
      <button class="btn btn-outline" onclick="UI.closeModal()">取消</button>
      <button class="btn btn-accent" onclick="Task.doReject(${taskId})">退回修改</button>`;
    UI.modal('退回任务', body, footer);
  },

  async doReject(taskId) {
    const note = document.getElementById('reject-note').value.trim();
    if (!note) { UI.toast('请填写退回原因', 'warn'); return; }
    await DB.updateTask(taskId, {
      status: 'in_progress',
      reviewedAt: new Date().toISOString(),
      reviewNote: note,
      submittedAt: null,
      submittedNote: null,
    });
    UI.closeModal();
    UI.toast('已退回修改', 'warn');
    await this._refreshView();
  },

  _calcCurrentPlanet(energy) {
    let current = 'moon';
    for (const planet of PLANETS) {
      if (energy >= planet.energyNeeded) {
        current = planet.id;
      }
    }
    return current;
  },

  async _refreshView() {
    if (Auth.currentRole === 'admin') {
      Router.adminTab(Router.currentAdminTab);
    } else {
      Router.userTab(Router.currentUserTab);
    }
  },
};

/* ==========================================================================
   Self Report Operations
   ========================================================================== */
const SelfReport = {
  async openSubmit() {
    const starOptions = STAR_LEVELS.map(l => `<option value="${l.stars}">${l.stars}星 · ${l.name} (${l.energyRange[0]}-${l.energyRange[1]}星能)</option>`).join('');
    const catOptions = CATEGORIES.map(c => `<option value="${c}">${c}</option>`).join('');
    const body = `
      <div class="form-group">
        <label>事件标题</label>
        <input type="text" id="sr-title" placeholder="比如：主动和新同学打招呼">
      </div>
      <div class="form-group">
        <label>事件描述</label>
        <textarea id="sr-desc" placeholder="详细描述一下发生了什么..."></textarea>
      </div>
      <div class="form-group">
        <label>分类</label>
        <select id="sr-category">${catOptions}</select>
      </div>
      <div class="form-group">
        <label>期望星能</label>
        <input type="number" id="sr-energy" placeholder="自己估计一下值多少星能" min="1" max="100">
      </div>`;
    const footer = `
      <button class="btn btn-outline" onclick="UI.closeModal()">取消</button>
      <button class="btn btn-primary" onclick="SelfReport.doSubmit()">提交申报</button>`;
    UI.modal('自主申报', body, footer);
  },

  async doSubmit() {
    const title = document.getElementById('sr-title').value.trim();
    const desc = document.getElementById('sr-desc').value.trim();
    const category = document.getElementById('sr-category').value;
    const energy = parseInt(document.getElementById('sr-energy').value);
    const config = await DB.getConfig();
    if (!title || !desc) { UI.toast('请填写完整信息', 'warn'); return; }
    if (!energy || energy < 1) { UI.toast('请填写有效的星能值', 'warn'); return; }
    await DB.createSelfReport({ title, description: desc, category, energy, submittedBy: config.userName });
    UI.closeModal();
    UI.toast('已提交申报，等待审核 🌟', 'success');
    await Task._refreshView();
  },

  async approve(id) {
    const reports = await DB.getSelfReports();
    const report = reports.find(r => r.id === id);
    if (!report) return;
    const body = `
      <div class="form-group">
        <label>审核评语（可选）</label>
        <textarea id="sr-review-note" placeholder="给舰长一些反馈..."></textarea>
      </div>`;
    const footer = `
      <button class="btn btn-outline" onclick="UI.closeModal()">取消</button>
      <button class="btn btn-primary" onclick="SelfReport.doApprove(${id})">通过</button>`;
    UI.modal('审核通过申报', body, footer);
  },

  async doApprove(id) {
    const note = document.getElementById('sr-review-note').value.trim();
    const reports = await DB.getSelfReports();
    const report = reports.find(r => r.id === id);
    if (!report) return;

    const config = await DB.getConfig();
    const newEnergy = config.starEnergy + report.energy;
    const newLevel = Math.floor(newEnergy / 50) + 1;
    const newPlanet = Task._calcCurrentPlanet(newEnergy);

    await DB.reviewSelfReport(id, 'approved', note);
    await DB.updateConfig({
      starEnergy: newEnergy,
      totalTasksCompleted: config.totalTasksCompleted + 1,
      monthlyTasks: config.monthlyTasks + 1,
      shipLevel: newLevel,
      currentPlanet: newPlanet,
    });
    UI.closeModal();
    UI.toast(`审核通过，获得 ${report.energy} 星能 ⚡`, 'success');
    await Task._refreshView();
  },

  async reject(id) {
    const body = `
      <div class="form-group">
        <label>驳回原因</label>
        <textarea id="sr-reject-note" placeholder="说明一下为什么不符合..."></textarea>
      </div>`;
    const footer = `
      <button class="btn btn-outline" onclick="UI.closeModal()">取消</button>
      <button class="btn btn-accent" onclick="SelfReport.doReject(${id})">驳回</button>`;
    UI.modal('驳回申报', body, footer);
  },

  async doReject(id) {
    const note = document.getElementById('sr-reject-note').value.trim();
    if (!note) { UI.toast('请填写驳回原因', 'warn'); return; }
    await DB.reviewSelfReport(id, 'rejected', note);
    UI.closeModal();
    UI.toast('已驳回', 'warn');
    await Task._refreshView();
  },
};

/* ==========================================================================
   Supply Station (Rewards)
   ========================================================================== */
const SupplyStation = {
  // 用户端：兑换奖励
  async redeem(itemId) {
    const item = SUPPLY_ITEMS.find(i => i.id === itemId);
    if (!item) return;
    const config = await DB.getConfig();

    if (config.starEnergy < item.cost) {
      UI.toast('星能不足，继续努力吧！', 'warn');
      return;
    }

    UI.confirm(`兑换 ${item.name}`, `确定要消耗 ${item.cost} ⚡ 星能兑换 ${item.name} 吗？`, async () => {
      const newEnergy = config.starEnergy - item.cost;

      // 处理 buff / skin
      let newEngineBuff = config.engineBuff;
      let newRadarBuff = config.radarBuff;
      let newSkin = config.shipSkin;

      if (item.value === 'buff' && item.id === 'buff_engine') newEngineBuff = true;
      if (item.value === 'buff' && item.id === 'buff_radar') newRadarBuff = true;
      if (item.value === 'skin') newSkin = item.id;

      await DB.updateConfig({
        starEnergy: newEnergy,
        engineBuff: newEngineBuff,
        radarBuff: newRadarBuff,
        shipSkin: newSkin,
      });

      // 记录奖励
      await DB.addReward({
        type: item.value === 'buff' || item.value === 'skin' ? 'virtual' : 'cash',
        name: item.name,
        amount: item.value || 0,
        energyCost: item.cost,
        note: item.desc,
        grantedBy: '补给站兑换',
        redeemed: item.value === 'buff' || item.value === 'skin',
      });

      UI.toast(`兑换成功！${item.emoji}`, 'success');
      await Task._refreshView();
    });
  },

  // 管理员：手动发放奖励
  async grant() {
    const typeOptions = ['monthly', 'semester', 'annual', 'custom'].map(t =>
      `<option value="${t}">${t === 'monthly' ? '月度小红包' : t === 'semester' ? '学期成长基金' : t === 'annual' ? '年度突破奖励' : '自定义奖励'}</option>`
    ).join('');
    const body = `
      <div class="form-group">
        <label>奖励类型</label>
        <select id="grant-type">${typeOptions}</select>
      </div>
      <div class="form-group">
        <label>奖励名称</label>
        <input type="text" id="grant-name" placeholder="比如：三月成长红包">
      </div>
      <div class="form-group">
        <label>金额（元）</label>
        <input type="number" id="grant-amount" placeholder="30">
      </div>
      <div class="form-group">
        <label>备注</label>
        <textarea id="grant-note" placeholder="一些鼓励的话..."></textarea>
      </div>`;
    const footer = `
      <button class="btn btn-outline" onclick="UI.closeModal()">取消</button>
      <button class="btn btn-gold" onclick="SupplyStation.doGrant()">发放奖励</button>`;
    UI.modal('发放奖励', body, footer);
  },

  async doGrant() {
    const type = document.getElementById('grant-type').value;
    const name = document.getElementById('grant-name').value.trim();
    const amount = parseFloat(document.getElementById('grant-amount').value);
    const note = document.getElementById('grant-note').value.trim();
    const config = await DB.getConfig();

    if (!name) { UI.toast('请填写奖励名称', 'warn'); return; }
    if (!amount || amount <= 0) { UI.toast('请填写有效金额', 'warn'); return; }

    await DB.addReward({
      type, name, amount, energyCost: 0, note,
      grantedBy: config.adminName || '指挥官',
      redeemed: false,
    });
    UI.closeModal();
    UI.toast('奖励已发放 🎁', 'success');
    await Task._refreshView();
  },

  async markRedeemed(id) {
    UI.confirm('确认已发放', '确认这笔奖励已经实际发放给舰长了吗？', async () => {
      await DB.redeemReward(id);
      UI.toast('已标记为已发放', 'success');
      await Task._refreshView();
    });
  },
};

/* ==========================================================================
   Admin View
   ========================================================================== */
const AdminView = {
  async renderTasks() {
    const tasks = await DB.getTasks();
    const config = await DB.getConfig();

    const stats = {
      total: tasks.length,
      available: tasks.filter(t => t.status === 'available').length,
      inProgress: tasks.filter(t => t.status === 'in_progress').length,
      pending: tasks.filter(t => t.status === 'pending_review').length,
      completed: tasks.filter(t => t.status === 'completed').length,
    };

    const html = `
      <div class="page-title">任务库</div>
      <div class="page-subtitle">管理所有星际任务</div>

      <div class="stats-grid">
        <div class="stat-card"><div class="stat-icon">📋</div><div class="stat-value">${stats.total}</div><div class="stat-label">总任务数</div></div>
        <div class="stat-card"><div class="stat-icon">✨</div><div class="stat-value">${stats.available}</div><div class="stat-label">待领取</div></div>
        <div class="stat-card"><div class="stat-icon">🚀</div><div class="stat-value">${stats.inProgress}</div><div class="stat-label">进行中</div></div>
        <div class="stat-card"><div class="stat-value gold">⚡ ${config.starEnergy}</div><div class="stat-label">总星能</div></div>
      </div>

      <div class="section-header">
        <div class="section-title">全部任务</div>
        <button class="btn btn-primary btn-sm" onclick="AdminView.openCreateTask()">+ 新建任务</button>
      </div>

      <div class="filter-bar">
        <select onchange="AdminView.filterTasks(this.value)">
          <option value="all">全部状态</option>
          <option value="available">待领取</option>
          <option value="in_progress">进行中</option>
          <option value="pending_review">待审核</option>
          <option value="completed">已完成</option>
          <option value="abandoned">已放弃</option>
        </select>
        <select onchange="AdminView.filterCategory(this.value)">
          <option value="all">全部分类</option>
          ${CATEGORIES.map(c => `<option value="${c}">${c}</option>`).join('')}
        </select>
      </div>

      <div id="task-list">
        ${tasks.length === 0 ? this._emptyState('还没有任务，点击右上角新建') : tasks.map(t => this._taskCard(t)).join('')}
      </div>`;

    document.getElementById('admin-main').innerHTML = html;
  },

  _taskCard(task) {
    return `
      <div class="task-card star-${task.starLevel}">
        <div class="task-card-header">
          <div class="task-card-title">${task.title}</div>
          ${UI.statusTag(task.status)}
        </div>
        <div class="task-card-desc">${task.description}</div>
        <div class="task-meta">
          ${UI.categoryTag(task.category)}
          ${UI.starTag(task.starLevel)}
          ${UI.energyBadge(task.energy)}
          ${task.claimedBy ? `<span class="tag" style="background:rgba(255,255,255,0.08);color:var(--text-secondary);">领取者：${task.claimedBy}</span>` : ''}
        </div>
        <div class="task-actions">
          <button class="btn btn-outline btn-sm" onclick="AdminView.editTask(${task.id})">编辑</button>
          <button class="btn btn-accent btn-sm" onclick="AdminView.deleteTask(${task.id})">删除</button>
        </div>
      </div>`;
  },

  _emptyState(msg) {
    return `<div class="empty-state"><div class="emoji">🌌</div><p>${msg}</p></div>`;
  },

  async openCreateTask() {
    const starOptions = STAR_LEVELS.map(l =>
      `<option value="${l.stars}">${l.stars}星 · ${l.name} (${l.energyRange[0]}-${l.energyRange[1]}⚡)</option>`
    ).join('');
    const catOptions = CATEGORIES.map(c => `<option value="${c}">${c}</option>`).join('');
    const body = `
      <div class="form-group">
        <label>任务标题</label>
        <input type="text" id="new-task-title" placeholder="比如：主动和同桌说早上好">
      </div>
      <div class="form-group">
        <label>任务描述</label>
        <textarea id="new-task-desc" placeholder="详细描述任务内容和要求..."></textarea>
      </div>
      <div class="form-group">
        <label>分类</label>
        <select id="new-task-category">${catOptions}</select>
      </div>
      <div class="form-group">
        <label>星级</label>
        <select id="new-task-star" onchange="AdminView.updateEnergyHint()">${starOptions}</select>
      </div>
      <div class="form-group">
        <label>星能奖励</label>
        <input type="number" id="new-task-energy" value="10" min="1" max="100">
        <p style="font-size:12px;color:var(--text-secondary);margin-top:4px;" id="energy-hint">建议：1星3-8，2星8-15，3星15-25，4星25-40，5星40-60</p>
      </div>`;
    const footer = `
      <button class="btn btn-outline" onclick="UI.closeModal()">取消</button>
      <button class="btn btn-primary" onclick="AdminView.createTask()">创建任务</button>`;
    UI.modal('新建任务', body, footer);
  },

  updateEnergyHint() {
    const star = parseInt(document.getElementById('new-task-star').value);
    const range = STAR_LEVELS.find(l => l.stars === star)?.energyRange || [0, 0];
    document.getElementById('energy-hint').textContent = `建议星能：${range[0]}-${range[1]} ⚡`;
  },

  async createTask() {
    const title = document.getElementById('new-task-title').value.trim();
    const desc = document.getElementById('new-task-desc').value.trim();
    const category = document.getElementById('new-task-category').value;
    const starLevel = parseInt(document.getElementById('new-task-star').value);
    const energy = parseInt(document.getElementById('new-task-energy').value);

    if (!title) { UI.toast('请填写任务标题', 'warn'); return; }
    if (!energy || energy < 1) { UI.toast('请填写有效的星能值', 'warn'); return; }

    await DB.createTask({
      title, description: desc, category, starLevel, energy,
      difficulty: DIFFICULTIES[starLevel - 1] || '中等',
      status: 'available',
    });
    UI.closeModal();
    UI.toast('任务创建成功 🎯', 'success');
    this.renderTasks();
  },

  async editTask(id) {
    const tasks = await DB.getTasks();
    const task = tasks.find(t => t.id === id);
    if (!task) return;

    const starOptions = STAR_LEVELS.map(l =>
      `<option value="${l.stars}" ${task.starLevel === l.stars ? 'selected' : ''}>${l.stars}星 · ${l.name}</option>`
    ).join('');
    const catOptions = CATEGORIES.map(c => `<option value="${c}" ${task.category === c ? 'selected' : ''}>${c}</option>`).join('');

    const body = `
      <div class="form-group">
        <label>任务标题</label>
        <input type="text" id="edit-task-title" value="${task.title}">
      </div>
      <div class="form-group">
        <label>任务描述</label>
        <textarea id="edit-task-desc">${task.description || ''}</textarea>
      </div>
      <div class="form-group">
        <label>分类</label>
        <select id="edit-task-category">${catOptions}</select>
      </div>
      <div class="form-group">
        <label>星级</label>
        <select id="edit-task-star">${starOptions}</select>
      </div>
      <div class="form-group">
        <label>星能奖励</label>
        <input type="number" id="edit-task-energy" value="${task.energy}" min="1" max="100">
      </div>`;
    const footer = `
      <button class="btn btn-outline" onclick="UI.closeModal()">取消</button>
      <button class="btn btn-primary" onclick="AdminView.updateTask(${id})">保存</button>`;
    UI.modal('编辑任务', body, footer);
  },

  async updateTask(id) {
    const title = document.getElementById('edit-task-title').value.trim();
    const desc = document.getElementById('edit-task-desc').value.trim();
    const category = document.getElementById('edit-task-category').value;
    const starLevel = parseInt(document.getElementById('edit-task-star').value);
    const energy = parseInt(document.getElementById('edit-task-energy').value);

    if (!title) { UI.toast('请填写任务标题', 'warn'); return; }
    await DB.updateTask(id, { title, description: desc, category, starLevel, energy });
    UI.closeModal();
    UI.toast('任务已更新', 'success');
    this.renderTasks();
  },

  async deleteTask(id) {
    UI.confirm('删除任务', '确定要删除这个任务吗？此操作不可恢复。', async () => {
      await DB.deleteTask(id);
      UI.toast('任务已删除', 'warn');
      this.renderTasks();
    });
  },

  filterTasks(status) {
    // 简化版：前端筛选
    const cards = document.querySelectorAll('#task-list .task-card');
    cards.forEach(card => {
      const tag = card.querySelector('.tag-status-done, .tag-status-available, .tag-status-progress, .tag-status-review, .tag-status-abandoned');
      if (status === 'all' || tag?.textContent === STATUS_MAP[status]?.label) {
        card.style.display = '';
      } else {
        card.style.display = 'none';
      }
    });
  },

  filterCategory(category) {
    const cards = document.querySelectorAll('#task-list .task-card');
    cards.forEach(card => {
      const tag = card.querySelector('.tag-category');
      if (category === 'all' || tag?.textContent === category) {
        card.style.display = '';
      } else {
        card.style.display = 'none';
      }
    });
  },

  async renderReview() {
    const tasks = await DB.getTasks();
    const reports = await DB.getSelfReports();
    const pendingTasks = tasks.filter(t => t.status === 'pending_review');
    const pendingReports = reports.filter(r => r.status === 'pending');

    const html = `
      <div class="page-title">审核台</div>
      <div class="page-subtitle">审核舰长提交的任务和自主申报</div>

      <div class="stats-grid">
        <div class="stat-card"><div class="stat-icon">📝</div><div class="stat-value">${pendingTasks.length}</div><div class="stat-label">待审核任务</div></div>
        <div class="stat-card"><div class="stat-icon">📨</div><div class="stat-value">${pendingReports.length}</div><div class="stat-label">待审核申报</div></div>
      </div>

      <div class="section-title" style="margin-bottom:12px;">待审核任务</div>
      ${pendingTasks.length === 0 ? this._emptyState('暂无待审核任务') : pendingTasks.map(t => `
        <div class="task-card star-${t.starLevel}">
          <div class="task-card-header">
            <div class="task-card-title">${t.title}</div>
            ${UI.statusTag(t.status)}
          </div>
          <div class="task-card-desc">${t.description}</div>
          <div class="task-meta">
            ${UI.categoryTag(t.category)}
            ${UI.starTag(t.starLevel)}
            ${UI.energyBadge(t.energy)}
            <span class="tag" style="background:rgba(255,255,255,0.08);color:var(--text-secondary);">提交者：${t.claimedBy}</span>
          </div>
          <div style="background:rgba(15,10,31,0.5);padding:12px;border-radius:8px;margin-bottom:12px;">
            <div style="font-size:13px;color:var(--text-secondary);margin-bottom:4px;">提交说明：</div>
            <div style="font-size:14px;">${t.submittedNote || '-'}</div>
            <div style="font-size:12px;color:var(--text-light);margin-top:4px;">提交时间：${UI.formatDate(t.submittedAt)}</div>
          </div>
          <div class="task-actions">
            <button class="btn btn-primary btn-sm" onclick="Task.approve(${t.id})">通过</button>
            <button class="btn btn-accent btn-sm" onclick="Task.reject(${t.id})">退回</button>
          </div>
        </div>
      `).join('')}

      <div class="section-title" style="margin:24px 0 12px;">待审核自主申报</div>
      ${pendingReports.length === 0 ? this._emptyState('暂无待审核申报') : pendingReports.map(r => `
        <div class="task-card star-3">
          <div class="task-card-header">
            <div class="task-card-title">${r.title}</div>
            <span class="tag tag-status-review">待审核</span>
          </div>
          <div class="task-card-desc">${r.description}</div>
          <div class="task-meta">
            ${UI.categoryTag(r.category)}
            ${UI.energyBadge(r.energy)}
            <span class="tag" style="background:rgba(255,255,255,0.08);color:var(--text-secondary);">申报者：${r.submittedBy}</span>
          </div>
          <div class="task-actions">
            <button class="btn btn-primary btn-sm" onclick="SelfReport.approve(${r.id})">通过</button>
            <button class="btn btn-accent btn-sm" onclick="SelfReport.reject(${r.id})">驳回</button>
          </div>
        </div>
      `).join('')}`;

    document.getElementById('admin-main').innerHTML = html;
  },

  async renderRewards() {
    const rewards = await DB.getRewards();
    const config = await DB.getConfig();

    const html = `
      <div class="page-title">补给站</div>
      <div class="page-subtitle">管理奖励发放 · 当前星能：⚡ ${config.starEnergy}</div>

      <div class="section-header">
        <div class="section-title">奖励记录</div>
        <button class="btn btn-gold btn-sm" onclick="SupplyStation.grant()">+ 手动发放</button>
      </div>

      ${rewards.length === 0 ? this._emptyState('还没有奖励记录') :
        `<div class="data-table-wrap" style="overflow-x:auto;">
          <table class="data-table">
            <thead>
              <tr><th>奖励</th><th>类型</th><th>金额</th><th>星能消耗</th><th>来源</th><th>状态</th><th>时间</th><th>操作</th></tr>
            </thead>
            <tbody>
              ${rewards.map(r => `
                <tr>
                  <td><strong>${r.name}</strong></td>
                  <td>${r.type === 'cash' ? '现金奖励' : r.type === 'virtual' ? '虚拟道具' : r.type}</td>
                  <td>${r.amount ? '¥' + r.amount : '-'}</td>
                  <td>${r.energyCost ? '⚡' + r.energyCost : '-'}</td>
                  <td style="font-size:13px;color:var(--text-secondary);">${r.grantedBy || '-'}</td>
                  <td>${r.redeemed ? '<span class="tag tag-status-done">已发放</span>' : '<span class="tag tag-status-progress">待发放</span>'}</td>
                  <td style="font-size:13px;color:var(--text-secondary);">${UI.formatDate(r.createdAt)}</td>
                  <td>${!r.redeemed && r.type !== 'virtual' ? `<button class="btn btn-sm btn-outline" onclick="SupplyStation.markRedeemed(${r.id})">标记已发</button>` : '-'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>`}`;

    document.getElementById('admin-main').innerHTML = html;
  },

  async renderDashboard() {
    const tasks = await DB.getTasks();
    const config = await DB.getConfig();
    const completed = tasks.filter(t => t.status === 'completed');

    // Category scores
    const catScores = CATEGORIES.map(cat => {
      const catTasks = tasks.filter(t => t.category === cat);
      const catDone = completed.filter(t => t.category === cat);
      if (catTasks.length === 0) return 0;
      const total = catTasks.reduce((s, t) => s + t.energy, 0);
      const done = catDone.reduce((s, t) => s + t.energy, 0);
      return Math.round((done / total) * 100);
    });

    // Monthly data (simplified - last 6 weeks)
    const weeks = ['第1周', '第2周', '第3周', '第4周', '第5周', '第6周'];
    const weekData = weeks.map(() => Math.floor(Math.random() * 5 + 1)); // placeholder

    const currentPlanet = PLANETS.find(p => p.id === config.currentPlanet) || PLANETS[0];
    const nextPlanet = PLANETS.find(p => p.energyNeeded > config.starEnergy);
    const progressToNext = nextPlanet
      ? Math.round(((config.starEnergy - currentPlanet.energyNeeded) / (nextPlanet.energyNeeded - currentPlanet.energyNeeded)) * 100)
      : 100;

    const html = `
      <div class="page-title">航行监控</div>
      <div class="page-subtitle">实时监控舰长的星际航行进度</div>

      <div class="stats-grid">
        <div class="stat-card"><div class="stat-icon">⚡</div><div class="stat-value gold">${config.starEnergy}</div><div class="stat-label">总星能</div></div>
        <div class="stat-card"><div class="stat-icon">🚀</div><div class="stat-value">Lv.${config.shipLevel}</div><div class="stat-label">飞船等级</div></div>
        <div class="stat-card"><div class="stat-icon">✅</div><div class="stat-value">${config.totalTasksCompleted}</div><div class="stat-label">完成任务</div></div>
        <div class="stat-card"><div class="stat-icon">🌟</div><div class="stat-value">${currentPlanet.icon}</div><div class="stat-label">${currentPlanet.name}</div></div>
      </div>

      <div class="card">
        <div class="card-title">航行进度</div>
        <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
          <span>${currentPlanet.icon} ${currentPlanet.name}</span>
          <span>${nextPlanet ? nextPlanet.icon + ' ' + nextPlanet.name : '🌌 银河中心'}</span>
        </div>
        ${Charts.progressBar(config.starEnergy, nextPlanet ? nextPlanet.energyNeeded : config.starEnergy)}
        <p style="font-size:12px;color:var(--text-secondary);margin-top:8px;">
          ${nextPlanet ? `距离 ${nextPlanet.name} 还需 ${nextPlanet.energyNeeded - config.starEnergy} ⚡ (${progressToNext}%)` : '已抵达银河中心！'}
        </p>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
        <div class="chart-wrap">
          <div class="chart-title">能力雷达图</div>
          <div class="chart-container">${Charts.radar(CATEGORIES, catScores)}</div>
        </div>
        <div class="chart-wrap">
          <div class="chart-title">本周完成趋势</div>
          <div class="chart-container">${Charts.bar(weeks, weekData, 300, 200)}</div>
        </div>
      </div>

      <div class="card">
        <div class="card-title">飞船状态</div>
        <div class="ship-status">
          <div class="ship-stat"><div class="label">引擎等级</div><div class="value">${config.engineBuff ? '强化型' : '标准型'}</div></div>
          <div class="ship-stat"><div class="label">雷达系统</div><div class="value">${config.radarBuff ? '高级' : '基础'}</div></div>
          <div class="ship-stat"><div class="label">涂装</div><div class="value">${config.shipSkin === 'skin_gold' ? '金色' : '标准'}</div></div>
        </div>
      </div>`;

    document.getElementById('admin-main').innerHTML = html;
  },

  async renderReports() {
    const tasks = await DB.getTasks();
    const config = await DB.getConfig();
    const rewards = await DB.getRewards();
    const completed = tasks.filter(t => t.status === 'completed');
    const currentPlanet = PLANETS.find(p => p.id === config.currentPlanet) || PLANETS[0];

    const catStats = CATEGORIES.map(cat => {
      const done = completed.filter(t => t.category === cat).length;
      const total = tasks.filter(t => t.category === cat).length;
      return { cat, done, total };
    });

    const html = `
      <div class="page-title">航行日志</div>
      <div class="page-subtitle">阶段性航行总结与回顾</div>

      <div class="report-card">
        <div class="report-header">
          <div class="report-title">本月航行报告</div>
          <button class="btn btn-outline btn-sm" onclick="AdminView.editReport()">编辑评语</button>
        </div>
        <div class="report-stats">
          <div class="report-stat"><div class="num">${config.monthlyTasks}</div><div class="label">本月任务</div></div>
          <div class="report-stat"><div class="num">${config.totalTasksCompleted}</div><div class="label">累计任务</div></div>
          <div class="report-stat"><div class="num gold">⚡${config.starEnergy}</div><div class="label">总星能</div></div>
          <div class="report-stat"><div class="num">${currentPlanet.icon}</div><div class="label">${currentPlanet.name}</div></div>
        </div>
        <div class="report-section">
          <h4>分类完成情况</h4>
          ${catStats.map(s => `<p>• ${s.cat}：${s.done}/${s.total} 个任务</p>`).join('')}
        </div>
        <div class="report-section">
          <h4>航行寄语</h4>
          <p>亲爱的舰长：

这个月你驾驶着飞船穿越了一片又一片星域，完成了 ${config.monthlyTasks} 个星际任务，获得了无数珍贵的星能。每一次尝试都是一次勇敢的跃迁，每一次突破都是一颗新的星星被点亮。

你已经飞到了 ${currentPlanet.name}，前方还有更广阔的宇宙等着你去探索。继续前进吧，银河中心就在远方 🌌

—— 指挥官</p>
        </div>
        <div style="display:flex;gap:8px;margin-top:16px;">
          <button class="btn btn-primary btn-sm" onclick="AdminView.exportReport()">导出报告</button>
        </div>
      </div>`;

    document.getElementById('admin-main').innerHTML = html;
  },

  editReport() {
    UI.toast('评语编辑功能开发中...', 'warn');
  },
  exportReport() {
    UI.toast('导出功能开发中...', 'warn');
  },
};

/* ==========================================================================
   User View
   ========================================================================== */
const UserView = {
  // ===== 星图 =====
  async renderStarMap() {
    const config = await DB.getConfig();
    const currentPlanet = PLANETS.find(p => p.id === config.currentPlanet) || PLANETS[0];
    const nextPlanet = PLANETS.find(p => p.energyNeeded > config.starEnergy);
    const currentIndex = PLANETS.findIndex(p => p.id === config.currentPlanet);

    // 计算星球在星图上的位置（弧形排列）
    const positions = PLANETS.map((planet, i) => {
      const percent = i / (PLANETS.length - 1);
      const x = 10 + percent * 80; // 10% - 90%
      const y = 50 + Math.sin(percent * Math.PI) * 35; // 弧线
      return { ...planet, x, y };
    });

    const currentPos = positions[currentIndex];

    // 连线路径
    let pathLines = '';
    for (let i = 0; i < positions.length - 1; i++) {
      const p1 = positions[i];
      const p2 = positions[i + 1];
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const length = Math.sqrt(dx * dx + dy * dy);
      const angle = Math.atan2(dy, dx) * 180 / Math.PI;
      const active = i < currentIndex;
      pathLines += `<div class="path-line ${active ? 'active' : ''}" style="left:${p1.x}%;top:${p1.y}%;width:${length}%;transform:rotate(${angle}deg);"></div>`;
    }

    const progressToNext = nextPlanet
      ? Math.round(((config.starEnergy - currentPlanet.energyNeeded) / (nextPlanet.energyNeeded - currentPlanet.energyNeeded)) * 100)
      : 100;

    const html = `
      <div class="page-title">星图</div>
      <div class="page-subtitle">你的星际航行轨迹</div>

      <div class="journey-info">
        <div class="journey-current">
          <div class="planet-big">${currentPlanet.icon}</div>
          <div class="info">
            <h3>${currentPlanet.name}</h3>
            <p>${currentPlanet.desc}</p>
          </div>
        </div>
        <div class="journey-next">
          <div class="next-label">下一站</div>
          <div class="next-planet">${nextPlanet ? nextPlanet.icon + ' ' + nextPlanet.name : '🏆 银河中心'}</div>
          <div class="energy-needed">${nextPlanet ? `还需 ${nextPlanet.energyNeeded - config.starEnergy} ⚡` : '已抵达终点！'}</div>
        </div>
      </div>

      <div class="star-map" id="star-map">
        ${pathLines}
        ${positions.map((p, i) => {
          let cls = 'planet ';
          if (i < currentIndex) cls += 'unlocked';
          else if (i === currentIndex) cls += 'current unlocked';
          else cls += 'locked';
          return `
            <div class="${cls}" style="left:${p.x}%;top:${p.y}%;" onclick="UserView.showPlanet('${p.id}')">
              <div class="planet-icon">${p.icon}</div>
              <div class="planet-name">${i <= currentIndex ? p.name : '???'}</div>
            </div>`;
        }).join('')}
        <div class="spaceship" id="spaceship" style="left:${currentPos.x}%;top:${currentPos.y - 8}%;">🚀</div>
      </div>

      <div class="card">
        <div class="card-title">航行进度</div>
        ${nextPlanet ? `
          <div style="display:flex;justify-content:space-between;margin-bottom:8px;font-size:13px;">
            <span>${currentPlanet.name}</span>
            <span style="color:var(--star-gold);">${config.starEnergy} / ${nextPlanet.energyNeeded} ⚡ (${progressToNext}%)</span>
            <span>${nextPlanet.name}</span>
          </div>
          ${Charts.progressBar(config.starEnergy, nextPlanet.energyNeeded)}
        ` : `<p style="text-align:center;color:var(--star-gold);">🎉 恭喜你抵达了银河中心！</p>`}
      </div>

      <div class="stats-grid">
        <div class="stat-card"><div class="stat-icon">⚡</div><div class="stat-value gold">${config.starEnergy}</div><div class="stat-label">总星能</div></div>
        <div class="stat-card"><div class="stat-icon">🚀</div><div class="stat-value">Lv.${config.shipLevel}</div><div class="stat-label">飞船等级</div></div>
        <div class="stat-card"><div class="stat-icon">✅</div><div class="stat-value">${config.totalTasksCompleted}</div><div class="stat-label">完成任务</div></div>
        <div class="stat-card"><div class="stat-icon">🌍</div><div class="stat-value">${currentIndex + 1}</div><div class="stat-label">已探索星球</div></div>
      </div>`;

    document.getElementById('user-main').innerHTML = html;
  },

  showPlanet(planetId) {
    const planet = PLANETS.find(p => p.id === planetId);
    if (!planet) return;

    const typeMap = { station: '起点站', planet: '任务星球', supply: '补给站', final: '最终目的地' };

    const body = `
      <div style="text-align:center;margin-bottom:20px;">
        <div style="font-size:64px;margin-bottom:8px;">${planet.icon}</div>
        <h3 style="font-size:22px;margin-bottom:4px;">${planet.name}</h3>
        <p style="color:var(--text-secondary);font-size:13px;">${typeMap[planet.type] || '星球'}</p>
      </div>
      <p style="text-align:center;color:var(--text-secondary);">${planet.desc}</p>
      <p style="text-align:center;margin-top:12px;font-size:13px;color:var(--star-gold);">
        需要 ${planet.energyNeeded} ⚡ 星能解锁
      </p>`;

    UI.modal(planet.name, body, `<button class="btn btn-primary" onclick="UI.closeModal()">关闭</button>`);
  },

  // ===== 任务板 =====
  async renderTasks() {
    const tasks = await DB.getTasks();
    const config = await DB.getConfig();

    const available = tasks.filter(t => t.status === 'available');
    const inProgress = tasks.filter(t => t.status === 'in_progress' && t.claimedBy === config.userName);
    const pending = tasks.filter(t => t.status === 'pending_review' && t.claimedBy === config.userName);
    const completed = tasks.filter(t => t.status === 'completed' && t.claimedBy === config.userName);

    const html = `
      <div class="page-title">任务板</div>
      <div class="page-subtitle">选择任务，收集星能，飞向更远的星空</div>

      <div class="stats-grid">
        <div class="stat-card"><div class="stat-icon">✨</div><div class="stat-value">${available.length}</div><div class="stat-label">可领取</div></div>
        <div class="stat-card"><div class="stat-icon">🚀</div><div class="stat-value">${inProgress.length}</div><div class="stat-label">进行中</div></div>
        <div class="stat-card"><div class="stat-icon">📝</div><div class="stat-value">${pending.length}</div><div class="stat-label">审核中</div></div>
        <div class="stat-card"><div class="stat-icon">⚡</div><div class="stat-value gold">${config.starEnergy}</div><div class="stat-label">我的星能</div></div>
      </div>

      <div class="filter-bar">
        <select id="user-status-filter" onchange="UserView.filterTasks()">
          <option value="available">可领取</option>
          <option value="in_progress">进行中</option>
          <option value="pending_review">审核中</option>
          <option value="completed">已完成</option>
        </select>
        <select onchange="UserView.filterCategory(this.value)">
          <option value="all">全部分类</option>
          ${CATEGORIES.map(c => `<option value="${c}">${c}</option>`).join('')}
        </select>
      </div>

      <div id="user-task-list">
        ${available.length === 0 ? '<div class="empty-state"><div class="emoji">🌌</div><p>暂无可用任务</p></div>' :
          available.map(t => this._taskCardAvailable(t)).join('')}
      </div>

      <div style="margin-top:24px;text-align:center;">
        <button class="btn btn-outline" onclick="SelfReport.openSubmit()">+ 自主申报事件</button>
      </div>`;

    document.getElementById('user-main').innerHTML = html;
  },

  _taskCardAvailable(task) {
    return `
      <div class="task-card star-${task.starLevel}">
        <div class="task-card-header">
          <div class="task-card-title">${task.title}</div>
          ${UI.statusTag('available')}
        </div>
        <div class="task-card-desc">${task.description}</div>
        <div class="task-meta">
          ${UI.categoryTag(task.category)}
          ${UI.starTag(task.starLevel)}
          ${UI.energyBadge(task.energy)}
        </div>
        <div class="task-actions">
          <button class="btn btn-primary btn-sm" onclick="Task.claim(${task.id})">领取任务</button>
        </div>
      </div>`;
  },

  _taskCardInProgress(task) {
    return `
      <div class="task-card star-${task.starLevel}">
        <div class="task-card-header">
          <div class="task-card-title">${task.title}</div>
          ${UI.statusTag('in_progress')}
        </div>
        <div class="task-card-desc">${task.description}</div>
        <div class="task-meta">
          ${UI.categoryTag(task.category)}
          ${UI.starTag(task.starLevel)}
          ${UI.energyBadge(task.energy)}
        </div>
        ${task.reviewNote ? `<div style="background:rgba(244,114,182,0.1);padding:10px;border-radius:8px;margin-bottom:12px;font-size:13px;color:var(--accent-light);">💬 指挥官反馈：${task.reviewNote}</div>` : ''}
        <div class="task-actions">
          <button class="btn btn-primary btn-sm" onclick="Task.submit(${task.id})">提交完成</button>
          <button class="btn btn-outline btn-sm" onclick="Task.abandon(${task.id})">放弃</button>
        </div>
      </div>`;
  },

  _taskCardPending(task) {
    return `
      <div class="task-card star-${task.starLevel}">
        <div class="task-card-header">
          <div class="task-card-title">${task.title}</div>
          ${UI.statusTag('pending_review')}
        </div>
        <div class="task-card-desc">${task.description}</div>
        <div class="task-meta">
          ${UI.categoryTag(task.category)}
          ${UI.starTag(task.starLevel)}
          ${UI.energyBadge(task.energy)}
        </div>
        <div style="background:rgba(15,10,31,0.5);padding:10px;border-radius:8px;margin-bottom:12px;">
          <div style="font-size:12px;color:var(--text-secondary);margin-bottom:2px;">你提交的内容：</div>
          <div style="font-size:13px;">${task.submittedNote || '-'}</div>
        </div>
        <p style="font-size:13px;color:var(--text-secondary);">等待指挥官审核中...</p>
      </div>`;
  },

  _taskCardCompleted(task) {
    return `
      <div class="task-card star-${task.starLevel}" style="opacity:0.8;">
        <div class="task-card-header">
          <div class="task-card-title">${task.title}</div>
          ${UI.statusTag('completed')}
        </div>
        <div class="task-card-desc">${task.description}</div>
        <div class="task-meta">
          ${UI.categoryTag(task.category)}
          ${UI.starTag(task.starLevel)}
          ${UI.energyBadge(task.energy)}
        </div>
        ${task.reviewNote ? `<div style="background:rgba(52,211,153,0.1);padding:10px;border-radius:8px;margin-top:8px;font-size:13px;color:#34d399;">💬 ${task.reviewNote}</div>` : ''}
      </div>`;
  },

  async filterTasks() {
    const status = document.getElementById('user-status-filter').value;
    const tasks = await DB.getTasks();
    const config = await DB.getConfig();
    let filtered = [];

    switch (status) {
      case 'available':
        filtered = tasks.filter(t => t.status === 'available');
        break;
      case 'in_progress':
        filtered = tasks.filter(t => t.status === 'in_progress' && t.claimedBy === config.userName);
        break;
      case 'pending_review':
        filtered = tasks.filter(t => t.status === 'pending_review' && t.claimedBy === config.userName);
        break;
      case 'completed':
        filtered = tasks.filter(t => t.status === 'completed' && t.claimedBy === config.userName);
        break;
    }

    const list = document.getElementById('user-task-list');
    if (filtered.length === 0) {
      list.innerHTML = '<div class="empty-state"><div class="emoji">🌌</div><p>这里还没有任务</p></div>';
      return;
    }

    let renderer;
    switch (status) {
      case 'available': renderer = t => this._taskCardAvailable(t); break;
      case 'in_progress': renderer = t => this._taskCardInProgress(t); break;
      case 'pending_review': renderer = t => this._taskCardPending(t); break;
      case 'completed': renderer = t => this._taskCardCompleted(t); break;
    }
    list.innerHTML = filtered.map(renderer).join('');
  },

  filterCategory(category) {
    const cards = document.querySelectorAll('#user-task-list .task-card');
    cards.forEach(card => {
      const tag = card.querySelector('.tag-category');
      if (category === 'all' || tag?.textContent === category) {
        card.style.display = '';
      } else {
        card.style.display = 'none';
      }
    });
  },

  // ===== 我的飞船 =====
  async renderGrowth() {
    const tasks = await DB.getTasks();
    const config = await DB.getConfig();
    const completed = tasks.filter(t => t.status === 'completed' && t.claimedBy === config.userName);
    const currentPlanet = PLANETS.find(p => p.id === config.currentPlanet) || PLANETS[0];
    const nextPlanet = PLANETS.find(p => p.energyNeeded > config.starEnergy);

    const catScores = CATEGORIES.map(cat => {
      const catTasks = tasks.filter(t => t.category === cat);
      const catDone = completed.filter(t => t.category === cat);
      if (catTasks.length === 0) return 0;
      const total = catTasks.reduce((s, t) => s + t.energy, 0);
      const done = catDone.reduce((s, t) => s + t.energy, 0);
      return Math.round((done / total) * 100);
    });

    const shipSkin = config.shipSkin === 'skin_gold' ? '✨ 金色涂装' : '🚀 标准涂装';

    const html = `
      <div class="page-title">我的飞船</div>
      <div class="page-subtitle">飞船状态与成长数据</div>

      <div class="card" style="text-align:center;">
        <div style="font-size:72px;margin-bottom:8px;filter:drop-shadow(0 0 16px rgba(251,191,36,0.5));">🚀</div>
        <h3 style="font-size:20px;margin-bottom:4px;">${config.userName || '舰长'} 的飞船</h3>
        <p style="color:var(--text-secondary);font-size:14px;">Lv.${config.shipLevel} · ${shipSkin}</p>
      </div>

      <div class="ship-status" style="margin-bottom:16px;">
        <div class="ship-stat"><div class="label">引擎</div><div class="value">${config.engineBuff ? '⚡ 强化' : '标准'}</div></div>
        <div class="ship-stat"><div class="label">雷达</div><div class="value">${config.radarBuff ? '📡 高级' : '基础'}</div></div>
        <div class="ship-stat"><div class="label">涂装</div><div class="value">${config.shipSkin === 'skin_gold' ? '✨ 金色' : '标准'}</div></div>
      </div>

      <div class="stats-grid">
        <div class="stat-card"><div class="stat-icon">⚡</div><div class="stat-value gold">${config.starEnergy}</div><div class="stat-label">总星能</div></div>
        <div class="stat-card"><div class="stat-icon">🏆</div><div class="stat-value">${config.totalTasksCompleted}</div><div class="stat-label">累计任务</div></div>
        <div class="stat-card"><div class="stat-icon">🌍</div><div class="stat-value">${currentPlanet.icon}</div><div class="stat-label">${currentPlanet.name}</div></div>
        <div class="stat-card"><div class="stat-icon">📅</div><div class="stat-value">${config.monthlyTasks}</div><div class="stat-label">本月任务</div></div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
        <div class="chart-wrap">
          <div class="chart-title">能力雷达图</div>
          <div class="chart-container">${Charts.radar(CATEGORIES, catScores)}</div>
        </div>
        <div class="chart-wrap">
          <div class="chart-title">下一站进度</div>
          <div class="chart-container">
            ${nextPlanet ? Charts.donut(config.starEnergy - currentPlanet.energyNeeded, nextPlanet.energyNeeded - currentPlanet.energyNeeded, 180, '#fbbf24') : Charts.donut(100, 100, 180, '#f472b6')}
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-title">最近完成</div>
        ${completed.length === 0 ? '<p style="color:var(--text-secondary);text-align:center;padding:20px;">还没有完成的任务</p>' :
          completed.slice(0, 5).map(t => `
            <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--border);">
              <div>
                <div style="font-size:14px;font-weight:500;">${t.title}</div>
                <div style="font-size:12px;color:var(--text-secondary);">${UI.formatDate(t.reviewedAt)}</div>
              </div>
              ${UI.energyBadge(t.energy)}
            </div>
          `).join('')}
      </div>`;

    document.getElementById('user-main').innerHTML = html;
  },

  // ===== 补给站 =====
  async renderRewards() {
    const config = await DB.getConfig();
    const rewards = await DB.getRewards();
    const myRewards = rewards.filter(r => r.grantedBy !== '补给站兑换' || true); // 全部展示

    // 按补给站类型分组可兑换物品
    const cashItems = SUPPLY_ITEMS.filter(i => typeof i.value === 'number');
    const buffItems = SUPPLY_ITEMS.filter(i => i.value === 'buff');
    const skinItems = SUPPLY_ITEMS.filter(i => i.value === 'skin');

    const renderItem = (item) => {
      const canAfford = config.starEnergy >= item.cost;
      const owned = (item.id === 'buff_engine' && config.engineBuff) ||
                    (item.id === 'buff_radar' && config.radarBuff) ||
                    (item.id === 'skin_gold' && config.shipSkin === 'skin_gold');
      return `
        <div class="supply-card">
          <div class="supply-emoji">${item.emoji}</div>
          <div class="supply-info">
            <div class="supply-name">${item.name}</div>
            <div class="supply-desc">${item.desc}</div>
          </div>
          <div style="text-align:right;">
            <div class="supply-cost">⚡ ${item.cost}</div>
            ${owned ? '<button class="btn btn-sm btn-outline" style="margin-top:8px;" disabled>已拥有</button>' :
              `<button class="btn btn-sm ${canAfford ? 'btn-gold' : 'btn-outline'}" style="margin-top:8px;" ${canAfford ? '' : 'disabled'} onclick="SupplyStation.redeem('${item.id}')">兑换</button>`}
          </div>
        </div>`;
    };

    const html = `
      <div class="page-title">补给站</div>
      <div class="page-subtitle">用星能兑换奖励和升级</div>

      <div class="card" style="text-align:center;">
        <div style="font-size:14px;color:var(--text-secondary);margin-bottom:4px;">我的星能</div>
        <div style="font-size:36px;font-weight:700;color:var(--star-gold);">⚡ ${config.starEnergy}</div>
      </div>

      <div class="section-title" style="margin:24px 0 12px;font-size:16px;">🧧 现金奖励</div>
      ${cashItems.map(renderItem).join('')}

      <div class="section-title" style="margin:24px 0 12px;font-size:16px;">⚙️ 飞船升级</div>
      ${buffItems.map(renderItem).join('')}

      <div class="section-title" style="margin:24px 0 12px;font-size:16px;">🎨 外观涂装</div>
      ${skinItems.map(renderItem).join('')}

      <div class="section-title" style="margin:24px 0 12px;font-size:16px;">📋 兑换记录</div>
      ${myRewards.length === 0 ? '<div class="empty-state"><div class="emoji">🎁</div><p>还没有兑换记录</p></div>' :
        myRewards.slice(0, 10).map(r => `
          <div class="supply-card">
            <div class="supply-emoji">🎁</div>
            <div class="supply-info">
              <div class="supply-name">${r.name}</div>
              <div class="supply-desc">${r.note || r.grantedBy} · ${UI.formatDate(r.createdAt)}</div>
            </div>
            <div style="text-align:right;">
              ${r.energyCost ? `<div class="supply-cost">-${r.energyCost} ⚡</div>` : r.amount ? `<div style="font-weight:700;color:var(--accent);">¥${r.amount}</div>` : ''}
              <div style="font-size:12px;margin-top:4px;">${r.redeemed ? '<span class="tag tag-status-done">已领取</span>' : '<span class="tag tag-status-progress">待发放</span>'}</div>
            </div>
          </div>
        `).join('')}`;

    document.getElementById('user-main').innerHTML = html;
  },
};

/* ==========================================================================
   Init
   ========================================================================== */
document.addEventListener('DOMContentLoaded', () => {
  DB.init();
});
