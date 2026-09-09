import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { env } from './config/env.js';
import { pool, query } from './config/db.js';
import authRoutes from './routes/authRoutes.js';
import inspectionRoutes from './routes/inspectionRoutes.js';

const app = express();

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || env.corsOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error(`CORS blocked origin: ${origin}`));
    },
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.resolve('uploads')));

if (env.googleClientId && env.googleClientSecret) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: env.googleClientId,
        clientSecret: env.googleClientSecret,
        callbackURL: env.googleCallbackUrl,
      },
      (accessToken, refreshToken, profile, done) => done(null, profile)
    )
  );
}

app.use(passport.initialize());

app.get('/api/health', async (_req, res) => {
  res.json({
    status: 'ok',
    service: 'legal-metrology-backend',
    phase: '2',
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/inspections', inspectionRoutes);

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({
    message: error.message || 'Internal server error',
  });
});

async function bootstrap() {
  if (!pool) {
    throw new Error('DATABASE_URL is missing. Configure backend/.env first.');
  }

  const schema = fs.readFileSync(
    new URL('./config/schema.sql', import.meta.url),
    'utf8'
  );

  await query(schema);

  console.log('Database ready.');

  app.listen(env.port, () => {
    console.log(`Legal Metrology backend running on http://localhost:${env.port}`);
  });
}

bootstrap().catch((error) => {
  console.error('Startup failed:', error);
  process.exit(1);
});
