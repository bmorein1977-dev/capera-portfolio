import 'dotenv/config';
import { pool } from '../db.js';
import fs from 'fs';
import path from 'path';
import url from 'url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

async function main() {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await pool.query(sql);
  console.log('Migration complete.');
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
