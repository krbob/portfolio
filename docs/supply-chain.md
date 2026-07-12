# Supply-chain controls

Portfolio treats build inputs and deployable images as separate trust boundaries.

## Prescribed toolchain

- JDK 21.0.11 (`.java-version` and CI; Gradle's Java 21 toolchain selects that installed JDK)
- Node.js 24.18.0 (`.node-version` and CI)
- npm 11.16.0 (`packageManager`)
- Gradle 9.6.1 with a verified wrapper distribution SHA-256

The API and web Dockerfiles retain readable version tags but also pin every base image to an immutable manifest
digest. The API build and runtime use the same Java major version.

## Dependency locks

Gradle uses strict dependency locking for the root application and `portfolio-domain`. Regenerate locks only together
with a reviewed dependency change:

```bash
cd apps/api
./gradlew dependencies :portfolio-domain:dependencies --write-locks
```

npm installs only from `package-lock.json` in CI and Docker builds. Run `npm audit --audit-level=high` after every
intentional lock update.

## Reproducible dependency SBOMs

Both applications generate normalized CycloneDX documents. Volatile serial/timestamp fields are removed and unordered
dependency collections are stabilized, so the same lock and prescribed toolchain produce byte-identical output.

```bash
cd apps/api && ./gradlew reproducibleSbom
cd apps/web && npm run sbom
```

Outputs:

- `apps/api/build/reports/sbom/portfolio-api.cdx.json`
- `apps/web/build/reports/sbom/portfolio-web.cdx.json`

CI generates each document twice, compares the bytes, uploads both as artifacts, and rejects HIGH or CRITICAL
vulnerabilities. It then builds the final API and web images and applies the same severity gate to their OS and
application packages. Unfixed findings are not silently ignored.

## Published-image evidence

Release builds use BuildKit with maximum provenance and an attached image SBOM. After GHCR returns the immutable image
digest, GitHub Artifact Attestations signs a second provenance statement bound to that subject digest. Publishing jobs
require `id-token: write` and `attestations: write`; build arguments are not used for secrets.

## Maintenance policy

All external GitHub Actions use full commit SHAs and all CI helper containers use immutable digests. Renovate may
propose digest/version updates, but never automerges them. Routine updates are monthly, limited in concurrency, and
held for seven days when the registry supplies a trustworthy release timestamp. Security alerts may open immediately
but still require review and the normal CI gates.

Run the local structural validator after editing Dockerfiles, workflows, tool versions, locks, or Renovate policy:

```bash
python3 scripts/validate-supply-chain.py
actionlint
```
