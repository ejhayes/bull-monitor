# bull-monitor
This is an all-in-one tool to help you visualize and report on bull! It includes:

- Real time queue monitoring of you rbull queues (just point at your redis and go)
- Prometheus metrics (configurable scraping times)
- Configurable UI support (arena or bull-board)

To get started:

  docker compose up -d bull-exporter

If you want to also run prometheus and grafana:

  docker compose up -d grafana

What's where?
- `/metrics`
- `/health`
- `/api` - swagger documentation of available endpoints
- `/queues` - UI for bull

Other services:
- localhost:3000 - bull exporter
- localhost:6002 - smtp
- localhost:6003 - SMTP Web UI (username: test, password: test)
- localhost:3001 - grafana
- localhost:3002 - prometheus

# contributing
- Open a PR

## TODO
- Config namespace events
- Docker container creation
- Github actions to build container and push to docker hub
- Dex/SAML/OIDC login
- Grafana integration help (SMTP config needed)
- Job duration metric (not working it seems???)
- Bull dashboard for grafana (to be loaded)
- Image plugin for grafana - grafana-image-renderer
- Sample webhook notification???
- Istio metrics?
- Screenshots/documentation
- Basic smoke testing
- Code climate / other code quality tools