# PwndaServer

Infrastructure and front-end code from [pwnda.org](https://pwnda.org), a self-hosted multi-coin
mining pool and non-custodial wallet service run as a one-person operation.

## What is here

- `services/cmd/pool-coin-router` - the stratum router in front of the pools. Miners whose
  software sends no TLS SNI arrive here, and the router picks the right pool by reading the first
  line of the stratum handshake.
- `web` - the public website: React and TypeScript, prerendered to static HTML at build time.
- `docs/architecture.md` - how the whole system fits together, including the parts that are not
  published here.

## What is not here

The payout engine, the exchange integrations, the admin dashboards. The
architecture page describes them at design level

The wallet client is a separate project and is already open source at
[PwndaWallet](https://github.com/pwndaCreate/PwndaWallet) - a non-custodial wallet needs an
auditable client, so that one is public by design.

## Run it

```
cd services && go test ./cmd/pool-coin-router/ && go build -o pool-coin-router ./cmd/pool-coin-router/
./pool-coin-router --listen 127.0.0.1:<port> --zephyr 127.0.0.1:<port> \
                   --zano 127.0.0.1:<port> --xelis 127.0.0.1:<port>
cd web && npm ci && npm run build      # static site in web/dist
```

## Attribution

The Zephyr and Zano pools this infrastructure serves run patched forks of
[cryptonote-nodejs-pool](https://github.com/dvandal/cryptonote-nodejs-pool), and the Xelis pool a
patched [xelis-pool](https://github.com/xelis-project/xelis-pool). Neither is vendored here.

## Status

In production since 2026, live at [pwnda.org](https://pwnda.org).

## License

MIT - see [LICENSE](LICENSE).
