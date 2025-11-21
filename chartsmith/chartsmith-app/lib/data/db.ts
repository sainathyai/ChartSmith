import { Pool, PoolConfig } from "pg";

let pool: Pool | null = null;

export function getDB(uri: string): Pool {
  if (pool) {
    return pool;
  }

  // Use WHATWG URL API instead of deprecated url.parse()
  const url = new URL(uri);
  const auth = url.username && url.password 
    ? [url.username, url.password]
    : url.username 
      ? [url.username, ""]
      : [];

  let ssl: boolean | { rejectUnauthorized: boolean } = {
    rejectUnauthorized: false,
  };
  
  // Parse query string from URL.searchParams
  if (url.searchParams.get("sslmode") === "disable") {
    ssl = false;
  }

  const config: PoolConfig = {
    user: auth[0] || undefined,
    password: auth[1] || undefined,
    host: url.hostname || "",
    port: url.port ? parseInt(url.port) : 5432,
    database: url.pathname?.split("/").filter(Boolean)[0] || "",
    ssl,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  };

  pool = new Pool(config);

  return pool;
}
