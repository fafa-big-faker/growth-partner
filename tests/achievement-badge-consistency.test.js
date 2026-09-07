const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');

test('achievement progress compares normalized claim identifiers', () => {
  const progress = app.match(/getAchievementProgress\(\)[\s\S]*?\n  },/)?.[0] || '';
  assert.match(progress, /new Set\([\s\S]*\.map\(String\)/);
  assert.match(progress, /claims\.has\(String\(a\.achievementId\)\)/);
  assert.doesNotMatch(progress, /claims\.includes\(a\.achievementId\)/);
});

test('achievement claiming stores and reserves one normalized identifier type', () => {
  const claim = app.match(/async claimAchievement\(achievementId\)[\s\S]*?\n  },/)?.[0] || '';
  assert.match(claim, /const normalizedId = String\(achievementId\)/);
  assert.match(claim, /reservePlayerClaim\('achievement', normalizedId\)/);
  assert.match(claim, /achievementClaims[\s\S]*normalizedId/);
});

test('badge visibility is computed even while its DOM node is absent', () => {
  const badge = app.match(/\n  _updateAchBadge\(\) \{[\s\S]*?\n  },/)?.[0] || '';
  const computeAt = badge.indexOf('Game.hasClaimableAchievements()');
  const queryAt = badge.indexOf("document.getElementById('ach-dot')");
  assert.ok(computeAt >= 0 && queryAt >= 0 && computeAt < queryAt);
  assert.match(badge, /_achievementBadgeVisible/);
  assert.match(badge, /dot\.style\.display/);
});

test('inventory and progress mutations share the achievement badge refresh', () => {
  const inventorySync = app.match(/\n  _applyInventoryChanges\(changes\) \{[\s\S]*?\n  },/)?.[0] || '';
  const cultivateStats = app.match(/\n  _updateCultivateStats\(\) \{[\s\S]*?\n  },/)?.[0] || '';
  assert.match(inventorySync, /UI\._updateAchBadge/);
  assert.match(cultivateStats, /this\._updateAchBadge/);
});
