import { drizzle, DrizzleD1Database } from 'drizzle-orm/d1';
import * as schema from 'database'; // This imports from our database package

export type Bindings = {
  DB: D1Database;
  CREGIS_WAAS_API_KEY: string;
  CREGIS_WAAS_PROJECT_ID: string;
  CREGIS_BASE_URL: string;
  CREGIS_PE_API_KEY: string;
  CREGIS_PE_PROJECT_ID: string;
  CREGIS_PROXY_URL?: string;
  CREGIS_PROXY_SECRET?: string;
  BREVO_API_KEY?: string;
  CLOUDFLARE_API_KEY?: string;
  CLOUDFLARE_ZONE_ID?: string;
  CLOUDFLARE_EMAIL?: string;
  R2_BACKUPS?: R2Bucket;
  JWT_SECRET?: string;
  MT5_API_KEY?: string;
  MT5_SERVER_ID?: string;
};

export type Variables = {
  db: DrizzleD1Database<typeof schema>;
  user: any; // we will define a proper user type later
};

export const createDb = (d1: D1Database) => {
  const db = drizzle(d1, { schema });
  
  const originalTx = db.transaction.bind(db);
  // @ts-ignore - Patching transaction to fallback if D1 fails
  db.transaction = async (cb: any) => {
    try {
      return await originalTx(cb);
    } catch (e: any) {
      if (e.message && e.message.toLowerCase().includes('begin')) {
        console.warn('D1 transaction begin failed, falling back to sequential execution');
        return await cb(db);
      }
      throw e;
    }
  };
  
  return db;
};
