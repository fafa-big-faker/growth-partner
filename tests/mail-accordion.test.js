const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, '..', 'styles.css'), 'utf8');

test('both mail entry points use one inline accordion renderer', () => {
  assert.match(app, /_renderMailAccordion\('modal'\)/);
  assert.match(app, /_renderMailAccordion\('page'\)/);
  assert.match(app, /_mailSurfaces:[\s\S]*expandedId/);
  assert.match(app, /class="mail-expanded"/);
  assert.match(app, /aria-expanded="\$\{expanded \? 'true' : 'false'\}"/);
  assert.match(app, /PlayerView\.toggleMail\('\$\{mail\.id\}', '\$\{surface\}'\)/);
});

test('opening mail no longer launches a second detail modal', () => {
  assert.doesNotMatch(app, /async openMail\(mailId\)/);
  assert.doesNotMatch(app, /PlayerView\.openMail\(/);
  assert.match(app, /async toggleMail\(mailId, surface\)/);
  assert.match(app, /await DB\.markMailRead\(mailId\)/);
});

test('mail actions refresh only their active accordion surface', () => {
  const claim = app.match(/async claimMailReward\(mailId, surface, button\)[\s\S]*?\n  },/)?.[0] || '';
  assert.match(app, /async claimMailReward\(mailId, surface, button\)/);
  assert.match(app, /_refreshMailSurface\(surface, mailId\)/);
  assert.match(app, /async deleteMail\(mailId, surface, button\)/);
  assert.match(app, /_refreshMailSurface\(surface, null\)/);
  assert.doesNotMatch(claim, /document\.querySelectorAll\('\.modal-overlay'\)/);
});

test('mail dates and database mutations are account scoped', () => {
  assert.match(app, /GameDateTime\.formatShanghaiDate\(mail\.createdAt\)/);
  for (const method of ['markMailRead', 'claimMail', 'deleteMail']) {
    const block = app.match(new RegExp(`async ${method}\\(id\\)[\\s\\S]*?\\n  },`))?.[0] || '';
    assert.match(block, /\.eq\('user_role', this\.playerRole\)/, `${method} must be scoped to the active account`);
  }
});

test('accordion styles keep content readable and actions responsive', () => {
  assert.match(css, /\.mail-summary[\s\S]*:focus-visible/);
  assert.match(css, /\.mail-expanded[\s\S]*white-space:\s*pre-wrap/);
  assert.match(css, /\.mail-attachments[\s\S]*flex-wrap:\s*wrap/);
});
