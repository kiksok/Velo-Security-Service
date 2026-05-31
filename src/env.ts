export const encoder = new TextEncoder()

export const port = process.env.PORT || 3000
export const panel = process.env.BACKEND_PANEL as 'v2b' | 'xb' || 'v2b'
export const domain = process.env.BACKEND_DOMAIN || ''
export const password = process.env.SEC_PASSWORD || ''

export const adminApi = process.env.ADMIN_API_PREFIX
export const adminEmail = process.env.ADMIN_EMAIL
export const adminPassword = process.env.ADMIN_PASSWORD
export const adminCreateUserEnabled = process.env.ADMIN_CREATE_USER_ENABLED === 'true'

export const smtpHost = process.env.MAIL_HOST
export const smtpPort = process.env.MAIL_PORT
export const smtpSecure = process.env.MAIL_SECURE === 'true'
export const smtpUser = process.env.MAIL_USER
export const smtpPassword = process.env.MAIL_PASS
export const smtpNewUserSubject = process.env.MAIL_NEWUSER_SUBJECT
export const smtpNewUserTemplate = process.env.MAIL_NEWUSER_URL

export const captchaKey = process.env.CAPTCHA_KEY
export const captchaQuickOrderEnabled = process.env.CAPTCHA_QUICK_ORDER_ENABLED === 'true'
export const captchaRegisterEnabled = process.env.CAPTCHA_REGISTER_ENABLED === 'true'
export const captchaLoginEnabled = process.env.CAPTCHA_LOGIN_ENABLED === 'true'

export const hardenedMode = process.env.HARDENED_MODE !== 'false'
export const rpcProxyEnabled = process.env.RPC_PROXY_ENABLED === 'true'
export const debugLogs = process.env.DEBUG_LOGS === 'true'
export const forceDisableRecaptcha = process.env.FORCE_DISABLE_RECAPTCHA !== 'false'

function normalizePath(path: string) {
  return path.startsWith('/') ? path : `/${path}`
}

export const rpcPath = normalizePath(process.env.RPC_PATH || '/assets/event')
export const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean)

export const proxyConfig = process.env.PROXY_URL
  ? { proxy: process.env.PROXY_URL }
  : {}

const passwordBuffer = encoder.encode(password)

const pbkdf2Key = await crypto.subtle.importKey(
  'raw',
  passwordBuffer,
  'PBKDF2',
  false,
  ['deriveBits', 'deriveKey'],
)

export const aesKey = await crypto.subtle.deriveKey(
  { name: 'PBKDF2', salt: passwordBuffer, iterations: 10000, hash: 'SHA-256' },
  pbkdf2Key,
  { name: 'AES-GCM', length: 128 },
  true,
  ['encrypt', 'decrypt'],
)
