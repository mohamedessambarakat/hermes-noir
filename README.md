# Hermes Noir

**A pure-black, monochrome restyle of the [Hermes Agent](https://github.com/NousResearch/hermes-agent) desktop app. By [Essam](https://essam.pro).**

Noir turns Hermes into a quiet, Vercel-style workspace: a true `#000` canvas, white and grays only (color is kept for success, warning and error), Geist type, rounded Lucide icons, and a Claude-style live status line while the agent works.

It's a regular Hermes plugin. It never touches Hermes' own files, so `hermes update` keeps working and you can switch back to any other theme at any time.

## What it changes

| Area | Change |
| --- | --- |
| Theme | **Noir · by Essam** in Settings → Appearance: pure black, monochrome, dark only |
| Type | Geist and Geist Mono, 15px chat text with a 1.6 line height |
| Icons | Hermes' sharp Codicons swapped for rounded Lucide icons |
| Sidebar | Larger text, hairline dividers between sections, calm hover and press motion, a tint on sessions where the agent is working |
| Status line | Above the input while a task runs: an animated spark, `1m 6s · 1.7k tokens · Running tools…` |
| Context ring | Next to the send button, fills as the context window fills (turns amber at 75%, red at 90%) |
| Empty chat | A short hint: press Ctrl K to jump to any session, project or skill |

Every visual change applies only while the Noir theme is selected. Pick another theme and Hermes looks stock again, with the plugin still installed.

With Windows "Animation effects" (or macOS "Reduce motion") turned on, the status spark fades instead of spinning, and other motion is removed.

## Install

Requires the Hermes desktop app. Noir is built against Hermes v0.21.5.

```bash
hermes plugins install mohamedessambarakat/hermes-noir
```

Then in Hermes: **Capabilities → Plugins → Hermes Noir → on**. The first time it loads, Noir switches you to the Noir theme once. After that, your theme choice is yours.

For the intended sizes, set **Settings → Appearance → Zoom** to 100%.

### Update

```bash
hermes plugins update hermes-noir
```

### Remove

```bash
hermes plugins remove hermes-noir
```

## If something looks off after a Hermes update

Noir restyles parts of Hermes that aren't a formal plugin API. When a Hermes update renames one of them, Noir shows a one-time notice ("N styling hooks changed…") and the affected piece falls back to Hermes' default look. Nothing breaks. Update Noir, or open an issue with your Hermes version (`hermes --version`).

## Develop

See [AGENTS.md](AGENTS.md) for how the plugin is structured and the rules for changing it.

```bash
npm install
npm run verify   # static checks + tests
```

## Credits

Made by [Essam](https://essam.pro). Icons: [Lucide](https://lucide.dev) (ISC). Fonts: [Geist](https://vercel.com/font) (SIL OFL 1.1), loaded from Google Fonts.

## License

[MIT](LICENSE) © Essam
