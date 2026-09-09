import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { findUserById } from '../services/userService.js';

export function signToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      role: user.role,
    },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn }
  );
}

export async function requireAuth(req, res, next) {
  try {
    const authorization = req.headers.authorization || '';

    if (!authorization.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Authentication required.' });
    }

    const token = authorization.slice(7);
    const payload = jwt.verify(token, env.jwtSecret);
    const user = await findUserById(payload.sub);

    if (!user) {
      return res.status(401).json({ message: 'User account was not found.' });
    }

    req.user = user;
    return next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired token.' });
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user?.role)) {
      return res.status(403).json({ message: 'Insufficient permissions.' });
    }

    return next();
  };
}
