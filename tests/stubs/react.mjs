export const useEffect = () => {}
export const useState = initial => [typeof initial === 'function' ? initial() : initial, () => {}]
