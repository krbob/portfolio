#!/usr/bin/env python3

"""Fail closed when immutable build inputs or dependency locks are removed."""

import json
import pathlib
import re
import sys


ROOT = pathlib.Path(__file__).resolve().parent.parent
SHA256 = re.compile(r"^[0-9a-f]{64}$")
ACTION_SHA = re.compile(r"^[^@\s]+@[0-9a-f]{40}$")


def fail(message: str) -> None:
    print(f"supply-chain validation failed: {message}", file=sys.stderr)
    raise SystemExit(1)


def require_file(relative_path: str) -> pathlib.Path:
    path = ROOT / relative_path
    if not path.is_file() or path.stat().st_size == 0:
        fail(f"missing required file: {relative_path}")
    return path


def validate_actions() -> None:
    for workflow in sorted((ROOT / ".github/workflows").glob("*.yml")):
        for line_number, line in enumerate(workflow.read_text(encoding="utf-8").splitlines(), 1):
            match = re.search(r"\buses:\s*([^\s#]+)", line)
            if not match:
                continue
            reference = match.group(1)
            if reference.startswith("./"):
                continue
            if not ACTION_SHA.fullmatch(reference):
                fail(f"{workflow.relative_to(ROOT)}:{line_number} action is not pinned to a full commit SHA: {reference}")


def validate_dockerfiles() -> None:
    for relative_path in ("apps/api/Dockerfile", "apps/web/Dockerfile"):
        dockerfile = require_file(relative_path)
        for line_number, line in enumerate(dockerfile.read_text(encoding="utf-8").splitlines(), 1):
            if not line.startswith("FROM "):
                continue
            image = line.split()[1]
            if not re.search(r"@sha256:[0-9a-f]{64}$", image):
                fail(f"{relative_path}:{line_number} base image is not digest pinned: {image}")


def validate_gradle() -> None:
    java_version = require_file(".java-version").read_text(encoding="utf-8").strip()
    if not re.fullmatch(r"\d+\.\d+\.\d+", java_version):
        fail(".java-version must pin an exact JDK feature release")
    properties = require_file("apps/api/gradle/wrapper/gradle-wrapper.properties").read_text(encoding="utf-8")
    match = re.search(r"^distributionSha256Sum=([^\s]+)$", properties, re.MULTILINE)
    if not match or not SHA256.fullmatch(match.group(1)):
        fail("Gradle wrapper distributionSha256Sum is missing or malformed")
    for lock in (
        "apps/api/gradle.lockfile",
        "apps/api/settings-gradle.lockfile",
        "apps/api/portfolio-domain/gradle.lockfile",
    ):
        require_file(lock)


def validate_node() -> None:
    node_version = require_file(".node-version").read_text(encoding="utf-8").strip()
    package = json.loads(require_file("apps/web/package.json").read_text(encoding="utf-8"))
    if package.get("engines", {}).get("node") != node_version:
        fail(".node-version and package.json engines.node differ")
    if not re.fullmatch(r"npm@\d+\.\d+\.\d+", package.get("packageManager", "")):
        fail("packageManager must pin an exact npm version")
    lock = json.loads(require_file("apps/web/package-lock.json").read_text(encoding="utf-8"))
    if lock.get("lockfileVersion") != 3:
        fail("package-lock.json must use lockfileVersion 3")


def validate_ci_toolchains() -> None:
    workflow = require_file(".github/workflows/ci-verify.yml").read_text(encoding="utf-8")
    expected = {
        "JDK_VERSION": require_file(".java-version").read_text(encoding="utf-8").strip(),
        "NODE_VERSION": require_file(".node-version").read_text(encoding="utf-8").strip(),
    }
    for variable, version in expected.items():
        if not re.search(rf'^\s*{variable}:\s*"{re.escape(version)}"\s*$', workflow, re.MULTILINE):
            fail(f"ci-verify.yml {variable} must match its repository version file")


def validate_renovate() -> None:
    config = json.loads(require_file("renovate.json").read_text(encoding="utf-8"))
    if config.get("automerge") is not False or config.get("platformAutomerge") is not False:
        fail("Renovate automerge must remain disabled")
    if config.get("minimumReleaseAgeBehaviour") != "timestamp-required":
        fail("Renovate must fail closed for dependencies without release timestamps")
    if "helpers:pinGitHubActionDigests" not in config.get("extends", []):
        fail("Renovate must retain GitHub Action digest maintenance")


def main() -> None:
    validate_actions()
    validate_dockerfiles()
    validate_gradle()
    validate_node()
    validate_ci_toolchains()
    validate_renovate()
    print("Supply-chain inputs verified: actions, base images, wrapper and dependency locks are immutable.")


if __name__ == "__main__":
    main()
