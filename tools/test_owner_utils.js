require('../owner-utils.js');

const assert = require('node:assert/strict');
const owner = globalThis.SentinelOwnerAlertOwner;

assert.equal(owner.matches('SOC José', 'SOC José'), true);
assert.equal(owner.matches('SOC Jose\u0301', 'SOC José'), true);
assert.equal(owner.matches('SOC_José', 'SOC José'), true);
assert.equal(owner.matches('SOC-Tier-1', 'SOC_Tier_1'), true);
assert.equal(owner.matches('SOC José', 'SOC_Tier_1'), false);
assert.equal(owner.matches('Moneta', ''), false);
assert.equal(owner.contains('Low demo-workspace Test incident SOC Jose\u0301 Active', 'SOC José'), true);
assert.equal(owner.contains('Medium demo-workspace Incident Customer New', 'SOC José'), false);
assert.equal(owner.contains('anything', ''), false);

console.log('Owner normalization tests passed.');
