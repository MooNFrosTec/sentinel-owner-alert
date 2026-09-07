require('../custom-severity.js');

const assert = require('node:assert/strict');
const severity = globalThis.SentinelOwnerAlertSeverity;

assert.equal(severity.isCustomCritical('High', 'High Incident A Severity:Critical New'), true);
assert.equal(severity.isCustomCritical('High', 'High Incident A Severity : Critical New'), true);
assert.equal(severity.isCustomCritical('Critical', 'Critical Incident A'), false);
assert.equal(severity.isCustomCritical('High', 'High Incident A Severity:Medium'), false);
assert.equal(severity.isCustomCritical('Medium', 'Medium Incident A Severity:Critical'), false);
assert.equal(severity.stripCustomCriticalTag('High Severity:Critical Incident A').trim(), 'High   Incident A');

console.log('Custom severity detection tests passed.');
