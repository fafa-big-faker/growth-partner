(function initRewardPresentation(root) {
  const ART_BASE = 'assets/runtime/v7/rewards';
  const ART_VERSION = 'xianlai-v7-20260909';
  const QUALITY_NAMES = ['凡品', '精品', '珍品', '神品', '仙品'];

  function escapeText(value) {
    return String(value ?? '').replace(/[&<>"']/g, character => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    })[character]);
  }

  function qualityId(value) {
    const id = Number(value);
    return Number.isInteger(id) && id >= 1 && id <= 5 ? id : 1;
  }

  function getAssetUrls() {
    return QUALITY_NAMES.map((name, index) => `${ART_BASE}/quality-${index + 1}.webp?v=${ART_VERSION}`);
  }

  function groupResults(results) {
    const groups = { regular: [], extra: [] };
    for (const reward of Array.isArray(results) ? results : []) {
      if (!reward || typeof reward !== 'object') continue;
      // Ten-chop results already contain each extra as a separate entry.
      groups[reward.isExtra ? 'extra' : 'regular'].push(reward);
    }
    return groups;
  }

  function createRenderer(dependencies = {}) {
    const items = dependencies.items || {};
    const quality = dependencies.quality || {};
    const escape = dependencies.escapeHtml || escapeText;
    const renderIcon = dependencies.renderItemIcon;

    function renderItem(reward, options = {}) {
      if (!reward || typeof reward !== 'object') return '';
      const id = reward.kind === 'coin' ? '0' : reward.kind === 'chopping' ? '1' : String(reward.itemId ?? '');
      const definition = items[id] || reward.item || {};
      const name = definition.name || (id === '0' ? '游戏币' : id === '1' ? '砍树次数' : '道具');
      const rank = qualityId(reward.quality ?? definition.quality);
      const rankName = quality[rank]?.name || QUALITY_NAMES[rank - 1];
      const size = ['large', 'small'].includes(options.size) ? options.size : 'regular';
      const quantity = Number.isFinite(Number(reward.quantity)) ? Number(reward.quantity) : 1;
      const icon = typeof renderIcon === 'function' && id
        ? renderIcon(id, definition.icon || '', 'reward-item-icon')
        : '<span class="reward-item-fallback" aria-hidden="true">物</span>';
      const buff = reward.buffText
        ? `<div class="reward-item-buff">斧技触发 · ${escape(reward.buffText)}</div>` : '';
      const refund = Number(reward.refundChopping) > 0
        ? `<div class="reward-item-refund">返还 ${escape(reward.refundChopping)} 次砍树</div>` : '';
      return `<div class="reward-item reward-item--${size}" data-reward-item="${escape(id)}">
        <div class="reward-art">
          <img class="reward-quality-ink" src="${ART_BASE}/quality-${rank}.webp?v=${ART_VERSION}" alt="" aria-hidden="true" decoding="async">
          <div class="reward-art-icon">${icon}</div>
        </div>
        <div class="reward-item-name quality-item-name quality-${rank}">${escape(name)}</div>
        <div class="reward-item-quantity"><span class="reward-item-quality">${escape(rankName)} · </span>×${escape(quantity)}</div>
        ${buff}${refund}
      </div>`;
    }

    function renderResults(results) {
      const { regular, extra } = groupResults(results);
      if (!regular.length && !extra.length) return '';
      return `<div class="reward-results">
        ${regular.length ? `<div class="reward-results-regular">${regular.map(reward => renderItem(reward)).join('')}</div>` : ''}
        ${extra.length ? `<section class="reward-results-extra" aria-label="额外奖励">
          <div class="reward-results-extra-title">额外奖励</div>
          <div class="reward-results-extra-items">${extra.map(reward => renderItem(reward, { size: 'small' })).join('')}</div>
        </section>` : ''}
      </div>`;
    }

    return { renderItem, renderResults };
  }

  const defaultRenderer = createRenderer();
  const api = { createRenderer, groupResults, getAssetUrls, ...defaultRenderer };
  root.RewardPresentation = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
