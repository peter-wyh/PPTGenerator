/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** DEV 模式登录页预填账号（.env.local，gitignored；审计 #10） */
  readonly VITE_DEV_PREFILL_EMAIL?: string;
  /** DEV 模式登录页预填密码（.env.local，gitignored；审计 #10） */
  readonly VITE_DEV_PREFILL_PASSWORD?: string;
}
