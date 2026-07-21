#!/usr/bin/env python3

"""Fail closed when immutable build inputs or dependency locks are removed."""

import json
import pathlib
import re
import shlex
import sys


ROOT = pathlib.Path(__file__).resolve().parent.parent
SHA256 = re.compile(r"^[0-9a-f]{64}$")
ACTION_SHA = re.compile(r"^[^@\s]+@[0-9a-f]{40}$")
IMAGE_TAG = re.compile(r"^[A-Za-z0-9_][A-Za-z0-9_.-]{0,127}$")
IMAGE_REPOSITORY = re.compile(
    r"^[a-z0-9]+(?:[._-][a-z0-9]+)*(?::[0-9]+)?"
    r"(?:/[a-z0-9]+(?:(?:[._]|__|[-]+)[a-z0-9]+)*)*$"
)

DOCKER_RUN_FLAG_OPTIONS = {
    "--detach",
    "--init",
    "--interactive",
    "--oom-kill-disable",
    "--privileged",
    "--publish-all",
    "--quiet",
    "--read-only",
    "--rm",
    "--sig-proxy",
    "--tty",
}
DOCKER_RUN_VALUE_OPTIONS = {
    "--add-host",
    "--annotation",
    "--attach",
    "--blkio-weight",
    "--blkio-weight-device",
    "--cap-add",
    "--cap-drop",
    "--cgroup-parent",
    "--cgroupns",
    "--cidfile",
    "--cpu-period",
    "--cpu-quota",
    "--cpu-rt-period",
    "--cpu-rt-runtime",
    "--cpu-shares",
    "--cpus",
    "--cpuset-cpus",
    "--cpuset-mems",
    "--detach-keys",
    "--device",
    "--device-cgroup-rule",
    "--device-read-bps",
    "--device-read-iops",
    "--device-write-bps",
    "--device-write-iops",
    "--dns",
    "--dns-option",
    "--dns-search",
    "--domainname",
    "--entrypoint",
    "--env",
    "--env-file",
    "--expose",
    "--gpus",
    "--group-add",
    "--health-cmd",
    "--health-interval",
    "--health-retries",
    "--health-start-interval",
    "--health-start-period",
    "--health-timeout",
    "--hostname",
    "--ip",
    "--ip6",
    "--ipc",
    "--isolation",
    "--kernel-memory",
    "--label",
    "--label-file",
    "--link",
    "--link-local-ip",
    "--log-driver",
    "--log-opt",
    "--mac-address",
    "--memory",
    "--memory-reservation",
    "--memory-swap",
    "--memory-swappiness",
    "--mount",
    "--name",
    "--network",
    "--network-alias",
    "--oom-score-adj",
    "--pid",
    "--pids-limit",
    "--platform",
    "--publish",
    "--pull",
    "--restart",
    "--runtime",
    "--security-opt",
    "--shm-size",
    "--stop-signal",
    "--stop-timeout",
    "--storage-opt",
    "--sysctl",
    "--tmpfs",
    "--ulimit",
    "--user",
    "--userns",
    "--uts",
    "--volume",
    "--volume-driver",
    "--volumes-from",
    "--workdir",
}
DOCKER_RUN_SHORT_FLAG_OPTIONS = set("diPqt")
DOCKER_RUN_SHORT_VALUE_OPTIONS = set("acehlmpuvw")


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


def workflow_shell_lines(workflow: pathlib.Path):
    """Yield shell lines after joining explicit backslash continuations."""
    buffered = ""
    start_line = 0
    for line_number, line in enumerate(workflow.read_text(encoding="utf-8").splitlines(), 1):
        if not buffered:
            start_line = line_number
        buffered = f"{buffered} {line.lstrip()}" if buffered else line
        if buffered.rstrip().endswith("\\"):
            buffered = buffered.rstrip()[:-1]
            continue
        yield start_line, buffered
        buffered = ""
    if buffered:
        yield start_line, buffered


def docker_run_image(tokens: list[str], start: int, location: str) -> str:
    index = start
    while index < len(tokens):
        token = tokens[index]
        if token == "--":
            index += 1
            break
        if not token.startswith("-") or token == "-":
            break

        if token.startswith("--"):
            option, separator, _ = token.partition("=")
            if option in DOCKER_RUN_FLAG_OPTIONS:
                index += 1
                continue
            if option in DOCKER_RUN_VALUE_OPTIONS:
                if separator:
                    index += 1
                elif index + 1 < len(tokens):
                    index += 2
                else:
                    fail(f"{location} docker run option has no value: {option}")
                continue
            fail(f"{location} unsupported docker run option prevents image validation: {option}")

        short_options = token[1:]
        position = 0
        while position < len(short_options):
            option = short_options[position]
            if option in DOCKER_RUN_SHORT_FLAG_OPTIONS:
                position += 1
                continue
            if option in DOCKER_RUN_SHORT_VALUE_OPTIONS:
                if position + 1 == len(short_options):
                    if index + 1 >= len(tokens):
                        fail(f"{location} docker run option has no value: -{option}")
                    index += 1
                position = len(short_options)
                continue
            fail(f"{location} unsupported docker run option prevents image validation: -{option}")
        index += 1

    if index >= len(tokens) or tokens[index] in {"&&", "||", ";", "|"}:
        fail(f"{location} docker run command has no image reference")
    return tokens[index].strip("'\"")


def validate_helper_image(image: str, location: str) -> None:
    reference, separator, digest = image.partition("@sha256:")
    repository_tag, tag_separator, tag = reference.rpartition(":")
    if (
        separator != "@sha256:"
        or not SHA256.fullmatch(digest)
        or tag_separator != ":"
        or not IMAGE_TAG.fullmatch(tag)
        or not IMAGE_REPOSITORY.fullmatch(repository_tag)
    ):
        fail(f"{location} docker run image must have an explicit tag and sha256 digest: {image}")


def validate_workflow_helper_images() -> None:
    workflows = sorted((ROOT / ".github/workflows").glob("*.yml"))
    workflows.extend(sorted((ROOT / ".github/workflows").glob("*.yaml")))
    for workflow in workflows:
        for line_number, line in workflow_shell_lines(workflow):
            lexer = shlex.shlex(line, posix=False)
            lexer.whitespace_split = True
            lexer.commenters = ""
            try:
                tokens = list(lexer)
            except ValueError as error:
                if re.search(r"\bdocker\s+run\b", line):
                    fail(f"{workflow.relative_to(ROOT)}:{line_number} cannot parse docker run command: {error}")
                continue
            for index in range(len(tokens) - 1):
                if pathlib.PurePath(tokens[index]).name != "docker" or tokens[index + 1] != "run":
                    continue
                location = f"{workflow.relative_to(ROOT)}:{line_number}"
                image = docker_run_image(tokens, index + 2, location)
                validate_helper_image(image, location)


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
    if config.get("branchPrefix") != "renovate/" or config.get("prCreation") != "immediate":
        fail("Renovate must use explicit dependency branches and pull requests")
    if config.get("automerge") is not True or config.get("automergeType") != "pr":
        fail("Every Renovate update must be eligible for pull-request automerge")
    if config.get("automergeStrategy") != "squash":
        fail("Renovate must squash dependency pull requests")
    if config.get("platformAutomerge") is not False:
        fail("GitHub platform automerge must stay disabled to enforce the monthly window")
    if config.get("ignoreTests") is not False:
        fail("Renovate automerge must require passing tests")
    if config.get("automergeSchedule") != ["* * 1-3 * *"]:
        fail("Renovate may automerge only during the first three days of each month")
    if config.get("rebaseWhen") != "behind-base-branch" or config.get("updateNotScheduled") is not True:
        fail("Renovate branches must stay current outside the creation window")
    if config.get("minimumReleaseAge") != "7 days":
        fail("Renovate updates must retain a seven-day maturity delay")
    if config.get("minimumReleaseAgeBehaviour") != "timestamp-optional":
        fail("Renovate updates without release timestamps must remain eligible")
    if "helpers:pinGitHubActionDigests" not in config.get("extends", []):
        fail("Renovate must retain GitHub Action digest maintenance")
    if config.get("timezone") != "Europe/Warsaw" or config.get("schedule") != ["at any time"]:
        fail("Renovate must create mature dependency pull requests continuously")
    if (
        config.get("commitHourlyLimit") != 0
        or config.get("prConcurrentLimit") != 0
        or config.get("branchConcurrentLimit") != 0
        or config.get("prHourlyLimit") != 0
    ):
        fail("Renovate branch and pull-request creation must remain unlimited")
    if config.get("lockFileMaintenance", {}).get("automerge") is not True:
        fail("Renovate lockfile maintenance must follow the automerge policy")
    if config.get("vulnerabilityAlerts", {}).get("automerge") is not True:
        fail("Renovate security updates must follow the automerge policy")
    if any(rule.get("automerge") is False for rule in config.get("packageRules", [])):
        fail("Renovate package rules must not disable automerge")


def main() -> None:
    validate_actions()
    validate_workflow_helper_images()
    validate_dockerfiles()
    validate_gradle()
    validate_node()
    validate_ci_toolchains()
    validate_renovate()
    print("Supply-chain inputs verified: actions, helper and base images, wrapper and dependency locks are immutable.")


if __name__ == "__main__":
    main()
