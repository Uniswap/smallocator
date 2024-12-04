declare module 'webauthn-p256' {
  type Record<K extends string | number | symbol, V> = { [P in K]: V };
  export type fallback = Record<string, unknown>;
}
