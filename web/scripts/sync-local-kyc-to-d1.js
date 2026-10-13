const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const CHUNK_SIZE = 60000;
const storageDir = path.join(__dirname, '..', 'storage', 'kyc');

if (!fs.existsSync(storageDir)) {
  console.log('No local storage dir found.');
  process.exit(0);
}

const files = fs.readdirSync(storageDir);
console.log(`Found ${files.length} files in ${storageDir}`);

const mimeMap = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.pdf': 'application/pdf',
};

const sqlStatements = [];
const now = Math.floor(Date.now() / 1000);

for (const file of files) {
  if (file === '.gitkeep') continue;
  const filePath = path.join(storageDir, file);
  const buffer = fs.readFileSync(filePath);
  const base64 = buffer.toString('base64');
  const ext = path.extname(file).toLowerCase();
  const mimeType = mimeMap[ext] || 'application/octet-stream';

  // Parse user_id and side from filename: kyc_{userId}_{side}_{timestamp}_{uniqueId}{ext}
  const parts = file.split('_');
  const userId = parts[1] || 'unknown';
  const side = parts[2] || 'doc';

  const chunks = [];
  for (let i = 0; i < base64.length; i += CHUNK_SIZE) {
    chunks.push(base64.slice(i, i + CHUNK_SIZE));
  }

  for (let i = 0; i < chunks.length; i++) {
    const id = `${file}_chunk_${i}`;
    const chunkData = chunks[i].replace(/'/g, "''"); // escape single quotes for SQL
    sqlStatements.push(
      `INSERT OR REPLACE INTO kyc_documents (id, filename, user_id, side, mime_type, file_size, chunk_index, total_chunks, data, created_at) VALUES ('${id}', '${file}', '${userId}', '${side}', '${mimeType}', ${buffer.length}, ${i}, ${chunks.length}, '${chunkData}', ${now});`
    );
  }
}

console.log(`Generated ${sqlStatements.length} SQL insert statements.`);
const sqlFilePath = path.join(__dirname, 'temp_kyc_sync.sql');
fs.writeFileSync(sqlFilePath, sqlStatements.join('\n'));

console.log('Executing on remote D1 ethsltd-new...');
try {
  execSync(`npx wrangler d1 execute ethsltd-new --remote --file="${sqlFilePath}"`, {
    cwd: path.join(__dirname, '..', '..', 'api'),
    stdio: 'inherit'
  });
  console.log('KYC documents successfully synced to remote D1!');
} catch (e) {
  console.error('Failed to sync KYC documents to D1:', e.message);
} finally {
  if (fs.existsSync(sqlFilePath)) {
    fs.unlinkSync(sqlFilePath);
  }
}
