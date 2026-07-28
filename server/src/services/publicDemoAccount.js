import bcrypt from 'bcryptjs';
import { createUser, findUserByIdentifier } from './store.js';

const publicDemoAccount = Object.freeze({
  fullName: 'Demo Social Media Mother',
  username: 'demosocialmediamother',
  email: 'demosocialmediamother@gmail.com',
  password: 'demo1234',
  gender: 'other'
});

const isExpectedDemoAccount = (user) => (
  user?.username === publicDemoAccount.username
  && user?.email === publicDemoAccount.email
);

export const ensurePublicDemoAccount = async () => {
  const [byEmail, byUsername] = await Promise.all([
    findUserByIdentifier(publicDemoAccount.email),
    findUserByIdentifier(publicDemoAccount.username)
  ]);

  if (byEmail || byUsername) {
    if (isExpectedDemoAccount(byEmail || byUsername)
      && (!byEmail || !byUsername || String(byEmail.id) === String(byUsername.id))) {
      return { created: false, username: publicDemoAccount.username };
    }
    throw new Error('Public demo account email or username is already used by another account');
  }

  const passwordHash = await bcrypt.hash(publicDemoAccount.password, 12);
  try {
    await createUser({
      fullName: publicDemoAccount.fullName,
      username: publicDemoAccount.username,
      email: publicDemoAccount.email,
      verifiedEmail: true,
      verifiedPhone: false,
      gender: publicDemoAccount.gender,
      passwordHash
    });
    return { created: true, username: publicDemoAccount.username };
  } catch (error) {
    if (error?.code !== 11000) throw error;
    const existing = await findUserByIdentifier(publicDemoAccount.email);
    if (!isExpectedDemoAccount(existing)) throw error;
    return { created: false, username: publicDemoAccount.username };
  }
};
