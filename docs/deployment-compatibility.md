# Deployment compatibility

`deployment/compatibility/1.0.0.json` is the versioned hand-off between application review and deployment. It records:

- the reviewed source commit for each repository;
- the exact generated/vendored OpenAPI and design-token bytes used by Portfolio;
- every image repository and the environment variable that must supply its immutable digest.

An image marked `unpublished` deliberately has `digest: null`. Do not replace it with zeros, a made-up digest, or a
moving tag. After images are published and verified, create a new manifest version, set real `sha256:<64 hex>`
digests, change their status to `published`, and validate the file before deployment.

## Production

`docker-compose.full-stack.yml` is fail-closed. Export all six digest variables from a trusted release manifest or
registry response before asking Compose to render the project:

```bash
export PORTFOLIO_API_IMAGE_DIGEST='sha256:...'
export PORTFOLIO_WEB_IMAGE_DIGEST='sha256:...'
export STOCK_ANALYST_IMAGE_DIGEST='sha256:...'
export STOCK_ANALYST_BACKEND_IMAGE_DIGEST='sha256:...'
export STOCK_ANALYST_UI_IMAGE_DIGEST='sha256:...'
export EDO_CALCULATOR_IMAGE_DIGEST='sha256:...'
docker compose -f docker-compose.full-stack.yml config
docker compose -f docker-compose.full-stack.yml up -d
```

Unset or empty variables stop interpolation before any image is pulled. Tags such as `latest` and `main` are not
accepted by the production file.

## Development example

`docker-compose.full-stack.example.yml` and `docker-compose.market-data.self-hosted.dev.example.yml` intentionally
retain readable moving tags for local, disposable ecosystem work. They are not production inputs and are validated as
independent from the digest variables. Neither self-hosted override forces `linux/amd64`; Docker selects a native
published platform or fails clearly when none exists.

Run the structural and hash validator after any source, contract, token, manifest, or Compose update:

```bash
python3 scripts/validate-compatibility-manifest.py
```

CI integration uses `scripts/smoke-test-contract-stack.sh`: local deterministic HTTP fixtures implement the pinned
Stock Analyst and EDO shapes, and the smoke rejects `DEGRADED`, `WARN`, stale or unvalued holdings. Live Yahoo/GUS
availability is intentionally isolated in the scheduled, non-blocking `live-canary.yml` workflow.
