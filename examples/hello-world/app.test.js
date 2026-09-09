import { test } from 'node:test';
import assert from 'node:assert/strict';
import { greet } from './src/greeter.js';
test('greeting contract', () => {
  assert.equal(greet(' Ada '), 'Hello, Ada!');
  assert.equal(greet('  '), 'Hello, world!');
  assert.equal(greet(), 'Hello, world!');
  assert.equal(greet('Ada','formal'), 'Good day, Ada.');
  assert.throws(() => greet('Ada','pirate'), /Unsupported tone/);
});
