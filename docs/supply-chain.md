# Supply-chain controls

Portfolio treats build inputs and deployable images as separate trust boundaries.

## Prescribed toolchain

- JDK 21.0.11 (`.java-version` and CI; Gradle's Java 21 toolchain selects that installed JDK)
- Node.js 24.18.0 (`.node-version` and CI)
- npm 11.16.0 (`packageManager`)
- Gradle 9.6.1 with a verified wrapper distribution SHA-256

The API and web Dockerfiles retain readable version tags but also pin every base image to an immutable manifest
digest. The API build and runtime use the same Java major version, and the runtime does not update packages from a
moving operating-system repository during the build.

## Dependency resolution

Direct API versions are pinned in the Gradle version catalog. Gradle resolves transitive JVM dependencies during the
build instead of requiring separately generated lockfiles that Renovate cannot reliably refresh. npm continues to
install from `package-lock.json`, which Renovate updates natively.

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

SBOM generation and vulnerability scanning are explicit maintenance operations rather than pull-request gates. This
keeps external vulnerability databases and scanner releases from blocking tested dependency updates.

## Published-image evidence

Release builds use BuildKit with maximum provenance and an attached image SBOM. After GHCR returns the immutable image
digest, GitHub Artifact Attestations signs a second provenance statement bound to that subject digest. Publishing jobs
require `id-token: write` and `attestations: write`; build arguments are not used for secrets.

## Maintenance policy

All external GitHub Actions use full commit SHAs and all CI helper containers use immutable digests. Renovate creates
mature dependency pull requests continuously and without concurrent or hourly limits. Existing branches stay current
throughout the month. Every update type is eligible for squash automerge after required CI is green, but Renovate
performs merges only during the first three days of each month. GitHub platform automerge remains disabled so it
cannot bypass that window. Releases with trustworthy timestamps are held for seven days; missing timestamps do not
block an update indefinitely.

Run the local structural validator after editing Dockerfiles, workflows, tool versions, or Renovate policy:

```bash
python3 scripts/validate-supply-chain.py
python3 scripts/validate-documentation.py
actionlint
```
