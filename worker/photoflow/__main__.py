"""Entry point: build a context, run the pipeline, report."""

import argparse
import shutil
import sys
import tempfile
import urllib.request

from .config import Config, ConfigError
from .pipeline import Context, run
from .storage import S3Storage


def main() -> int:
    parser = argparse.ArgumentParser(description="Process new photos and repair what is missing.")
    parser.add_argument(
        "--workers", type=int, default=1,
        help="files to process at once (default 1). Raise it for a local run over a "
             "large library; leave it alone in CI, where a runner has two cores.",
    )
    arguments = parser.parse_args()

    if arguments.workers < 1:
        print("--workers must be at least 1", file=sys.stderr)
        return 2

    try:
        config = Config.from_env()
    except ConfigError as error:
        print(f"Configuration error: {error}", file=sys.stderr)
        return 2

    work_dir = tempfile.mkdtemp(prefix="photoflow-")

    try:
        context = Context(
            config=config,
            storage=S3Storage(config, workers=arguments.workers),
            work_dir=work_dir,
            workers=arguments.workers,
        )
        results = run(context)
    finally:
        shutil.rmtree(work_dir, ignore_errors=True)

    failed = [result for result in results if result.error]

    print("\n" + "=" * 48)
    for result in results:
        status = "FAILED" if result.error else "ok"
        print(f"{result.name:<10} {result.seconds:>7.1f}s  {status}")
    print("=" * 48)

    _ping_healthcheck(config, ok=not failed)

    return 1 if failed else 0


def _ping_healthcheck(config, ok: bool) -> None:
    """A missed or failing run should page the operator, not fail silently."""
    if not config.healthcheck_url:
        return

    url = config.healthcheck_url if ok else config.healthcheck_url.rstrip("/") + "/fail"
    try:
        urllib.request.urlopen(url, timeout=10)
    except Exception as error:
        print(f"healthcheck ping failed: {error}", file=sys.stderr)


if __name__ == "__main__":
    raise SystemExit(main())
