const STUBS = {
  '@hermes/plugin-sdk': new URL('./stubs/plugin-sdk.mjs', import.meta.url).href,
  react: new URL('./stubs/react.mjs', import.meta.url).href,
  'react/jsx-runtime': new URL('./stubs/jsx-runtime.mjs', import.meta.url).href
}

export async function resolve(specifier, context, nextResolve) {
  if (STUBS[specifier]) return { url: STUBS[specifier], shortCircuit: true }
  return nextResolve(specifier, context)
}
