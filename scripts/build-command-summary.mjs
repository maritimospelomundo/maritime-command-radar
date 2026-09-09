import { readFile, writeFile } from 'node:fs/promises';
import adapter from '../site/command-summary.js';
const data = JSON.parse(await readFile(new URL('../site/data/latest.json', import.meta.url), 'utf8'));
await writeFile(new URL('../site/data/command-summary.json', import.meta.url), JSON.stringify(adapter.buildCommandSummary(data), null, 2) + '\n');
console.log('command-summary.json generated from latest.json');
