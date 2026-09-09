import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { query } from '../config/db.js';

export async function findUserByEmail(email) {
  const result = await query(
    'SELECT * FROM users WHERE LOWER(email) = LOWER($1)',
    [email.trim()]
  );

  return result.rows[0] || null;
}

export async function findUserById(id) {
  const result = await query(
    'SELECT id, name, email, role, created_at FROM users WHERE id = $1',
    [id]
  );

  return result.rows[0] || null;
}

export async function createLocalUser({ name, email, password }) {
  const existing = await findUserByEmail(email);

  if (existing) {
    throw new Error('An account with this email already exists. Please sign in.');
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const id = crypto.randomUUID();

  const result = await query(
    `INSERT INTO users (id, name, email, password_hash, role)
     VALUES ($1, $2, $3, $4, 'INSPECTOR')
     RETURNING id, name, email, role, created_at`,
    [id, name.trim(), email.trim().toLowerCase(), passwordHash]
  );

  return result.rows[0];
}

export async function findOrCreateGoogleUser(profile) {
  const googleId = profile.id;
  const email = profile.emails?.[0]?.value;
  const name = profile.displayName || 'Google User';

  if (!email) {
    throw new Error('Google account did not provide an email address.');
  }

  const existing = await query(
    'SELECT * FROM users WHERE google_id = $1 OR LOWER(email) = LOWER($2)',
    [googleId, email]
  );

  if (existing.rows[0]) {
    const user = existing.rows[0];

    if (!user.google_id) {
      await query('UPDATE users SET google_id = $1 WHERE id = $2', [
        googleId,
        user.id,
      ]);
      user.google_id = googleId;
    }

    return user;
  }

  const id = crypto.randomUUID();
  const result = await query(
    `INSERT INTO users (id, name, email, google_id, role)
     VALUES ($1, $2, $3, $4, 'INSPECTOR')
     RETURNING *`,
    [id, name, email.toLowerCase(), googleId]
  );

  return result.rows[0];
}
