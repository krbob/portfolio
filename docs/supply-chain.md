# Supply-chain controls

Portfolio treats build inputs and deployable images as separate trust boundaries.

## Prescribed toolchain

- JDK (CI reads the exact version from `.java-version`; Gradle's Java toolchain selects that installed JDK)
- Node.js (exact version aligned across `.node-version`, package metadata and the web build image; CI reads `.node-version`)
- npm (exact version aligned between `packageManager`, `engines.npm` and the lockfile)
- Gradle (exact version aligned between the wrapper and API build image, with a verified distribution SHA-256)

The API and web Dockerfiles retain readable version tags but also pin every base image to an immutable manifest
digest. The API build and runtime use Java 21, and neither runtime image updates packages from a moving
operating-system repository during the build. The API image owns its HTTP healthcheck through an application-packaged
probe that requires only the Java runtime; Compose definitions inherit it instead of duplicating or replacing its
command. Required CI starts the production image and waits for Docker to report it healthy. CI and the web image
activate Corepack's npm shim; CI also verifies that the exact `packageManager` version is in use before installing
dependencies.

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

All external GitHub Actions use full commit SHAs and all CI helper containers use immutable digests. Renovate inherits
the shared monthly ecosystem policy: on the first day of each month it creates dependency pull requests without a
concurrency cap, and GitHub squash-merges each one as soon as required CI is green. Every update type is eligible,
branches are rebased only to resolve conflicts, and releases with trustworthy timestamps are held for seven days;
missing timestamps do not block an update indefinitely. Renovate's separate vulnerability-alert pull requests are
disabled because they bypass schedules; vulnerable dependencies remain part of the normal monthly update run.
The seven-day age applies to each release independently: frequent new releases do not reset the age of older
versions. Renovate can select the newest eligible older release during the monthly window. New branches for releases
that become eligible after that window wait for the next first-of-month run unless requested through the Dependency
Dashboard. Existing branches can still be refreshed and merged outside that window.

Kotlin and Ktor updates are grouped so their shared Gradle version-catalog inputs are tested together. TypeScript
stays below 6 while openapi-typescript requires TypeScript 5; js-yaml 5 also remains excluded pending adoption.
Node.js version updates wait for all three declarations (version file, package engine and Docker image); Gradle
version updates wait for both the wrapper and Docker image. Digest-only image refreshes use the Docker images group
without those minimum group sizes. Required CI verifies that the selected versions agree before merging. The API
runtime remains on Java 21; changing its major requires a coordinated repository-toolchain and container-health
contract upgrade rather than an isolated base-image update.

Required pull-request CI runs the structural supply-chain validator and builds both production Dockerfiles without
pushing. Its required `ci-required` job runs even when verification fails or is cancelled, and succeeds only when
verification succeeds. The validator checks this gate as well as the toolchain inputs. This prevents a skipped
aggregate check from allowing automerge after failed verification.

Run the local structural validator after editing Dockerfiles, workflows, tool versions, or Renovate policy:

```bash
python3 scripts/validate-supply-chain.py
python3 scripts/validate-documentation.py
actionlint
```
