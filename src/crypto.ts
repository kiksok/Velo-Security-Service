import type { BufferSource } from 'node:stream/web'
import { randomBytes } from 'node:crypto'
import { aesKey, encoder } from './env'

function toBase64Url(data: Buffer) {
  return data
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

function fromBase64Url(value: string) {
  const normalized = value.trim().replace(/-/g, '+').replace(/_/g, '/')
  const padding = normalized.length % 4 === 0 ? '' : '='.repeat(4 - normalized.length % 4)
  return Buffer.from(`${normalized}${padding}`, 'base64')
}

export async function decrypt(encrypted: BufferSource, salt: BufferSource) {
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', length: 128, iv: salt },
    aesKey,
    encrypted,
  )

  return new TextDecoder().decode(decrypted)
}

export async function encrypt(data: BufferSource, salt: BufferSource) {
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', length: 128, iv: salt },
    aesKey,
    data,
  )

  return Buffer.from(encrypted).toString('base64')
}

export async function decryptEnvelope(payload: string | Buffer) {
  const packet = Buffer.isBuffer(payload) ? payload : fromBase64Url(payload)
  if (packet.length <= 12) {
    throw new Error('Invalid encrypted packet')
  }

  const salt = packet.subarray(0, 12)
  const encrypted = packet.subarray(12)
  return decrypt(encrypted, salt)
}

export async function encryptEnvelope(data: unknown) {
  const salt = randomBytes(12)
  const plaintext = typeof data === 'string' ? data : JSON.stringify(data)
  const encrypted = await encrypt(encoder.encode(plaintext), salt)
  return toBase64Url(Buffer.concat([salt, Buffer.from(encrypted, 'base64')]))
}
