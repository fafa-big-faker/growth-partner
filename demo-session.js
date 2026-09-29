(function (root) {
  'use strict';
  const copy = value => JSON.parse(JSON.stringify(value));
  const positive = value => Number.isSafeInteger(Number(value)) && Number(value) > 0;
  const day = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  function isEntry(search = root.location?.search || '') {
    return new URLSearchParams(search).get('demo') === '1';
  }
  function verify(role, password) {
    return role === 'player' && String(password) === '888'
      ? { role: 'player', playerRole: 'demo', environment: 'demo' } : null;
  }

  function createStore({ config, affixes, tasks = [], now = () => new Date() }) {
    const items = new Map(config.itemTable.map(item => [String(item.id), item]));
    const created = now(), prefix = root.crypto?.randomUUID?.() || `${created.getTime()}-${Math.random().toString(36).slice(2)}`;
    let sequence = 0;
    const id = () => `demo-${prefix}-${++sequence}`;
    const makeWeapon = (itemId, skillRolls) => ({ id: id(), itemId: String(itemId), skillRolls: copy(skillRolls), createdAt: now().toISOString() });
    const giftItem = items.get('51002');
    const skillIds = String(giftItem?.interactionParams || '').split(',').slice(1).map(Number).filter(Number.isFinite);
    const skills = skillIds.map(skillId => {
      const skill = config.skillTable.find(row => row.skillId === skillId);
      if (!skill) throw new Error('演示仙斧技能配置缺失');
      const buffs = config.buffTable.filter(row => row.buffId === skill.buffId && row.buffQuality === 5 && row.weight > 0);
      if (!buffs.length) throw new Error('演示仙斧缺少SSS品质词条');
      return { ...skill, buffs };
    });
    // Fixed, legal high-end values from the real quality-5 ranges; no change to proc probability rules.
    const giftRolls = affixes.rollSkills(skillIds, () => 0.999999999, { skills });
    if (affixes.getWeaponRating({ skillRolls: giftRolls }).label !== 'SSS') throw new Error('演示仙斧评级不是SSS');
    const weapons = [makeWeapon('51001', []), makeWeapon('51002', giftRolls)];
    const giftId = weapons[1].id;
    const state = {
      level: 10, exp: 0, realmLevel: 1, treeLevel: 14, treeRealm: 14,
      choppingCount: 999, axeId: '51001', axeInstanceId: weapons[0].id,
      balance: 0, totalWithdrawn: 0, coin: 0, totalChops: 0, totalCoinEarned: 0,
      lastDailyDate: null, signInMonth: null, signInDays: 0, signInClaims: [],
      shopPurchases: {}, achievementClaims: [], themeRewardClaims: [],
    };
    const inventory = new Map([['30001', 1], ['30101', 1], ['30201', 1], ['40001', 999]]);
    const ends = new Date(created); ends.setDate(ends.getDate() + 30);
    const taskRows = copy(tasks).map(task => ({
      ...task, status: 'published',
      themeStart: task.taskType === 'theme' ? day(created) : null,
      themeEnd: task.taskType === 'theme' ? day(ends) : null,
    }));
    const submissions = [], mails = [], withdrawals = [], claims = new Set();
    const quantity = itemId => inventory.get(String(itemId)) || 0;
    const setQuantity = (itemId, count) => count > 0 ? inventory.set(String(itemId), count) : inventory.delete(String(itemId));
    const validItem = (itemId, count) => items.has(String(itemId)) && positive(count);
    const fail = code => ({ ok: false, code });
    let tenClosed = false;

    const store = {
      giftId,
      afterTenClosed(equippedId) {
        if (tenClosed) return false;
        tenClosed = true;
        return equippedId !== giftId && weapons.some(weapon => weapon.id === giftId);
      },
      getPlayerState: () => copy(state),
      initPlayerState: () => copy(state),
      _defaultPlayerState: () => copy(state),
      updatePlayerState(updates) {
        for (const key of Object.keys(updates)) {
          if (!Object.hasOwn(state, key)) throw new Error(`演示存档未知字段：${key}`);
        }
        Object.assign(state, copy(updates));
        return true;
      },
      getInventory: () => [...inventory].map(([itemId, count]) => ({ itemId, quantity: count })),
      addItem(itemId, count = 1) {
        if (!validItem(itemId, count)) return null;
        const next = quantity(itemId) + Number(count);
        if (!Number.isSafeInteger(next)) return null;
        setQuantity(itemId, next);
        return { ok: true, quantity: next };
      },
      removeItem(itemId, count = 1) {
        if (!validItem(itemId, count) || quantity(itemId) < Number(count)) return null;
        const next = quantity(itemId) - Number(count);
        setQuantity(itemId, next);
        return { ok: true, quantity: next };
      },
      composeInventoryItem(sourceId, sourceCount, targetId, targetCount) {
        if (String(sourceId) === String(targetId) || !validItem(sourceId, sourceCount) || !validItem(targetId, targetCount)) return fail('invalid_quantity');
        if (quantity(sourceId) < Number(sourceCount)) return fail('insufficient_materials');
        const targetQuantity = quantity(targetId) + Number(targetCount);
        if (!Number.isSafeInteger(targetQuantity)) return fail('invalid_quantity');
        const sourceQuantity = quantity(sourceId) - Number(sourceCount);
        setQuantity(sourceId, sourceQuantity); setQuantity(targetId, targetQuantity);
        return { ok: true, sourceQuantity, targetQuantity };
      },
      getWeaponInstances: () => copy(weapons),
      initializeWeaponAffixes(instanceId, rolls) {
        const weapon = weapons.find(row => row.id === instanceId);
        if (!weapon) return null;
        if (!weapon.skillRolls.length) weapon.skillRolls = copy(rolls);
        return copy(weapon.skillRolls);
      },
      initializeWeaponAffixesBatch(updates) {
        return updates.flatMap(update => {
          const rolls = store.initializeWeaponAffixes(update.id, update.skillRolls);
          return rolls ? [{ id: update.id, skillRolls: rolls }] : [];
        });
      },
      grantWeaponInstance(itemId, rolls) {
        if (Number(items.get(String(itemId))?.type) !== 5) return null;
        const weapon = makeWeapon(itemId, rolls); weapons.push(weapon);
        return copy(weapon);
      },
      forgeWeaponInstance(costId, costCount, itemId, rolls) {
        if (!validItem(costId, costCount) || Number(items.get(String(itemId))?.type) !== 5 || !Array.isArray(rolls)) return fail('invalid_configuration');
        if (quantity(costId) < Number(costCount)) return fail('insufficient_materials');
        const weapon = store.grantWeaponInstance(itemId, rolls);
        const remainingMaterial = quantity(costId) - Number(costCount);
        setQuantity(costId, remainingMaterial);
        return { ok: true, weapon, remainingMaterial, costQuantity: remainingMaterial };
      },
      equipWeaponInstance(instanceId) {
        const weapon = weapons.find(row => row.id === instanceId);
        if (!weapon) return fail('not_found');
        const realm = config.realmTable.find(row => Number(row.realmId) === Number(state.realmLevel));
        if (Number(items.get(weapon.itemId)?.quality) > Number(realm?.maxAxeQuality || 1)) return fail('realm_locked');
        state.axeId = weapon.itemId; state.axeInstanceId = weapon.id;
        return { ok: true, axeId: weapon.itemId, axeInstanceId: weapon.id };
      },
      sellWeaponInstance(instanceId, price) {
        const index = weapons.findIndex(row => row.id === instanceId);
        if (index < 0) return fail('not_found');
        if (state.axeInstanceId === instanceId) return fail('equipped');
        const amount = Number(price);
        if (!Number.isSafeInteger(amount) || amount < 0) return fail('invalid_price');
        weapons.splice(index, 1);
        state.coin += amount; state.totalCoinEarned += amount;
        return { ok: true, coin: state.coin };
      },
      reservePlayerClaim(type, key) {
        const month = day(now()).slice(0, 7);
        const stamp = `${type}:${type === 'signin' ? month : ''}:${key}`;
        if (claims.has(stamp)) return fail('already_claimed');
        const fields = { achievement: 'achievementClaims', signin: 'signInClaims', theme: 'themeRewardClaims' };
        const field = fields[type];
        if (!field) return fail('invalid_claim');
        if (state[field].some(value => String(value) === String(key))) return fail('already_claimed');
        claims.add(stamp); state[field].push(type === 'signin' ? Number(key) : String(key));
        return { ok: true };
      },
      dailyCheckIn(rewards) {
        const today = day(now()), month = today.slice(0, 7);
        const result = () => ({ date: today, month, days: state.signInDays, claims: copy(state.signInClaims), choppingCount: state.choppingCount });
        if (state.lastDailyDate === today) return { ...result(), ok: false, code: 'already_checked' };
        if (!Array.isArray(rewards) || rewards.some(row => !validItem(row.itemId, row.count))) return fail('invalid_rewards');
        if (state.signInMonth !== month) { state.signInDays = 0; state.signInClaims = []; }
        state.lastDailyDate = today; state.signInMonth = month; state.signInDays++;
        for (const reward of rewards) {
          const item = items.get(String(reward.itemId)), count = Number(reward.count);
          if (item.type === 0) { state.coin += count; state.totalCoinEarned += count; }
          else if (item.type === 6) state.choppingCount += count;
          else if (item.type === 5) {
            const ids = String(item.interactionParams || '').split(',').slice(1).map(Number);
            const skillConfig = { skills: config.skillTable.map(skill => ({ ...skill, buffs: config.buffTable.filter(row => row.buffId === skill.buffId) })) };
            for (let n = 0; n < count; n++) store.grantWeaponInstance(item.id, affixes.rollSkills(ids, Math.random, skillConfig));
          } else store.addItem(reward.itemId, count);
        }
        return { ok: true, ...result() };
      },
      getTasks: (type = null) => copy(taskRows.filter(task => !type || task.taskType === type)),
      getSubmissions: (status = null) => copy(submissions.filter(sub => !status || sub.status === status)),
      submitTask(submission) {
        const task = taskRows.find(row => row.id === submission.taskId);
        if (!task && !submission.isSelfTask) return null;
        if (!String(submission.description || '').trim()) return null;
        if (task && submissions.some(sub => sub.taskId === task.id && sub.status !== 'rejected')) return null;
        const sub = {
          id: id(), taskId: task?.id || null, taskType: task?.taskType || 'self',
          taskTitle: task?.title || String(submission.selfTitle || submission.taskTitle || ''),
          isSelfTask: !task, selfTitle: task ? null : String(submission.selfTitle || ''),
          selfDescription: task ? null : String(submission.selfDescription || submission.description),
          description: String(submission.description), status: 'pending', submittedAt: now().toISOString(),
          reviewNote: '', rewardChopping: task?.rewardChopping || 0, rewardItems: copy(task?.rewardItems || []),
        };
        submissions.unshift(sub);
        return copy(sub);
      },
      simulateReview(subId) {
        const sub = submissions.find(row => row.id === subId);
        if (!sub || sub.status !== 'pending') return false;
        sub.status = 'approved'; sub.reviewNote = '演示模式：模拟审核通过，未发送至真实天道。';
        if (sub.isSelfTask) {
          sub.rewardChopping = 10;
          sub.rewardItems = [{ item_id: '40001', quantity: 1 }];
          sub.reviewNote += ' 示例奖励：10次砍树、1个开工石。';
        }
        store.sendMail('演示任务审核通过', `「${sub.taskTitle}」已模拟通过，请前往任务页领取奖励。此为演示，不是真实审核。`);
        return true;
      },
      claimSubmission(subId) {
        const sub = submissions.find(row => row.id === subId);
        if (!sub || sub.status !== 'approved') return false;
        sub.status = 'claimed';
        return true;
      },
      getMails: () => copy(mails.filter(mail => !mail.isDeleted)),
      sendMail(title, content, attachments = []) {
        mails.unshift({ id: id(), title, content, items: copy(attachments), isRead: false, isClaimed: false, isDeleted: false, createdAt: now().toISOString() });
        return true;
      },
      markMailRead(mailId) {
        const mail = mails.find(row => row.id === mailId && !row.isDeleted);
        if (!mail) return false;
        mail.isRead = true; return true;
      },
      claimMail(mailId) {
        const mail = mails.find(row => row.id === mailId && !row.isDeleted && !row.isClaimed);
        if (!mail) return false;
        mail.isClaimed = mail.isRead = true; return true;
      },
      deleteMail(mailId) {
        const mail = mails.find(row => row.id === mailId);
        if (!mail) return false;
        mail.isDeleted = true; return true;
      },
      deleteMails(ids) {
        mails.forEach(mail => { if (mail.isRead && ids.includes(mail.id)) mail.isDeleted = true; });
        return true;
      },
      getWithdrawals: (status = null) => copy(withdrawals.filter(row => !status || row.status === status)),
      requestWithdrawal(amount) {
        if (!positive(amount)) return null;
        const row = { id: id(), amount: Number(amount), status: 'pending', createdAt: now().toISOString() };
        withdrawals.unshift(row); return copy(row);
      },
    };
    return store;
  }

  let active = null;
  function install(db, options) {
    const entry = options.entry ?? isEntry();
    let store = null;
    for (const name of Object.keys(db)) {
      if (typeof db[name] !== 'function') continue;
      const original = db[name];
      db[name] = function (...args) {
        if (entry || db.playerRole === 'demo') {
          if (name === 'setPlayerRole') {
            if (args[0] !== 'demo') throw new Error('演示入口不能访问正式或测试账号');
            db.playerRole = 'demo'; return;
          }
          if (!entry || !store || typeof store[name] !== 'function') throw new Error(`演示模式不支持该操作：${name}`);
          return store[name](...args);
        }
        if (name === 'setPlayerRole' && args[0] === 'demo') throw new Error('请从演示入口登录');
        return original.apply(this, args);
      };
    }
    active = {
      get store() { return store; },
      get giftId() { return store?.giftId || null; },
      reset() {
        if (!entry) throw new Error('只能在演示入口重置演示存档');
        store = createStore(options); return store;
      },
      end() { store = null; },
      afterTenClosed: equippedId => Boolean(store?.afterTenClosed(equippedId)),
    };
    return active;
  }
  const api = {
    isEntry, verify, createStore, install,
    reset: () => active?.reset(), end: () => active?.end(),
    afterTenClosed: equippedId => Boolean(active?.afterTenClosed(equippedId)),
    simulateReview: id => active?.store?.simulateReview(id) || false,
    get giftId() { return active?.giftId || null; },
  };
  if (isEntry()) root.document?.documentElement?.classList.add('demo-entry');
  root.DemoSession = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
