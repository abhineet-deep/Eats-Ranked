import fs from 'node:fs';
import path from 'node:path';

/** Writes JSON via a temp file + rename so a crash can never leave a half-written file. */
export function atomicWriteJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(data, null, 2)}\n`);
  fs.renameSync(tmp, file);
}
