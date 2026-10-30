import { spawn } from 'child_process';
import path from 'path';
import os from 'os';
import fs from 'fs';

// Default install paths for MongoDB on Windows
const possiblePaths = [
  'C:\\Program Files\\MongoDB\\Server\\8.2\\bin\\mongod.exe',
  'C:\\Program Files\\MongoDB\\Server\\8.0\\bin\\mongod.exe',
  'C:\\Program Files\\MongoDB\\Server\\7.0\\bin\\mongod.exe',
  'C:\\Program Files\\MongoDB\\Server\\6.0\\bin\\mongod.exe',
  'mongod'
];

let mongodBin = possiblePaths.find(p => p !== 'mongod' && fs.existsSync(p)) || 'mongod';

const dbPath = path.join(os.homedir(), 'data', 'db');
if (!fs.existsSync(dbPath)) {
  fs.mkdirSync(dbPath, { recursive: true });
}

console.log('='.repeat(60));
console.log('  Starting MongoDB Server (127.0.0.1:27017)');
console.log(`  Database Path: ${dbPath}`);
console.log(`  Binary:        ${mongodBin}`);
console.log('='.repeat(60));

const child = spawn(
  mongodBin,
  [
    '--dbpath', dbPath,
    '--bind_ip', '127.0.0.1',
    '--port', '27017',
    '--setParameter', 'diagnosticDataCollectionEnabled=false'
  ],
  { stdio: 'inherit' }
);

child.on('error', (err) => {
  console.error('[MongoDB Launcher Error]:', err.message);
});

child.on('exit', (code, signal) => {
  if (code !== 0 && code !== null) {
    console.log(`[MongoDB] Process exited with code ${code}`);
  }
});
