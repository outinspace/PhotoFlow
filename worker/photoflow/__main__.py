"""Entry point: build a context, run the pipeline, report."""

import argparse
import shutil
import sys
import tempfile
import traceback
import urllib.request

from . import launchd
from .bucket_setup import ensure_ready
from .config import Config, ConfigError
from .pipeline import Context, run
from .storage import S3Storage


def main() -> int:
    try:
        return _main()
    except Exception:
        launchd.report_failure(traceback.format_exc())
        raise


def _main() -> int:
    parser = argparse.ArgumentParser(description="Process new photos and repair what is missing.")
    parser.add_argument(
        "command", nargs="?", choices=["install", "uninstall"],
        help="install: run daily from this Mac via launchd, with the current settings. "
             "uninstall: stop doing that. No command: run once now.",
    )
    parser.add_argument(
        "--workers", type=int, default=1,
        help="files to process at once (default 1). Raise it for a local run over a "
             "large library; leave it alone in CI, where a runner has two cores.",
    )
    parser.add_argument(
        "--env", metavar="FILE",
        help="settings file to use instead of worker/.env, for a second bucket on "
             "the same machine. Only needed for install and uninstall; the "
             "installed agent carries its settings with it.",
    )
    arguments = parser.parse_args()

    if arguments.workers < 1:
        print("--workers must be at least 1", file=sys.stderr)
        return 2

    try:
        config = Config.from_env(arguments.env)
    except ConfigError as error:
        print(f"Configuration error: {error}", file=sys.stderr)
        launchd.report_failure(f"Configuration error: {error}")
        return 2

    if arguments.command == "uninstall":
        return launchd.uninstall(config.bucket)

    if arguments.command == "install":
        try:
            return launchd.install(config.bucket)
        except ValueError as error:
            print(error, file=sys.stderr)
            return 2

    storage = S3Storage(config, workers=arguments.workers)

    # Only asks when something is wrong and there is a terminal to answer from.
    if not ensure_ready(config, storage):
        return 2

    # Batches of PHOTOFLOW_BATCH_SIZE until nothing is waiting. Each is published
    # before the next starts, so a closed lid or a crash loses at most one batch.
    batch = 0

    while True:
        batch += 1
        print(f"\n===== batch {batch} =====", flush=True)

        # A fresh directory per batch keeps disk use to one batch of originals.
        work_dir = tempfile.mkdtemp(prefix="photoflow-")
        try:
            context = Context(
                config=config, storage=storage, work_dir=work_dir, workers=arguments.workers
            )
            results = run(context)
        finally:
            shutil.rmtree(work_dir, ignore_errors=True)

        failed = [result for result in results if result.error]
        _print_summary(results)

        if failed or not context.more_waiting:
            break

    _ping_healthcheck(config, ok=not failed)

    if failed:
        launchd.report_failure("\n".join(f"{r.name}: {r.error}" for r in failed), config.bucket)

    return 1 if failed else 0


def _print_summary(results) -> None:
    print("\n" + "=" * 48)
    for result in results:
        status = "FAILED" if result.error else "ok"
        print(f"{result.name:<10} {result.seconds:>7.1f}s  {status}")
    print("=" * 48)


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
