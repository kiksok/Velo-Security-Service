# Hardened Deployment

1. Keep the backend panel on localhost or a private Docker network.
2. Bind Velo Security Service to localhost.
3. Reverse proxy only the theme site and the RPC path you choose.
4. Keep `LEGACY_ROUTES_ENABLED=false` and `PUBLIC_STATUS_ENABLED=false` in production.
5. Put the same `SEC_PASSWORD` in the service and the frontend RPC client.

The direct `docker run` guide is in `docs/docker-run.md`.

Minimal reverse proxy idea:

```txt
/assets/event -> http://127.0.0.1:12020/assets/event
```

The public site does not need to expose health checks or backend API paths.
