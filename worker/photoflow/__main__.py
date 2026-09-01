"""Entry point: build a context, run the pipeline, report."""

import shutil
import sys
import tempfile
import urllib.request
from pathlib import Path

from dotenv import load_dotenv

from .config import Config, ConfigError

# Settings come from worker/.env when running locally. Real environment variables
# take precedence, so a stale local file can never override what CI passes in.
load_dotenv(Path(__file__).resolve().parent.parent / ".env")
from .pipeline import Context, run
from .storage import S3Storage


def main() -> int:
    try:
        config = Config.from_env()
    except ConfigError as error:
        print(f"Configuration error: {error}", file=sys.stderr)
        return 2

    work_dir = tempfile.mkdtemp(prefix="photoflow-")

    try:
        context = Context(config=config, storage=S3Storage(config), work_dir=work_dir)
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
