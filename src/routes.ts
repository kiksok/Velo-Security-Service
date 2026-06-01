import type Koa from 'koa'
import type { PlanPeriodKey } from './services/backend'
import type { CaptchaCheckOptions, CaptchaType } from './types/captcha'
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import KoaRouter from '@koa/router'
import chalk from 'chalk'
import { decryptEnvelope, encryptEnvelope } from './crypto'
import {
  adminCreateUserEnabled,
  captchaKey,
  captchaLoginEnabled,
  captchaQuickOrderEnabled,
  captchaRegisterEnabled,
  debugLogs,
  domain,
  forceDisableRecaptcha,
  proxyConfig,
  rpcPath,
  rpcProxyEnabled,
  studioAllowedEmails,
  studioConfigRoot,
  smtpNewUserSubject,
} from './env'
import { BackendService } from './services/backend'
import { checkCaptcha, generateCaptchaData, generateCaptchaHash } from './services/captcha'
import { MailerService } from './services/mailer'
import { renderHtml } from './utlis'

export const router = new KoaRouter()

interface RpcRequest {
  op?: number | string
  method?: string
  path?: string
  query?: Record<string, string | readonly string[]>
  body?: unknown
  data?: unknown
  headers?: Record<string, string>
  token?: string
  captcha?: CaptchaCheckOptions
}

interface BackendRoute {
  method: string
  path: string
}

interface BackendResult {
  ok: boolean
  status: number
  contentType?: string
  body: unknown
}

interface PublicRequestMeta {
  baseUrl?: string
}

interface StudioWritePayload {
  config?: string
  locale?: string
}

const backendRoutes: Record<string, BackendRoute> = {
  1: { method: 'GET', path: '/api/v1/user/notice/fetch' },
  2: { method: 'GET', path: '/api/v1/user/info' },
  3: { method: 'GET', path: '/api/v1/user/comm/config' },
  4: { method: 'GET', path: '/api/v1/guest/comm/config' },
  5: { method: 'GET', path: '/api/v1/user/plan/fetch' },
  6: { method: 'GET', path: '/api/v1/user/order/fetch' },
  7: { method: 'GET', path: '/api/v1/user/order/detail' },
  8: { method: 'GET', path: '/api/v1/user/server/fetch' },
  9: { method: 'GET', path: '/api/v1/user/knowledge/fetch' },
  10: { method: 'POST', path: '/api/v1/user/invite/save' },
  11: { method: 'GET', path: '/api/v1/user/invite/fetch' },
  12: { method: 'GET', path: '/api/v1/user/invite/details' },
  13: { method: 'GET', path: '/api/v1/user/ticket/fetch' },
  14: { method: 'GET', path: '/api/v1/bing/vip' },
  15: { method: 'GET', path: '/api/v1/user/getSubscribe' },
  16: { method: 'GET', path: '/api/v1/user/order/getPaymentMethod' },
  17: { method: 'GET', path: '/api/v1/user/stat/getTrafficLog' },
  18: { method: 'GET', path: '/api/v1/user/getStat' },
  19: { method: 'POST', path: '/api/v1/user/resetSecurity' },
  20: { method: 'POST', path: '/api/v1/user/coupon/check' },
  21: { method: 'POST', path: '/api/v1/user/order/save' },
  22: { method: 'POST', path: '/api/v1/user/order/checkout' },
  23: { method: 'POST', path: '/api/v1/user/order/cancel' },
  24: { method: 'POST', path: '/api/v1/user/update' },
  25: { method: 'POST', path: '/api/v1/user/transfer' },
  26: { method: 'POST', path: '/api/v1/user/ticket/withdraw' },
  27: { method: 'POST', path: '/api/v1/user/redeemgiftcard' },
  28: { method: 'POST', path: '/api/v1/user/ticket/save' },
  29: { method: 'POST', path: '/api/v1/user/ticket/close' },
  30: { method: 'POST', path: '/api/v1/user/ticket/reply' },
  31: { method: 'POST', path: '/api/v1/passport/auth/login' },
  32: { method: 'GET', path: '/api/v1/user/logout' },
  33: { method: 'POST', path: '/api/v1/passport/auth/check' },
  34: { method: 'POST', path: '/api/v1/passport/auth/register' },
  35: { method: 'POST', path: '/api/v1/user/changePassword' },
  36: { method: 'POST', path: '/api/v1/passport/auth/forget' },
  37: { method: 'POST', path: '/api/v1/passport/comm/sendEmailVerify' },
  38: { method: 'POST', path: '/api/v1/passport/auth/token2Login' },
}

function dataOf<T>(request: RpcRequest) {
  return (request.data ?? request.body ?? {}) as T
}

function removeCaptcha(body: unknown) {
  if (body && typeof body === 'object' && 'captcha' in body) {
    delete (body as { captcha?: CaptchaCheckOptions }).captcha
  }
}

function checkRouteCaptcha(type: CaptchaType, request: RpcRequest) {
  const body = dataOf<{ captcha?: CaptchaCheckOptions }>(request)
  const result = checkCaptcha(type, request.captcha || body.captcha)
  if (result !== true) {
    return {
      ok: false,
      status: 400,
      body: {
        code: result.code,
        message: result.message,
      },
    } satisfies BackendResult
  }
  removeCaptcha(body)
  request.data = body
  request.body = body
  return null
}

async function encryptedReply(ctx: Koa.Context, data: BackendResult) {
  ctx.status = 200
  ctx.type = 'application/octet-stream'
  ctx.body = await encryptEnvelope(data)
}

function toBase64Url(data: string) {
  return Buffer.from(data)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

function fromBase64Url(value: string) {
  const normalized = value.trim().replace(/-/g, '+').replace(/_/g, '/')
  const padding = normalized.length % 4 === 0 ? '' : '='.repeat(4 - normalized.length % 4)
  return Buffer.from(`${normalized}${padding}`, 'base64').toString()
}

function compactReply(ctx: Koa.Context, data: BackendResult) {
  ctx.status = 200
  ctx.type = 'text/plain; charset=utf-8'
  ctx.body = toBase64Url(JSON.stringify(data))
}

function expandCompactRequest(data: Record<string, unknown>): RpcRequest {
  return {
    op: data.o as RpcRequest['op'],
    method: data.m as RpcRequest['method'],
    query: data.q as RpcRequest['query'],
    data: data.d,
    path: data.p as RpcRequest['path'],
    headers: data.h as RpcRequest['headers'],
    token: data.t as RpcRequest['token'],
    captcha: data.c as RpcRequest['captcha'],
  }
}

function parseCompactEnvelope(rawBody: string) {
  const data = JSON.parse(fromBase64Url(rawBody))
  if (!data || typeof data !== 'object' || !('o' in data)) {
    return null
  }

  return expandCompactRequest(data as Record<string, unknown>)
}

function camouflage(ctx: Koa.Context) {
  ctx.status = 404
  ctx.body = ''
}

function parseMaybeJson(text: string, contentType: string) {
  if (!text) {
    return null
  }
  if (!contentType.includes('json')) {
    return text
  }
  try {
    return JSON.parse(text)
  }
  catch {
    return text
  }
}

function getStudioPaths() {
  if (!studioConfigRoot) {
    return null
  }

  return {
    configPath: join(studioConfigRoot, 'config.js'),
    localePath: join(studioConfigRoot, 'locales', 'zh-CN.json'),
    localeMirrorPath: join(studioConfigRoot, 'assets', 'BwgpI1-f.json'),
  }
}

function getPublicBaseUrl(ctx: Koa.Context) {
  const origin = ctx.get('Origin')
  if (origin) {
    try {
      return new URL(origin).origin
    }
    catch {
      return undefined
    }
  }

  const forwardedProto = ctx.get('X-Forwarded-Proto')
  const forwardedHost = ctx.get('X-Forwarded-Host')
  if (forwardedHost) {
    return `${forwardedProto || ctx.protocol}://${forwardedHost}`
  }

  const host = ctx.get('Host')
  if (!host) {
    return undefined
  }

  return `${ctx.protocol}://${host}`
}

function rewriteAppUrl(body: unknown, publicBaseUrl?: string) {
  if (!publicBaseUrl || !body || typeof body !== 'object') {
    return body
  }

  if (!('data' in body)) {
    return body
  }

  const data = (body as { data?: unknown }).data
  if (!data || typeof data !== 'object' || !('app_url' in data)) {
    return body
  }

  return {
    ...(body as Record<string, unknown>),
    data: {
      ...(data as Record<string, unknown>),
      app_url: publicBaseUrl,
    },
  }
}

function rewritePublicConfig(body: unknown, publicBaseUrl?: string) {
  const rewritten = rewriteAppUrl(body, publicBaseUrl)
  if (!forceDisableRecaptcha || !rewritten || typeof rewritten !== 'object' || !('data' in rewritten)) {
    return rewritten
  }

  const data = (rewritten as { data?: unknown }).data
  if (!data || typeof data !== 'object') {
    return rewritten
  }

  return {
    ...(rewritten as Record<string, unknown>),
    data: {
      ...(data as Record<string, unknown>),
      is_recaptcha: 0,
      recaptcha_site_key: '',
    },
  }
}

function safeForwardHeaders(source?: Record<string, string>, token?: string) {
  const headers = new Headers()
  const blocked = new Set(['host', 'content-length', 'connection'])

  for (const [key, value] of Object.entries(source || {})) {
    const lower = key.toLowerCase()
    if (!blocked.has(lower)) {
      headers.set(key, value)
    }
  }

  if (token) {
    headers.set('Authorization', token)
  }
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  return headers
}

async function proxyToBackend(options: {
  method: string
  path: string
  query?: Record<string, string | readonly string[]>
  body?: unknown
  headers?: Record<string, string>
  token?: string
}): Promise<BackendResult> {
  const url = new URL(domain)
  url.pathname = options.path
  if (options.query) {
    url.search = new URLSearchParams(options.query).toString()
  }

  const method = options.method.toUpperCase()
  const init: RequestInit = {
    method,
    headers: safeForwardHeaders(options.headers, options.token),
    ...proxyConfig,
  }

  if (method !== 'GET' && method !== 'HEAD' && options.body !== undefined) {
    init.body = typeof options.body === 'string' ? options.body : JSON.stringify(options.body)
  }

  const response = await fetch(url, init)
  const contentType = response.headers.get('content-type') || ''
  const text = await response.text()

  return {
    ok: response.ok,
    status: response.status,
    contentType,
    body: parseMaybeJson(text, contentType),
  }
}

async function getUserEmailByToken(token?: string) {
  if (!token) {
    return null
  }

  const result = await proxyToBackend({
    method: 'GET',
    path: '/api/v1/user/info',
    token,
  })

  if (!result.ok || !result.body || typeof result.body !== 'object') {
    return null
  }

  const body = result.body as {
    data?: { email?: unknown }
    email?: unknown
  }

  const email = body.data?.email || body.email
  return typeof email === 'string' ? email.toLowerCase() : null
}

async function backupAndWriteFile(path: string, content: string) {
  await mkdir(dirname(path), { recursive: true })
  const backupPath = `${path}.bak-${Date.now()}`

  try {
    await copyFile(path, backupPath)
  }
  catch {}

  await writeFile(path, content, 'utf8')
}

async function writeStudioFiles(data: StudioWritePayload) {
  const paths = getStudioPaths()
  if (!paths) {
    return {
      ok: false,
      status: 500,
      body: {
        message: 'Studio root is not configured',
      },
    } satisfies BackendResult
  }

  const { config = '', locale = '' } = data
  if (!config.startsWith('window.CONFIG = ')) {
    return {
      ok: false,
      status: 400,
      body: {
        message: 'Invalid config payload',
      },
    } satisfies BackendResult
  }

  try {
    JSON.parse(locale)
  }
  catch {
    return {
      ok: false,
      status: 400,
      body: {
        message: 'Invalid locale payload',
      },
    } satisfies BackendResult
  }

  await backupAndWriteFile(paths.configPath, config)
  await backupAndWriteFile(paths.localePath, locale)
  await backupAndWriteFile(paths.localeMirrorPath, locale)

  return {
    ok: true,
    status: 200,
    body: {
      savedAt: Date.now(),
      files: ['config.js', 'locales/zh-CN.json', 'assets/BwgpI1-f.json'],
    },
  } satisfies BackendResult
}

async function quickCaptcha(request: RpcRequest): Promise<BackendResult> {
  const data = dataOf<{ type?: CaptchaType }>(request)
  const type = data.type || 'quick'

  let hasCheck = false
  switch (type) {
    case 'quick':
      hasCheck = captchaQuickOrderEnabled
      break
    case 'register':
      hasCheck = captchaRegisterEnabled
      break
    case 'login':
      hasCheck = captchaLoginEnabled
      break
  }

  if (!captchaKey || !hasCheck) {
    return { ok: true, status: 200, body: { data: null } }
  }

  const timestamp = Date.now()
  const { code, dataURL } = await generateCaptchaData()
  const hash = generateCaptchaHash({ code, type, timestamp, captchaKey })

  return {
    ok: true,
    status: 200,
    body: {
      data: dataURL,
      timestamp,
      hash,
    },
  }
}

async function quickOrder(request: RpcRequest): Promise<BackendResult> {
  const captchaError = checkRouteCaptcha('quick', request)
  if (captchaError) {
    return captchaError
  }

  const { email, password, planId, period, couponCode, inviteCode } = dataOf<{
    email: string
    password: string
    planId: string
    period: PlanPeriodKey
    couponCode?: string
    inviteCode?: string
  }>(request)

  if (couponCode) {
    const couponData = await BackendService.instance.getCouponData({
      code: couponCode,
      plan_id: planId.toString(),
      period,
    })

    if (!couponData || !couponData.data || !couponData.data.value) {
      const message = (couponData as { message?: string } | undefined)?.message || '优惠券无效'
      return {
        ok: false,
        status: 400,
        body: {
          code: 500,
          message,
        },
      }
    }
  }

  const checkUserExist = await BackendService.instance.checkUser(email)
  if (checkUserExist) {
    return {
      ok: false,
      status: 400,
      body: {
        code: 500,
        message: '用户已存在',
      },
    }
  }

  const authToken = adminCreateUserEnabled
    ? await BackendService.instance.createUserForAdmin({ email, password })
    : await BackendService.instance.createUser({ email, password, invite_code: inviteCode })

  const order = await BackendService.instance.createOrder({
    token: authToken,
    plan_id: planId,
    period,
    coupon_code: couponCode,
  })

  const template = MailerService.instance.newUserTemplate
    ? {
        html: renderHtml(MailerService.instance.newUserTemplate, { email, password }),
      }
    : {
        text: `${smtpNewUserSubject}\n\n账号信息:\n邮箱: ${email}\n密码: ${password}`,
      }
  MailerService.instance.sendMail(email, smtpNewUserSubject || '通知', template).catch((err) => {
    if (debugLogs) {
      console.error(chalk.bgRed('ERROR:'), 'send new-user mail failed:', err)
    }
  })

  return {
    ok: true,
    status: 200,
    body: {
      authToken,
      orderId: order,
    },
  }
}

async function dispatchRpc(request: RpcRequest, meta: PublicRequestMeta): Promise<BackendResult> {
  const op = String(request.op ?? '')

  switch (op) {
    case 'quick.plan':
    case '201':
      return { ok: true, status: 200, body: await BackendService.instance.getPlanList() }
    case 'quick.payment':
    case '202':
      return { ok: true, status: 200, body: await BackendService.instance.getOrderPayments() }
    case 'quick.coupon':
    case '203':
      return { ok: true, status: 200, body: await BackendService.instance.getCouponData(dataOf(request)) }
    case 'quick.captcha':
    case '204':
      return quickCaptcha(request)
    case 'quick.order':
    case '205':
      return quickOrder(request)
    case 'studio.write': {
      if (!studioAllowedEmails.length) {
        return {
          ok: false,
          status: 403,
          body: {
            message: 'Studio save is not enabled',
          },
        }
      }

      const email = await getUserEmailByToken(request.token)
      if (!email || !studioAllowedEmails.includes(email)) {
        return {
          ok: false,
          status: 403,
          body: {
            message: 'Studio save is not allowed for this account',
          },
        }
      }

      return writeStudioFiles(dataOf<StudioWritePayload>(request))
    }
  }

  const route = backendRoutes[op]
  if (route) {
    if (route.path === '/api/v1/passport/auth/login') {
      const captchaError = checkRouteCaptcha('login', request)
      if (captchaError) {
        return captchaError
      }
    }
    if (route.path === '/api/v1/passport/auth/register') {
      const captchaError = checkRouteCaptcha('register', request)
      if (captchaError) {
        return captchaError
      }
    }

    const result = await proxyToBackend({
      method: request.method || route.method,
      path: route.path,
      query: request.query,
      body: dataOf(request),
      headers: request.headers,
      token: request.token,
    })

    if (op === '3' || op === '4') {
      return {
        ...result,
        body: rewritePublicConfig(result.body, meta.baseUrl),
      }
    }

    return result
  }

  if (rpcProxyEnabled && request.path) {
    return proxyToBackend({
      method: request.method || 'GET',
      path: request.path,
      query: request.query,
      body: request.body ?? request.data,
      headers: request.headers,
      token: request.token,
    })
  }

  return {
    ok: false,
    status: 404,
    body: {
      message: 'Not found',
    },
  }
}

router.post(rpcPath, async (ctx: Koa.Context) => {
  let request: RpcRequest | null = null
  let compactMode = false

  try {
    const rawBody = typeof ctx.request.body === 'string' ? ctx.request.body : ctx.request.rawBody
    if (!rawBody) {
      camouflage(ctx)
      return
    }

    try {
      request = parseCompactEnvelope(rawBody)
      compactMode = !!request
    }
    catch {}

    if (!request) {
      request = JSON.parse(await decryptEnvelope(rawBody)) as RpcRequest
    }
  }
  catch (error) {
    if (debugLogs) {
      console.error('RPC envelope rejected:', error)
    }
    camouflage(ctx)
    return
  }

  try {
    const result = await dispatchRpc(request, {
      baseUrl: getPublicBaseUrl(ctx),
    })

    if (compactMode) {
      compactReply(ctx, result)
    }
    else {
      await encryptedReply(ctx, result)
    }
  }
  catch (error) {
    if (debugLogs) {
      console.error('RPC dispatch failed:', error)
    }
    const result = {
      ok: false,
      status: 500,
      body: {
        message: 'Request failed',
      },
    }

    if (compactMode) {
      compactReply(ctx, result)
    }
    else {
      await encryptedReply(ctx, result)
    }
  }
})
