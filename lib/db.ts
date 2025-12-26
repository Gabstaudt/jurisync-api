import { Pool } from "pg";

declare global {
  // eslint-disable-next-line no-var
  var __pgPool: Pool | undefined;
}

function buildSsl() {
  // Se explicitamente desligado
  if (
    process.env.DATABASE_SSL === "disable" ||
    process.env.DATABASE_SSL === "false"
  ) {
    return false;
  }

  // Caso exista CA customizado (ex.: Cockroach)
  if (process.env.COCKROACH_CA_CERT) {
    return { ca: process.env.COCKROACH_CA_CERT };
  }

  return { rejectUnauthorized: false };
}

export const pool =
  global.__pgPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: buildSsl(),
  });

if (!global.__pgPool) global.__pgPool = pool;

// função helper de query (sem genéricos para evitar erro TS)
export const q = (sql: string, params: any[] = []) => pool.query(sql, params);
