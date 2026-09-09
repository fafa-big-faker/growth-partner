(function initRewardPresentation(root) {
  const ART_BASE = 'assets/runtime/v7/rewards';
  const ART_VERSION = 'xianlai-v7-20260909';
  const QUALITY_NAMES = ['凡品', '精品', '珍品', '神品', '仙品'];
  const activeReveals = new WeakMap();
  let revealId = 0;

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

  function getRewardMetadata(reward = {}) {
    if (!reward || typeof reward !== 'object') reward = {};
    const parsedQuantity = Number(reward.quantity);
    const quantity = Number.isFinite(parsedQuantity) && parsedQuantity >= 0 ? parsedQuantity : 1;
    const parsedBase = Number(reward.baseQuantity);
    const baseQuantity = Number.isFinite(parsedBase) && parsedBase >= 0 ? parsedBase : quantity;
    const refund = Number(reward.refundChopping);
    const metadata = { quantity, baseQuantity: quantity, triggers: [], refund: Number.isFinite(refund) && refund > 0 ? refund : 0 };
    if (reward.isExtra || !Array.isArray(reward.buffTriggers) || !reward.buffTriggers.length) return metadata;
    const triggers = [];
    let previous = baseQuantity;
    for (const trigger of reward.buffTriggers) {
      const beforeQuantity = Number(trigger?.beforeQuantity);
      const afterQuantity = Number(trigger?.afterQuantity);
      const multiplier = Number(trigger?.multiplier);
      if (![beforeQuantity, afterQuantity, multiplier].every(Number.isFinite)
        || beforeQuantity !== previous || beforeQuantity < 0 || multiplier < 1
        || Math.abs(afterQuantity - beforeQuantity * multiplier) > 0.000001) return metadata;
      if (afterQuantity > beforeQuantity) triggers.push({ beforeQuantity, afterQuantity, multiplier,
        skillId: trigger.skillId ?? null, buffId: trigger.buffId ?? null,
        buffRowId: trigger.buffRowId ?? null, buffQuality: trigger.buffQuality ?? null });
      previous = afterQuantity;
    }
    if (previous !== quantity || !triggers.length) return metadata;
    return { ...metadata, baseQuantity, triggers };
  }

  function getRevealPlan(metadata) {
    const events = [];
    let cursor = 0;
    let triggerCount = 0;
    for (const [itemIndex, reward] of metadata.entries()) {
      events.push({ at: cursor, type: 'reveal', itemIndex });
      cursor += 120;
      for (const [triggerIndex, trigger] of reward.triggers.entries()) {
        const duration = triggerCount++ === 0 ? 450 : 300;
        events.push({ at: cursor, type: 'trigger', itemIndex, triggerIndex });
        events.push({ at: cursor + duration * 0.6, type: 'quantity', itemIndex, quantity: trigger.afterQuantity });
        cursor += duration;
        events.push({ at: cursor, type: 'settle', itemIndex, triggerIndex });
      }
      if (reward.refund > 0) {
        if (!reward.triggers.length) {
          const duration = triggerCount++ === 0 ? 450 : 300;
          events.push({ at: cursor, type: 'refund-trigger', itemIndex });
          events.push({ at: cursor + duration * 0.6, type: 'refund', itemIndex });
          cursor += duration;
          events.push({ at: cursor, type: 'settle', itemIndex });
        } else {
          events.push({ at: cursor, type: 'refund', itemIndex });
          cursor += 120;
        }
      }
      events.push({ at: cursor, type: 'complete-item', itemIndex });
    }
    return { events, duration: cursor + (metadata.length ? 100 : 0) };
  }

  function playReveal(overlay, { audio, onComplete } = {}) {
    activeReveals.get(overlay)?.cancel();
    const document = overlay?.ownerDocument;
    const view = document?.defaultView || root;
    const entries = [...(overlay?.querySelectorAll('.reward-item[data-reward-reveal]') || [])].map(element => {
      let metadata;
      try { metadata = JSON.parse(element.dataset.rewardReveal); } catch { metadata = null; }
      metadata = metadata && Array.isArray(metadata.triggers) ? metadata : getRewardMetadata();
      const quantity = element.querySelector('.reward-item-quantity-value');
      const ticker = element.querySelector('.reward-quantity-ticker');
      const buff = element.querySelector('.reward-item-buff');
      const refund = element.querySelector('.reward-item-refund');
      const reserves = [element.querySelector('.reward-item-quantity'), element.querySelector('.reward-item-feedback')]
        .filter(Boolean).map(node => ({ node, original: node.style.minHeight || '', height: node.getBoundingClientRect().height }));
      return { element, metadata, quantity, ticker, buff, refund, buffHtml: buff?.innerHTML || '',
        refundVisibility: refund?.style.visibility || '', buffVisibility: buff?.style.visibility || '', reserves };
    });
    const group = `reward-dialog-${++revealId}`;
    const timers = new Set();
    let done = false;
    let observer;
    let controller;

    function stopAudio() { try { audio?.stopEffects?.(group); } catch {} }
    function cue(name) {
      try { Promise.resolve(audio?.playEffect?.(name, { group })).catch(() => {}); } catch {}
    }
    function hidden() {
      if (!overlay || overlay.isConnected === false || document?.hidden) return true;
      for (let element = overlay; element?.nodeType === 1; element = element.parentElement) {
        const style = view.getComputedStyle?.(element);
        if (element.hidden || style?.display === 'none' || style?.visibility === 'hidden') return true;
      }
      return false;
    }
    function cleanup(stop = true) {
      timers.forEach(timer => view.clearTimeout(timer));
      timers.clear();
      observer?.disconnect();
      document?.removeEventListener?.('visibilitychange', visibilityChanged);
      view.removeEventListener?.('pagehide', cancel);
      if (stop) stopAudio();
      if (activeReveals.get(overlay) === controller) activeReveals.delete(overlay);
    }
    function finalState() {
      for (const entry of entries) {
        entry.element.classList.remove('is-reward-pending', 'is-reward-revealing', 'is-skill-active', 'is-count-changing', 'is-refund-active');
        entry.element.dataset.revealState = 'complete';
        if (entry.quantity) entry.quantity.textContent = `×${entry.metadata.quantity}`;
        if (entry.ticker) delete entry.ticker.dataset.previousQuantity;
        if (entry.buff) { entry.buff.innerHTML = entry.buffHtml; entry.buff.style.visibility = entry.buffVisibility; }
        if (entry.refund) entry.refund.style.visibility = entry.refundVisibility;
        entry.reserves.forEach(({ node, original }) => { node.style.minHeight = original; });
      }
    }
    function complete(stopAudioNow) {
      if (done) return;
      done = true;
      cleanup(stopAudioNow);
      finalState();
      if (overlay) overlay.dataset.rewardRevealState = 'complete';
      onComplete?.();
    }
    function finish() { complete(true); }
    function cancel() {
      if (done) { stopAudio(); return; }
      done = true;
      cleanup();
      finalState();
      if (overlay) overlay.dataset.rewardRevealState = 'cancelled';
    }
    function visibilityChanged() {
      if (!overlay || overlay.isConnected === false) cancel();
      else if (hidden()) finish();
    }
    function apply(event) {
      if (done) return;
      if (hidden()) { visibilityChanged(); return; }
      const entry = entries[event.itemIndex];
      if (event.type === 'reveal') {
        entry.element.classList.remove('is-reward-pending');
        entry.element.classList.add('is-reward-revealing');
        entry.element.dataset.revealState = 'revealing';
        if (entry.buff && !entry.metadata.triggers.length) entry.buff.style.visibility = entry.buffVisibility;
        cue('rewardReveal');
      } else if (event.type === 'trigger') {
        entry.element.classList.add('is-skill-active');
        if (entry.buff) {
          entry.buff.style.visibility = entry.buffVisibility;
          entry.buff.textContent = `斧技发动 · 数量×${entry.metadata.triggers[event.triggerIndex].multiplier}`;
        }
        cue('skillTrigger');
      } else if (event.type === 'quantity') {
        if (entry.ticker) entry.ticker.dataset.previousQuantity = entry.quantity?.textContent || '';
        if (entry.quantity) entry.quantity.textContent = `×${event.quantity}`;
        entry.element.classList.add('is-count-changing');
        cue('rewardReveal');
      } else if (event.type === 'settle') {
        entry.element.classList.remove('is-skill-active', 'is-count-changing', 'is-refund-active');
        if (entry.ticker) delete entry.ticker.dataset.previousQuantity;
        if (entry.buff && event.triggerIndex === entry.metadata.triggers.length - 1) entry.buff.innerHTML = entry.buffHtml;
      } else if (event.type === 'refund-trigger') {
        entry.element.classList.add('is-skill-active');
        cue('skillTrigger');
      } else if (event.type === 'refund') {
        if (entry.refund) entry.refund.style.visibility = entry.refundVisibility;
        entry.element.classList.add('is-refund-active');
        cue('rewardReveal');
      } else if (event.type === 'complete-item') {
        entry.element.classList.remove('is-reward-revealing', 'is-refund-active');
        entry.element.dataset.revealState = 'complete';
      }
    }
    controller = { finish, cancel };
    if (overlay) activeReveals.set(overlay, controller);
    if (hidden()) { visibilityChanged(); return controller; }
    if (!entries.length || view.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { finish(); return controller; }
    overlay.dataset.rewardRevealState = 'running';
    for (const entry of entries) {
      entry.element.classList.add('is-reward-pending');
      entry.element.dataset.revealState = 'pending';
      entry.reserves.forEach(({ node, height }) => { node.style.minHeight = `${height}px`; });
      if (entry.quantity) entry.quantity.textContent = `×${entry.metadata.baseQuantity}`;
      if (entry.buff) entry.buff.style.visibility = 'hidden';
      if (entry.refund) entry.refund.style.visibility = 'hidden';
    }
    function schedule(callback, delay) {
      if (delay === 0) { callback(); return; }
      const timer = view.setTimeout(() => { timers.delete(timer); callback(); }, delay);
      timers.add(timer);
    }
    const plan = getRevealPlan(entries.map(entry => entry.metadata));
    for (const event of plan.events) schedule(() => apply(event), event.at);
    schedule(() => complete(false), plan.duration);
    const MutationObserver = view.MutationObserver;
    if (MutationObserver && document?.documentElement) {
      observer = new MutationObserver(visibilityChanged);
      observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'style', 'class'] });
    }
    document?.addEventListener?.('visibilitychange', visibilityChanged);
    view.addEventListener?.('pagehide', cancel);
    return controller;
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
      const metadata = getRewardMetadata(reward);
      const quantity = metadata.quantity;
      const icon = typeof renderIcon === 'function' && id
        ? renderIcon(id, definition.icon || '', 'reward-item-icon')
        : '<span class="reward-item-fallback" aria-hidden="true">物</span>';
      const buffCopy = metadata.triggers.length ? metadata.triggers.map(trigger => `×${trigger.multiplier}`).join(' · ') : reward.buffText;
      const buff = buffCopy ? `<div class="reward-item-buff">${metadata.triggers.length ? '斧技发动 · 数量' : '斧技触发 · '}${escape(buffCopy)}</div>` : '';
      const refundIcon = metadata.refund > 0 && typeof renderIcon === 'function' ? renderIcon('1', items['1']?.icon || '', 'reward-refund-icon') : '';
      const refund = metadata.refund > 0
        ? `<div class="reward-item-refund">${refundIcon}<span>返还 ${escape(metadata.refund)} 次砍树</span></div>` : '';
      return `<div class="reward-item reward-item--${size}" data-reward-item="${escape(id)}" data-reward-reveal="${escape(JSON.stringify(metadata))}">
        <div class="reward-art">
          <img class="reward-quality-ink" src="${ART_BASE}/quality-${rank}.webp?v=${ART_VERSION}" alt="" aria-hidden="true" decoding="async">
          <div class="reward-art-icon">${icon}</div>
        </div>
        <div class="reward-item-name quality-item-name quality-${rank}">${escape(name)}</div>
        <div class="reward-item-quantity"><span class="reward-item-quality">${escape(rankName)} · </span><span class="reward-quantity-ticker"><span class="reward-item-quantity-value">×${escape(quantity)}</span></span></div>
        <div class="reward-item-feedback">${buff}${refund}</div>
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
        ${renderRefundTotal([...regular, ...extra])}
      </div>`;
    }

    function renderRefundTotal(results) {
      const total = (Array.isArray(results) ? results : []).reduce((sum, reward) => sum + getRewardMetadata(reward).refund, 0);
      if (!total) return '';
      const icon = typeof renderIcon === 'function' ? renderIcon('1', items['1']?.icon || '', 'reward-refund-icon') : '';
      return `<div class="reward-refund-total" data-refund-total="${escape(total)}"><span>本次共返还</span>${icon}<b>×${escape(total)}</b></div>`;
    }

    return { renderItem, renderResults, renderRefundTotal };
  }

  const defaultRenderer = createRenderer();
  const api = { createRenderer, groupResults, getAssetUrls, getRewardMetadata, getRevealPlan, playReveal, ...defaultRenderer };
  root.RewardPresentation = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
