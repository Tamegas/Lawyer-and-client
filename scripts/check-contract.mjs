#!/usr/bin/env node
// API + route contract check (no dependencies):
//  1. every api.get/post/put/patch/delete(...) and useApi(...) call in client/src matches a route (verb + path) declared in server/src/routes
//  2. every internal link (to="/x", navigate('/x'), <Navigate>) matches a <Route path> in client/src/App.jsx
//  3. every lazy page import in App.jsx exists
// `--unused` also lists server routes no client code calls.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rd = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const walk = (dir, out = []) => {
  const abs = path.join(root, dir);
  if (!fs.existsSync(abs)) return out;
  for (const e of fs.readdirSync(abs, { withFileTypes: true })) {
    const rel = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== 'node_modules') walk(rel, out); } else if (/\.jsx?$/.test(e.name)) out.push(rel);
  }
  return out;
};
const lineOf = (src, idx) => src.slice(0, idx).split('\n').length;

// ---- server route table -----------------------------------------------------------------------
export function collectServerRoutes() {
  const app = rd('server/src/app.js');
  const imports = {};
  for (const m of app.matchAll(/import (\w+) from '\.\/routes\/([\w]+)\.js'/g)) imports[m[1]] = m[2];
  const routes = [];
  for (const m of app.matchAll(/app\.use\('(\/api[\w/-]*)',\s*(\w+)\(/g)) {
    const file = imports[m[2]];
    if (!file) continue;
    const src = rd(`server/src/routes/${file}.js`);
    for (const r of src.matchAll(/router\.(get|post|put|patch|delete)\(\s*'([^']*)'/g)) {
      routes.push({ method: r[1].toUpperCase(), pattern: (m[1] + (r[2] === '/' ? '' : r[2])).replace(/\/$/, ''), file, line: lineOf(src, r.index) });
    }
  }
  return routes;
}
const toRegex = (pattern) => new RegExp(`^${pattern.replace(/:[A-Za-z]+/g, '[^/]+')}$`);

const problems = [];
const bad = (file, line, msg) => problems.push(`✗ ${file}:${line} ${msg}`);
const routes = collectServerRoutes();
const called = new Set();

// ---- client → API ----------------------------------------------------------------------------
const clientFiles = walk('client/src');
const normalise = (raw) => raw.replace(/\$\{[^}]*\}/g, ':param').split('?')[0];
for (const f of clientFiles) {
  const src = rd(f);
  const re = /(?:\bapi\.(get|post|put|patch|delete)|\b(useApi))\(\s*([`'"])([^`'"]*)\3/g;
  for (const m of src.matchAll(re)) {
    const method = (m[1] ?? 'get').toUpperCase();
    const raw = m[4];
    if (!raw.startsWith('/')) continue;
    const p = '/api' + normalise(raw).replace(/\/$/, '');
    const hit = routes.find((r) => r.method === method && toRegex(r.pattern).test(p.replace(/:param/g, 'x')));
    if (!hit) bad(f, lineOf(src, m.index), `${method} ${raw} matches no server route`); else called.add(`${hit.method} ${hit.pattern}`);
  }
}

// ---- client routes --------------------------------------------------------------------------
const appSrc = rd('client/src/App.jsx');
const paths = [];
for (const m of appSrc.matchAll(/<Route\s+(?:index|path="([^"]*)")/g)) paths.push(m[1] === undefined ? '' : m[1]);
const routeRegexes = paths.map((p) => (p === '*' ? /^.*$/ : new RegExp(`^/${p.replace(/:[A-Za-z]+/g, '[^/]+')}$`)));
const exists = (p) => p === '/' || routeRegexes.some((r, i) => paths[i] !== '*' && r.test(p));
for (const f of clientFiles) {
  const src = rd(f);
  const re = /(?:\bto=|\bto:\s*|\bnavigate\(\s*|\bhref=)(?:\{\s*)?([`'"])(\/[^`'"?#]*)/g;
  for (const m of src.matchAll(re)) {
    let p = m[2];
    if (p.startsWith('/api')) continue;
    if (p.includes('${') && !p.slice(p.indexOf('${')).includes('}')) p = p.slice(0, p.indexOf('${'));
    if (p.includes('${')) { p = p.replace(/\$\{[^}]*\}/g, 'x'); }
    if (p.length > 1) p = p.replace(/\/$/, '');
    if (!exists(p)) bad(f, lineOf(src, m.index), `link to ${m[2]} matches no <Route> in App.jsx`);
  }
}
for (const m of appSrc.matchAll(/import\('\.\/(pages\/[^']+)'\)/g)) {
  if (!fs.existsSync(path.join(root, 'client/src', m[1]))) bad('client/src/App.jsx', lineOf(appSrc, m.index), `page file missing: ${m[1]}`);
}
for (const m of appSrc.matchAll(/from '\.\/(components\/[^']+)'/g)) {
  if (!fs.existsSync(path.join(root, 'client/src', m[1]))) bad('client/src/App.jsx', lineOf(appSrc, m.index), `component file missing: ${m[1]}`);
}

problems.forEach((p) => console.log(p));
if (process.argv.includes('--unused')) {
  const unused = routes.filter((r) => !called.has(`${r.method} ${r.pattern}`));
  console.log(`\nServer routes not called by the client (${unused.length}):`);
  unused.forEach((r) => console.log(`  ${r.method} ${r.pattern}  (${r.file}.js:${r.line})`));
}
console.log(problems.length ? `\n${problems.length} problem(s). ${routes.length} server routes, ${clientFiles.length} client files.` : `✓ contract ok (${routes.length} server routes, ${clientFiles.length} client files).`);
process.exit(problems.length ? 1 : 0);
