import { Router } from 'express';
import passport from 'passport';
import {
  googleCallback,
  login,
  me,
  signup,
} from '../controllers/authController.js';
import { env } from '../config/env.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.post('/signup', signup);
router.post('/login', login);
router.get('/me', requireAuth, me);

router.get('/google', (req, res, next) => {
  if (!env.googleClientId || !env.googleClientSecret) {
    return res.redirect(
      `${env.frontendUrl}/login?error=Google%20login%20is%20not%20configured%20yet`
    );
  }

  return passport.authenticate('google', {
    scope: ['profile', 'email'],
    session: false,
  })(req, res, next);
});

router.get(
  '/google/callback',
  passport.authenticate('google', {
    session: false,
    failureRedirect: '/api/auth/google/failure',
  }),
  googleCallback
);

router.get('/google/failure', (req, res) => {
  res.redirect(
    `${env.frontendUrl}/login?error=Google%20authentication%20failed`
  );
});

export default router;
