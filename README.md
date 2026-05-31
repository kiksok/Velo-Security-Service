# Velo Security Service

Velo Security Service is a hardened API gateway for panel-style subscription sites. It keeps the public surface small by exposing one encrypted RPC endpoint and forwarding decoded operations to the private backend.

## Public Surface

Default hardened mode exposes only:

```txt
POST /assets/event
```

The request and response bodies are AES-GCM encrypted envelopes. Public legacy routes, public status pages, plaintext forwarding, and custom encryption headers are not part of the hardened public interface.

## Security Defaults

- `HARDENED_MODE=true`
- `RPC_PROXY_ENABLED=false`
- `RPC_PATH=/assets/event`

Use an internal backend URL whenever possible:

```txt
BACKEND_DOMAIN=http://127.0.0.1:3000
```

or a Docker/private-network hostname.

## Runtime

```bash
cp .env.example .env
bun run build:bun
bun run start
```

For Docker-style deployments, keep the service bound to localhost and publish it through your web server/CDN layer:

```yaml
ports:
  - "127.0.0.1:12020:3000"
```

## Frontend Integration

Use `docs/velo-client.js` as the browser-side encrypted RPC helper. The frontend should call the single `RPC_PATH` endpoint with operation codes instead of embedding backend API paths.

Quick checkout operation codes:

```txt
201 get plan list
202 get payment methods
203 check coupon
204 get captcha
205 create order
```

Common authenticated operation codes:

```txt
1 notice list
2 user profile
3 user config
4 guest config
5 plan list
6 order list
7 order detail
8 server list
9 knowledge list
10 save invite
11 invite list
12 invite detail
13 ticket list
14 vip data
15 subscription data
16 payment methods
17 traffic log
18 user stats
19 reset security
20 check coupon
21 save order
22 checkout order
23 cancel order
24 update profile
25 transfer balance
26 withdraw ticket
27 redeem gift card
28 create ticket
29 close ticket
30 reply ticket
31 login
32 logout
33 auth check
34 register
35 change password
36 forgot password
37 send email verification
38 token login
```

## Migration Note

Existing frontends must be adapted to use the encrypted RPC helper. Do not expose backend API paths from the browser bundle.
