import bcrypt from 'bcryptjs';
import {
  createLocalUser,
  findOrCreateGoogleUser,
  findUserByEmail,
} from '../services/userService.js';
import { signToken } from '../middleware/auth.js';

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  };
}

export async function signup(req, res) {
  try {
    const { name, email, password } = req.body || {};

    if (!name?.trim() || !email?.trim() || !password) {
      return res
        .status(400)
        .json({ message: 'Name, email and password are required.' });
    }

    if (name.trim().length < 2) {
      return res.status(400).json({ message: 'Please enter your full name.' });
    }

    if (password.length < 8) {
      return res
        .status(400)
        .json({ message: 'Password must be at least 8 characters long.' });
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailPattern.test(email.trim())) {
      return res.status(400).json({ message: 'Please enter a valid email address.' });
    }

    const user = await createLocalUser({ name, email, password });

    return res.status(201).json({
      message: 'Account created successfully. Please sign in.',
      user: publicUser(user),
    });
  } catch (error) {
    if (error.code === '23505') {
      return res
        .status(409)
        .json({ message: 'An account with this email already exists.' });
    }

    return res.status(500).json({ message: error.message });
  }
}

export async function login(req, res) {
  try {
    const { email, password } = req.body || {};

    if (!email?.trim() || !password) {
      return res
        .status(400)
        .json({ message: 'Email and password are required.' });
    }

    const user = await findUserByEmail(email);

    if (!user || !user.password_hash) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const passwordMatches = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatches) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    return res.json({
      token: signToken(user),
      user: publicUser(user),
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

export async function me(req, res) {
  return res.json({ user: req.user });
}

export async function googleCallback(req, res) {
  try {
    const user = await findOrCreateGoogleUser(req.user);
    const token = signToken(user);

    return res.redirect(
      `${process.env.FRONTEND_URL || 'http://localhost:5174'}/oauth-callback?token=${encodeURIComponent(token)}`
    );
  } catch (error) {
    return res.redirect(
      `${process.env.FRONTEND_URL || 'http://localhost:5174'}/login?error=${encodeURIComponent(error.message)}`
    );
  }
}
