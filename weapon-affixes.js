(function initWeaponAffixes(root) {
  const clampRandom = (value) => Math.min(Math.max(Number(value) || 0, 0), 0.999999999);

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function parseRange(range) {
    const values = String(range ?? '')
      .split(',')
      .map(value => value.trim())
      .filter(value => value !== '')
      .map(Number)
      .filter(Number.isFinite);
    if (values.length === 0) return null;
    const min = Math.min(values[0], values[1] ?? values[0]);
    const max = Math.max(values[0], values[1] ?? values[0]);
    return { min, max };
  }

  function rollRange(range, random = Math.random, options = {}) {
    const parsed = parseRange(range);
    if (!parsed) return null;
    const { min, max } = parsed;
    if (min === max) return options.decimals === 2 ? Number(min.toFixed(2)) : min;
    const roll = clampRandom(random());
    if (options.integer) return Math.floor(min + roll * (max - min + 1));
    const decimals = options.decimals ?? 2;
    return Number((min + roll * (max - min)).toFixed(decimals));
  }

  function pickWeightedBuff(rows, random = Math.random) {
    const candidates = (Array.isArray(rows) ? rows : []).filter(row => Number(row?.weight) > 0);
    const total = candidates.reduce((sum, row) => sum + Number(row.weight), 0);
    if (!candidates.length || total <= 0) return null;
    let cursor = clampRandom(random()) * total;
    for (const row of candidates) {
      cursor -= Number(row.weight);
      if (cursor < 0) return row;
    }
    return candidates[candidates.length - 1];
  }

  function getSkillConfig(skillId, config) {
    if (Array.isArray(config?.skills)) {
      return config.skills.find(skill => Number(skill.skillId) === Number(skillId)) || null;
    }
    if (typeof root.getSkillById === 'function') return root.getSkillById(Number(skillId));
    const skill = root.GAME_CONFIG?.skillTable?.find(row => Number(row.skillId) === Number(skillId));
    if (!skill) return null;
    return {
      ...skill,
      buffs: (root.GAME_CONFIG?.buffTable || []).filter(row => Number(row.buffId) === Number(skill.buffId)),
    };
  }

  function classifyEffect(buff) {
    return String(buff?.description || '').includes('返还') ? 'chop_refund' : 'reward_multiplier';
  }

  function rollValues(buff, effectType, random) {
    const values = {};
    if (effectType === 'reward_multiplier') {
      const value1 = rollRange(buff.value1Range, random, { integer: true });
      const value2 = rollRange(buff.value2Range, random, { decimals: 2 });
      const value3 = rollRange(buff.value3Range, random, { integer: true });
      if (value1 !== null) values.value1 = value1;
      if (value2 !== null) values.value2 = value2;
      if (value3 !== null) values.value3 = value3;
    } else {
      const value1 = rollRange(buff.value1Range, random, { decimals: 2 });
      const value2 = rollRange(buff.value2Range, random, { integer: true });
      const value3 = rollRange(buff.value3Range, random, { integer: true });
      if (value1 !== null) values.value1 = value1;
      if (value2 !== null) values.value2 = value2;
      if (value3 !== null) values.value3 = value3;
    }
    return values;
  }

  function rollSkills(skillIds, random = Math.random, config = null) {
    return (Array.isArray(skillIds) ? skillIds : []).map(skillId => {
      const skill = getSkillConfig(skillId, config);
      if (!skill) throw new Error(`Missing skill configuration: ${skillId}`);
      const selected = pickWeightedBuff(skill.buffs, random);
      if (!selected) throw new Error(`Missing weighted BUFF configuration: ${skill.buffId}`);
      const effectType = classifyEffect(selected);
      return {
        skillId: Number(skill.skillId),
        buffId: Number(skill.buffId),
        buffRowId: Number(selected.id),
        buffQuality: Number(selected.buffQuality) || 1,
        description: String(selected.description || ''),
        effectType,
        values: rollValues(selected, effectType, random),
      };
    });
  }

  function formatValue(key, value, roll, qualityTable) {
    const effectType = roll.effectType || classifyEffect(roll);
    if (key === 'value1' && effectType === 'reward_multiplier') {
      const quality = (qualityTable || []).find(row => Number(row.id ?? row.qualityId) === Number(value));
      return quality?.name || `品质${value}`;
    }
    if ((key === 'value2' && effectType === 'reward_multiplier')
      || (key === 'value1' && effectType === 'chop_refund')) {
      return `${Number(value)}%`;
    }
    return String(value);
  }

  function formatSkill(skillRoll, qualityTable = root.GAME_CONFIG?.qualityTable || []) {
    if (!skillRoll) return '';
    const normalizedRoll = {
      ...skillRoll,
      effectType: skillRoll.effectType || classifyEffect(skillRoll),
    };
    let template = escapeHtml(normalizedRoll.description || '');
    for (const key of ['value1', 'value2', 'value3']) {
      if (!(key in (normalizedRoll.values || {}))) continue;
      const display = escapeHtml(formatValue(key, normalizedRoll.values[key], normalizedRoll, qualityTable));
      const targetQuality = key === 'value1' && normalizedRoll.effectType === 'reward_multiplier'
        ? Number(normalizedRoll.values[key])
        : Number(normalizedRoll.buffQuality);
      const colorQuality = Math.max(1, Math.min(5, targetQuality || 1));
      const token = `<span class="buff-value buff-quality-${colorQuality}">${display}</span>`;
      template = template.replaceAll(`{${key}}`, token);
      if (key === 'value1') template = template.replaceAll('{vlaue1}', token);
    }
    return template;
  }

  function getWeaponRating(weapon) {
    let quality = 1;
    for (const roll of Array.isArray(weapon?.skillRolls) ? weapon.skillRolls : []) {
      if (!roll || typeof roll !== 'object' || Array.isArray(roll)) continue;
      if (typeof roll.description !== 'string' || !roll.description.trim()) continue;
      if (typeof roll.buffQuality !== 'number' && typeof roll.buffQuality !== 'string') continue;
      const candidate = Number(roll.buffQuality);
      if (!Number.isInteger(candidate) || candidate < 1 || candidate > 5) continue;
      quality = Math.max(quality, candidate);
    }
    return { quality, label: ['B', 'A', 'S', 'SS', 'SSS'][quality - 1] };
  }

  function applyRewardMultipliers(drop, rolls, random = Math.random) {
    if (!drop) return drop;
    const result = { ...drop };
    for (const roll of Array.isArray(rolls) ? rolls : []) {
      if (roll?.effectType !== 'reward_multiplier') continue;
      if (Number(roll.values?.value1) !== Number(result.quality)) continue;
      if (clampRandom(random()) * 100 >= Number(roll.values?.value2)) continue;
      result.quantity *= Math.max(1, Number(roll.values?.value3) || 1);
    }
    return result;
  }

  function rollRefund(rolls, random = Math.random) {
    let refund = 0;
    for (const roll of Array.isArray(rolls) ? rolls : []) {
      if (roll?.effectType !== 'chop_refund') continue;
      if (clampRandom(random()) * 100 < Number(roll.values?.value1)) {
        refund += Math.max(0, Math.floor(Number(roll.values?.value2) || 0));
      }
    }
    return refund;
  }

  const api = {
    rollRange,
    pickWeightedBuff,
    rollSkills,
    formatSkill,
    getWeaponRating,
    applyRewardMultipliers,
    rollRefund,
  };
  root.WeaponAffixes = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
