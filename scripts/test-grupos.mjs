import assert from 'node:assert/strict';
import { isGroupChat, isGroupChatId, isGroupMessage } from '../src/groupPolicy.js';

assert.equal(isGroupChatId('120363123456789000@g.us'), true);
assert.equal(isGroupChatId('5547999990000@c.us'), false);
assert.equal(isGroupChatId('244671418761243@lid'), false);

assert.equal(isGroupChat({ isGroup: true, id: { _serialized: '5547999990000@c.us' } }), true);
assert.equal(isGroupChat({ isGroup: false, id: { _serialized: '120363123456789000@g.us' } }), true);
assert.equal(isGroupChat({ isGroup: false, id: { _serialized: '5547999990000@c.us' } }), false);

assert.equal(isGroupMessage({ from: '120363123456789000@g.us' }), true);
assert.equal(isGroupMessage({ id: { remote: '120363123456789000@g.us' } }), true);
assert.equal(isGroupMessage({ id: { _serialized: 'false_120363123456789000@g.us_ABC' } }), true);
assert.equal(isGroupMessage({ from: '5547999990000@c.us', id: { remote: '5547999990000@c.us' } }), false);

console.log('Politica de grupos conferida.');
