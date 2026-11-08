#!/usr/bin/env node
/**
 * Cria (ou redefine a senha de) um administrador direto no D1, sem passar pelo /admin/setup.
 *
 *   npm run admin:create -- --email voce@empresa.com.br --name "Seu Nome" --remote
 *   ADMIN_PASSWORD='senha-longa' npm run admin:create -- --email ... --local
 *
 * Sem ADMIN_PASSWORD, uma senha aleatória é gerada e mostrada uma única vez.
 * Usa o mesmo formato de hash do Worker (PBKDF2-SHA256, 100.000 iterações).
 */
import { execFileSync } from 'node:child_process';
import { pbkdf2Sync, randomBytes, randomUUID } from 'node:crypto';

const args = process.argv.slice(2);
const get = (flag) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
};
const email = (get('--email') ?? '').trim().toLowerCase();
const name = (get('--name') ?? 'Administrador').trim();
const target = args.includes('--local') ? '--local' : '--remote';
const role = args.includes('--editor') ? 'editor' : 'admin';

if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error('Informe um e-mail válido: --email voce@empresa.com.br');
  process.exit(1);
}

const generated = !process.env.ADMIN_PASSWORD;
const password = process.env.ADMIN_PASSWORD ?? randomBytes(12).toString('base64url');
if (password.length < 10) {
  console.error('A senha precisa ter pelo menos 10 caracteres.');
  process.exit(1);
}

const b64url = (buf) => buf.toString('base64url');
const salt = randomBytes(16);
const hash = pbkdf2Sync(password, salt, 100_000, 32, 'sha256');
const passwordHash = `pbkdf2$100000$${b64url(salt)}$${b64url(hash)}`;
const now = new Date().toISOString();
const q = (s) => `'${String(s).replace(/'/g, "''")}'`;

const sql = `INSERT INTO users (id, email, name, password_hash, role, is_active, created_at, updated_at)
VALUES (${q(`user-${randomUUID()}`)}, ${q(email)}, ${q(name)}, ${q(passwordHash)}, ${q(role)}, 1, ${q(now)}, ${q(now)})
ON CONFLICT(email) DO UPDATE SET password_hash = excluded.password_hash, role = excluded.role, is_active = 1, updated_at = excluded.updated_at;
DELETE FROM sessions WHERE user_id = (SELECT id FROM users WHERE email = ${q(email)});`;

console.log(`Gravando ${role} ${email} no D1 (${target.slice(2)})…`);
// Garante que as tabelas existem (o Worker também cria na primeira visita)
execFileSync('npx', ['wrangler', 'd1', 'migrations', 'apply', 'DB', target], { stdio: 'inherit', shell: process.platform === 'win32' });
execFileSync('npx', ['wrangler', 'd1', 'execute', 'DB', target, '--command', sql.replace(/\n/g, ' ')], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
});
console.log('\nPronto. Entre em /admin com:');
console.log(`  e-mail: ${email}`);
if (generated) console.log(`  senha:  ${password}   (guarde agora; ela não será mostrada de novo)`);
