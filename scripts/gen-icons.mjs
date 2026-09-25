// Regenerates the ICON_SVGS block inside desktop/plugin.js from lucide-static.
// Disk plugins must be a single file with no imports beyond the SDK and React,
// so icon data is inlined between the GENERATED markers instead of imported.
import { readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

import { CODICON_TO_LUCIDE, NOIR_ICONS } from './icon-map.mjs'

const require = createRequire(import.meta.url)
const PLUGIN_FILE = fileURLToPath(new URL('../desktop/plugin.js', import.meta.url))
const START = '// <GENERATED:icons> (npm run icons; do not edit by hand)'
const END = '// </GENERATED:icons>'
const STROKE_WIDTH = '1.75'

const iconNodes = require('lucide-static/icon-nodes.json')

function toSvg(lucideName) {
  const nodes = iconNodes[lucideName]
  if (!nodes) throw new Error(`lucide-static has no icon named "${lucideName}"`)
  const children = nodes
    .map(([tag, attrs]) => `<${tag} ${Object.entries(attrs).map(([key, value]) => `${key}="${value}"`).join(' ')}/>`)
    .join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="${STROKE_WIDTH}" stroke-linecap="round" stroke-linejoin="round">${children}</svg>`
}

export function buildIconBlock() {
  const lines = map => Object.entries(map)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, lucide]) => `  ${JSON.stringify(key)}: ${JSON.stringify(toSvg(lucide))}`)
    .join(',\n')
  return `${START}\n// Lucide icons (ISC license, https://lucide.dev), keyed by the Codicon they replace.\nconst ICON_SVGS = {\n${lines(CODICON_TO_LUCIDE)}\n}\n// Icons Noir places itself, keyed by purpose.\nconst NOIR_ICONS = {\n${lines(NOIR_ICONS)}\n}\n${END}`
}

export function replaceIconBlock(source, block) {
  const start = source.indexOf(START)
  const end = source.indexOf(END)
  if (start === -1 || end === -1 || end < start) {
    throw new Error('desktop/plugin.js is missing the <GENERATED:icons> markers')
  }
  return source.slice(0, start) + block + source.slice(end + END.length)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const source = readFileSync(PLUGIN_FILE, 'utf8')
  const next = replaceIconBlock(source, buildIconBlock())
  writeFileSync(PLUGIN_FILE, next)
  console.log(`Wrote ${Object.keys(CODICON_TO_LUCIDE).length} icons into desktop/plugin.js`)
}
