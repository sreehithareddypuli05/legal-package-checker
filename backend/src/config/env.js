import dotenv from 'dotenv';
dotenv.config();
export const env = { port: Number(process.env.PORT || 5000), corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173' };
