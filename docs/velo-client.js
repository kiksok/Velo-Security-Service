const textEncoder = new TextEncoder()
const textDecoder = new TextDecoder()

function toBase64Url(bytes) {
  let binary = ''
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte)
  })
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

function fromBase64Url(value) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4)
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes
}

async function deriveKey(password) {
  const passwordBytes = textEncoder.encode(password)
  const baseKey = await crypto.subtle.importKey(
    'raw',
    passwordBytes,
    'PBKDF2',
    false,
    ['deriveKey'],
  )

  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: passwordBytes, iterations: 10000, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 128 },
    false,
    ['encrypt', 'decrypt'],
  )
}

async function seal(data, key) {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const plaintext = textEncoder.encode(JSON.stringify(data))
  const encrypted = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext))
  const packet = new Uint8Array(iv.length + encrypted.length)
  packet.set(iv, 0)
  packet.set(encrypted, iv.length)
  return toBase64Url(packet)
}

async function open(packet, key) {
  const bytes = fromBase64Url(packet)
  const iv = bytes.slice(0, 12)
  const encrypted = bytes.slice(12)
  const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, encrypted)
  return JSON.parse(textDecoder.decode(plaintext))
}

export async function createVeloClient(options) {
  const key = await deriveKey(options.password)

  return {
    async request(op, payload = {}) {
      const body = await seal({ op, ...payload }, key)
      const response = await fetch(options.endpoint, {
        method: 'POST',
        headers: {
          'content-type': 'text/plain',
        },
        body,
      })

      if (!response.ok) {
        throw new Error(`RPC request rejected with HTTP ${response.status}`)
      }

      return open(await response.text(), key)
    },
  }
}

export const VeloOps = {
  quickPlan: 201,
  quickPayment: 202,
  quickCoupon: 203,
  quickCaptcha: 204,
  quickOrder: 205,
  login: 31,
  register: 34,
  userInfo: 2,
  guestConfig: 4,
  userConfig: 3,
  planFetch: 5,
  orderFetch: 6,
  orderSave: 21,
  orderCheckout: 22,
}
