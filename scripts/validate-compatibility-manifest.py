#!/usr/bin/env python3

"""Validate deployment compatibility evidence and digest fail-closed wiring."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import pathlib
import re
import stat
import sys


ROOT = pathlib.Path(__file__).resolve().parent.parent
DEFAULT_MANIFEST_PATH = pathlib.Path("deployment/compatibility/1.0.0.json")
MANIFEST_ENVIRONMENT = "PORTFOLIO_COMPATIBILITY_MANIFEST"
PRODUCTION_COMPOSE_PATH = ROOT / "docker-compose.full-stack.yml"
DEVELOPMENT_COMPOSE_PATH = ROOT / "docker-compose.full-stack.example.yml"
SELF_HOSTED_COMPOSE_PATH = ROOT / "docker-compose.market-data.self-hosted.yml"
SELF_HOSTED_DEVELOPMENT_COMPOSE_PATH = ROOT / "docker-compose.market-data.self-hosted.dev.example.yml"
ROLLOUT_SCRIPT_PATH = ROOT / "scripts/rollout-full-stack.sh"
RUNBOOK_PATH = ROOT / "docs/runbook.md"
COMMIT = re.compile(r"^[0-9a-f]{40}$")
DIGEST = re.compile(r"^sha256:[0-9a-f]{64}$")
SHA256 = re.compile(r"^[0-9a-f]{64}$")
SEMVER = re.compile(r"^\d+\.\d+\.\d+$")
EXPECTED_IMAGE_ENVIRONMENTS = {
    "portfolio-api": "PORTFOLIO_API_IMAGE_DIGEST",
    "portfolio-web": "PORTFOLIO_WEB_IMAGE_DIGEST",
    "stock-analyst": "STOCK_ANALYST_IMAGE_DIGEST",
    "stock-analyst-backend-yfinance": "STOCK_ANALYST_BACKEND_IMAGE_DIGEST",
    "stock-analyst-ui": "STOCK_ANALYST_UI_IMAGE_DIGEST",
    "edo-calculator": "EDO_CALCULATOR_IMAGE_DIGEST",
}


def fail(message: str) -> None:
    print(f"compatibility manifest validation failed: {message}", file=sys.stderr)
    raise SystemExit(1)


def parse_arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Validate a versioned ecosystem compatibility manifest."
    )
    parser.add_argument(
        "manifest",
        nargs="?",
        help=(
            "manifest path; relative paths resolve from the repository "
            f"(overrides {MANIFEST_ENVIRONMENT})"
        ),
    )
    parser.add_argument(
        "--require-released",
        action="store_true",
        help="require a released manifest whose image digests match the environment",
    )
    return parser.parse_args()


def display_path(path: pathlib.Path) -> str:
    try:
        return str(path.relative_to(ROOT))
    except ValueError:
        return str(path)


def resolve_manifest_path(argument: str | None) -> pathlib.Path:
    configured = (
        argument
        or os.environ.get(MANIFEST_ENVIRONMENT)
        or str(DEFAULT_MANIFEST_PATH)
    )
    candidate = pathlib.Path(configured).expanduser()
    if not candidate.is_absolute():
        candidate = ROOT / candidate
    resolved = candidate.resolve()
    try:
        resolved.relative_to(ROOT)
    except ValueError:
        fail(f"manifest path must stay inside the repository: {configured}")
    if not resolved.is_file():
        fail(f"manifest file does not exist: {display_path(resolved)}")
    return resolved


def load_json(path: pathlib.Path) -> dict:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exception:
        fail(f"cannot read {display_path(path)}: {exception}")


def file_sha256(relative_path: str) -> str:
    path = ROOT / relative_path
    if not path.is_file():
        fail(f"contract file does not exist: {relative_path}")
    return hashlib.sha256(path.read_bytes()).hexdigest()


def validate_components(manifest: dict) -> None:
    components = manifest.get("components", [])
    expected = {"portfolio", "stock-analyst", "stock-analyst-ui", "edo-calculator"}
    actual = {component.get("id") for component in components}
    if actual != expected:
        fail(f"component inventory differs: {sorted(actual)}")
    for component in components:
        if not COMMIT.fullmatch(component.get("sourceCommit", "")):
            fail(f"{component.get('id')} sourceCommit is not a full Git SHA")
        if not str(component.get("repository", "")).startswith("https://github.com/"):
            fail(f"{component.get('id')} repository is not an HTTPS GitHub URL")


def validate_contracts(manifest: dict) -> None:
    contracts = manifest.get("contracts", [])
    expected = {"portfolio-api-client", "stock-analyst-v1", "edo-calculator-v1", "stock-ecosystem-ui"}
    actual = {contract.get("id") for contract in contracts}
    if actual != expected:
        fail(f"contract inventory differs: {sorted(actual)}")

    for contract in contracts:
        contract_id = contract["id"]
        if "sourceCommit" in contract and not COMMIT.fullmatch(contract["sourceCommit"]):
            fail(f"{contract_id} sourceCommit is not a full Git SHA")
        files = contract.get("files") or [{"path": contract.get("path"), "sha256": contract.get("sha256")}]
        for contract_file in files:
            relative_path = contract_file.get("path", "")
            expected_sha = contract_file.get("sha256", "")
            if not SHA256.fullmatch(expected_sha):
                fail(f"{contract_id} has a malformed SHA-256 for {relative_path}")
            actual_sha = file_sha256(relative_path)
            if actual_sha != expected_sha:
                fail(f"{contract_id} hash differs for {relative_path}: {actual_sha}")

    properties = {}
    for line in (ROOT / "apps/api/contracts/upstream/upstream-contracts.properties").read_text(encoding="utf-8").splitlines():
        if "=" in line:
            key, value = line.split("=", 1)
            properties[key] = value
    contract_by_id = {contract["id"]: contract for contract in contracts}
    expected_upstream = {
        "stock-analyst-v1": (properties.get("stockAnalyst.commit"), properties.get("stockAnalyst.sha256")),
        "edo-calculator-v1": (properties.get("edoCalculator.commit"), properties.get("edoCalculator.sha256")),
    }
    for contract_id, (commit, sha256) in expected_upstream.items():
        contract = contract_by_id[contract_id]
        if contract.get("sourceCommit") != commit or contract.get("sha256") != sha256:
            fail(f"{contract_id} differs from upstream-contracts.properties")

    token_source = load_json(ROOT / "apps/web/src/styles/vendor/stock-ecosystem-ui/source.json")
    token_contract = contract_by_id["stock-ecosystem-ui"]
    token_files = {pathlib.Path(item["path"]).name: item["sha256"] for item in token_contract["files"]}
    if token_contract.get("sourceCommit") != token_source.get("sourceCommit"):
        fail("design-token source commit differs from source.json")
    if token_contract.get("version") != token_source.get("contractVersion"):
        fail("design-token version differs from source.json")
    if token_files != token_source.get("files"):
        fail("design-token file hashes differ from source.json")


def validate_images(manifest: dict, require_released: bool) -> None:
    images = manifest.get("images", [])
    expected = set(EXPECTED_IMAGE_ENVIRONMENTS)
    actual = {image.get("id") for image in images}
    if actual != expected or len(images) != len(expected):
        fail(f"image inventory differs: {sorted(actual)}")
    if manifest.get("imagePolicy", {}).get("unpublishedDigest", "missing") is not None:
        fail("unpublished image digest sentinel must be JSON null")

    production_compose = PRODUCTION_COMPOSE_PATH.read_text(encoding="utf-8")
    development_compose = DEVELOPMENT_COMPOSE_PATH.read_text(encoding="utf-8")
    self_hosted_compose = SELF_HOSTED_COMPOSE_PATH.read_text(encoding="utf-8")
    self_hosted_development_compose = SELF_HOSTED_DEVELOPMENT_COMPOSE_PATH.read_text(encoding="utf-8")
    expected_manifest_reference = (
        "manifest: ${PORTFOLIO_COMPATIBILITY_MANIFEST:-deployment/compatibility/1.0.0.json}"
    )
    if expected_manifest_reference not in production_compose:
        fail("production Compose does not expose the selected compatibility manifest")

    for image in images:
        image_id = image["id"]
        digest = image.get("digest")
        status = image.get("status")
        variable = image.get("digestEnvironment", "")
        repository = image.get("repository", "")
        if variable != EXPECTED_IMAGE_ENVIRONMENTS[image_id]:
            fail(f"{image_id} uses an unexpected digest environment variable: {variable}")
        if status == "unpublished":
            if digest is not None:
                fail(f"{image_id} is unpublished but contains a digest")
        elif status == "published":
            if not DIGEST.fullmatch(digest or "") or digest == f"sha256:{'0' * 64}":
                fail(f"{image_id} published digest is missing, malformed, or fake")
        else:
            fail(f"{image_id} has unsupported status: {status}")
        if not re.fullmatch(r"[A-Z][A-Z0-9_]+_IMAGE_DIGEST", variable):
            fail(f"{image_id} digestEnvironment is malformed")
        if f"{repository}@${{{variable}:?" not in production_compose:
            fail(f"production Compose does not fail closed for {image_id}")
        if repository not in development_compose or f"${{{variable}" in development_compose:
            fail(f"development Compose is not an independent tag-based example for {image_id}")
        if image_id not in {"portfolio-api", "portfolio-web"}:
            if f"{repository}@${{{variable}:?" not in self_hosted_compose:
                fail(f"self-hosted production override does not fail closed for {image_id}")
            if repository not in self_hosted_development_compose or f"${{{variable}" in self_hosted_development_compose:
                fail(f"self-hosted development override is not tag based for {image_id}")

    if manifest.get("status") == "released":
        unpublished = sorted(image["id"] for image in images if image.get("status") != "published")
        if unpublished:
            fail(f"released manifest contains unpublished images: {', '.join(unpublished)}")

    if require_released:
        for image in images:
            variable = image["digestEnvironment"]
            configured_digest = os.environ.get(variable)
            if configured_digest != image["digest"]:
                if configured_digest is None:
                    fail(f"released rollout is missing {variable}")
                fail(f"{variable} does not match the selected release manifest")

    if re.search(r"image:\s*\S+:(?:latest|main)\s*$", self_hosted_compose, re.MULTILINE):
        fail("self-hosted production override contains a moving latest/main tag")
    if re.search(r"^\s*platform:", self_hosted_compose + self_hosted_development_compose, re.MULTILINE):
        fail("self-hosted overrides must not force a CPU architecture")


def validate_rollout_policy(manifest: dict) -> None:
    policy = manifest.get("rolloutPolicy", {})
    stages = policy.get("stages", [])
    expected_stages = [
        ("market-backends", ["stock-analyst-backend-yfinance"]),
        ("providers", ["stock-analyst", "edo-calculator"]),
        ("portfolio-api", ["portfolio-api"]),
        ("frontends", ["portfolio-web", "stock-analyst-ui"]),
    ]
    actual_stages = [(stage.get("id"), stage.get("images")) for stage in stages]
    if actual_stages != expected_stages:
        fail(f"rollout stages must keep providers before consumers: {actual_stages}")

    gates = policy.get("gates", [])
    expected_gates = [
        {
            "afterStage": "providers",
            "beforeStage": "portfolio-api",
            "component": "stock-analyst",
            "method": "GET",
            "path": "/readyz",
            "requiredStatus": 200,
        },
        {
            "afterStage": "providers",
            "beforeStage": "portfolio-api",
            "component": "edo-calculator",
            "method": "GET",
            "path": "/readyz",
            "requiredStatus": 200,
        },
        {
            "afterStage": "providers",
            "beforeStage": "portfolio-api",
            "component": "stock-analyst",
            "method": "GET",
            "path": "/openapi/v1.json",
            "requiredPaths": ["/v1/quote/{stock}", "/v1/history/{stock}"],
        },
    ]
    if gates != expected_gates:
        fail("rollout policy must gate Portfolio API on both provider readiness checks and versioned Stock Analyst routes")


def validate_rollout_script() -> None:
    try:
        script = ROLLOUT_SCRIPT_PATH.read_text(encoding="utf-8")
        runbook = RUNBOOK_PATH.read_text(encoding="utf-8")
    except OSError as exception:
        fail(f"cannot read fail-closed rollout documentation: {exception}")
    if not ROLLOUT_SCRIPT_PATH.stat().st_mode & stat.S_IXUSR:
        fail("fail-closed rollout script is not executable")

    required_fragments = [
        "set -euo pipefail",
        "export PORTFOLIO_COMPATIBILITY_MANIFEST",
        "python3 scripts/validate-compatibility-manifest.py --require-released",
        "compose config >/dev/null",
        "compose up -d stock-analyst-backend-yfinance",
        "compose up -d stock-analyst edo-calculator",
        "http://127.0.0.1:8080/readyz",
        "http://edo-calculator:8080/readyz",
        "/v1/quote/{stock}",
        "/v1/history/{stock}",
        "compose up -d portfolio-api",
        "compose up -d portfolio-web stock-analyst-ui",
    ]
    positions = []
    for fragment in required_fragments:
        position = script.find(fragment)
        if position < 0:
            fail(f"rollout script is missing required fail-closed step: {fragment}")
        positions.append(position)
    if positions != sorted(positions):
        fail("rollout script no longer keeps readiness and contract gates before Portfolio consumers")
    if "scripts/rollout-full-stack.sh" not in runbook:
        fail("operations runbook does not use the fail-closed rollout script")


def main() -> None:
    arguments = parse_arguments()
    manifest_path = resolve_manifest_path(arguments.manifest)
    manifest = load_json(manifest_path)
    if manifest.get("schemaVersion") != 1:
        fail("unsupported schemaVersion")
    manifest_version = manifest.get("manifestVersion", "")
    if not SEMVER.fullmatch(manifest_version):
        fail("manifestVersion must be semantic x.y.z")
    if manifest_path.name != f"{manifest_version}.json":
        fail(
            f"manifestVersion {manifest_version} does not match file name {manifest_path.name}"
        )
    if manifest.get("status") not in {"candidate", "released"}:
        fail("status must be candidate or released")
    if arguments.require_released and manifest.get("status") != "released":
        fail("rollout requires a manifest with status released")
    validate_components(manifest)
    validate_contracts(manifest)
    validate_images(manifest, require_released=arguments.require_released)
    validate_rollout_policy(manifest)
    validate_rollout_script()
    if arguments.require_released:
        print(
            f"Released compatibility manifest {manifest_version} verified with "
            f"{len(EXPECTED_IMAGE_ENVIRONMENTS)} matching image digests."
        )
    else:
        print(
            f"Compatibility manifest {manifest_version} verified with pinned contracts "
            f"and {manifest['status']} image evidence."
        )


if __name__ == "__main__":
    main()
