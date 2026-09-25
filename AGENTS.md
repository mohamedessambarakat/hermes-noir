# Hermes Noir: agent and contributor guide

Hermes Noir is a desktop plugin for the Hermes Agent app. It restyles the app (theme, type, icons, sidebar) and adds a few small components. It must survive Hermes updates and never break the app.

## How Hermes loads this plugin

- The package is `plugin.yaml` + `desktop/plugin.js`. `hermes plugins install owner/repo` clones it into `<HERMES_HOME>/plugins/hermes-noir/`. The desktop app then copies `desktop/` into `<HERMES_HOME>/desktop-plugins/hermes-noir/`. The desktop half is opt-in: users enable it in Capabilities → Plugins.
- `desktop/plugin.js` is loaded **as one uncompiled ES module**. It may import only `@hermes/plugin-sdk`, `react` and `react/jsx-runtime`. No relative imports, no npm packages, no JSX syntax (use `jsx()`/`jsxs()`), no build step.
- The installer rejects `eval`, `new Function`, dynamic `import()`, injected `<script>` and prototype patching. `npm run check` mirrors those rules.
- On Windows, `HERMES_HOME` is usually `%LOCALAPPDATA%\hermes`, not `~/.hermes`. Check with `hermes dump`.

## Structure of `desktop/plugin.js`

The file is split into fixed, numbered sections. Keep them in this order:

1. **CONFIG**: palette, fonts, `NOIR_THEME`, `TYPE_TOKENS`.
2. **HOOKS**: every Hermes selector or CSS token the plugin depends on, with its source file. **If you depend on a new Hermes internal, add it here first.**
3. **HELPERS**: pure functions, exported so tests can call them.
4. **STYLES**: `buildStylesheet()`, the one injected `<style>`.
5. **FEATURES**: one `installX(ctx)` per feature, plus the `FEATURES` table.
6. **ICONS**: the generated block between `<GENERATED:icons>` markers. Never edit by hand.
7. **PLUGIN**: the default export. It runs each feature in its own try/catch.

## Rules that keep it from breaking

- **Scope every visual rule to the theme.** Rules targeting Hermes elements must start with `SCOPE` (`:root[data-hermes-theme="noir"]`). Noir's own components (`.noir-*`) render only when `useNoirActive()` is true. The stylesheet test fails on an unscoped Hermes selector.
- **Prefer stable hooks.** In order: SDK contribution areas → `data-slot` / `data-*` attributes → Hermes CSS tokens (`--conversation-*`, `--dt-*`) → class names. Never match visible text (it's translated) and never rely on Tailwind utility classes.
- **No `!important`** except to beat an inline style Hermes sets from React.
- **Features fail alone.** An installer may throw; `register()` catches it, logs it, and loads the rest. Every listener, timer, observer and DOM node an installer creates must be released through `ctx.onDispose`, `ctx.setTimeout`, `ctx.setInterval` or `ctx.onEvent`, so disabling or hot-reloading the plugin leaves nothing behind.
- **Degrade, don't crash.** If a hook is missing, that piece of styling simply doesn't apply. The self-check warns the user once per app session.
- **Respect reduced motion.** Under `prefers-reduced-motion`, remove movement. Status indicators may fade.
- **Don't rebuild what Hermes has.** Hermes already has unread markers, row menus, tool-run collapse, todo progress, model and effort pills, and Ctrl K jumps. Restyle them; don't duplicate them.

## Adding a feature

1. If it needs a Hermes internal, add a `HOOKS` entry (selector or test, `required`, `source`, `usedBy`).
2. Write `installMyFeature(ctx)` in section 5. Register UI through contribution areas (`COMPOSER_AREAS.*`, `CHAT_EMPTY_AREA`, `THEMES_AREA`, …) and CSS through `buildStylesheet()`.
3. Add a row to `FEATURES`.
4. Add tests for any pure logic in `tests/plugin.test.mjs`. Test behavior and relationships, not snapshots of current values.
5. Run `npm run verify` and `hermes plugins validate .`.
6. Check it in the running app (see "Verifying in the app").

## Icons

`scripts/icon-map.mjs` maps Codicon names (what Hermes renders) to Lucide names. After editing it, run `npm run icons` to rewrite the generated block. `npm run check` fails if the block is stale. Unmapped Codicons keep Hermes' glyph.

## After a Hermes update

1. `hermes --version`, then open the app with Noir enabled.
2. If the "styling hooks changed" notice appears, the console lists which `HOOKS` ids are missing and their source files. Find the new selector in `hermes-agent/apps/desktop/src/` and update the entry and the CSS that uses it.
3. Check `DesktopThemeColors` in `apps/desktop/src/themes/types.ts` for new required keys (the theme test lists the required ones).
4. Bump the version in **both** `plugin.yaml` and `package.json` (`npm run check` enforces they match).

## Verifying in the app

- Dev install: link the repo's `desktop/` folder into Hermes so saves hot-reload:
  `New-Item -ItemType Junction -Path "$env:LOCALAPPDATA\hermes\desktop-plugins\hermes-noir" -Target "<repo>\desktop"`.
  Remove the junction before testing a real `hermes plugins install`; never have both.
- Automated checks prove the file loads and the logic is right. They can't prove it looks right. Confirm visually in the running app before calling a change done.

## Debugging in the running app

The packaged Hermes app has no DevTools port, but renderer `console.error` output lands in `<HERMES_HOME>/logs/desktop.log` (lines tagged `[renderer console:main]`). `console.warn` does not. To inspect the real DOM or event stream, add a temporary installer marked `// TEMP-DIAGNOSTIC` that logs with `console.error(LOG_PREFIX, 'DIAG-…')`. Save (the dev junction hot-reloads it within seconds), then read the log. `npm run check` fails while any `TEMP-DIAGNOSTIC` or `DIAG-` code remains.

Lessons already paid for:
- CSS `:has()` cannot be nested. A rule with `:has(… :has(…))` is dropped silently.
- With Hermes' "glass" window effect on, the sidebar is transparent. Paint it explicitly.
- React inline colors serialize as `rgb(r, g, b)`, not hex. Match on that when searching `[style]`.
- Rearranging Hermes' composer grid with CSS broke it. Restyle the composer; don't relayout it.

## Commands

| Command | What it does |
| --- | --- |
| `npm run verify` | `check` + `test`: run before every commit |
| `npm run check` | Hermes loader/installer rules, syntax, icon block in sync, ids and versions match |
| `npm test` | Unit tests (Node's test runner, SDK stubbed in `tests/stubs/`) |
| `npm run icons` | Regenerate the icon block from `scripts/icon-map.mjs` |
| `hermes plugins validate .` | Hermes' own validator |

## Naming and credit

The product name is **Hermes Noir**, the theme label **Noir · by Essam**, the id `hermes-noir` (plugin id, `plugin.yaml` name and package name must match). Credit goes in bylines (author, homepage, README), not in identifiers.
