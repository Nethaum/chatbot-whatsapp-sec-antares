import assert from 'node:assert/strict';
import { extractPhoneCandidates } from '../src/phoneCandidates.js';

assert.deepEqual(extractPhoneCandidates('244671418761243'), []);
assert.deepEqual(extractPhoneCandidates('244671418761243@lid'), []);
assert.deepEqual(extractPhoneCandidates('+55 47 98890-6757'), ['5547988906757']);
assert.deepEqual(extractPhoneCandidates('47 8890-6757'), ['4788906757']);
assert.deepEqual(extractPhoneCandidates('88906757'), []);

console.log('Candidatos de telefone conferidos.');
