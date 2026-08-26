/* ==========================================================================
   成长伙伴 · 社交成长任务系统 — 应用逻辑（Supabase 云端版）
   模块: DB(数据层) | Auth(认证) | Router(路由) | Task(任务)
         | SelfReport(自主申报) | Reward(奖励) | Dashboard(看板)
         | Report(报告) | UI(辅助) | Charts(图表)
   ========================================================================== */

const CATEGORIES = ['校园人际', '家庭情感', '自我突破'];
const LEVELS = ['基础礼仪项', '进阶挑战项', '突破挑战项'];
const LEVEL_CLASS = { '基础礼仪项': 'basic', '进阶挑战项': 'advanced', '突破挑战项': 'breakthrough' };
const DIFFICULTIES = ['极低', '低', '中等', '较高', '高'];
const STATUS_MAP = {
  available: { label: '待领取', cls: 'available' },
  in_progress: { label: '进行中', cls: 'progress' },
  pending_review: { label: '待审核', cls: 'review' },
  completed: { label: '已完成', cls: 'done' },
  abandoned: { label: '已放弃', cls: 'abandoned' },
};
const REWARD_TYPES = [
  { value: 'monthly', label: '月度小红包', emoji: '🧧' },
  { value: 'semester', label: '学期成长基金', emoji: '💰' },
  { value: 'annual', label: '年度突破奖励', emoji: '🏆' },
  { value: 'custom', label: '自定义奖励', emoji: '🎁' },
];
const GROWTH_LEVELS = [
  { min: 0, name: '萌芽', emoji: '🌱', nextMin: 30 },
  { min: 30, name: '新芽', emoji: '🌿', nextMin: 80 },
  { min: 80, name: '小树', emoji: '🌳', nextMin: 160 },
  { min: 160, name: '枝繁', emoji: '🌴', nextMin: 300 },
  { min: 300, name: '茁壮', emoji: '🌲', nextMin: 500 },
  { min: 500, name: '参天', emoji: '🎄', nextMin: null },
];

/* ==================== Supabase 数据层 ==================== */
const DB = {
  supabase: null,
  init() {
    this.supabase = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_KEY);
  },

  // --- 任务 ---
  async getTasks() {
    const { data, error } = await this.supabase
      .from('tasks')
      .select('*')
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data.map(t => this._mapTask(t));
  },

  async createTask(task) {
    const payload = this._unmapTask(task);
    const { data, error } = await this.supabase
      .from('tasks')
      .insert(payload)
      .select()
      .single();
    if (error) throw error;
    return this._mapTask(data);
  },

  async updateTask(id, updates) {
    const payload = this._unmapTask(updates);
    const { data, error } = await this.supabase
      .from('tasks')
      .update(payload)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return this._mapTask(data);
  },

  async deleteTask(id) {
    const { error } = await this.supabase.from('tasks').delete().eq('id', id);
    if (error) throw error;
  },

  // 字段映射：snake_case ↔ camelCase
  _mapTask(t) {
    return {
      id: t.id,
      title: t.title,
      description: t.description || '',
      category: t.category,
      level: t.level,
      difficulty: t.difficulty,
      growthValue: t.growth_value,
      recommendedPeriod: t.recommended_period || '',
      status: t.status,
      claimedBy: t.claimed_by,
      submittedDesc: t.submitted_desc,
      reviewNote: t.review_note,
      claimedAt: t.claimed_at,
      submittedAt: t.submitted_at,
      completedAt: t.completed_at,
      abandonedAt: t.abandoned_at,
      createdAt: t.created_at,
    };
  },
  _unmapTask(t) {
    const out = {};
    if (t.title !== undefined) out.title = t.title;
    if (t.description !== undefined) out.description = t.description;
    if (t.category !== undefined) out.category = t.category;
    if (t.level !== undefined) out.level = t.level;
    if (t.difficulty !== undefined) out.difficulty = t.difficulty;
    if (t.growthValue !== undefined) out.growth_value = t.growthValue;
    if (t.recommendedPeriod !== undefined) out.recommended_period = t.recommendedPeriod;
    if (t.status !== undefined) out.status = t.status;
    if (t.claimedBy !== undefined) out.claimed_by = t.claimedBy;
    if (t.submittedDesc !== undefined) out.submitted_desc = t.submittedDesc;
    if (t.reviewNote !== undefined) out.review_note = t.reviewNote;
    if (t.claimedAt !== undefined) out.claimed_at = t.claimedAt;
    if (t.submittedAt !== undefined) out.submitted_at = t.submittedAt;
    if (t.completedAt !== undefined) out.completed_at = t.completedAt;
    if (t.abandonedAt !== undefined) out.abandoned_at = t.abandonedAt;
    return out;
  },

  // --- 自主申报 ---
  async getSelfReports() {
    const { data, error } = await this.supabase
      .from('self_reports')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data.map(s => this._mapReport(s));
  },
  async createSelfReport(r) {
    const { data, error } = await this.supabase
      .from('self_reports')
      .insert({ title: r.title, description: r.description })
      .select()
      .single();
    if (error) throw error;
    return this._mapReport(data);
  },
  async updateSelfReport(id, updates) {
    const payload = {};
    if (updates.status !== undefined) payload.status = updates.status;
    if (updates.reviewNote !== undefined) payload.review_note = updates.reviewNote;
    if (updates.rewardAmount !== undefined) payload.reward_amount = updates.rewardAmount;
    if (updates.reviewedBy !== undefined) payload.reviewed_by = updates.reviewedBy;
    if (updates.reviewedAt !== undefined) payload.reviewed_at = updates.reviewedAt;
    const { data, error } = await this.supabase
      .from('self_reports')
      .update(payload)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return this._mapReport(data);
  },
  _mapReport(s) {
    return {
      id: s.id,
      userId: s.user_id,
      title: s.title,
      description: s.description || '',
      status: s.status,
      reviewNote: s.review_note,
      rewardAmount: s.reward_amount || 0,
      reviewedBy: s.reviewed_by,
      reviewedAt: s.reviewed_at,
      createdAt: s.created_at,
    };
  },

  // --- 奖励 ---
  async getRewards() {
    const { data, error } = await this.supabase
      .from('rewards')
      .select('*')
      .order('issued_at', { ascending: false });
    if (error) throw error;
    return data.map(r => this._mapReward(r));
  },
  async createReward(r) {
    const payload = {
      user_id: r.userId || 'user',
      amount: r.amount,
      type: r.type,
      note: r.note || null,
      issued_by: r.issuedBy || 'admin',
      related_task_id: r.relatedTaskId || null,
    };
    const { data, error } = await this.supabase
      .from('rewards')
      .insert(payload)
      .select()
      .single();
    if (error) throw error;
    return this._mapReward(data);
  },
  _mapReward(r) {
    return {
      id: r.id,
      userId: r.user_id,
      amount: r.amount,
      type: r.type,
      note: r.note,
      issuedBy: r.issued_by,
      relatedTaskId: r.related_task_id,
      issuedAt: r.issued_at,
    };
  },

  // --- 系统配置 ---
  async getConfig(key) {
    const { data, error } = await this.supabase
      .from('app_config')
      .select('value')
      .eq('id', key)
      .single();
    if (error) return null;
    return data.value;
  },
  async setConfig(key, value) {
    const { error } = await this.supabase
      .from('app_config')
      .upsert({ id: key, value, updated_at: new Date().toISOString() });
    if (error) throw error;
  },
};

/* ==================== 认证 ==================== */
const Auth = {
  selectedRole: 'user',
  selectRole(role) {
    this.selectedRole = role;
    document.querySelectorAll('.role-card').forEach(c => c.classList.toggle('active', c.dataset.role === role));
    const pw = document.getElementById('login-password');
    pw.placeholder = role === 'admin' ? '请输入管理员密码' : '请输入密码';
    pw.value = '';
  },
  async doLogin() {
    const pw = document.getElementById('login-password').value.trim();
    const role = this.selectedRole;
    // 简单密码校验（两个人用，足够）
    const passwords = { admin: 'admin', user: 'user' };
    if (passwords[role] !== pw) { UI.toast('密码错误，请重试', 'error'); return; }
    const profile = await DB.getConfig(role === 'admin' ? 'admin_profile' : 'user_profile');
    sessionStorage.setItem('gp_role', role);
    sessionStorage.setItem('gp_user', JSON.stringify({ ...profile, role }));
    if (role === 'admin') Router.showAdmin(); else Router.showUser();
  },
  current() { return JSON.parse(sessionStorage.getItem('gp_user') || 'null'); },
  logout() {
    sessionStorage.removeItem('gp_role');
    sessionStorage.removeItem('gp_user');
    Router.showLogin();
  },
};

/* ==================== 路由 ==================== */
const Router = {
  adminTabName: 'tasks',
  userTabName: 'tasks',
  showLogin() {
    document.getElementById('login-screen').style.display = 'flex';
    document.getElementById('admin-dashboard').style.display = 'none';
    document.getElementById('user-dashboard').style.display = 'none';
  },
  showAdmin() {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('admin-dashboard').style.display = 'flex';
    document.getElementById('user-dashboard').style.display = 'none';
    const u = Auth.current();
    document.getElementById('admin-name').textContent = u ? u.name : '管理员';
    this.adminTab(this.adminTabName);
  },
  showUser() {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('admin-dashboard').style.display = 'none';
    document.getElementById('user-dashboard').style.display = 'flex';
    const u = Auth.current();
    document.getElementById('user-name').textContent = u ? u.name : '用户';
    this.userTab(this.userTabName);
  },
  async adminTab(tab) {
    this.adminTabName = tab;
    document.querySelectorAll('#admin-nav .nav-item').forEach(n => n.classList.toggle('active', n.dataset.tab === tab));
    const main = document.getElementById('admin-main');
    main.innerHTML = '<div class="empty-state"><div class="emoji">⏳</div><p>加载中...</p></div>';
    try {
      if (tab === 'tasks') main.innerHTML = await AdminView.tasks();
      else if (tab === 'review') main.innerHTML = await AdminView.review();
      else if (tab === 'rewards') main.innerHTML = await AdminView.rewards();
      else if (tab === 'dashboard') main.innerHTML = await AdminView.dashboard();
      else if (tab === 'reports') main.innerHTML = AdminView.reports();
    } catch (e) {
      console.error(e);
      main.innerHTML = `<div class="empty-state"><div class="emoji">⚠️</div><p>加载失败：${e.message || e}</p></div>`;
    }
  },
  async userTab(tab) {
    this.userTabName = tab;
    document.querySelectorAll('#user-nav .nav-item').forEach(n => n.classList.toggle('active', n.dataset.tab === tab));
    const main = document.getElementById('user-main');
    main.innerHTML = '<div class="empty-state"><div class="emoji">⏳</div><p>加载中...</p></div>';
    try {
      if (tab === 'tasks') main.innerHTML = await UserView.tasks();
      else if (tab === 'growth') main.innerHTML = await UserView.growth();
      else if (tab === 'rewards') main.innerHTML = await UserView.rewards();
    } catch (e) {
      console.error(e);
      main.innerHTML = `<div class="empty-state"><div class="emoji">⚠️</div><p>加载失败：${e.message || e}</p></div>`;
    }
  },
};

/* ==================== UI 辅助 ==================== */
const UI = {
  modal(title, bodyHtml, footerHtml) {
    const c = document.getElementById('modal-container');
    c.innerHTML = `<div class="modal-overlay" onclick="if(event.target===this)UI.closeModal()"><div class="modal"><div class="modal-header"><span class="modal-title">${title}</span><button class="modal-close" onclick="UI.closeModal()">&times;</button></div>${bodyHtml}${footerHtml ? `<div class="modal-footer">${footerHtml}</div>` : ''}</div></div>`;
  },
  closeModal() { document.getElementById('modal-container').innerHTML = ''; },
  toast(msg, type = 'success') {
    const c = document.getElementById('toast-container');
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.textContent = msg;
    c.appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translateY(20px)'; setTimeout(() => t.remove(), 300); }, 2600);
  },
  confirm(msg, onYes, yesText = '确认') {
    this.modal('请确认', `<p style="font-size:14px;line-height:1.8;">${msg}</p>`,
      `<button class="btn btn-outline" onclick="UI.closeModal()">取消</button><button class="btn btn-primary" onclick="(${onYes})();UI.closeModal()">${yesText}</button>`);
  },
  empty(emoji, text) { return `<div class="empty-state"><div class="emoji">${emoji}</div><p>${text}</p></div>`; },
  tag(label, cls) { return `<span class="tag tag-${cls}">${label}</span>`; },
  levelTag(level) { return this.tag(level, 'level-' + (LEVEL_CLASS[level] || 'basic')); },
  statusTag(status) { const s = STATUS_MAP[status] || { label: status, cls: 'done' }; return this.tag(s.label, 'status-' + s.cls); },
  fmtDate(iso) { if (!iso) return '-'; const d = new Date(iso); return `${d.getMonth() + 1}月${d.getDate()}日`; },
  fmtDateFull(iso) { if (!iso) return '-'; const d = new Date(iso); return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`; },
};

/* ==================== 图表 ==================== */
const Charts = {
  radar(data, labels) {
    const cx = 100, cy = 100, r = 65;
    const n = labels.length, step = (Math.PI * 2) / n;
    let grid = '', axes = '', lables = '', dataPts = '';
    for (let lv = 1; lv <= 4; lv++) {
      const lr = (r / 4) * lv; let pts = '';
      for (let i = 0; i < n; i++) { const a = -Math.PI / 2 + i * step; pts += `${cx + lr * Math.cos(a)},${cy + lr * Math.sin(a)} `; }
      grid += `<polygon points="${pts}" fill="none" stroke="#e2ead9" stroke-width="1"/>`;
    }
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + i * step;
      axes += `<line x1="${cx}" y1="${cy}" x2="${cx + r * Math.cos(a)}" y2="${cy + r * Math.sin(a)}" stroke="#e2ead9" stroke-width="1"/>`;
      const lx = cx + (r + 16) * Math.cos(a), ly = cy + (r + 16) * Math.sin(a) + 4;
      lables += `<text x="${lx}" y="${ly}" text-anchor="middle" font-size="10" fill="#6b7d6e">${labels[i]}</text>`;
    }
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + i * step; const v = data[i] || 0;
      dataPts += `${cx + r * v * Math.cos(a)},${cy + r * v * Math.sin(a)} `;
    }
    return `<svg viewBox="0 0 200 200" width="200" height="200">${grid}${axes}<polygon points="${dataPts}" fill="rgba(91,179,112,0.2)" stroke="#5bb370" stroke-width="2"/>${lables}</svg>`;
  },
  donut(segments) {
    const cx = 80, cy = 80, r = 55, sw = 18;
    const total = segments.reduce((s, x) => s + x.value, 0) || 1;
    const circ = 2 * Math.PI * r; let off = 0, arcs = '', legend = '', yo = 0;
    const colors = ['#5bb370', '#ff9a76', '#a78bfa', '#60a5fa', '#f9a825'];
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i]; const len = (seg.value / total) * circ; const col = seg.color || colors[i % colors.length];
      arcs += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${col}" stroke-width="${sw}" stroke-dasharray="${len} ${circ - len}" stroke-dashoffset="${-off}" transform="rotate(-90 ${cx} ${cy})"/>`;
      off += len;
      legend += `<rect x="170" y="${yo}" width="10" height="10" fill="${col}" rx="2"/><text x="186" y="${yo + 9}" font-size="11" fill="#6b7d6e">${seg.label} (${seg.value})</text>`;
      yo += 20;
    }
    const center = `<text x="${cx}" y="${cy - 2}" text-anchor="middle" font-size="20" font-weight="700" fill="#3d9c54">${total}</text><text x="${cx}" y="${cy + 14}" text-anchor="middle" font-size="10" fill="#9caf9f">总计</text>`;
    return `<svg viewBox="0 0 310 200" width="310" height="200">${arcs}${center}${legend}</svg>`;
  },
  bar(data, labels) {
    const w = 300, h = 160, pad = 28, ch = h - pad * 2;
    const bw = (w - pad * 2) / data.length * 0.55, gap = (w - pad * 2) / data.length * 0.45;
    const max = Math.max(...data, 1);
    let bars = '';
    for (let i = 0; i < data.length; i++) {
      const x = pad + i * (bw + gap) + gap / 2, bh = (data[i] / max) * ch, y = pad + ch - bh;
      bars += `<rect x="${x}" y="${y}" width="${bw}" height="${bh}" fill="#5bb370" rx="4"/>`;
      if (data[i] > 0) bars += `<text x="${x + bw / 2}" y="${y - 5}" text-anchor="middle" font-size="11" fill="#3d9c54">${data[i]}</text>`;
      bars += `<text x="${x + bw / 2}" y="${h - pad + 16}" text-anchor="middle" font-size="10" fill="#9caf9f">${labels[i]}</text>`;
    }
    return `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><line x1="${pad}" y1="${pad + ch}" x2="${w - pad}" y2="${pad + ch}" stroke="#e2ead9" stroke-width="1"/>${bars}</svg>`;
  },
  progressBar(pct, label) {
    return `<div style="margin-bottom:12px"><div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px"><span>${label}</span><span style="color:var(--primary-dark);font-weight:600">${Math.round(pct)}%</span></div><div class="progress-bar-wrap"><div class="progress-bar" style="width:${pct}%"></div></div></div>`;
  },
};

/* ==================== 数据计算辅助 ==================== */
function getGrowthPoints(tasks) {
  return tasks.filter(t => t.status === 'completed').reduce((s, t) => s + (t.growthValue || 0), 0);
}
function getGrowthLevel(points) {
  let lv = GROWTH_LEVELS[0];
  for (const l of GROWTH_LEVELS) { if (points >= l.min) lv = l; }
  return lv;
}
function getCompletedThisMonth(tasks) {
  const now = new Date();
  return tasks.filter(t => t.status === 'completed' && t.completedAt && new Date(t.completedAt).getMonth() === now.getMonth() && new Date(t.completedAt).getFullYear() === now.getFullYear());
}
function getGrowthDays(tasks) {
  const days = new Set();
  tasks.filter(t => t.status === 'completed' && t.completedAt).forEach(t => days.add(new Date(t.completedAt).toDateString()));
  return days.size;
}
function getCategoryDist(tasks) {
  const dist = {}; CATEGORIES.forEach(c => dist[c] = 0);
  tasks.filter(t => t.status === 'completed').forEach(t => { if (dist[t.category] !== undefined) dist[t.category] += t.growthValue; });
  return dist;
}
function getLevelDist(tasks) {
  const dist = {}; LEVELS.forEach(l => dist[l] = 0);
  tasks.filter(t => t.status === 'completed').forEach(t => { if (dist[t.level] !== undefined) dist[t.level]++; });
  return dist;
}
function getMonthlyTrend(tasks) {
  const now = new Date(); const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const count = tasks.filter(t => t.status === 'completed' && t.completedAt && new Date(t.completedAt).getMonth() === d.getMonth() && new Date(t.completedAt).getFullYear() === d.getFullYear()).length;
    months.push({ label: (d.getMonth() + 1) + '月', count });
  }
  return months;
}

/* ==================== 管理员视图 ==================== */
const AdminView = {
  async tasks() {
    const tasks = await DB.getTasks();
    let f = { category: '', level: '', status: '' };
    window._adminFilter = f;
    const renderList = (list) => {
      if (!list.length) return UI.empty('📭', '暂无任务，点击上方按钮创建');
      return list.map(t => `\n        <div class="task-card level-${LEVEL_CLASS[t.level] || 'basic'}">\n          <div class="task-card-header">\n            <div>\n              <div class="task-card-title">${t.title}</div>\n              <div class="task-card-desc">${t.description}</div>\n            </div>\n            ${UI.statusTag(t.status)}\n          </div>\n          <div class="task-meta">\n            ${UI.tag(t.category, 'category')}\n            ${UI.levelTag(t.level)}\n            ${UI.tag('难度:' + t.difficulty, 'level-basic')}\n            ${UI.tag('+' + t.growthValue + '成长值', 'category')}\n            ${UI.tag(t.recommendedPeriod, 'category')}\n          </div>\n          ${t.submittedDesc ? `<div style="background:var(--primary-lighter);padding:10px;border-radius:8px;font-size:13px;margin-bottom:8px"><strong>完成说明：</strong>${t.submittedDesc}</div>` : ''}\n          <div class="task-actions">\n            <button class="btn btn-outline btn-sm" onclick=\"Task.openEdit('${t.id}')\">编辑</button>\n            <button class="btn btn-ghost btn-sm\" onclick=\"Task.del('${t.id}')\">删除</button>\n          </div>\n        </div>`).join('');
    };
    return `\n      <div class="section-header">\n        <div><div class="page-title">任务管理</div><div class="page-subtitle">创建、编辑和管理成长任务</div></div>\n        <button class="btn btn-primary" onclick="Task.openCreate()">+ 新建任务</button>\n      </div>\n      <div class="filter-bar">\n        <select id="f-cat" onchange="AdminView._filter()"><option value="">全部分类</option>${CATEGORIES.map(c => `<option value="${c}">${c}</option>`).join('')}</select>\n        <select id="f-lvl" onchange="AdminView._filter()"><option value="">全部级别</option>${LEVELS.map(l => `<option value="${l}">${l}</option>`).join('')}</select>\n        <select id="f-st" onchange="AdminView._filter()"><option value="">全部状态</option>${Object.entries(STATUS_MAP).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join('')}</select>\n      </div>\n      <div id="task-list">${renderList(tasks)}</div>`;
  },
  async _filter() {
    const f = { category: document.getElementById('f-cat').value, level: document.getElementById('f-lvl').value, status: document.getElementById('f-st').value };
    const tasks = await DB.getTasks();
    const list = tasks.filter(t => (!f.category || t.category === f.category) && (!f.level || t.level === f.level) && (!f.status || t.status === f.status));
    const el = document.getElementById('task-list');
    if (!el) return;
    if (!list.length) { el.innerHTML = UI.empty('📭', '没有匹配的任务'); return; }
    el.innerHTML = list.map(t => `\n      <div class="task-card level-${LEVEL_CLASS[t.level] || 'basic'}">\n        <div class="task-card-header"><div><div class="task-card-title">${t.title}</div><div class="task-card-desc">${t.description}</div></div>${UI.statusTag(t.status)}</div>\n        <div class="task-meta">${UI.tag(t.category, 'category')}${UI.levelTag(t.level)}${UI.tag('+'+t.growthValue+'成长值', 'category')}${UI.tag(t.recommendedPeriod, 'category')}</div>\n        ${t.submittedDesc ? `<div style="background:var(--primary-lighter);padding:10px;border-radius:8px;font-size:13px;margin-bottom:8px"><strong>完成说明：</strong>${t.submittedDesc}</div>` : ''}\n        <div class="task-actions"><button class="btn btn-outline btn-sm" onclick="Task.openEdit('${t.id}')">编辑</button><button class="btn btn-ghost btn-sm" onclick="Task.del('${t.id}')">删除</button></div>\n      </div>`).join('');
  },
  async review() {
    const tasks = await DB.getTasks();
    const reports = await DB.getSelfReports();
    const pending = tasks.filter(t => t.status === 'pending_review');
    const srPending = reports.filter(s => s.status === 'pending');
    let html = `<div class="page-title">任务审核</div><div class="page-subtitle">审核妹妹提交的任务完成情况和自主申报</div>`;
    if (!pending.length && !srPending.length) {
      html += UI.empty('✅', '当前没有待审核的内容，一切就绪！');
      return html;
    }
    if (pending.length) {
      html += `<div class="section-title" style="margin-bottom:12px">任务完成审核（${pending.length}）</div>`;
      html += pending.map(t => `\n        <div class="task-card level-${LEVEL_CLASS[t.level] || 'basic'}">\n          <div class="task-card-header"><div class="task-card-title">${t.title}</div>${UI.statusTag(t.status)}</div>\n          <div class="task-card-desc">${t.description}</div>\n          <div class="task-meta">${UI.tag(t.category, 'category')}${UI.levelTag(t.level)}${UI.tag('+'+t.growthValue+'成长值', 'category')}</div>\n          <div style="background:var(--primary-lighter);padding:12px;border-radius:8px;font-size:14px;margin-bottom:12px"><strong>📝 完成说明：</strong><br>${t.submittedDesc || '(未填写说明)'}</div>\n          <div style="font-size:12px;color:var(--text-light);margin-bottom:8px">提交时间：${UI.fmtDateFull(t.submittedAt)}</div>\n          <div class="task-actions">\n            <button class="btn btn-primary btn-sm" onclick="Task.approve('${t.id}')">通过 ✓</button>\n            <button class="btn btn-outline btn-sm" onclick="Task.reject('${t.id}')">退回修改</button>\n          </div>\n        </div>`).join('');
    }
    if (srPending.length) {
      html += `<div class="section-title" style="margin:24px 0 12px">自主申报审核（${srPending.length}）</div>`;
      html += srPending.map(s => `\n        <div class="task-card" style="border-left-color:#a78bfa">\n          <div class="task-card-header"><div class="task-card-title">${s.title}</div>${UI.tag('自主申报', 'status-review')}</div>\n          <div class="task-card-desc">${s.description}</div>\n          <div style="font-size:12px;color:var(--text-light);margin-bottom:8px">申报时间：${UI.fmtDateFull(s.createdAt)}</div>\n          <div class="task-actions">\n            <button class="btn btn-primary btn-sm" onclick="SelfReport.approve('${s.id}')">通过并发放奖励</button>\n            <button class="btn btn-outline btn-sm" onclick="SelfReport.reject('${s.id}')">不通过</button>\n          </div>\n        </div>`).join('');
    }
    return html;
  },
  async rewards() {
    const rewards = await DB.getRewards();
    const total = rewards.reduce((s, r) => s + r.amount, 0);
    return `\n      <div class="section-header"><div><div class="page-title">奖励中心</div><div class="page-subtitle">发放成长奖励，记录每一次鼓励</div></div></div>\n      <div class="card">\n        <div class="card-title">发放奖励</div>\n        <div class="form-group"><label>奖励类型</label><select id="rw-type">${REWARD_TYPES.map(r => `<option value="${r.value}">${r.emoji} ${r.label}</option>`).join('')}</select></div>\n        <div class="form-group"><label>金额（元）</label><input type="number" id="rw-amount" placeholder="请输入金额" min="1"></div>\n        <div class="form-group"><label>备注</label><textarea id="rw-note" placeholder="写一句鼓励的话..."></textarea></div>\n        <button class="btn btn-accent btn-block" onclick="Reward.issue()">🎁 发放奖励</button>\n      </div>\n      <div class="card">\n        <div class="card-title">奖励记录（累计 ¥${total}）</div>\n        ${rewards.length ? rewards.map(r => `\n          <div class="reward-card">\n            <div class="reward-emoji">${REWARD_TYPES.find(t => t.value === r.type)?.emoji || '🎁'}</div>\n            <div class="reward-info"><div class="reward-amount">¥${r.amount}</div><div class="reward-note">${r.note || r.type}</div><div class="reward-date">${UI.fmtDateFull(r.issuedAt)}</div></div>\n          </div>`).join('') : UI.empty('🎁', '还没有发放过奖励')}\n      </div>`;
  },
  async dashboard() {
    const tasks = await DB.getTasks();
    const profile = await DB.getConfig('user_profile');
    const initial = profile?.initialScore || 30;
    const pts = getGrowthPoints(tasks);
    const lv = getGrowthLevel(pts);
    const completed = tasks.filter(t => t.status === 'completed');
    const total = tasks.length;
    const rate = total ? Math.round(completed.length / total * 100) : 0;
    const catDist = getCategoryDist(tasks);
    const maxCat = Math.max(...Object.values(catDist), 1);
    const lvlDist = getLevelDist(tasks);
    const trend = getMonthlyTrend(tasks);
    return `\n      <div class="page-title">成长看板</div><div class="page-subtitle">完整成长数据分析（含基准分对比）</div>\n      <div class="stats-grid">\n        <div class="stat-card"><div class="stat-icon">✅</div><div class="stat-value">${completed.length}</div><div class="stat-label">已完成任务</div></div>\n        <div class="stat-card"><div class="stat-icon">📈</div><div class="stat-value">${getCompletedThisMonth(tasks).length}</div><div class="stat-label">本月完成</div></div>\n        <div class="stat-card"><div class="stat-icon">⭐</div><div class="stat-value">${pts}</div><div class="stat-label">成长积分</div></div>\n        <div class="stat-card"><div class="stat-icon">📊</div><div class="stat-value">${rate}%</div><div class="stat-label">完成率</div></div>\n      </div>\n      <div class="chart-wrap"><div class="chart-title">成长进度（基准分 ${initial} → 当前 ${initial + pts}）</div>${Charts.progressBar(Math.min((pts / 200) * 100, 100), `社交成长值：${initial + pts} 分（初始 ${initial} + 成长 ${pts}）`)}</div>\n      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px" class="chart-grid">\n        <div class="chart-wrap"><div class="chart-title">任务类型分布（成长值）</div><div class="chart-container">${Charts.radar(CATEGORIES.map(c => (catDist[c] || 0) / maxCat), CATEGORIES)}</div></div>\n        <div class="chart-wrap"><div class="chart-title">难度分布</div><div class="chart-container">${Charts.donut(LEVELS.map(l => ({ label: l, value: lvlDist[l] || 0 })))}</div></div>\n      </div>\n      <div class="chart-wrap"><div class="chart-title">近6个月完成趋势</div><div class="chart-container">${Charts.bar(trend.map(t => t.count), trend.map(t => t.label))}</div></div>`;
  },
  reports() {
    const now = new Date(); const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    return `\n      <div class="page-title">总结报告</div><div class="page-subtitle">自动生成成长报告，支持导出</div>\n      <div class="filter-bar">\n        <select id="rp-type"><option value="monthly">月度报告</option><option value="semester">学期报告</option><option value="annual">年度报告</option></select>\n        <input type="month" id="rp-month" value="${ym}">\n        <button class="btn btn-primary btn-sm" onclick="Report.generate()">生成报告</button>\n      </div>\n      <div id="report-output">${UI.empty('📋', '选择报告类型和月份，点击生成')}</div>`;
  },
};

/* ==================== 用户视图 ==================== */
const UserView = {
  async tasks() {
    const tasks = await DB.getTasks();
    const available = tasks.filter(t => t.status === 'available');
    const mine = tasks.filter(t => t.status === 'in_progress' || t.status === 'pending_review');
    const done = tasks.filter(t => t.status === 'completed');
    return `\n      <div class="page-title">任务中心</div><div class="page-subtitle">选择你感兴趣的任务，迈出舒适区的一小步 🌱</div>\n      ${mine.length ? `\n        <div class="section-title" style="margin-bottom:12px">我的任务（${mine.length}）</div>\n        ${mine.map(t => `\n          <div class="task-card level-${LEVEL_CLASS[t.level] || 'basic'}">\n            <div class="task-card-header"><div class="task-card-title">${t.title}</div>${UI.statusTag(t.status)}</div>\n            <div class="task-card-desc">${t.description}</div>\n            <div class="task-meta">${UI.tag(t.category, 'category')}${UI.levelTag(t.level)}${UI.tag('+'+t.growthValue+'成长值', 'category')}</div>\n            ${t.status === 'in_progress' ? `\n              <button class="btn btn-primary btn-sm" onclick="Task.openSubmit('${t.id}')">提交完成</button>\n              <button class="btn btn-ghost btn-sm" onclick="Task.abandon('${t.id}')">放弃</button>` : ''}\n            ${t.status === 'pending_review' ? `<div style=\"font-size:13px;color:var(--text-secondary);padding:8px 0\">⏳ 等待审核中...</div>` : ''}\n          </div>`).join('')}` : ''}\n      <div class="section-header" style="margin-top:24px"><div class="section-title">可领取任务</div><button class="btn btn-outline btn-sm" onclick="SelfReport.openCreate()">📝 自主申报</button></div>\n      ${available.length ? available.map(t => `\n        <div class="task-card level-${LEVEL_CLASS[t.level] || 'basic'}">\n          <div class="task-card-header"><div class="task-card-title">${t.title}</div></div>\n          <div class="task-card-desc">${t.description}</div>\n          <div class="task-meta">${UI.tag(t.category, 'category')}${UI.levelTag(t.level)}${UI.tag('+'+t.growthValue+'成长值', 'category')}${UI.tag(t.recommendedPeriod, 'category')}</div>\n          <button class="btn btn-primary btn-sm" onclick="Task.claim('${t.id}')">领取任务</button>\n        </div>`).join('') : UI.empty('🎉', '当前没有可领取的任务，去自主申报一个吧！')}\n      ${done.length ? `<div class=\"section-title\" style=\"margin:24px 0 12px\">已完成（${done.length}）</div>${done.map(t => `<div class=\"task-card\" style=\"border-left-color:#95c895;opacity:0.7\"><div class=\"task-card-header\"><div class=\"task-card-title\">${t.title}</div>${UI.statusTag('completed')}</div><div class=\"task-meta\">${UI.tag(t.category, 'category')}${UI.tag('+'+t.growthValue+'成长值', 'category')}</div></div>`).join('')}` : ''}`;
  },
  async growth() {
    const tasks = await DB.getTasks();
    const pts = getGrowthPoints(tasks);
    const lv = getGrowthLevel(pts);
    const completed = tasks.filter(t => t.status === 'completed');
    const rewards = await DB.getRewards();
    const catDist = getCategoryDist(tasks);
    const maxCat = Math.max(...Object.values(catDist), 1);
    const lvlDist = getLevelDist(tasks);
    const nextLv = GROWTH_LEVELS.find(l => l.min > pts);
    const pct = nextLv ? ((pts - lv.min) / (nextLv.min - lv.min)) * 100 : 100;
    return `\n      <div class="page-title">我的成长 🌿</div><div class="page-subtitle">每一步主动，都在让社交能力生根发芽</div>\n      <div class="card" style="text-align:center;background:linear-gradient(135deg,var(--primary-lighter),var(--accent-lighter))">\n        <div style="font-size:48px">${lv.emoji}</div>\n        <div style="font-size:22px;font-weight:700;color:var(--primary-dark);margin:8px 0">${lv.name}</div>\n        <div style="font-size:14px;color:var(--text-secondary)">累计成长积分 <strong style="color:var(--primary-dark)">${pts}</strong> 分</div>\n        ${nextLv ? `<div style="margin-top:12px">${Charts.progressBar(pct, `距离「${nextLv.name}」还需 ${nextLv.min - pts} 分`)}</div>` : `<div style="margin-top:8px;font-size:14px;color:var(--primary-dark)">已达最高等级！🎉</div>`}\n      </div>\n      <div class="stats-grid">\n        <div class="stat-card"><div class="stat-icon">✅</div><div class="stat-value">${completed.length}</div><div class="stat-label">完成任务</div></div>\n        <div class="stat-card"><div class="stat-icon">📅</div><div class="stat-value">${getCompletedThisMonth(tasks).length}</div><div class="stat-label">本月完成</div></div>\n        <div class="stat-card"><div class="stat-icon">🔥</div><div class="stat-value">${getGrowthDays(tasks)}</div><div class="stat-label">成长天数</div></div>\n        <div class="stat-card"><div class="stat-icon">💰</div><div class="stat-value">¥${rewards.reduce((s,r)=>s+r.amount,0)}</div><div class=\"stat-label\">成长基金</div></div>\n      </div>\n      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px" class="chart-grid">\n        <div class="chart-wrap"><div class="chart-title">社交类型成长</div><div class="chart-container">${Charts.radar(CATEGORIES.map(c => (catDist[c] || 0) / maxCat), CATEGORIES)}</div></div>\n        <div class="chart-wrap"><div class="chart-title">任务分布</div><div class="chart-container">${Charts.donut(LEVELS.map(l => ({ label: l, value: lvlDist[l] || 0 })))}</div></div>\n      </div>\n      <div class="card\"><div class="card-title">💡 成长寄语</div><p style="font-size:14px;color:var(--text-secondary);line-height:1.8">社交不是一门需要满分的考试，而是一棵需要浇灌的小树。每一次主动开口、每一次微笑、每一次关心他人，都是浇向根部的水。你不需要做到完美，只需要愿意迈出那一步。🌱</p></div>`;
  },
  async rewards() {
    const rewards = await DB.getRewards();
    const total = rewards.reduce((s, r) => s + r.amount, 0);
    return `\n      <div class="page-title">奖励记录 🎁</div><div class="page-subtitle">每一次成长，都值得被看见和奖励</div>\n      <div class="card" style="text-align:center;background:linear-gradient(135deg,var(--accent-lighter),var(--primary-lighter))">\n        <div style="font-size:40px">💰</div><div style="font-size:28px;font-weight:700;color:var(--accent);margin:4px 0">¥${total}</div><div style="font-size:14px;color:var(--text-secondary)">累计成长基金</div>\n      </div>\n      ${rewards.length ? rewards.map(r => `\n        <div class="reward-card">\n          <div class="reward-emoji">${REWARD_TYPES.find(t => t.value === r.type)?.emoji || '🎁'}</div>\n          <div class="reward-info\"><div class="reward-amount">¥${r.amount}</div><div class="reward-note">${r.note || ''}</div><div class="reward-date">${UI.fmtDateFull(r.issuedAt)}</div></div>\n        </div>`).join('') : UI.empty('🎁', '还没有收到奖励，完成任务后会有的哦！')}`;
  },
};

/* ==================== 任务操作 ==================== */
const Task = {
  openCreate() {
    UI.modal('新建任务', `\n      <div class="form-group"><label>任务标题</label><input type="text" id="t-title" placeholder="如：主动和室友打招呼"></div>\n      <div class="form-group"><label>任务描述</label><textarea id="t-desc" placeholder="详细描述任务要求和完成标准..."></textarea></div>\n      <div class="form-group"><label>分类</label><select id="t-cat">${CATEGORIES.map(c => `<option value="${c}">${c}</option>`).join('')}</select></div>\n      <div class="form-group"><label>级别</label><select id="t-level">${LEVELS.map(l => `<option value="${l}">${l}</option>`).join('')}</select></div>\n      <div class="form-group"><label>难度</label><select id="t-diff">${DIFFICULTIES.map(d => `<option value="${d}">${d}</option>`).join('')}</select></div>\n      <div class="form-group"><label>成长值</label><input type="number" id="t-gv" value="10" min="0"></div>\n      <div class="form-group"><label>推荐周期</label><input type="text" id="t-period" placeholder="如：第1月·适应期"></div>\n    `, `<button class="btn btn-outline" onclick="UI.closeModal()">取消</button><button class="btn btn-primary" onclick="Task.save()">创建任务</button>`);
  },
  async openEdit(id) {
    const tasks = await DB.getTasks();
    const t = tasks.find(x => x.id === id); if (!t) return;
    UI.modal('编辑任务', `\n      <div class="form-group"><label>任务标题</label><input type="text" id="t-title" value="${t.title}"></div>\n      <div class="form-group"><label>任务描述</label><textarea id="t-desc">${t.description}</textarea></div>\n      <div class="form-group"><label>分类</label><select id="t-cat">${CATEGORIES.map(c => `<option value="${c}" ${c === t.category ? 'selected' : ''}>${c}</option>`).join('')}</select></div>\n      <div class="form-group"><label>级别</label><select id="t-level">${LEVELS.map(l => `<option value="${l}" ${l === t.level ? 'selected' : ''}>${l}</option>`).join('')}</select></div>\n      <div class="form-group"><label>难度</label><select id="t-diff">${DIFFICULTIES.map(d => `<option value="${d}" ${d === t.difficulty ? 'selected' : ''}>${d}</option>`).join('')}</select></div>\n      <div class="form-group"><label>成长值</label><input type="number" id="t-gv" value="${t.growthValue}" min="0"></div>\n      <div class="form-group"><label>推荐周期</label><input type="text" id="t-period" value="${t.recommendedPeriod || ''}"></div>\n    `, `<button class="btn btn-outline" onclick="UI.closeModal()">取消</button><button class="btn btn-primary" onclick="Task.save('${id}')">保存修改</button>`);
  },
  async save(id) {
    const data = {
      title: document.getElementById('t-title').value.trim(),
      description: document.getElementById('t-desc').value.trim(),
      category: document.getElementById('t-cat').value,
      level: document.getElementById('t-level').value,
      difficulty: document.getElementById('t-diff').value,
      growthValue: parseInt(document.getElementById('t-gv').value) || 0,
      recommendedPeriod: document.getElementById('t-period').value.trim(),
    };
    if (!data.title) { UI.toast('请填写任务标题', 'error'); return; }
    try {
      if (id) {
        await DB.updateTask(id, data);
        UI.toast('任务已更新');
      } else {
        await DB.createTask(data);
        UI.toast('任务创建成功');
      }
      UI.closeModal();
      Router.adminTab('tasks');
    } catch (e) {
      console.error(e);
      UI.toast('操作失败：' + (e.message || e), 'error');
    }
  },
  async del(id) {
    UI.confirm('确定删除这个任务吗？', `async function(){await Task.doDel('${id}')}()`, '删除');
  },
  async doDel(id) {
    try {
      await DB.deleteTask(id);
      UI.toast('任务已删除');
      Router.adminTab('tasks');
    } catch (e) {
      UI.toast('删除失败：' + (e.message || e), 'error');
    }
  },
  async claim(id) {
    try {
      await DB.updateTask(id, { status: 'in_progress', claimedBy: 'user', claimedAt: new Date().toISOString() });
      UI.toast('已领取任务，加油！💪');
      Router.userTab('tasks');
    } catch (e) {
      UI.toast('领取失败：' + (e.message || e), 'error');
    }
  },
  openSubmit(id) {
    UI.modal('提交任务完成', `\n      <div style="margin-bottom:12px"><strong id="submit-task-title"></strong></div>\n      <div class="form-group"><label>完成说明（文字描述即可）</label><textarea id="t-submit-desc" placeholder="简单描述一下你是怎么完成的，做得不完美也没关系！"></textarea></div>\n    `, `<button class="btn btn-outline" onclick="UI.closeModal()">取消</button><button class="btn btn-primary" onclick="Task.submit('${id}')">提交</button>`);
    // 异步拿任务标题
    DB.getTasks().then(tasks => {
      const t = tasks.find(x => x.id === id);
      if (t) document.getElementById('submit-task-title').textContent = t.title;
    });
  },
  async submit(id) {
    try {
      await DB.updateTask(id, {
        status: 'pending_review',
        submittedDesc: document.getElementById('t-submit-desc').value.trim(),
        submittedAt: new Date().toISOString(),
      });
      UI.closeModal();
      UI.toast('已提交，等待审核中 ✨');
      Router.userTab('tasks');
    } catch (e) {
      UI.toast('提交失败：' + (e.message || e), 'error');
    }
  },
  async abandon(id) {
    UI.confirm('确定放弃这个任务吗？放弃也不会有任何惩罚，随时可以重新领取。', `async function(){await Task.doAbandon('${id}')}()`, '放弃');
  },
  async doAbandon(id) {
    try {
      await DB.updateTask(id, { status: 'abandoned', abandonedAt: new Date().toISOString() });
      UI.toast('已放弃，没关系，下次再试试！');
      Router.userTab('tasks');
    } catch (e) {
      UI.toast('操作失败：' + (e.message || e), 'error');
    }
  },
  async approve(id) {
    const tasks = await DB.getTasks();
    const t = tasks.find(x => x.id === id); if (!t) return;
    UI.modal('通过审核', `\n      <p style="font-size:14px;margin-bottom:16px">任务「${t.title}」即将标记为已完成，妹妹将获得 <strong style="color:var(--primary-dark)">${t.growthValue}</strong> 成长值。</p>\n      <div class="form-group"><label>奖励金额（可选，元）</label><input type="number" id="ap-reward" placeholder="不填则不发放奖励" min="0"></div>\n      <div class="form-group"><label>审核评语（可选）</label><textarea id="ap-note" placeholder="给妹妹一句鼓励的话..."></textarea></div>\n    `, `<button class="btn btn-outline" onclick="UI.closeModal()">取消</button><button class="btn btn-primary" onclick="Task.doApprove('${id}')">确认通过</button>`);
  },
  async doApprove(id) {
    try {
      await DB.updateTask(id, {
        status: 'completed',
        completedAt: new Date().toISOString(),
        reviewNote: document.getElementById('ap-note').value.trim() || null,
      });
      const amt = parseInt(document.getElementById('ap-reward').value);
      if (amt > 0) {
        const tasks = await DB.getTasks();
        const t = tasks.find(x => x.id === id);
        await DB.createReward({
          userId: 'user', amount: amt, type: 'custom',
          note: `任务奖励：${t.title}`, issuedBy: 'admin', relatedTaskId: id,
        });
      }
      UI.closeModal();
      UI.toast('审核通过！🎉');
      Router.adminTab('review');
    } catch (e) {
      UI.toast('操作失败：' + (e.message || e), 'error');
    }
  },
  async reject(id) {
    UI.confirm('退回让妹妹修改？退回后任务回到进行中状态。', `async function(){await Task.doReject('${id}')}()`, '退回');
  },
  async doReject(id) {
    try {
      await DB.updateTask(id, { status: 'in_progress' });
      UI.toast('已退回修改');
      Router.adminTab('review');
    } catch (e) {
      UI.toast('操作失败：' + (e.message || e), 'error');
    }
  },
};

/* ==================== 自主申报操作 ==================== */
const SelfReport = {
  openCreate() {
    UI.modal('自主申报社交突破', `\n      <p style="font-size:13px;color:var(--text-secondary);margin-bottom:16px">如果你完成了一件任务列表之外的社交突破，可以在这里申报，哥哥审核后可发放奖励！</p>\n      <div class="form-group"><label>事件标题</label><input type="text" id="sr-title" placeholder="如：主动和隔壁宿舍同学聊天"></div>\n      <div class="form-group"><label>详细描述</label><textarea id="sr-desc" placeholder="描述一下发生了什么，你是怎么主动的..."></textarea></div>\n    `, `<button class="btn btn-outline" onclick="UI.closeModal()">取消</button><button class="btn btn-primary" onclick="SelfReport.save()">提交申报</button>`);
  },
  async save() {
    const title = document.getElementById('sr-title').value.trim();
    const desc = document.getElementById('sr-desc').value.trim();
    if (!title) { UI.toast('请填写事件标题', 'error'); return; }
    try {
      await DB.createSelfReport({ title, description: desc });
      UI.closeModal();
      UI.toast('申报已提交，等待审核 🌟');
      Router.userTab('tasks');
    } catch (e) {
      UI.toast('提交失败：' + (e.message || e), 'error');
    }
  },
  async approve(id) {
    const reports = await DB.getSelfReports();
    const sr = reports.find(s => s.id === id); if (!sr) return;
    UI.modal('通过自主申报', `\n      <p style="font-size:14px;margin-bottom:16px">「${sr.title}」即将通过审核。</p>\n      <div class="form-group"><label>奖励金额（可选，元）</label><input type="number" id="sr-reward" placeholder="不填则不发放奖励" min="0"></div>\n      <div class="form-group"><label>评语</label><textarea id="sr-note" placeholder="给妹妹一句鼓励的话..."></textarea></div>\n    `, `<button class="btn btn-outline" onclick="UI.closeModal()">取消</button><button class="btn btn-primary" onclick="SelfReport.doApprove('${id}')">确认通过</button>`);
  },
  async doApprove(id) {
    try {
      const amt = parseInt(document.getElementById('sr-reward').value) || 0;
      const note = document.getElementById('sr-note').value.trim() || null;
      await DB.updateSelfReport(id, {
        status: 'approved',
        reviewedBy: 'admin',
        reviewedAt: new Date().toISOString(),
        reviewNote: note,
        rewardAmount: amt,
      });
      if (amt > 0) {
        const reports = await DB.getSelfReports();
        const sr = reports.find(s => s.id === id);
        await DB.createReward({
          userId: 'user', amount: amt, type: 'custom',
          note: `自主申报奖励：${sr.title}`, issuedBy: 'admin',
        });
      }
      UI.closeModal();
      UI.toast('申报已通过！🎉');
      Router.adminTab('review');
    } catch (e) {
      UI.toast('操作失败：' + (e.message || e), 'error');
    }
  },
  async reject(id) {
    UI.confirm('确定不通过这个申报吗？', `async function(){await SelfReport.doReject('${id}')}()`, '不通过');
  },
  async doReject(id) {
    try {
      await DB.updateSelfReport(id, {
        status: 'rejected',
        reviewedBy: 'admin',
        reviewedAt: new Date().toISOString(),
      });
      UI.toast('已标记为不通过');
      Router.adminTab('review');
    } catch (e) {
      UI.toast('操作失败：' + (e.message || e), 'error');
    }
  },
};

/* ==================== 奖励操作 ==================== */
const Reward = {
  async issue() {
    const type = document.getElementById('rw-type').value;
    const amount = parseInt(document.getElementById('rw-amount').value);
    const note = document.getElementById('rw-note').value.trim();
    if (!amount || amount <= 0) { UI.toast('请输入有效金额', 'error'); return; }
    try {
      await DB.createReward({
        userId: 'user', amount, type,
        note: note || REWARD_TYPES.find(t => t.value === type)?.label,
        issuedBy: 'admin',
      });
      UI.toast('奖励已发放！🎁');
      Router.adminTab('rewards');
    } catch (e) {
      UI.toast('发放失败：' + (e.message || e), 'error');
    }
  },
};

/* ==================== 报告 ==================== */
const Report = {
  async generate() {
    const type = document.getElementById('rp-type').value;
    const monthVal = document.getElementById('rp-month').value;
    const [year, month] = monthVal.split('-').map(Number);
    const allTasks = await DB.getTasks();
    const allRewards = await DB.getRewards();
    let tasks, label;
    if (type === 'monthly') {
      tasks = allTasks.filter(t => t.status === 'completed' && t.completedAt && (() => { const d = new Date(t.completedAt); return d.getFullYear() === year && d.getMonth() === month - 1; })());
      label = `${year}年${month}月`;
    } else if (type === 'semester') {
      const isFall = month >= 9;
      tasks = allTasks.filter(t => {
        if (t.status !== 'completed' || !t.completedAt) return false;
        const d = new Date(t.completedAt);
        return isFall ? (d.getFullYear() === year && d.getMonth() >= 8) : (d.getFullYear() === year && d.getMonth() <= 7);
      });
      label = `${year}${isFall ? '秋季' : '春季'}学期`;
    } else {
      tasks = allTasks.filter(t => t.status === 'completed' && t.completedAt && new Date(t.completedAt).getFullYear() === year);
      label = `${year}年度`;
    }
    const pts = tasks.reduce((s, t) => s + t.growthValue, 0);
    const catDist = {}; CATEGORIES.forEach(c => catDist[c] = 0); tasks.forEach(t => catDist[t.category] = (catDist[t.category] || 0) + 1);
    const lvlDist = {}; LEVELS.forEach(l => lvlDist[l] = 0); tasks.forEach(t => lvlDist[t.level] = (lvlDist[t.level] || 0) + 1);
    const maxCat = Math.max(...Object.values(catDist), 1);
    const rewards = allRewards.filter(r => {
      const d = new Date(r.issuedAt);
      if (type === 'monthly') return d.getFullYear() === year && d.getMonth() === month - 1;
      if (type === 'annual') return d.getFullYear() === year;
      return true;
    });
    const rewardTotal = rewards.reduce((s, r) => s + r.amount, 0);
    const commentKey = `${monthVal}-${type}`;
    const existingComment = await DB.getConfig('report_comments') || {};
    const comment = existingComment[commentKey] || '';
    document.getElementById('report-output').innerHTML = `\n      <div class="report-card" id="report-printable">\n        <div class="report-header"><div class="report-title">${label}成长报告</div><button class="btn btn-outline btn-sm" onclick="Report.export()">📥 导出</button></div>\n        <div class="report-stats">\n          <div class="report-stat"><div class="num">${tasks.length}</div><div class="label">完成任务</div></div>\n          <div class="report-stat"><div class="num">${pts}</div><div class="label">成长积分</div></div>\n          <div class="report-stat"><div class="num">¥${rewardTotal}</div><div class="label">成长基金</div></div>\n        </div>\n        <div class="report-section"><h4>成长亮点</h4><p>${tasks.length ? `这个周期完成了 ${tasks.length} 个任务，累计获得 ${pts} 成长值，涵盖了${Object.entries(catDist).filter(([k,v])=>v>0).map(([k,v])=>`${k}${v}个`).join('、')}。每一次主动都是成长的印记。` : '这个周期暂未完成任务，没关系，成长不急于一时，重要的是愿意迈出那一步。'}</p></div>\n        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px" class="chart-grid">\n          <div class="chart-wrap"><div class="chart-title">类型分布</div><div class="chart-container">${Charts.radar(CATEGORIES.map(c => (catDist[c] || 0) / maxCat), CATEGORIES)}</div></div>\n          <div class="chart-wrap"><div class="chart-title">难度分布</div><div class="chart-container">${Charts.donut(LEVELS.map(l => ({ label: l, value: lvlDist[l] || 0 })))}</div></div>\n        </div>\n        <div class="report-section"><h4>完成任务清单</h4>${tasks.length ? `<div style="font-size:14px;line-height:2">${tasks.map((t, i) => `${i + 1}. ${t.title} <span style="color:var(--text-light)">(+${t.growthValue})</span>`).join('<br>')}</div>` : '<p>暂无</p>'}</div>\n        <div class="report-section"><h4>管理员评语</h4><textarea id="rp-comment" placeholder="在这里写一段评语和鼓励..." style="width:100%;min-height:80px;padding:10px;border:1.5px solid var(--border);border-radius:10px;font-size:14px;font-family:inherit">${comment}</textarea><button class="btn btn-primary btn-sm" style="margin-top:8px" onclick="Report.saveComment('${commentKey}')">保存评语</button></div>\n      </div>`;
  },
  async saveComment(key) {
    try {
      const all = await DB.getConfig('report_comments') || {};
      all[key] = document.getElementById('rp-comment').value;
      await DB.setConfig('report_comments', all);
      UI.toast('评语已保存');
    } catch (e) {
      UI.toast('保存失败：' + (e.message || e), 'error');
    }
  },
  export() { window.print(); },
};

/* ==================== 启动 ==================== */
DB.init();
const savedRole = sessionStorage.getItem('gp_role');
const savedUser = sessionStorage.getItem('gp_user');
if (savedRole && savedUser) {
  if (savedRole === 'admin') Router.showAdmin(); else Router.showUser();
} else {
  Router.showLogin();
}
