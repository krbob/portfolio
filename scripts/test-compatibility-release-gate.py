#!/usr/bin/env python3

"""Exercise compatibility-manifest selection and the pre-Compose release gate."""

from __future__ import annotations

import contextlib
import json
import os
import pathlib
import subprocess
import sys
import tempfile
import unittest


ROOT = pathlib.Path(__file__).resolve().parent.parent
VALIDATOR = ROOT / "scripts/validate-compatibility-manifest.py"
ROLLOUT = ROOT / "scripts/rollout-full-stack.sh"
DEFAULT_MANIFEST = ROOT / "deployment/compatibility/1.0.0.json"
MANIFEST_ENVIRONMENT = "PORTFOLIO_COMPATIBILITY_MANIFEST"
DEFAULT = json.loads(DEFAULT_MANIFEST.read_text(encoding="utf-8"))
DIGEST_ENVIRONMENTS = tuple(
    image["digestEnvironment"] for image in DEFAULT["images"]
)


def clean_environment() -> dict[str, str]:
    environment = os.environ.copy()
    environment.pop(MANIFEST_ENVIRONMENT, None)
    for variable in DIGEST_ENVIRONMENTS:
        environment.pop(variable, None)
    return environment


def run_validator(
    manifest: pathlib.Path | None = None,
    *,
    require_released: bool = False,
    environment: dict[str, str] | None = None,
) -> subprocess.CompletedProcess[str]:
    command = [sys.executable, str(VALIDATOR)]
    if require_released:
        command.append("--require-released")
    if manifest is not None:
        command.append(str(manifest))
    return subprocess.run(
        command,
        cwd=ROOT,
        env=environment if environment is not None else clean_environment(),
        capture_output=True,
        text=True,
        check=False,
    )


@contextlib.contextmanager
def released_manifest() -> tuple[pathlib.Path, dict[str, str]]:
    with tempfile.TemporaryDirectory(
        prefix="release-gate-",
        dir=ROOT / "deployment/compatibility",
    ) as directory:
        version = "999.0.0"
        manifest_path = pathlib.Path(directory) / f"{version}.json"
        manifest = json.loads(json.dumps(DEFAULT))
        manifest["manifestVersion"] = version
        manifest["status"] = "released"
        digest_environment: dict[str, str] = {}
        for index, image in enumerate(manifest["images"], start=1):
            digest = f"sha256:{index:064x}"
            image["digest"] = digest
            image["status"] = "published"
            digest_environment[image["digestEnvironment"]] = digest
        manifest_path.write_text(
            f"{json.dumps(manifest, indent=2)}\n",
            encoding="utf-8",
        )
        yield manifest_path, digest_environment


def run_rollout_before_compose(
    manifest: pathlib.Path,
    digest_environment: dict[str, str],
) -> tuple[subprocess.CompletedProcess[str], bool]:
    with tempfile.TemporaryDirectory(prefix="portfolio-fake-docker-") as directory:
        temp = pathlib.Path(directory)
        marker = temp / "docker-called"
        fake_docker = temp / "docker"
        fake_docker.write_text(
            "#!/bin/sh\n"
            "printf 'docker was called\\n' >> \"${DOCKER_MARKER:?}\"\n"
            "exit 97\n",
            encoding="utf-8",
        )
        fake_docker.chmod(0o755)

        environment = clean_environment()
        environment.update(digest_environment)
        environment[MANIFEST_ENVIRONMENT] = str(manifest.relative_to(ROOT))
        environment["DOCKER_MARKER"] = str(marker)
        environment["PATH"] = f"{temp}{os.pathsep}{environment['PATH']}"
        result = subprocess.run(
            ["bash", str(ROLLOUT)],
            cwd=ROOT,
            env=environment,
            capture_output=True,
            text=True,
            check=False,
        )
        return result, marker.exists()


class CompatibilityReleaseGateTest(unittest.TestCase):
    def assert_failed_with(
        self,
        result: subprocess.CompletedProcess[str],
        message: str,
    ) -> None:
        self.assertNotEqual(0, result.returncode, result.stdout)
        self.assertIn(message, result.stderr)

    def test_default_candidate_still_passes_structural_validation(self) -> None:
        result = run_validator()

        self.assertEqual(0, result.returncode, result.stderr)
        self.assertIn("candidate image evidence", result.stdout)

    def test_release_mode_rejects_candidate(self) -> None:
        result = run_validator(require_released=True)

        self.assert_failed_with(result, "rollout requires a manifest with status released")

    def test_released_manifest_accepts_exact_positional_digest_inputs(self) -> None:
        with released_manifest() as (manifest, digests):
            environment = clean_environment()
            environment.update(digests)
            result = run_validator(
                manifest.relative_to(ROOT),
                require_released=True,
                environment=environment,
            )

        self.assertEqual(0, result.returncode, result.stderr)
        self.assertIn("6 matching image digests", result.stdout)

    def test_environment_selects_released_manifest(self) -> None:
        with released_manifest() as (manifest, digests):
            environment = clean_environment()
            environment.update(digests)
            environment[MANIFEST_ENVIRONMENT] = str(manifest.relative_to(ROOT))
            result = run_validator(require_released=True, environment=environment)

        self.assertEqual(0, result.returncode, result.stderr)

    def test_positional_manifest_overrides_environment_selection(self) -> None:
        with released_manifest() as (manifest, digests):
            environment = clean_environment()
            environment.update(digests)
            environment[MANIFEST_ENVIRONMENT] = "deployment/compatibility/missing.json"
            result = run_validator(
                manifest.relative_to(ROOT),
                require_released=True,
                environment=environment,
            )

        self.assertEqual(0, result.returncode, result.stderr)

    def test_release_mode_rejects_digest_mismatch(self) -> None:
        with released_manifest() as (manifest, digests):
            environment = clean_environment()
            environment.update(digests)
            environment["PORTFOLIO_API_IMAGE_DIGEST"] = f"sha256:{'f' * 64}"
            result = run_validator(
                manifest.relative_to(ROOT),
                require_released=True,
                environment=environment,
            )

        self.assert_failed_with(
            result,
            "PORTFOLIO_API_IMAGE_DIGEST does not match the selected release manifest",
        )

    def test_release_mode_rejects_missing_digest_input(self) -> None:
        with released_manifest() as (manifest, digests):
            environment = clean_environment()
            environment.update(digests)
            environment.pop("EDO_CALCULATOR_IMAGE_DIGEST")
            result = run_validator(
                manifest.relative_to(ROOT),
                require_released=True,
                environment=environment,
            )

        self.assert_failed_with(
            result,
            "released rollout is missing EDO_CALCULATOR_IMAGE_DIGEST",
        )

    def test_released_manifest_cannot_contain_unpublished_image(self) -> None:
        with released_manifest() as (manifest, digests):
            content = json.loads(manifest.read_text(encoding="utf-8"))
            content["images"][0]["status"] = "unpublished"
            content["images"][0]["digest"] = None
            manifest.write_text(f"{json.dumps(content, indent=2)}\n", encoding="utf-8")
            environment = clean_environment()
            environment.update(digests)
            result = run_validator(
                manifest.relative_to(ROOT),
                require_released=True,
                environment=environment,
            )

        self.assert_failed_with(result, "released manifest contains unpublished images")

    def test_manifest_version_must_match_file_name(self) -> None:
        with released_manifest() as (manifest, _):
            mismatched_path = manifest.with_name("999.0.1.json")
            mismatched_path.write_bytes(manifest.read_bytes())
            result = run_validator(mismatched_path.relative_to(ROOT))

        self.assert_failed_with(result, "does not match file name 999.0.1.json")

    def test_manifest_path_cannot_escape_repository(self) -> None:
        with tempfile.TemporaryDirectory(prefix="external-portfolio-manifest-") as directory:
            external = pathlib.Path(directory) / "1.0.0.json"
            external.write_text(json.dumps(DEFAULT), encoding="utf-8")
            result = run_validator(external)

        self.assert_failed_with(result, "manifest path must stay inside the repository")

    def test_manifest_symlink_cannot_escape_repository(self) -> None:
        with tempfile.TemporaryDirectory(prefix="external-portfolio-manifest-") as directory:
            external = pathlib.Path(directory) / "1.0.0.json"
            external.write_text(json.dumps(DEFAULT), encoding="utf-8")
            with tempfile.TemporaryDirectory(
                prefix="release-gate-link-",
                dir=ROOT / "deployment/compatibility",
            ) as link_directory:
                link = pathlib.Path(link_directory) / "1.0.0.json"
                link.symlink_to(external)
                result = run_validator(link.relative_to(ROOT))

        self.assert_failed_with(result, "manifest path must stay inside the repository")

    def test_candidate_rollout_stops_before_docker_compose(self) -> None:
        result, docker_called = run_rollout_before_compose(DEFAULT_MANIFEST, {})

        self.assert_failed_with(result, "rollout requires a manifest with status released")
        self.assertFalse(docker_called)

    def test_digest_mismatch_rollout_stops_before_docker_compose(self) -> None:
        with released_manifest() as (manifest, digests):
            digests["STOCK_ANALYST_IMAGE_DIGEST"] = f"sha256:{'f' * 64}"
            result, docker_called = run_rollout_before_compose(manifest, digests)

        self.assert_failed_with(
            result,
            "STOCK_ANALYST_IMAGE_DIGEST does not match the selected release manifest",
        )
        self.assertFalse(docker_called)

    def test_matching_released_rollout_reaches_docker_compose(self) -> None:
        with released_manifest() as (manifest, digests):
            result, docker_called = run_rollout_before_compose(manifest, digests)

        self.assertNotEqual(0, result.returncode)
        self.assertTrue(docker_called)
        self.assertIn("Released compatibility manifest 999.0.0 verified", result.stdout)


if __name__ == "__main__":
    unittest.main()
