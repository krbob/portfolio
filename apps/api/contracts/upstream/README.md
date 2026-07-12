# Upstream OpenAPI snapshots

Portfolio vendors immutable API snapshots because its build and CI must work in an isolated checkout.

| Upstream | Source revision | Snapshot |
| --- | --- | --- |
| `stock-analyst` | `6a290a6` | `stock-analyst-v1.json` |
| `edo-calculator` | `20b098e` | `edo-calculator-v1.yaml` |

`upstream-contracts.properties` pins the SHA-256 of each source file. `./gradlew checkUpstreamContracts`
fails before compilation when a vendored file does not match its lock. `generateUpstreamContracts` parses the
snapshots with Swagger Parser and generates only the response projections and versioned paths consumed by
Portfolio into `build/generated/sources/upstreamContracts`.
Stock quote/history projections include the upstream provenance object so coverage and freshness metadata are not
discarded at the client boundary.

To upgrade a contract:

1. Copy the exact OpenAPI file from a reviewed upstream commit.
2. Update its commit and SHA-256 in `upstream-contracts.properties`.
3. Run `./gradlew clean checkUpstreamContracts generateUpstreamContracts test detekt build`.
4. Review client mappings and consumer contract tests before committing the snapshot.

Do not point generation at `../stock-analyst` or `../edo-calculator`; sibling repositories are intentionally not
part of the build contract.
