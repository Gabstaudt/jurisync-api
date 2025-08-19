import { Pool } from "pg";

declare global { var __pgPool: Pool | undefined; }

export const pool =
  global.__pgPool ?? new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.COCKROACH_CA_CERT ? { ca: process.env.COCKROACH_CA_CERT } : true,
  });

if (!global.__pgPool) global.__pgPool = pool;

export const q = <T = any>(sql: string, params: any[] = []) => pool.query<T>(sql, params);
