import type { CaptchaCheckOptions, CaptchaType } from '../types/captcha'
import { createHash } from 'node:crypto'
import chalk from 'chalk'
import CaptchaPng from '../captchapng/captchapng'
import { captchaKey, captchaLoginEnabled, captchaQuickOrderEnabled, captchaRegisterEnabled } from '../env'

function generateContrastColors(): {
  background: [number, number, number, number]
  foreground: [number, number, number, number]
} {
  // 随机生成背景色（RGBA）
  const r = Math.floor(Math.random() * 256)
  const g = Math.floor(Math.random() * 256)
  const b = Math.floor(Math.random() * 256)
  const background: [number, number, number, number] = [r, g, b, 255] // A固定为255（不透明）

  // 计算背景色的相对亮度（公式来自WCAG 2.0）
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255

  // 基于背景亮度选择高对比度的前景色
  // 亮度 > 0.5 时使用深色前景，否则使用浅色前景
  const foreground: [number, number, number, number]
    = luminance > 0.5 ? [0, 0, 0, 255] : [255, 255, 255, 255]

  return { background, foreground }
}

export async function generateCaptchaData() {
  const code = Math.floor(Math.random() * 9000) + 1000
  const colors = generateContrastColors()
  const p = new CaptchaPng(180, 60, code) // 生成一个4位数的验证码
  p.color(...colors.background) // First color: background (red, green, blue, alpha)
  p.color(...colors.foreground) // Second color: paint (red, green, blue, alpha)
  return {
    code: code.toString(),
    dataURL: `data:image/png;base64,${p.getBase64()}`,
  }
}

export function generateCaptchaHash(options: {
  code: string
  type: CaptchaType
  timestamp: number
  captchaKey: string
}): string {
  const { code, type, timestamp, captchaKey } = options
  return createHash('sha256').update(`${timestamp}${code.toLowerCase()}${type}${captchaKey}`).digest('base64')
}

export function verifyCaptchaHash(options: {
  code: string
  type: CaptchaType
  timestamp: number
  captchaKey: string
  hash: string
}): boolean {
  const { code, type, timestamp, captchaKey, hash } = options
  const verifyHash = generateCaptchaHash({ code, type, timestamp, captchaKey })
  return verifyHash === hash
}

export function checkCaptcha(type: CaptchaType, data?: CaptchaCheckOptions) {
  if (!captchaKey) {
    return true
  }

  // 根据类型检查是否启用验证码校验
  let hasCheck: boolean
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
    default:
      hasCheck = false
      break
  }
  if (!hasCheck) {
    console.log(chalk.bgGrey('PASS:'), `${type}路由 =>  图形验证码校验跳过`)
    return true
  }

  // 检查是否提供了验证码
  if (!data || !data.code || !data.type || !data.timestamp || !data.hash) {
    return {
      error: true,
      code: 502,
      message: '缺少验证码',
    }
  }

  // 检查验证码类型是否一致
  if (data.type !== type) {
    return {
      error: true,
      code: 502,
      message: '验证码类型不匹配',
    }
  }

  // 检查时间戳是否在有效范围内
  if (Date.now() - Number(data.timestamp) > 5 * 60 * 1000) {
    return {
      error: true,
      code: 502,
      message: '验证码已过期',
    }
  }

  // 验证验证码哈希
  if (!verifyCaptchaHash({ code: data.code, type: data.type, timestamp: data.timestamp, captchaKey, hash: data.hash })) {
    return {
      error: true,
      code: 502,
      message: '验证码无效',
    }
  }

  console.log(chalk.bgGreen('SUCCESS:'), `${type}路由 =>  图形验证码校验通过`)
  return true
}
