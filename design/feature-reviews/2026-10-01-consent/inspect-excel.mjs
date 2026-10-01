import fs from 'node:fs/promises';
import { readSheet } from 'read-excel-file/node';
const ev = 'design/feature-reviews/2026-10-01-consent/evidence';
const result = {};
for (const name of ['demo-responses.xlsx', 'remote-fixture-responses.xlsx']) {
    const rows = await readSheet(ev + '/' + name);
    result[name] = { rows: rows.length, header: rows[0], first: rows[1], second: rows[2], last: rows.at(-1) };
}
await fs.writeFile(ev + '/excel-inspection.json', JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
