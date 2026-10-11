import { Database } from 'better-sqlite3';
import DatabaseConstructor from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';

const stateDir = path.resolve('.wrangler/state/v3/d1/miniflare-D1DatabaseObject');

// Find the sqlite file in the directory
const files = fs.readdirSync(stateDir);
const sqliteFile = files.find(f => f.endsWith('.sqlite'));

if (!sqliteFile) {
  console.error('No database file found.');
  process.exit(1);
}

const dbPath = path.join(stateDir, sqliteFile);
console.log(`Connecting to ${dbPath}`);

const db: Database = new DatabaseConstructor(dbPath);

console.log('Upgrading users to ADMIN...');
const info = db.prepare(`UPDATE users SET role = 'ADMIN'`).run();
console.log(`Updated ${info.changes} users to ADMIN role.`);
