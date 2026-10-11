import { Hono } from 'hono';
import { Bindings, Variables } from '../db';
import { jwtMiddleware } from '../middleware/jwt';
import { systemBackups } from 'database';
import { eq, desc, asc } from 'drizzle-orm';

const adminBackupRouter = new Hono<{ Bindings: Bindings; Variables: Variables }>();

adminBackupRouter.use('*', jwtMiddleware);

// 1. Create a full backup
adminBackupRouter.post('/create', async (c) => {
  const db = c.get('db');
  const user = c.get('user');

  if (user.role !== 'SUPER_ADMIN') {
    return c.json({ success: false, error: 'Unauthorized' }, 403);
  }

  try {
    // 1. Generate full database logical dump (JSON)
    // Get all tables
    const tablesQuery = await c.env.DB.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name != 'system_backups'`).all();
    
    if (!tablesQuery.success) {
      throw new Error("Failed to fetch tables from database");
    }

    const tables = tablesQuery.results as { name: string }[];
    const backupData: Record<string, any[]> = {};

    // Dump each table
    for (const table of tables) {
      const rows = await c.env.DB.prepare(`SELECT * FROM ${table.name}`).all();
      if (rows.success) {
        backupData[table.name] = rows.results;
      }
    }

    const backupJsonString = JSON.stringify(backupData);
    const sizeBytes = new Blob([backupJsonString]).size;
    const backupId = `BKP-${Date.now()}`;
    const filename = `backup_ethsltd_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    const now = new Date();

    let storedInR2 = false;
    let r2Error = null;

    // 2. Upload to R2 if available
    if (c.env.R2_BACKUPS) {
      try {
        await c.env.R2_BACKUPS.put(filename, backupJsonString, {
          httpMetadata: { contentType: 'application/json' }
        });
        storedInR2 = true;

        // 3. Enforce retention policy (Max 3 in R2)
        const existingR2Backups = await db.select()
          .from(systemBackups)
          .where(eq(systemBackups.storedInR2, true))
          .orderBy(asc(systemBackups.createdAt))
          .all();

        // If we now have more than 3 (including the one we just uploaded), delete oldest
        // Actually, the one we just uploaded isn't in the DB yet. 
        // So if there are 3 existing, we need to delete 1 to make room for this new one, making it 3 total.
        if (existingR2Backups.length >= 3) {
          const backupsToDelete = existingR2Backups.slice(0, existingR2Backups.length - 2); // Keep the 2 newest, plus the 1 we just added = 3
          for (const bkp of backupsToDelete) {
            try {
              await c.env.R2_BACKUPS.delete(bkp.filename);
              // Update DB to reflect it's no longer in R2, but keep history
              await db.update(systemBackups)
                .set({ storedInR2: false })
                .where(eq(systemBackups.id, bkp.id));
            } catch (delErr) {
              console.error("Failed to delete old backup from R2:", delErr);
            }
          }
        }
      } catch (err: any) {
        console.error("R2 Upload failed:", err);
        r2Error = err.message;
        storedInR2 = false;
      }
    } else {
      r2Error = "R2_BACKUPS binding is not configured in wrangler.toml or environment.";
    }

    // 4. Record history in Database
    await db.insert(systemBackups).values({
      id: backupId,
      filename,
      type: 'FULL',
      sizeBytes,
      storedInR2,
      status: storedInR2 ? 'SUCCESS' : 'LOCAL_ONLY',
      errorDetails: r2Error,
      createdBy: user.id,
      createdAt: now,
    });

    // 5. Return JSON payload for immediate local download
    return c.json({
      success: true,
      message: storedInR2 ? 'Backup created and stored in R2 successfully.' : 'Backup generated for local download only. R2 storage unavailable.',
      metadata: {
        id: backupId,
        filename,
        sizeBytes,
        storedInR2,
        status: storedInR2 ? 'SUCCESS' : 'LOCAL_ONLY'
      },
      data: backupJsonString
    });

  } catch (error: any) {
    console.error('Backup creation error:', error);
    return c.json({ success: false, error: 'Failed to create backup: ' + error.message }, 500);
  }
});


// 2. List Backup History
adminBackupRouter.get('/list', async (c) => {
  const db = c.get('db');
  const user = c.get('user');

  if (user.role !== 'SUPER_ADMIN') {
    return c.json({ success: false, error: 'Unauthorized' }, 403);
  }

  try {
    const history = await db.select().from(systemBackups).orderBy(desc(systemBackups.createdAt)).all();
    return c.json({ success: true, data: history });
  } catch (error: any) {
    console.error('Backup list error:', error);
    return c.json({ success: false, error: 'Failed to fetch backup history' }, 500);
  }
});


// 3. Download from R2
adminBackupRouter.get('/download/:filename', async (c) => {
  const user = c.get('user');

  if (user.role !== 'SUPER_ADMIN') {
    return c.json({ success: false, error: 'Unauthorized' }, 403);
  }

  const filename = c.req.param('filename');

  if (!c.env.R2_BACKUPS) {
    return c.json({ success: false, error: 'R2 storage is not configured' }, 400);
  }

  try {
    const object = await c.env.R2_BACKUPS.get(filename);
    if (!object) {
      return c.json({ success: false, error: 'Backup file not found in R2' }, 404);
    }

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set('etag', object.httpEtag);
    headers.set('Content-Disposition', `attachment; filename="${filename}"`);
    
    return new Response(object.body, { headers });
  } catch (error: any) {
    console.error('Backup download error:', error);
    return c.json({ success: false, error: 'Failed to download backup' }, 500);
  }
});


// 4. Restore Backup
adminBackupRouter.post('/restore', async (c) => {
  const user = c.get('user');

  if (user.role !== 'SUPER_ADMIN') {
    return c.json({ success: false, error: 'Unauthorized' }, 403);
  }

  try {
    const body = await c.req.json();
    const backupJsonString = body.backupData;

    if (!backupJsonString) {
      return c.json({ success: false, error: 'No backup data provided' }, 400);
    }

    const backupData = JSON.parse(backupJsonString);

    if (typeof backupData !== 'object' || Array.isArray(backupData)) {
      return c.json({ success: false, error: 'Invalid backup format' }, 400);
    }

    const tables = Object.keys(backupData);
    if (tables.length === 0) {
      return c.json({ success: false, error: 'Backup is empty' }, 400);
    }

    // Since we are running on D1, restoring a full DB requires dropping existing data
    // and re-inserting. D1 supports batch statements. We will generate a massive batch array.
    // WARNING: For large DBs, this can exceed Cloudflare's 1MB limits or timeout.
    // We will batch them in chunks of 50 statements.

    const statements: D1PreparedStatement[] = [];

    // Create delete statements to clear current data (except system_backups)
    for (const table of tables) {
      if (table !== 'system_backups' && !table.startsWith('sqlite_')) {
        statements.push(c.env.DB.prepare(`DELETE FROM ${table}`));
      }
    }

    // Create insert statements
    for (const table of tables) {
      if (table === 'system_backups' || table.startsWith('sqlite_')) continue;
      
      const rows = backupData[table];
      if (!Array.isArray(rows) || rows.length === 0) continue;

      const columns = Object.keys(rows[0]);
      if (columns.length === 0) continue;

      const placeholders = columns.map(() => '?').join(', ');
      const query = `INSERT INTO ${table} (${columns.map(c => `"${c}"`).join(', ')}) VALUES (${placeholders})`;

      for (const row of rows) {
        const values = columns.map(col => row[col]);
        statements.push(c.env.DB.prepare(query).bind(...values));
      }
    }

    // Execute in batches of 50 to avoid D1 limits
    const BATCH_SIZE = 50;
    for (let i = 0; i < statements.length; i += BATCH_SIZE) {
      const batch = statements.slice(i, i + BATCH_SIZE);
      await c.env.DB.batch(batch);
    }

    return c.json({ success: true, message: 'Database restored successfully' });

  } catch (error: any) {
    console.error('Backup restore error:', error);
    return c.json({ success: false, error: 'Failed to restore backup: ' + error.message }, 500);
  }
});

export default adminBackupRouter;
