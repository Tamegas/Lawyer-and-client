#!/usr/bin/env node
// Name-resolution check via the TypeScript compiler API (no types, no install): reports undefined variables / JSX components,
// bad named/default imports from local modules and unresolved relative imports. Everything else TS says is ignored.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const candidates = [process.env.TYPESCRIPT, '/opt/npm-tools/node_modules/typescript', '/opt/node22/lib/node_modules/typescript',
  '/home/claude/.npm-global/lib/node_modules/typescript', path.join(root, 'node_modules/typescript'), path.join(root, 'client/node_modules/typescript')].filter(Boolean);
let ts;
for (const c of candidates) { try { ts = require(c); break; } catch { /* next */ } }
if (!ts) { console.error('typescript not found. Set TYPESCRIPT=/path/to/typescript.'); process.exit(2); }

const walk = (dir, out = []) => {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === 'dist' || e.name.startsWith('.')) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out); else if (/\.(jsx?|mjs)$/.test(e.name)) out.push(p);
  }
  return out;
};
const files = [...walk(path.join(root, 'client/src')), ...walk(path.join(root, 'server/src')), ...walk(path.join(root, 'server/db')), ...walk(path.join(root, 'server/tests'))];

const options = {
  allowJs: true, checkJs: true, noEmit: true, jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022,
  moduleResolution: ts.ModuleResolutionKind.Bundler, skipLibCheck: true, resolveJsonModule: true, types: [], noImplicitAny: false, strict: false,
  typeRoots: [], lib: ['lib.es2022.d.ts', 'lib.dom.d.ts', 'lib.dom.iterable.d.ts'],
};
const host = ts.createCompilerHost(options);
const program = ts.createProgram(files, options, host);

const WANT = new Set([2304, 2552, 2305, 2614, 2613, 2307, 2448, 2454, 2300, 2451, 2686]);
const problems = [];
for (const sf of program.getSourceFiles()) {
  if (!files.includes(path.resolve(sf.fileName))) continue;
  for (const d of [...program.getSyntacticDiagnostics(sf), ...program.getSemanticDiagnostics(sf)]) {
    if (!WANT.has(d.code) && d.category !== ts.DiagnosticCategory.Error) continue;
    const msg = ts.flattenDiagnosticMessageText(d.messageText, ' ');
    if (d.code === 2307 && !/Cannot find module '\./.test(msg) && !/Cannot find module '\.\./.test(msg)) continue; // uninstalled packages are fine
    if ([2305, 2614, 2613].includes(d.code) && !/["']\.{1,2}\//.test(msg)) continue; // named imports from packages
    if (!WANT.has(d.code)) continue;
    if (d.code === 2304 && /Cannot find name '(process|Buffer|__dirname|require|module|global|NodeJS)'/.test(msg)) continue;
    if (d.code === 2686) continue; // React UMD global (react-jsx runtime is used)
    const { line, character } = sf.getLineAndCharacterOfPosition(d.start ?? 0);
    problems.push(`✗ ${path.relative(root, sf.fileName)}:${line + 1}:${character + 1} TS${d.code} ${msg}`);
  }
}
const only = process.argv.slice(2).filter((a) => !a.startsWith('-'));
const shown = only.length ? problems.filter((p) => only.some((o) => p.includes(o))) : problems;
shown.forEach((p) => console.log(p));
console.log(shown.length ? `\n${shown.length} problem(s) in ${files.length} files.` : `✓ names resolve in ${files.length} files.`);
process.exit(shown.length ? 1 : 0);
