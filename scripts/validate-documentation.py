#!/usr/bin/env python3
"""Validate local documentation links and configuration coverage without network access."""

from __future__ import annotations

import re
import sys
from pathlib import Path
from urllib.parse import unquote


ROOT = Path(__file__).resolve().parents[1]
MARKDOWN_LINK = re.compile(r"\[[^\]]*\]\(([^)]+)\)")
HTML_LINK = re.compile(r'<(?:a|img)\b[^>]*(?:href|src)="([^"]+)"', re.IGNORECASE)
ENV_LITERAL = re.compile(r'"(PORTFOLIO_[A-Z0-9_]+)"')
EXTERNAL_PREFIXES = ("http://", "https://", "mailto:", "data:", "#")


def owned_markdown_files() -> list[Path]:
    candidates = [ROOT / "README.md", ROOT / "AGENTS.md"]
    candidates.extend((ROOT / "docs").rglob("*.md"))
    candidates.extend((ROOT / "apps/api/contracts").rglob("README.md"))
    candidates.extend((ROOT / "apps/web/src/styles/vendor").rglob("README.md"))
    return sorted({path for path in candidates if path.is_file()})


def local_target(source: Path, raw_reference: str) -> Path | None:
    reference = raw_reference.strip().removeprefix("<").removesuffix(">")
    if not reference or reference.startswith(EXTERNAL_PREFIXES):
        return None
    path_only = unquote(re.split(r"[?#]", reference, maxsplit=1)[0])
    if not path_only:
        return None
    return (source.parent / path_only).resolve()


def validate_links(files: list[Path]) -> list[str]:
    errors: list[str] = []
    for source in files:
        content = source.read_text(encoding="utf-8")
        references = MARKDOWN_LINK.findall(content) + HTML_LINK.findall(content)
        for reference in references:
            target = local_target(source, reference)
            if target is not None and not target.exists():
                errors.append(
                    f"{source.relative_to(ROOT)}: missing local target {reference!r}"
                )
    return errors


def api_environment_variables() -> set[str]:
    variables: set[str] = set()
    source_root = ROOT / "apps/api/src/main/kotlin"
    for source in source_root.rglob("*.kt"):
        variables.update(ENV_LITERAL.findall(source.read_text(encoding="utf-8")))
    return variables


def validate_configuration_coverage() -> list[str]:
    documented = (ROOT / "docs/configuration.md").read_text(encoding="utf-8")
    return [
        f"docs/configuration.md: missing runtime variable {variable}"
        for variable in sorted(api_environment_variables())
        if variable not in documented
    ]


def validate_safety_contracts() -> list[str]:
    errors: list[str] = []
    readme = (ROOT / "README.md").read_text(encoding="utf-8")
    screenshot_spec = (ROOT / "apps/web/e2e/screenshots.spec.ts").read_text(encoding="utf-8")
    required_docs = {
        "docs/configuration.md",
        "docs/financial-methodology.md",
        "docs/troubleshooting.md",
        "docs/deployment-compatibility.md",
        "docs/supply-chain.md",
    }
    for path in sorted(required_docs):
        if path not in readme:
            errors.append(f"README.md: active document is not indexed: {path}")

    forbidden_rollout = "docker compose -f docker-compose.full-stack.yml up -d"
    for source in [ROOT / "README.md", *sorted((ROOT / "docs").rglob("*.md"))]:
        if forbidden_rollout in source.read_text(encoding="utf-8"):
            errors.append(
                f"{source.relative_to(ROOT)}: bypasses the staged production rollout"
            )

    opt_in = "PORTFOLIO_SCREENSHOTS_ALLOW_STATE_REPLACE"
    if opt_in not in readme or opt_in not in screenshot_spec:
        errors.append("README/screenshot suite: destructive screenshot opt-in is not enforced")
    if "loopbackHosts" not in screenshot_spec:
        errors.append("screenshot suite: loopback target restriction is missing")
    return errors


def main() -> int:
    files = owned_markdown_files()
    errors = (
        validate_links(files)
        + validate_configuration_coverage()
        + validate_safety_contracts()
    )
    if errors:
        for error in errors:
            print(f"ERROR: {error}", file=sys.stderr)
        return 1
    print(
        f"Documentation verified: {len(files)} Markdown files, "
        f"{len(api_environment_variables())} API environment variables."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
