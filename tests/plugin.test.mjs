import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'

import plugin, {
  buildStylesheet,
  FEATURES,
  formatElapsed,
  formatTokens,
  HOOKS,
  missingHooks,
  NOIR_THEME,
  PHASE_BY_EVENT,
  phaseForEvent,
  PLUGIN_ID,
  streamedLength,
  THEME_NAME,
  turnTokens,
  usageRows
} from '../desktop/plugin.js'

// Required keys of DesktopThemeColors in hermes-agent apps/desktop/src/themes/types.ts.
const REQUIRED_COLOR_KEYS = [
  'background', 'foreground', 'card', 'cardForeground', 'muted', 'mutedForeground', 'popover',
  'popoverForeground', 'primary', 'primaryForeground', 'secondary', 'secondaryForeground', 'accent',
  'accentForeground', 'border', 'input', 'ring', 'destructive', 'destructiveForeground'
]

describe('status line formatting', () => {
  it('formats elapsed time like Claude Code', () => {
    assert.equal(formatElapsed(0), '0s')
    assert.equal(formatElapsed(66_000), '1m 6s')
    assert.equal(formatElapsed(3_720_000), '1h 2m')
    assert.equal(formatElapsed(-5), '0s')
  })

  it('compacts token counts and never shows garbage', () => {
    assert.equal(formatTokens(999), '999')
    assert.equal(formatTokens(1700), '1.7k')
    assert.equal(formatTokens(2_500_000), '2.5M')
    assert.equal(formatTokens(Number.NaN), '0')
  })

  it('counts only output tokens spent since the turn began', () => {
    assert.equal(turnTokens({ output: 5000 }, 3300), 1700)
    assert.equal(turnTokens(null, 10), 0)
  })

  it('shows a live estimate while Hermes has not reported usage yet', () => {
    // No reported change yet: the streamed-text estimate carries the count.
    assert.equal(turnTokens({ output: 3300 }, 3300, 4000), 1000)
    assert.equal(turnTokens(null, Number.NaN, 400), 100)
  })

  it('switches to the reported figure once it catches up, and never counts down', () => {
    assert.equal(turnTokens({ output: 5000 }, 3300, 4000), 1700)
    // Counter reset below the baseline (e.g. compression): keep the estimate, not a negative.
    assert.equal(turnTokens({ output: 100 }, 3300, 800), 200)
  })

  it('reads streamed length only from streaming events', () => {
    assert.equal(streamedLength({ type: 'message.delta', payload: { text: 'hello' } }), 5)
    assert.equal(streamedLength({ type: 'tool.start', payload: { text: 'hello' } }), 0)
    assert.equal(streamedLength({ type: 'message.delta' }), 0)
  })

  it('maps every tracked gateway event to a label and ignores the rest', () => {
    for (const type of Object.keys(PHASE_BY_EVENT)) assert.ok(phaseForEvent(type)?.length > 0, type)
    assert.equal(phaseForEvent('session.title'), null)
  })
})

describe('context popover', () => {
  it('shows used / max and a placeholder for anything Hermes did not report', () => {
    const rows = Object.fromEntries(usageRows({ context_used: 76_000, context_max: 200_000, input: 1200, cost_usd: 0.0421 }))
    assert.equal(rows.Context, '76.0k / 200.0k')
    assert.equal(rows['Input tokens'], '1.2k')
    assert.equal(rows['Output tokens'], '—')
    assert.equal(rows.Cost, '$0.042')
  })
})

describe('theme', () => {
  it('is the theme the plugin scopes its styles to', () => {
    assert.equal(NOIR_THEME.name, THEME_NAME)
  })

  it('defines every color Hermes requires, as hex', () => {
    for (const key of REQUIRED_COLOR_KEYS) {
      assert.match(NOIR_THEME.colors[key] ?? '', /^#[0-9a-f]{6}$/i, key)
    }
  })

  it('is dark-only with a pure black canvas', () => {
    assert.equal(NOIR_THEME.darkColors, undefined)
    assert.equal(NOIR_THEME.colors.background, '#000000')
  })
})

describe('stylesheet', () => {
  const scope = `:root[data-hermes-theme="${THEME_NAME}"]`
  const css = buildStylesheet({ add: '<svg/>' })

  it('never touches Hermes elements outside the Noir theme', () => {
    const hermesHooks = /data-slot|\.codicon|\.row-hover|data-working/
    const selectorLines = css.split('\n').filter(line => hermesHooks.test(line.split('{')[0]))
    assert.ok(selectorLines.length > 0)
    for (const line of selectorLines) assert.ok(line.includes(scope), `unscoped rule: ${line.slice(0, 80)}`)
  })

  it('emits one icon rule per icon', () => {
    assert.equal(css.match(/codicon-add::before/g)?.length, 1)
  })
})

describe('self-check', () => {
  const fakeDoc = present => ({
    documentElement: { hasAttribute: () => present },
    querySelector: () => (present ? {} : null)
  })

  it('reports nothing when every selector-based hook is present', () => {
    const selectorHooks = HOOKS.filter(hook => hook.selector)
    assert.deepEqual(missingHooks(fakeDoc(true), selectorHooks), [])
  })

  it('reports only required hooks when they are missing', () => {
    const missing = missingHooks(fakeDoc(false), HOOKS.filter(hook => hook.selector))
    assert.ok(missing.length > 0)
    assert.ok(missing.every(hook => hook.required))
  })

  it('treats a hook check that throws as missing instead of crashing', () => {
    const throwing = [{ id: 'boom', required: true, test: () => { throw new Error('x') } }]
    assert.deepEqual(missingHooks(fakeDoc(true), throwing).map(hook => hook.id), ['boom'])
  })
})

describe('plugin contract', () => {
  const originalFeatures = [...FEATURES]
  afterEach(() => FEATURES.splice(0, FEATURES.length, ...originalFeatures))

  it('uses one id everywhere', () => {
    assert.equal(plugin.id, PLUGIN_ID)
  })

  it('keeps loading the other features when one throws', () => {
    const installed = []
    FEATURES.splice(0, FEATURES.length,
      { id: 'broken', install: () => { throw new Error('boom') } },
      { id: 'fine', install: () => installed.push('fine') })
    const originalError = console.error
    console.error = () => {}
    try {
      plugin.register({})
    } finally {
      console.error = originalError
    }
    assert.deepEqual(installed, ['fine'])
  })
})
