"""Export the OpenAPI specification from the actual FastAPI application.

Usage:
    uv run python scripts/export_openapi.py
    # or with custom output path
    uv run python scripts/export_openapi.py --out ./openapi.json
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from fastapi.openapi.utils import get_openapi

from app.main import create_app


def export_openapi(output_path: Path) -> None:
    """Generate and write the OpenAPI schema from the actual application instance."""
    app = create_app()
    openapi_schema = get_openapi(
        title=app.title,
        version=app.version,
        openapi_version=app.openapi_version,
        description=app.description,
        routes=app.routes,
    )

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8") as f:
        json.dump(openapi_schema, f, indent=2, sort_keys=True)
        f.write("\n")

    print(f"OpenAPI schema successfully exported to: {output_path.resolve()}")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Export OpenAPI schema from the FastAPI application"
    )
    parser.add_argument(
        "--out",
        type=Path,
        default=Path("openapi.json"),
        help="Target path for the exported JSON file (default: ./openapi.json)",
    )
    args = parser.parse_args()
    export_openapi(args.out)


if __name__ == "__main__":
    main()
