# Docker Run Deployment

The fastest deployment path is:

1. Build the image on the server.
2. Run the container bound to localhost.
3. Reverse proxy only the RPC path from your public site.

## Build

```bash
git clone https://github.com/kiksok/Velo-Security-Service.git
cd Velo-Security-Service
docker build -t velo-security-service:0.1.0 .
```

## Run

Use this when the backend panel runs on the same host:

```bash
docker rm -f velo-security-service 2>/dev/null || true

docker run -d \
  --name velo-security-service \
  --restart always \
  --add-host=host.docker.internal:host-gateway \
  -p 127.0.0.1:12020:3000 \
  -e PORT=3000 \
  -e BACKEND_PANEL=xb \
  -e BACKEND_DOMAIN=http://host.docker.internal:1024 \
  -e SEC_PASSWORD='change-this-to-a-long-random-secret' \
  -e HARDENED_MODE=true \
  -e RPC_PATH=/assets/event \
  -e ALLOWED_ORIGINS=https://your-theme-domain.example \
  -e RPC_PROXY_ENABLED=false \
  velo-security-service:0.1.0
```

Use optional quick checkout variables only when you need quick checkout:

```bash
  -e ADMIN_API_PREFIX=your-admin-api-prefix \
  -e ADMIN_EMAIL=admin@example.com \
  -e ADMIN_PASSWORD='your-admin-password' \
  -e ADMIN_CREATE_USER_ENABLED=false \
  -e CAPTCHA_KEY='change-this-captcha-secret' \
  -e CAPTCHA_QUICK_ORDER_ENABLED=true \
  -e CAPTCHA_REGISTER_ENABLED=true \
  -e CAPTCHA_LOGIN_ENABLED=true \
  -e MAIL_HOST=smtp.example.com \
  -e MAIL_PORT=465 \
  -e MAIL_SECURE=true \
  -e MAIL_USER=notice@example.com \
  -e MAIL_PASS='your-smtp-password' \
  -e MAIL_NEWUSER_SUBJECT='Welcome'
```

## Reverse Proxy

Expose only the RPC path:

```txt
/assets/event -> http://127.0.0.1:12020/assets/event
```

Do not expose a status page or backend API paths.

## Checks

Plain browser access should look uninteresting:

```bash
curl -i http://127.0.0.1:12020/
curl -i http://127.0.0.1:12020/assets/event
```

Expected result: empty `404` or method rejection for non-encrypted/non-POST requests. A real frontend request must use the encrypted RPC client and the same `SEC_PASSWORD`.
