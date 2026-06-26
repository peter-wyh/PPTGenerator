// client.ts 不直接 import store（store import client），用桥解耦。
export interface AuthFns {
  getAccessToken: () => string | null
  setAccessToken: (token: string) => void
  clear: () => void
}

export const authBridge: { fns: AuthFns | null } = { fns: null }

export function setAuthFns(fns: AuthFns) {
  authBridge.fns = fns
}
