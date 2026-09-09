import pg from 'pg';
import {env} from './env.js';
const {Pool}=pg;
export const pool=env.databaseUrl?new Pool({connectionString:env.databaseUrl}):null;
export async function query(text,params=[]){if(!pool) throw new Error('DATABASE_URL is not configured'); return pool.query(text,params);}
