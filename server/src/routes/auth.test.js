import test from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';

process.env.NODE_ENV = 'test';
process.env.RENDER = 'false';
process.env.MONGODB_URI = ' ';
process.env.ALLOW_MEMORY_STORAGE = 'true';

const [
  { createApp },
  { createUser, memorySnapshot },
] = await Promise.all([
  import('../app.js'),
  import('../services/store.js'),
]);

test('account creation and login accept phone or email channels but never username authentication', async (t) => {
  const memory = memorySnapshot();
  for (const collection of Object.values(memory)) collection.clear();
  t.after(() => {
    for (const collection of Object.values(memory)) collection.clear();
  });

  await createUser({
    fullName: 'Auth Person',
    username: 'authperson',
    email: 'auth@example.com',
    verifiedEmail: true,
    passwordHash: await bcrypt.hash('password123', 4),
    gender: 'transgender',
  });

  const app = createApp();
  const server = await new Promise((resolve, reject) => {
    const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
    listening.once('error', reject);
  });
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const url = `http://127.0.0.1:${server.address().port}/api/auth`;
  const post = async (path, body) => {
    const response = await fetch(`${url}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return { response, payload: await response.json() };
  };

  const usernameLogin = await post('/login', { identifier: '@authperson', password: 'password123' });
  assert.equal(usernameLogin.response.status, 422);
  assert.equal(usernameLogin.payload.error.code, 'PHONE_OR_EMAIL_REQUIRED');

  const emailLogin = await post('/login', { identifier: 'AUTH@EXAMPLE.COM', password: 'password123' });
  assert.equal(emailLogin.response.status, 200);
  assert.equal(emailLogin.payload.user.username, 'authperson');

  const usernameSignup = await post('/signup', {
    fullName: 'Old Client',
    username: 'oldclient',
    method: 'username',
    gender: 'other',
    password: 'password123',
    confirmPassword: 'password123',
  });
  assert.equal(usernameSignup.response.status, 422);
  assert.equal(usernameSignup.payload.error.code, 'INVALID_SIGNUP_METHOD');
});
