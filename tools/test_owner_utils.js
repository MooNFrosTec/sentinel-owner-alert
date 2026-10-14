require('../owner-utils.js');

const assert = require('node:assert/strict');
const owner = globalThis.SentinelOwnerAlertOwner;

assert.equal(owner.matches('SOC Ivo Szűcs', 'SOC Ivo Szűcs'), true);
assert.equal(owner.matches('SOC Ivo Szu\u030Bcs', 'SOC Ivo Szűcs'), true);
assert.equal(owner.matches('SOC_Ivo_Szűcs', 'SOC Ivo Szűcs'), true);
assert.equal(owner.matches('SOC-Tier-1', 'SOC_Tier_1'), true);
assert.equal(owner.matches('SOC Ivo Szűcs', 'SOC_Tier_1'), false);
assert.equal(owner.matches('Moneta', ''), false);

console.log('Owner normalization tests passed.');
