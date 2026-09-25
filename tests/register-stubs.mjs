// Lets Node import desktop/plugin.js in tests: the Hermes-only specifiers
// resolve to local stubs; everything else resolves normally.
import { register } from 'node:module'

register('./stub-loader.mjs', import.meta.url)
