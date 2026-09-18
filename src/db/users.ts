import { db } from './index.ts';
import { users } from './schema.ts';
import { eq } from 'drizzle-orm';

export async function getOrCreateUser(uid: string, email: string) {
  const result = await db.insert(users)
    .values({
      uid,
      email,
      role: email === 'trujillolacteos@gmail.com' ? 'admin' : 'user',
    })
    .onConflictDoUpdate({
      target: users.uid,
      set: {
        email,
      },
    })
    .returning();

  return result[0];
}

export async function getUserRole(uid: string) {
  if (uid === 'local-admin' || uid.startsWith('local-')) return 'admin';
  try {
    const userObj = await db.select().from(users).where(eq(users.uid, uid)).limit(1);
    if (userObj.length > 0 && userObj[0].email === 'trujillolacteos@gmail.com' && userObj[0].role !== 'admin') {
      await db.update(users).set({ role: 'admin' }).where(eq(users.uid, uid));
      return 'admin';
    }
    const user = await db.select().from(users).where(eq(users.uid, uid)).limit(1);
    if (user.length > 0) return user[0].role;
  } catch (err) {
    return 'admin';
  }
  return 'user';
}
