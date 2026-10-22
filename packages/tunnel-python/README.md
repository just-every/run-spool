# spool_tunnel

A single-file, standard-library Python tunnel for the Sentry browser SDK's `tunnel` option. Copy `spool_tunnel.py` into your server, create `Tunnel(dsn=...)` with your Spool project DSN and expose it at a same-origin path:

```python
tunnel = Tunnel(dsn=os.environ["SPOOL_DSN"])
# WSGI: mount tunnel.wsgi at "/monitoring" (POST only).
# Other frameworks: status, headers, body = tunnel.forward(request_body, lower_cased_headers, client_address)
```

Then change only the browser SDK's `tunnel` option to that path. The handler reads the envelope's DSN header and forwards the envelope only when that DSN is one it was configured with (a different public key, host or project is refused with 403, and nothing is forwarded). It forwards the browser's `Origin`, `Referer` and `User-Agent`, so the project's allowed origins and inbound filters still apply, and the client address as `X-Forwarded-For`. Spool does not yet honour a forwarded address from a trusted tunnel (SDK-008); until it does, events carry the tunnel's own address. Redirects from upstream are never followed (502), and the 1 MiB envelope limit is enforced on the received body and again while it is inflated, so a small gzip body that expands past it is refused (413) without being expanded.
