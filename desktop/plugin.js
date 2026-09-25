/**
 * Hermes Noir by Essam (https://essam.pro)
 * A pure-black, monochrome restyle of the Hermes Agent desktop app.
 *
 * Hermes loads desktop plugins as ONE uncompiled ES module that may import only
 * '@hermes/plugin-sdk', 'react' and 'react/jsx-runtime'. So this file is organised
 * in fixed sections instead of separate modules (see AGENTS.md before editing):
 *
 *   1. CONFIG    theme palette, type scale, motion tokens
 *   2. HOOKS     every Hermes DOM selector / CSS token this plugin depends on
 *   3. HELPERS   pure functions (exported for tests)
 *   4. STYLES    the injected stylesheet, scoped to the Noir theme
 *   5. FEATURES  one install(ctx) per feature, run from a single table
 *   6. ICONS     generated Lucide SVGs (npm run icons)
 *   7. PLUGIN    the default export Hermes loads
 *
 * Everything visual is scoped to `:root[data-hermes-theme="noir"]`, so picking any
 * other theme instantly returns Hermes to stock without disabling the plugin.
 */
import {
  atom,
  CHAT_EMPTY_AREA,
  COMPOSER_AREAS,
  host,
  Kbd,
  Popover,
  PopoverContent,
  PopoverTrigger,
  requestTheme,
  THEMES_AREA,
  useTheme,
  useValue
} from '@hermes/plugin-sdk'
import { useEffect, useState } from 'react'
import { jsx, jsxs } from 'react/jsx-runtime'

// ─── 1. CONFIG ──────────────────────────────────────────────────────────────

export const PLUGIN_ID = 'hermes-noir'
export const THEME_NAME = 'noir'
const SCOPE = `:root[data-hermes-theme="${THEME_NAME}"]`
const LOG_PREFIX = '[hermes-noir]'

const PALETTE = {
  black: '#000000',
  surface: '#0a0a0a',
  elevated: '#111111',
  hover: '#161616',
  border: '#1f1f1f',
  borderStrong: '#2e2e2e',
  text: '#ededed',
  text2: '#a1a1a1',
  text3: '#8f8f8f',
  ok: '#3ecf8e',
  warn: '#f5a524',
  err: '#ff5c5c'
}

const FONT_SANS = '"Geist", ui-sans-serif, system-ui, sans-serif, "Segoe UI Emoji", "Apple Color Emoji"'
const FONT_MONO = '"Geist Mono", ui-monospace, "Cascadia Mono", Menlo, monospace'
const FONT_URL = 'https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&family=Geist+Mono:wght@400;500&display=swap'

// Dark-only: no `darkColors`. Hermes paints `.dark` from the background's luminance.
export const NOIR_THEME = {
  name: THEME_NAME,
  label: 'Noir · by Essam',
  description: 'Pure black, monochrome, Geist. By Essam (essam.pro).',
  colors: {
    background: PALETTE.black,
    foreground: PALETTE.text,
    card: PALETTE.surface,
    cardForeground: PALETTE.text,
    muted: PALETTE.elevated,
    mutedForeground: PALETTE.text2,
    popover: PALETTE.surface,
    popoverForeground: PALETTE.text,
    primary: PALETTE.text,
    primaryForeground: PALETTE.black,
    secondary: PALETTE.hover,
    secondaryForeground: PALETTE.text,
    accent: PALETTE.hover,
    accentForeground: PALETTE.text,
    border: PALETTE.border,
    input: PALETTE.borderStrong,
    ring: PALETTE.text,
    midground: PALETTE.text,
    composerRing: PALETTE.borderStrong,
    destructive: PALETTE.err,
    destructiveForeground: PALETTE.black,
    sidebarBackground: PALETTE.black,
    sidebarBorder: PALETTE.border,
    userBubble: PALETTE.elevated,
    userBubbleBorder: PALETTE.border
  },
  typography: { fontSans: FONT_SANS, fontMono: FONT_MONO, fontUrl: FONT_URL }
}

// Type scale. Hermes declares these tokens in styles.css (@layer base :root);
// our unlayered, theme-scoped rule wins without !important.
const TYPE_TOKENS = {
  '--conversation-text-font-size': '0.9375rem', // 15px chat text
  '--conversation-line-height': '1.5rem',
  '--conversation-tool-font-size': '0.8125rem',
  '--conversation-caption-font-size': '0.8125rem',
  '--conversation-caption-line-height': '1.125rem',
  '--dt-line-height': '1.6'
}

// ─── 2. HOOKS ───────────────────────────────────────────────────────────────
// Every Hermes internal this plugin relies on, in one place. `required` hooks
// must exist on any chat screen; the self-check warns once if one disappears
// after a Hermes update. Sources are relative to apps/desktop/src/ in hermes-agent.

export const HOOKS = [
  { id: 'theme-attribute', required: true, test: doc => doc.documentElement.hasAttribute('data-hermes-theme'), source: 'themes/context.tsx applyTheme (root.dataset.hermesTheme)', usedBy: 'all scoping' },
  { id: 'sidebar', required: true, selector: '[data-slot="sidebar"]', source: 'components/ui/sidebar.tsx', usedBy: 'sidebar type size' },
  { id: 'sidebar-group', required: true, selector: '[data-slot="sidebar-group"]', source: 'components/ui/sidebar.tsx SidebarGroup', usedBy: 'section dividers' },
  { id: 'codicon', required: true, selector: 'i.codicon', source: 'components/ui/codicon.tsx', usedBy: 'Lucide icon swap' },
  { id: 'conversation-font-token', required: true, test: doc => getComputedStyle(doc.documentElement).getPropertyValue('--conversation-text-font-size').trim() !== '', source: 'styles.css --conversation-text-font-size', usedBy: '15px chat text' },
  { id: 'section-label', required: true, selector: '[data-slot="sidebar"] .dither', source: 'app/shell/sidebar-label.tsx SidebarPanelLabel', usedBy: 'section label style, channel icon tint' },
  { id: 'surface-tokens', required: true, test: doc => getComputedStyle(doc.documentElement).getPropertyValue('--ui-bg-sidebar').trim() !== '', source: 'styles.css --ui-bg-sidebar / --ui-bg-chrome', usedBy: 'true black sidebar and chrome' },
  { id: 'session-row', required: false, selector: '.row-hover', source: 'app/chat/sidebar/session-row.tsx', usedBy: 'row height, text size, motion' },
  { id: 'wordmark', required: false, selector: '.wordmark', source: 'components/chat/wordmark.tsx', usedBy: 'empty-chat title' },
  { id: 'working-row', required: false, selector: '[data-working="true"]', source: 'app/chat/sidebar/session-row.tsx', usedBy: 'working row tint' },
  { id: 'turn-activity', required: false, selector: '[data-slot="aui_turn-activity"]', source: 'components/assistant-ui/thread/status.tsx', usedBy: 'replaced by Noir status line' },
  { id: 'response-loading', required: false, selector: '[data-slot="aui_response-loading"]', source: 'components/assistant-ui/thread/status.tsx ResponseLoadingIndicator', usedBy: 'duplicate timer hidden while Noir status line shows' }
]

// Gateway events that tell us what the agent is doing, mapped to a status label.
export const PHASE_BY_EVENT = {
  'reasoning.delta': 'Thinking…',
  'thinking.delta': 'Thinking…',
  'tool.start': 'Running tools…',
  'tool.generating': 'Running tools…',
  'subagent.start': 'Running subagents…',
  'message.delta': 'Writing…'
}
const DEFAULT_PHASE = 'Working…'
const STREAM_EVENTS = new Set(['message.delta', 'reasoning.delta', 'thinking.delta'])

// ─── 3. HELPERS (pure) ──────────────────────────────────────────────────────

export function formatElapsed(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  if (minutes >= 60) return `${Math.floor(minutes / 60)}h ${minutes % 60}m`
  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`
}

export function formatTokens(count) {
  if (!Number.isFinite(count) || count < 0) return '0'
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`
  if (count >= 1000) return `${(count / 1000).toFixed(1)}k`
  return String(Math.round(count))
}

// Rough chars-per-token for streamed text; only bridges the gap until Hermes reports real usage.
const CHARS_PER_TOKEN = 4

/**
 * Output tokens for the current turn. Hermes reports usage only when a model call
 * finishes, so while text streams we estimate from streamed characters, and take the
 * reported figure as soon as it is at least as large.
 */
export function turnTokens(usage, baselineOutput, streamedChars = 0) {
  const estimated = Math.round(Math.max(0, streamedChars) / CHARS_PER_TOKEN)
  const output = Number(usage?.output)
  if (!Number.isFinite(output)) return estimated
  const reported = Number.isFinite(baselineOutput) && output >= baselineOutput ? output - baselineOutput : 0
  return Math.max(reported, estimated)
}

/** Characters carried by a streaming gateway event, 0 for anything else. */
export function streamedLength(event) {
  const text = event?.payload?.text
  return STREAM_EVENTS.has(event?.type) && typeof text === 'string' ? text.length : 0
}

export function phaseForEvent(type) {
  return PHASE_BY_EVENT[type] ?? null
}

/** Which hooks are missing from `doc`. Only hooks that can be evaluated count. */
export function missingHooks(doc, hooks = HOOKS) {
  return hooks.filter(hook => {
    if (!hook.required) return false
    try {
      return hook.test ? !hook.test(doc) : doc.querySelector(hook.selector) === null
    } catch (error) {
      console.warn(LOG_PREFIX, `hook "${hook.id}" check threw`, error)
      return true
    }
  })
}

export function svgToMaskUrl(svg) {
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
}

export function buildIconCss(iconSvgs, scope = SCOPE) {
  return Object.entries(iconSvgs)
    .map(([codicon, svg]) => {
      const mask = svgToMaskUrl(svg)
      return `${scope} .codicon.codicon-${codicon}::before{content:"";display:inline-block;width:1em;height:1em;background-color:currentColor;-webkit-mask:${mask} center/contain no-repeat;mask:${mask} center/contain no-repeat}`
    })
    .join('\n')
}

// ─── 4. STYLES ──────────────────────────────────────────────────────────────

export function buildStylesheet(iconSvgs, scope = SCOPE) {
  const tokens = Object.entries(TYPE_TOKENS).map(([name, value]) => `${name}:${value};`).join('')
  return `
/* Hermes Noir by Essam: every rule is scoped to the Noir theme. */
${scope}{${tokens}
  --noir-border:${PALETTE.border};--noir-border-strong:${PALETTE.borderStrong};--noir-hover:${PALETTE.hover};
  --noir-surface:${PALETTE.surface};--noir-elevated:${PALETTE.elevated};--noir-text:${PALETTE.text};--noir-text-2:${PALETTE.text2};--noir-text-3:${PALETTE.text3};
  --noir-ok:${PALETTE.ok};--noir-warn:${PALETTE.warn};--noir-err:${PALETTE.err};
  --noir-ease:cubic-bezier(.2,.8,.2,1);--noir-dur:150ms;
  color-scheme:dark;
}
${scope} *{scrollbar-width:thin;scrollbar-color:var(--noir-border-strong) transparent}
${scope} ::selection{background:rgba(237,237,237,.22)}

/* Surfaces: Hermes mixes the theme seed with a neutral gray; Noir wants true black. */
${scope}{--ui-bg-sidebar:${PALETTE.black};--ui-bg-chrome:${PALETTE.black}}
/* With Hermes' "glass" window effect on, the sidebar is transparent and shows the OS window material. */
${scope} [data-slot="sidebar"]{background-color:${PALETTE.black}}

/* Sidebar: larger text, hairline dividers between sections, calm motion. */
${scope} [data-slot="sidebar"]{font-size:.875rem}
${scope} [data-slot="sidebar-group"]+[data-slot="sidebar-group"]{border-top:1px solid var(--noir-border);margin-top:.375rem;padding-top:.375rem}
/* Section labels (Pinned, Sessions, Discord, Cron jobs): sentence case, muted, no dithered square.
   Anchored on Hermes' .dither marker inside SidebarPanelLabel (app/shell/sidebar-label.tsx). */
${scope} [data-slot="sidebar"] .dither{display:none}
${scope} [data-slot="sidebar"] span:has(> .dither){text-transform:none;letter-spacing:0;font-size:.75rem;font-weight:500;color:var(--noir-text-3);padding-left:.25rem}
/* Channel icons: gray until hovered, then their brand color (AvatarChip sets color inline). */
${scope} [data-slot="sidebar"] button:has(> span > .dither) > span[style]{filter:grayscale(1) brightness(1.5);opacity:.8;transition:filter var(--noir-dur) var(--noir-ease),opacity var(--noir-dur) var(--noir-ease)}
${scope} [data-slot="sidebar"] button:has(> span > .dither):hover > span[style]{filter:none;opacity:1}
/* Rows: taller and larger text (Hermes: min-h 1.625rem, text 0.8125rem in row-geometry.ts). */
${scope} [data-slot="sidebar"] .row-hover{min-height:2.125rem}
${scope} [data-slot="sidebar"] .row-hover .truncate{font-size:.875rem}
${scope} .row-hover{transition:background-color var(--noir-dur) var(--noir-ease),color var(--noir-dur) var(--noir-ease),transform var(--noir-dur) var(--noir-ease)}
${scope} .row-hover:active{transform:scale(.985)}
${scope} [data-working="true"]{background-image:linear-gradient(90deg,rgba(237,237,237,.07),transparent 70%)}

/* Composer: Hermes' own layout, Noir chrome only (hairline border, brighter while typing). */
${scope} [data-slot="composer-surface"]{border-color:var(--noir-border-strong);transition:border-color var(--noir-dur) var(--noir-ease)}
${scope} [data-slot="composer-surface"]:focus-within{border-color:#555}

/* Empty-chat wordmark: Geist instead of the stencil display face, at a quieter size.
   Width is an inline style on the element, hence !important. */
${scope} .wordmark{font-family:var(--dt-font-sans);font-weight:600;letter-spacing:-.03em;text-transform:none;line-height:1.1;width:min(24rem,70%)!important}

/* The Noir status line replaces Hermes' "working" caption; keep the original for screen readers. */
${scope} [data-slot="aui_turn-activity"][data-state="active"]{position:absolute!important;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
/* Same for the in-transcript "▦ 2s" loading row, but only when it carries no hint (compacting,
   provider wait, local model load render with .shimmer and stay visible). */
${scope} [data-slot="aui_response-loading"]:not(:has(.shimmer)){position:absolute!important;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}

/* Noir's own components. */
.noir-status{display:flex;align-items:center;gap:.5rem;padding:.25rem .75rem;font-size:.8125rem;color:var(--noir-text-2);font-variant-numeric:tabular-nums}
.noir-status .noir-spark{flex-shrink:0;color:var(--noir-text);animation:noir-spark 1.6s var(--noir-ease) infinite}
.noir-status .noir-phase{background:linear-gradient(90deg,var(--noir-text-3) 0%,var(--noir-text-3) 40%,var(--noir-text) 50%,var(--noir-text-3) 60%,var(--noir-text-3) 100%);background-size:250% 100%;-webkit-background-clip:text;background-clip:text;color:transparent;animation:noir-shimmer 2s linear infinite}
.noir-ring{display:inline-grid;place-items:center;width:1.75rem;height:1.75rem;padding:0;border:0;border-radius:999px;background:transparent;color:var(--noir-text-2);cursor:pointer;transition:background-color var(--noir-dur) var(--noir-ease)}
.noir-ring:hover,.noir-ring[data-state="open"]{background:var(--noir-hover)}
.noir-ring:focus-visible{outline:2px solid var(--noir-text);outline-offset:1px}
.noir-usage{display:grid;grid-template-columns:auto auto;gap:.25rem 1.5rem;font-size:.8125rem;min-width:14rem}
.noir-usage dt{color:var(--noir-text-3)}
.noir-usage dd{margin:0;text-align:right;font-variant-numeric:tabular-nums;color:var(--noir-text)}
.noir-usage-title{margin:0 0 .5rem;font-size:.8125rem;font-weight:500;color:var(--noir-text)}
.noir-ring svg{transform:rotate(-90deg)}
.noir-empty{display:flex;flex-direction:column;align-items:center;gap:.5rem;padding-top:.75rem;color:var(--noir-text-3);font-size:.875rem}
@keyframes noir-spark{0%{transform:rotate(0) scale(1)}50%{transform:rotate(45deg) scale(.72)}100%{transform:rotate(90deg) scale(1)}}
@keyframes noir-shimmer{from{background-position:100% 0}to{background-position:0 0}}
@keyframes noir-breathe{0%,100%{opacity:1}50%{opacity:.3}}
@media (prefers-reduced-motion:reduce){
  ${scope} .row-hover{transition:none}
  ${scope} .row-hover:active{transform:none}
  .noir-status .noir-phase{animation:none;background:none;color:var(--noir-text-3)}
  /* Status indicators stay alive without motion: a fade instead of a spin. */
  .noir-status .noir-spark{animation:noir-breathe 1.4s ease-in-out infinite}
}

/* Lucide icons in place of Codicons. */
${buildIconCss(iconSvgs, scope)}
`
}

// ─── 5. FEATURES ────────────────────────────────────────────────────────────

const isNoirActive = () => document.documentElement.dataset.hermesTheme === THEME_NAME

function useNoirActive() {
  const { themeName } = useTheme()
  return themeName === THEME_NAME
}

/** Theme registration, plus a one-time switch to Noir the first time the plugin loads. */
function installTheme(ctx) {
  ctx.register({ id: 'theme', area: THEMES_AREA, data: NOIR_THEME })

  if (ctx.storage.get('themeAutoSelected', false)) return
  ctx.setTimeout(() => {
    if (requestTheme(THEME_NAME)) {
      ctx.storage.set('themeAutoSelected', true)
    } else {
      console.warn(LOG_PREFIX, 'Noir theme was not available to select; pick it in Settings > Appearance.')
    }
  }, 0)
}

function installStylesheet(ctx) {
  const style = document.createElement('style')
  style.id = `${PLUGIN_ID}-styles`
  style.textContent = buildStylesheet(ICON_SVGS)
  // Last in <head> so equal-specificity rules resolve in our favour.
  document.head.appendChild(style)
  ctx.onDispose(() => style.remove())
}

/** Warns once per app session if a required Hermes hook vanished (usually after an update). */
function installSelfCheck(ctx) {
  let warned = false
  const run = () => {
    if (warned || !isNoirActive()) return
    const missing = missingHooks(document)
    if (missing.length === 0) return
    warned = true
    console.warn(LOG_PREFIX, 'Hermes hooks no longer match:', missing.map(hook => `${hook.id} (${hook.source})`))
    host.notify({
      kind: 'warning',
      title: 'Hermes Noir',
      message: `${missing.length} styling hook(s) changed in this Hermes version; some Noir styling is off. Check for a Noir update.`,
      detail: missing.map(hook => hook.id).join(', ')
    })
  }

  ctx.setTimeout(run, 8000)
  const observer = new MutationObserver(() => ctx.setTimeout(run, 1500))
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-hermes-theme'] })
  ctx.onDispose(() => observer.disconnect())
}

// Per-session turn state: when the turn began, token baseline, current phase.
const $turns = atom({})

function updateTurn(sessionId, patch) {
  const turns = $turns.get()
  $turns.set({ ...turns, [sessionId]: { ...turns[sessionId], ...patch } })
}

function installTurnTracking(ctx) {
  let previous = {}
  const unsubscribe = host.state.busyBySession.subscribe(busyBySession => {
    const next = busyBySession ?? {}
    for (const [sessionId, busy] of Object.entries(next)) {
      if (busy && !previous[sessionId]) {
        const focusedUsage = host.state.focusedSessionId.get() === sessionId ? host.state.focusedUsage.get() : null
        updateTurn(sessionId, { startedAt: Date.now(), baseline: Number(focusedUsage?.output), streamedChars: 0, phase: DEFAULT_PHASE })
      }
    }
    for (const sessionId of Object.keys(previous)) {
      if (previous[sessionId] && !next[sessionId]) {
        const { [sessionId]: _finished, ...rest } = $turns.get()
        $turns.set(rest)
      }
    }
    previous = { ...next }
  })
  ctx.onDispose(unsubscribe)

  for (const type of Object.keys(PHASE_BY_EVENT)) {
    ctx.onEvent(type, event => {
      const sessionId = event?.session_id
      const turn = sessionId ? $turns.get()[sessionId] : undefined
      if (!turn) return
      updateTurn(sessionId, { phase: phaseForEvent(type), streamedChars: (turn.streamedChars ?? 0) + streamedLength(event) })
    })
  }
}

function Spark() {
  return jsx('svg', {
    'aria-hidden': true,
    className: 'noir-spark',
    fill: 'none',
    height: 16,
    viewBox: '0 0 24 24',
    width: 16,
    children: jsxs('g', {
      stroke: 'currentColor',
      strokeLinecap: 'round',
      children: [
        jsx('path', { d: 'M12 3v5M12 16v5M3 12h5M16 12h5', strokeWidth: 2.4 }),
        jsx('path', { d: 'M6.3 6.3l2.4 2.4M15.3 15.3l2.4 2.4M6.3 17.7l2.4-2.4M15.3 8.7l2.4-2.4', opacity: 0.7, strokeWidth: 1.8 })
      ]
    })
  })
}

function StatusLine() {
  const active = useNoirActive()
  const busy = useValue(host.state.busy)
  const sessionId = useValue(host.state.focusedSessionId)
  const usage = useValue(host.state.focusedUsage)
  const turns = useValue($turns)
  const [now, setNow] = useState(() => Date.now())

  const turn = sessionId ? turns[sessionId] : undefined
  const running = active && busy && Boolean(turn)

  useEffect(() => {
    if (!running) return undefined
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [running])

  useEffect(() => {
    // Baseline is captured lazily when the session wasn't focused at turn start.
    if (running && !Number.isFinite(turn.baseline) && Number.isFinite(Number(usage?.output))) {
      updateTurn(sessionId, { baseline: Number(usage.output) })
    }
  }, [running, sessionId, turn, usage])

  if (!running) return null

  const stats = `${formatElapsed(now - turn.startedAt)} · ${formatTokens(turnTokens(usage, turn.baseline, turn.streamedChars))} tokens · `
  return jsxs('div', {
    'aria-live': 'off',
    className: 'noir-status',
    children: [jsx(Spark, {}), jsx('span', { children: stats }), jsx('span', { className: 'noir-phase', children: turn.phase ?? DEFAULT_PHASE })]
  })
}

function installStatusLine(ctx) {
  ctx.register({ id: 'status-line', area: COMPOSER_AREAS.top, render: () => jsx(StatusLine, {}) })
}

const RING_RADIUS = 8
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS

function formatCount(value) {
  return Number.isFinite(Number(value)) ? formatTokens(Number(value)) : '—'
}

/** Rows for the context popover; pure so it can be tested without React. */
export function usageRows(usage) {
  const cost = Number(usage?.cost_usd)
  return [
    ['Context', `${formatCount(usage?.context_used)} / ${formatCount(usage?.context_max)}`],
    ['Input tokens', formatCount(usage?.input)],
    ['Output tokens', formatCount(usage?.output)],
    ['Cost', Number.isFinite(cost) ? `$${cost.toFixed(cost < 1 ? 3 : 2)}` : '—']
  ]
}

function RingGlyph({ percent }) {
  const stroke = percent >= 90 ? 'var(--noir-err)' : percent >= 75 ? 'var(--noir-warn)' : 'var(--noir-text)'
  return jsxs('svg', {
    'aria-hidden': true,
    height: 20,
    viewBox: '0 0 20 20',
    width: 20,
    children: [
      jsx('circle', { cx: 10, cy: 10, fill: 'none', r: RING_RADIUS, stroke: 'var(--noir-border-strong)', strokeWidth: 2 }),
      jsx('circle', {
        cx: 10,
        cy: 10,
        fill: 'none',
        r: RING_RADIUS,
        stroke,
        strokeDasharray: RING_CIRCUMFERENCE,
        strokeDashoffset: RING_CIRCUMFERENCE * (1 - percent / 100),
        strokeLinecap: 'round',
        strokeWidth: 2
      })
    ]
  })
}

function ContextRing() {
  const active = useNoirActive()
  const usage = useValue(host.state.focusedUsage)
  const raw = Number(usage?.context_percent)
  if (!active || !Number.isFinite(raw)) return null

  const percent = Math.min(100, Math.max(0, raw))
  const label = `Context ${Math.round(percent)}% used. Show usage details`
  return jsxs(Popover, {
    children: [
      jsx(PopoverTrigger, {
        asChild: true,
        children: jsx('button', { 'aria-label': label, className: 'noir-ring', title: label, type: 'button', children: jsx(RingGlyph, { percent }) })
      }),
      jsx(PopoverContent, {
        align: 'end',
        side: 'top',
        children: jsxs('div', {
          children: [
            jsx('p', { className: 'noir-usage-title', children: `${Math.round(percent)}% of context used` }),
            jsx('dl', {
              className: 'noir-usage',
              children: usageRows(usage).flatMap(([name, value]) => [jsx('dt', { children: name }, `${name}-dt`), jsx('dd', { children: value }, `${name}-dd`)])
            })
          ]
        })
      })
    ]
  })
}
function installContextRing(ctx) {
  ctx.register({ id: 'context-ring', area: COMPOSER_AREAS.actions, render: () => jsx(ContextRing, {}) })
}

function EmptyHint() {
  if (!useNoirActive()) return null
  return jsxs('div', {
    className: 'noir-empty',
    children: [jsxs('span', { children: ['Press ', jsx(Kbd, { children: 'Ctrl K' }), ' to jump to any session, project or skill.'] })]
  })
}

function installEmptyState(ctx) {
  ctx.register({ id: 'empty-hint', area: CHAT_EMPTY_AREA, data: { render: () => jsx(EmptyHint, {}) } })
}

// Order matters only for readability; each feature is independent and fails alone.
export const FEATURES = [
  { id: 'theme', install: installTheme },
  { id: 'stylesheet', install: installStylesheet },
  { id: 'turn-tracking', install: installTurnTracking },
  { id: 'status-line', install: installStatusLine },
  { id: 'context-ring', install: installContextRing },
  { id: 'empty-state', install: installEmptyState },
  { id: 'self-check', install: installSelfCheck }
]

// ─── 6. ICONS ───────────────────────────────────────────────────────────────

// <GENERATED:icons> (npm run icons; do not edit by hand)
// Lucide icons (ISC license, https://lucide.dev), keyed by the Codicon they replace.
const ICON_SVGS = {
  "account": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"black\" stroke-width=\"1.75\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2\"/><circle cx=\"12\" cy=\"7\" r=\"4\"/></svg>",
  "add": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"black\" stroke-width=\"1.75\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M5 12h14\"/><path d=\"M12 5v14\"/></svg>",
  "agent": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"black\" stroke-width=\"1.75\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M12 8V4H8\"/><rect width=\"16\" height=\"12\" x=\"4\" y=\"8\" rx=\"2\"/><path d=\"M2 14h2\"/><path d=\"M20 14h2\"/><path d=\"M15 13v2\"/><path d=\"M9 13v2\"/></svg>",
  "archive": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"black\" stroke-width=\"1.75\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><rect width=\"20\" height=\"5\" x=\"2\" y=\"3\" rx=\"1\"/><path d=\"M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8\"/><path d=\"M10 12h4\"/></svg>",
  "arrow-down": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"black\" stroke-width=\"1.75\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M12 5v14\"/><path d=\"m19 12-7 7-7-7\"/></svg>",
  "arrow-left": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"black\" stroke-width=\"1.75\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"m12 19-7-7 7-7\"/><path d=\"M19 12H5\"/></svg>",
  "arrow-right": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"black\" stroke-width=\"1.75\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M5 12h14\"/><path d=\"m12 5 7 7-7 7\"/></svg>",
  "arrow-up": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"black\" stroke-width=\"1.75\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"m5 12 7-7 7 7\"/><path d=\"M12 19V5\"/></svg>",
  "bell": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"black\" stroke-width=\"1.75\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M10.268 21a2 2 0 0 0 3.464 0\"/><path d=\"M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326\"/></svg>",
  "check": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"black\" stroke-width=\"1.75\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M20 6 9 17l-5-5\"/></svg>",
  "check-all": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"black\" stroke-width=\"1.75\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M18 6 7 17l-5-5\"/><path d=\"m22 10-7.5 7.5L13 16\"/></svg>",
  "checklist": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"black\" stroke-width=\"1.75\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M13 5h8\"/><path d=\"M13 12h8\"/><path d=\"M13 19h8\"/><path d=\"m3 17 2 2 4-4\"/><path d=\"m3 7 2 2 4-4\"/></svg>",
  "chevron-down": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"black\" stroke-width=\"1.75\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"m6 9 6 6 6-6\"/></svg>",
  "chevron-left": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"black\" stroke-width=\"1.75\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"m15 18-6-6 6-6\"/></svg>",
  "chevron-right": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"black\" stroke-width=\"1.75\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"m9 18 6-6-6-6\"/></svg>",
  "chevron-up": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"black\" stroke-width=\"1.75\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"m18 15-6-6-6 6\"/></svg>",
  "chrome-close": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"black\" stroke-width=\"1.75\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M18 6 6 18\"/><path d=\"m6 6 12 12\"/></svg>",
  "chrome-maximize": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"black\" stroke-width=\"1.75\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><rect width=\"18\" height=\"18\" x=\"3\" y=\"3\" rx=\"2\"/></svg>",
  "chrome-minimize": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"black\" stroke-width=\"1.75\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M5 12h14\"/></svg>",
  "chrome-restore": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"black\" stroke-width=\"1.75\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><rect width=\"14\" height=\"14\" x=\"8\" y=\"8\" rx=\"2\" ry=\"2\"/><path d=\"M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2\"/></svg>",
  "circle-large": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"black\" stroke-width=\"1.75\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><circle cx=\"12\" cy=\"12\" r=\"10\"/></svg>",
  "circle-large-outline": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"black\" stroke-width=\"1.75\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><circle cx=\"12\" cy=\"12\" r=\"10\"/></svg>",
  "close": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"black\" stroke-width=\"1.75\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M18 6 6 18\"/><path d=\"m6 6 12 12\"/></svg>",
  "cloud-download": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"black\" stroke-width=\"1.75\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M12 13v8l-4-4\"/><path d=\"m12 21 4-4\"/><path d=\"M4.393 15.269A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.436 8.284\"/></svg>",
  "code": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"black\" stroke-width=\"1.75\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"m16 18 6-6-6-6\"/><path d=\"m8 6-6 6 6 6\"/></svg>",
  "comment": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"black\" stroke-width=\"1.75\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M22 17a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 21.286V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z\"/></svg>",
  "comment-discussion": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"black\" stroke-width=\"1.75\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M16 10a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 14.286V4a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z\"/><path d=\"M20 9a2 2 0 0 1 2 2v10.286a.71.71 0 0 1-1.212.502l-2.202-2.202A2 2 0 0 0 17.172 19H10a2 2 0 0 1-2-2v-1\"/></svg>",
  "copy": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"black\" stroke-width=\"1.75\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><rect width=\"14\" height=\"14\" x=\"8\" y=\"8\" rx=\"2\" ry=\"2\"/><path d=\"M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2\"/></svg>",
  "debug-pause": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"black\" stroke-width=\"1.75\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><rect x=\"14\" y=\"3\" width=\"5\" height=\"18\" rx=\"1\"/><rect x=\"5\" y=\"3\" width=\"5\" height=\"18\" rx=\"1\"/></svg>",
  "device-desktop": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"black\" stroke-width=\"1.75\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><rect width=\"20\" height=\"14\" x=\"2\" y=\"3\" rx=\"2\"/><line x1=\"8\" x2=\"16\" y1=\"21\" y2=\"21\"/><line x1=\"12\" x2=\"12\" y1=\"17\" y2=\"21\"/></svg>",
  "discard": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"black\" stroke-width=\"1.75\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M9 14 4 9l5-5\"/><path d=\"M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5a5.5 5.5 0 0 1-5.5 5.5H11\"/></svg>",
  "edit": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"black\" stroke-width=\"1.75\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z\"/><path d=\"m15 5 4 4\"/></svg>",
  "ellipsis": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"black\" stroke-width=\"1.75\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><circle cx=\"12\" cy=\"12\" r=\"1\"/><circle cx=\"19\" cy=\"12\" r=\"1\"/><circle cx=\"5\" cy=\"12\" r=\"1\"/></svg>",
  "error": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"black\" stroke-width=\"1.75\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><circle cx=\"12\" cy=\"12\" r=\"10\"/><line x1=\"12\" x2=\"12\" y1=\"8\" y2=\"12\"/><line x1=\"12\" x2=\"12.01\" y1=\"16\" y2=\"16\"/></svg>",
  "extensions": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"black\" stroke-width=\"1.75\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M10 22V7a1 1 0 0 0-1-1H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5a1 1 0 0 0-1-1H2\"/><rect x=\"14\" y=\"2\" width=\"8\" height=\"8\" rx=\"1\"/></svg>",
  "eye": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"black\" stroke-width=\"1.75\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0\"/><circle cx=\"12\" cy=\"12\" r=\"3\"/></svg>",
  "file-media": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"black\" stroke-width=\"1.75\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><rect width=\"18\" height=\"18\" x=\"3\" y=\"3\" rx=\"2\" ry=\"2\"/><circle cx=\"9\" cy=\"9\" r=\"2\"/><path d=\"m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21\"/></svg>",
  "files": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"black\" stroke-width=\"1.75\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M15 2h-4a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V8\"/><path d=\"M16.706 2.706A2.4 2.4 0 0 0 15 2v5a1 1 0 0 0 1 1h5a2.4 2.4 0 0 0-.706-1.706z\"/><path d=\"M5 7a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h8a2 2 0 0 0 1.732-1\"/></svg>",
  "folder": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"black\" stroke-width=\"1.75\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z\"/></svg>",
  "folder-opened": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"black\" stroke-width=\"1.75\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2\"/></svg>",
  "git-branch": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"black\" stroke-width=\"1.75\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M15 6a9 9 0 0 0-9 9V3\"/><circle cx=\"18\" cy=\"6\" r=\"3\"/><circle cx=\"6\" cy=\"18\" r=\"3\"/></svg>",
  "globe": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"black\" stroke-width=\"1.75\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><circle cx=\"12\" cy=\"12\" r=\"10\"/><path d=\"M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20\"/><path d=\"M2 12h20\"/></svg>",
  "grabber": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"black\" stroke-width=\"1.75\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><circle cx=\"9\" cy=\"12\" r=\"1\"/><circle cx=\"9\" cy=\"5\" r=\"1\"/><circle cx=\"9\" cy=\"19\" r=\"1\"/><circle cx=\"15\" cy=\"12\" r=\"1\"/><circle cx=\"15\" cy=\"5\" r=\"1\"/><circle cx=\"15\" cy=\"19\" r=\"1\"/></svg>",
  "home": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"black\" stroke-width=\"1.75\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8\"/><path d=\"M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z\"/></svg>",
  "hubot": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"black\" stroke-width=\"1.75\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M12 8V4H8\"/><rect width=\"16\" height=\"12\" x=\"4\" y=\"8\" rx=\"2\"/><path d=\"M2 14h2\"/><path d=\"M20 14h2\"/><path d=\"M15 13v2\"/><path d=\"M9 13v2\"/></svg>",
  "info": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"black\" stroke-width=\"1.75\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><circle cx=\"12\" cy=\"12\" r=\"10\"/><path d=\"M12 16v-4\"/><path d=\"M12 8h.01\"/></svg>",
  "kebab-vertical": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"black\" stroke-width=\"1.75\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><circle cx=\"12\" cy=\"12\" r=\"1\"/><circle cx=\"12\" cy=\"5\" r=\"1\"/><circle cx=\"12\" cy=\"19\" r=\"1\"/></svg>",
  "key": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"black\" stroke-width=\"1.75\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M2.586 17.414A2 2 0 0 0 2 18.828V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.172a2 2 0 0 0 1.414-.586l.814-.814a6.5 6.5 0 1 0-4-4z\"/><circle cx=\"16.5\" cy=\"7.5\" r=\".5\" fill=\"currentColor\"/></svg>",
  "layers": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"black\" stroke-width=\"1.75\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z\"/><path d=\"M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12\"/><path d=\"M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17\"/></svg>",
  "layout-sidebar-left": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"black\" stroke-width=\"1.75\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><rect width=\"18\" height=\"18\" x=\"3\" y=\"3\" rx=\"2\"/><path d=\"M9 3v18\"/></svg>",
  "layout-sidebar-right": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"black\" stroke-width=\"1.75\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><rect width=\"18\" height=\"18\" x=\"3\" y=\"3\" rx=\"2\"/><path d=\"M15 3v18\"/></svg>",
  "lightbulb": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"black\" stroke-width=\"1.75\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5\"/><path d=\"M9 18h6\"/><path d=\"M10 22h4\"/></svg>",
  "link-external": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"black\" stroke-width=\"1.75\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M15 3h6v6\"/><path d=\"M10 14 21 3\"/><path d=\"M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6\"/></svg>",
  "list-filter": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"black\" stroke-width=\"1.75\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M2 5h20\"/><path d=\"M6 12h12\"/><path d=\"M9 19h6\"/></svg>",
  "list-unordered": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"black\" stroke-width=\"1.75\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M3 5h.01\"/><path d=\"M3 12h.01\"/><path d=\"M3 19h.01\"/><path d=\"M8 5h13\"/><path d=\"M8 12h13\"/><path d=\"M8 19h13\"/></svg>",
  "loading": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"black\" stroke-width=\"1.75\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M21 12a9 9 0 1 1-6.219-8.56\"/></svg>",
  "mic": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"black\" stroke-width=\"1.75\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M12 19v3\"/><path d=\"M19 10v2a7 7 0 0 1-14 0v-2\"/><rect x=\"9\" y=\"2\" width=\"6\" height=\"13\" rx=\"3\"/></svg>",
  "package": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"black\" stroke-width=\"1.75\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z\"/><path d=\"M12 22V12\"/><polyline points=\"3.29 7 12 12 20.71 7\"/><path d=\"m7.5 4.27 9 5.15\"/></svg>",
  "pass-filled": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"black\" stroke-width=\"1.75\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><circle cx=\"12\" cy=\"12\" r=\"10\"/><path d=\"m16 9-5.5 5.5L8 12\"/></svg>",
  "pin": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"black\" stroke-width=\"1.75\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M12 17v5\"/><path d=\"M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z\"/></svg>",
  "pinned": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"black\" stroke-width=\"1.75\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M12 17v5\"/><path d=\"M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z\"/></svg>",
  "play": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"black\" stroke-width=\"1.75\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z\"/></svg>",
  "refresh": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"black\" stroke-width=\"1.75\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8\"/><path d=\"M21 3v5h-5\"/><path d=\"M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16\"/><path d=\"M8 16H3v5\"/></svg>",
  "repo": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"black\" stroke-width=\"1.75\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M10 2v7.751a.25.25 0 00.407.195l2.28-1.834a.5.5 0 01.627 0l2.28 1.834A.25.25 0 0016 9.751V2\"/><path d=\"M4 19.5v-15A2.5 2.5 0 016.5 2H19a1 1 0 011 1v18a1 1 0 01-1 1H6.5a1 1 0 010-5H20\"/></svg>",
  "robot": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"black\" stroke-width=\"1.75\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M12 8V4H8\"/><rect width=\"16\" height=\"12\" x=\"4\" y=\"8\" rx=\"2\"/><path d=\"M2 14h2\"/><path d=\"M20 14h2\"/><path d=\"M15 13v2\"/><path d=\"M9 13v2\"/></svg>",
  "root-folder": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"black\" stroke-width=\"1.75\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z\"/><circle cx=\"12\" cy=\"13\" r=\"2\"/><path d=\"M12 15v5\"/></svg>",
  "search": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"black\" stroke-width=\"1.75\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"m21 21-4.34-4.34\"/><circle cx=\"11\" cy=\"11\" r=\"8\"/></svg>",
  "send": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"black\" stroke-width=\"1.75\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z\"/><path d=\"m21.854 2.147-10.94 10.939\"/></svg>",
  "settings-gear": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"black\" stroke-width=\"1.75\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915\"/><circle cx=\"12\" cy=\"12\" r=\"3\"/></svg>",
  "sparkle": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"black\" stroke-width=\"1.75\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z\"/><path d=\"M20 2v4\"/><path d=\"M22 4h-4\"/><circle cx=\"4\" cy=\"20\" r=\"2\"/></svg>",
  "stop-circle": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"black\" stroke-width=\"1.75\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><circle cx=\"12\" cy=\"12\" r=\"10\"/><rect x=\"9\" y=\"9\" width=\"6\" height=\"6\" rx=\"1\"/></svg>",
  "symbol-color": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"black\" stroke-width=\"1.75\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M12 22a1 1 0 0 1 0-20 10 9 0 0 1 10 9 5 5 0 0 1-5 5h-2.25a1.75 1.75 0 0 0-1.4 2.8l.3.4a1.75 1.75 0 0 1-1.4 2.8z\"/><circle cx=\"13.5\" cy=\"6.5\" r=\".5\" fill=\"currentColor\"/><circle cx=\"17.5\" cy=\"10.5\" r=\".5\" fill=\"currentColor\"/><circle cx=\"6.5\" cy=\"12.5\" r=\".5\" fill=\"currentColor\"/><circle cx=\"8.5\" cy=\"7.5\" r=\".5\" fill=\"currentColor\"/></svg>",
  "terminal": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"black\" stroke-width=\"1.75\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"m7 11 2-2-2-2\"/><path d=\"M11 13h4\"/><rect width=\"18\" height=\"18\" x=\"3\" y=\"3\" rx=\"2\" ry=\"2\"/></svg>",
  "text-size": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"black\" stroke-width=\"1.75\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M12 4v16\"/><path d=\"M4 7V5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v2\"/><path d=\"M9 20h6\"/></svg>",
  "tools": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"black\" stroke-width=\"1.75\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.106-3.105c.32-.322.863-.22.983.218a6 6 0 0 1-8.259 7.057l-7.91 7.91a1 1 0 0 1-2.999-3l7.91-7.91a6 6 0 0 1 7.057-8.259c.438.12.54.662.219.984z\"/></svg>",
  "trash": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"black\" stroke-width=\"1.75\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M10 11v6\"/><path d=\"M14 11v6\"/><path d=\"M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6\"/><path d=\"M3 6h18\"/><path d=\"M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2\"/></svg>",
  "warning": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"black\" stroke-width=\"1.75\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3\"/><path d=\"M12 9v4\"/><path d=\"M12 17h.01\"/></svg>",
  "watch": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"black\" stroke-width=\"1.75\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><circle cx=\"12\" cy=\"12\" r=\"10\"/><path d=\"M12 6v6l4 2\"/></svg>",
  "zap": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"black\" stroke-width=\"1.75\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M15.914 4a1.5 1.5 0 00-2.474-1.561l-9 9A1.5 1.5 0 005.5 14h4.002a.5.5 0 01.471.666L8.086 20a1.5 1.5 0 002.475 1.56l9-9A1.5 1.5 0 0018.5 10h-3.997a.5.5 0 01-.472-.667z\"/></svg>"
}
// </GENERATED:icons>

// ─── 7. PLUGIN ──────────────────────────────────────────────────────────────

export default {
  id: PLUGIN_ID,
  name: 'Hermes Noir',
  description: 'Pure-black, monochrome restyle with Geist and Lucide icons. By Essam (essam.pro).',
  register(ctx) {
    for (const feature of FEATURES) {
      try {
        feature.install(ctx)
      } catch (error) {
        console.error(LOG_PREFIX, `feature "${feature.id}" failed to install`, error)
        host.notify({ kind: 'warning', title: 'Hermes Noir', message: `The "${feature.id}" part failed to load; the rest still works.` })
      }
    }
  }
}
