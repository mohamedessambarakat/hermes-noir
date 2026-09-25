// Static checks that mirror what Hermes enforces when it loads or installs a
// desktop plugin, plus this repo's own invariants. Run: npm run check
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { buildIconBlock } from './gen-icons.mjs'

const root = new URL('../', import.meta.url)
const read = path => readFileSync(new URL(path, root), 'utf8')
const pluginPath = fileURLToPath(new URL('desktop/plugin.js', root))
const plugin = read('desktop/plugin.js')
const failures = []
const fail = message => failures.push(message)

// 1. Hermes' runtime loader only resolves these specifiers (contrib/runtime-loader.ts).
const ALLOWED_IMPORTS = new Set(['@hermes/plugin-sdk', 'react', 'react/jsx-runtime'])
for (const [, specifier] of plugin.matchAll(/^\s*import\s[^'"]*['"]([^'"]+)['"]/gm)) {
  if (!ALLOWED_IMPORTS.has(specifier)) fail(`desktop/plugin.js imports "${specifier}"; Hermes only allows ${[...ALLOWED_IMPORTS].join(', ')}`)
}

// 2. Patterns hermes_cli/plugin_validate_desktop.py rejects at install time.
const FORBIDDEN = [
  [/\beval\s*\(/, 'eval('],
  [/new\s+Function\s*\(/, 'new Function('],
  [/\bimport\s*\(/, 'dynamic import()'],
  [/createElement\(\s*['"]script['"]/, "createElement('script')"],
  [/<script/i, '<script tag'],
  [/\.prototype\.\w+\s*=/, 'prototype patching'],
  [/setPrototypeOf|__proto__/, 'prototype patching']
]
for (const [pattern, label] of FORBIDDEN) {
  if (pattern.test(plugin)) fail(`desktop/plugin.js contains ${label}, which Hermes' installer rejects`)
}

// 2b. Temporary diagnostics (see AGENTS.md "Debugging in the running app") must not ship.
if (/TEMP-DIAGNOSTIC|DIAG-/.test(plugin)) fail('desktop/plugin.js still contains TEMP-DIAGNOSTIC / DIAG- code; remove it before committing')

// 3. Syntax: the file must parse as an ES module on its own.
try {
  execFileSync(process.execPath, ['--check', pluginPath], { stdio: 'pipe' })
} catch (error) {
  fail(`desktop/plugin.js does not parse:\n${error.stderr?.toString() ?? error.message}`)
}

// 4. Generated icon block matches scripts/icon-map.mjs.
if (!plugin.includes(buildIconBlock())) fail('Icon block is stale: run `npm run icons`')

// 5. One id everywhere: plugin id, manifest name, package name.
const pluginId = plugin.match(/export const PLUGIN_ID = '([^']+)'/)?.[1]
const manifestName = read('plugin.yaml').match(/^name:\s*(\S+)/m)?.[1]
const packageName = JSON.parse(read('package.json')).name
if (!pluginId) fail('PLUGIN_ID not found in desktop/plugin.js')
if (manifestName !== pluginId) fail(`plugin.yaml name "${manifestName}" != PLUGIN_ID "${pluginId}"`)
if (packageName !== pluginId) fail(`package.json name "${packageName}" != PLUGIN_ID "${pluginId}"`)

// 6. Manifest and package versions move together.
const manifestVersion = read('plugin.yaml').match(/^version:\s*(\S+)/m)?.[1]
const packageVersion = JSON.parse(read('package.json')).version
if (manifestVersion !== packageVersion) fail(`plugin.yaml version ${manifestVersion} != package.json version ${packageVersion}`)

if (failures.length) {
  console.error(`check failed (${failures.length}):\n- ${failures.join('\n- ')}`)
  process.exit(1)
}
console.log('check passed')
