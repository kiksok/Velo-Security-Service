import { bodyParser } from '@koa/bodyparser'
import cors from '@koa/cors'
import chalk from 'chalk'
import Koa from 'koa'
import {
  allowedOrigins,
  domain,
  hardenedMode,
  password,
  port,
} from './env'
import { router } from './routes'
import { BackendService } from './services/backend'
import { MailerService } from './services/mailer'

const app = new Koa()

app.use(bodyParser({
  encoding: 'utf-8',
  enableTypes: ['json', 'text', 'form'],
  extendTypes: {
    json: ['application/json'],
    text: ['text/plain', 'application/octet-stream'],
    form: ['application/x-www-form-urlencoded'],
  },
}))

app.use(cors({
  origin: (ctx: Koa.Context) => {
    const origin = ctx.get('Origin')
    if (!origin) {
      return ''
    }
    if (allowedOrigins.includes('*')) {
      return origin
    }
    return allowedOrigins.includes(origin) ? origin : ''
  },
  allowMethods: ['POST', 'OPTIONS'],
  allowHeaders: ['authorization', 'content-type'],
  exposeHeaders: ['content-type'],
}))

app.use(router.routes())
app.use(router.allowedMethods())

app.use(async (ctx) => {
  if (ctx.status === 404 && !ctx.body) {
    ctx.body = ''
  }
})

;(async () => {
  if (!domain || !password) {
    console.error(chalk.bgRedBright('ERROR:'), 'Please set BACKEND_DOMAIN and SEC_PASSWORD')
    process.exit(1)
  }

  await BackendService.instance.initAdminToken()
  await MailerService.instance.init()

  app.listen(port, () => {
    console.log(chalk.bgGreen('SUCCESS:'), `Velo Security Service is listening on http://localhost:${port}`)
    console.log(chalk.bgYellow('MODE:'), hardenedMode ? 'hardened-rpc' : 'rpc')
  })
})()
