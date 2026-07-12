#!/usr/bin/env python3

"""Remove volatile CycloneDX fields and stabilize unordered collections."""

import json
import os
import sys
import tempfile
from typing import Any


def sort_key(value: Any) -> str:
    if isinstance(value, str):
        return value
    if isinstance(value, dict):
        return "\0".join(
            str(value.get(key, ""))
            for key in ("bom-ref", "ref", "purl", "group", "name", "version")
        )
    return json.dumps(value, sort_keys=True, separators=(",", ":"))


def normalize(value: Any) -> Any:
    if isinstance(value, dict):
        normalized = {key: normalize(item) for key, item in value.items()}
        for key in ("components", "dependencies", "services", "vulnerabilities"):
            collection = normalized.get(key)
            if isinstance(collection, list):
                normalized[key] = sorted(collection, key=sort_key)
        depends_on = normalized.get("dependsOn")
        if isinstance(depends_on, list) and all(isinstance(item, str) for item in depends_on):
            normalized["dependsOn"] = sorted(depends_on)
        return normalized
    if isinstance(value, list):
        return [normalize(item) for item in value]
    return value


def main() -> None:
    if len(sys.argv) != 3:
        raise SystemExit("usage: normalize-cyclonedx.py INPUT OUTPUT")

    input_path, output_path = sys.argv[1:]
    with open(input_path, encoding="utf-8") as source:
        document = json.load(source)

    document.pop("serialNumber", None)
    metadata = document.get("metadata")
    if isinstance(metadata, dict):
        metadata.pop("timestamp", None)

    normalized = normalize(document)
    output_directory = os.path.dirname(os.path.abspath(output_path))
    os.makedirs(output_directory, exist_ok=True)
    descriptor, temporary_path = tempfile.mkstemp(prefix=".cyclonedx-", dir=output_directory, text=True)
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8") as target:
            json.dump(normalized, target, ensure_ascii=False, indent=2, sort_keys=True)
            target.write("\n")
        os.replace(temporary_path, output_path)
    except BaseException:
        try:
            os.unlink(temporary_path)
        except FileNotFoundError:
            pass
        raise


if __name__ == "__main__":
    main()
