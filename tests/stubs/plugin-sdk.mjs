// Minimal stand-in for '@hermes/plugin-sdk', enough for plugin.js to import in Node.
export function atom(initial) {
  let value = initial
  const listeners = new Set()
  return {
    get: () => value,
    set(next) {
      value = next
      for (const listener of listeners) listener(value)
    },
    subscribe(listener) {
      listeners.add(listener)
      listener(value)
      return () => listeners.delete(listener)
    }
  }
}

export const CHAT_EMPTY_AREA = 'chat.empty'
export const COMPOSER_AREAS = { top: 'composer.top', actions: 'composer.actions' }
export const THEMES_AREA = 'themes'
export const host = {
  notify: () => {},
  state: {
    busy: atom(false),
    busyBySession: atom({}),
    focusedSessionId: atom(null),
    focusedUsage: atom(null)
  }
}
export const Kbd = () => null
export const requestTheme = () => true
export const useTheme = () => ({ themeName: 'noir' })
export const useValue = store => store.get()
export const Popover = () => null
export const PopoverContent = () => null
export const PopoverTrigger = () => null
