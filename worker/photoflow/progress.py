"""Report how far through its work a long step has got.

A step over a large library runs for minutes or hours and, between its heading
and its summary line, used to print nothing at all — so a run that had stalled
looked exactly like one that was working.

Output adapts to where it lands. A terminal gets one line redrawn in place. A log
file gets a line only every LOG_INTERVAL_SECONDS, because a redrawn line in a log
is just one very long line, and a step that finishes quickly gets no line at all:
its summary already says everything.
"""

import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

LOG_INTERVAL_SECONDS = 60

# True while an in-place line is on screen waiting to be overwritten.
_line_open = False


def interrupt() -> None:
    """End an in-place line so the next print starts on a line of its own."""
    global _line_open

    if _line_open:
        print(flush=True)
        _line_open = False


def track(items, label: str):
    """Yield each of items, reporting progress as they go.

    Takes a sized collection rather than any iterable: the total is the whole
    point of the report, and every caller already has a list.
    """
    total = len(items)
    if not total:
        return

    interactive = sys.stdout.isatty()
    started = time.monotonic()
    last_logged = 0.0
    logged = False

    if interactive:
        _report(label, 0, total, 0.0, interactive)

    try:
        for index, item in enumerate(items, start=1):
            yield item
            elapsed = time.monotonic() - started

            if interactive:
                _report(label, index, total, elapsed, interactive)
            elif elapsed - last_logged >= LOG_INTERVAL_SECONDS:
                last_logged = elapsed
                logged = True
                _report(label, index, total, elapsed, interactive)
    finally:
        # The caller may break out early, which still leaves a line to close.
        interrupt()

    # Reached only when every item was consumed, so this cannot claim a total the
    # step did not actually reach.
    if logged:
        _report(label, total, total, time.monotonic() - started, interactive)


def track_map(work, items, label: str, workers: int) -> None:
    """Run work over items, reporting as each finishes.

    One worker keeps the sequential path, so a default run behaves exactly as it
    did and nothing here has to be trusted when it is not asked for.
    """
    if workers <= 1:
        for item in track(items, label):
            work(item)
        return

    total = len(items)
    if not total:
        return

    interactive = sys.stdout.isatty()
    started = time.monotonic()
    last_logged = 0.0
    done = 0
    lock = threading.Lock()

    with ThreadPoolExecutor(max_workers=workers) as pool:
        futures = [pool.submit(work, item) for item in items]

        for future in as_completed(futures):
            # Raised here rather than swallowed: a step's own expected failures are
            # handled inside work, so anything reaching this is a real fault.
            future.result()

            with lock:
                done += 1
                elapsed = time.monotonic() - started

                if interactive:
                    _report(label, done, total, elapsed, interactive)
                elif elapsed - last_logged >= LOG_INTERVAL_SECONDS:
                    last_logged = elapsed
                    _report(label, done, total, elapsed, interactive)

    interrupt()


def _report(label: str, done: int, total: int, elapsed: float, interactive: bool) -> None:
    global _line_open

    line = f"  {label} {done}/{total}  {round(done / total * 100)}%{_timing(done, total, elapsed)}"

    if not interactive:
        print(line, flush=True)
        return

    # \x1b[K clears whatever the previous, possibly longer, line left behind.
    print(f"\r{line}\x1b[K", end="", flush=True)
    _line_open = done < total

    if done == total:
        print(flush=True)


def _timing(done: int, total: int, elapsed: float) -> str:
    if done == total:
        return f"  in {_duration(elapsed)}"
    if not done or not elapsed:
        return ""

    return f"  eta {_duration((total - done) * elapsed / done)}"


def _duration(seconds: float) -> str:
    seconds = int(seconds)
    if seconds < 60:
        return f"{seconds}s"
    if seconds < 3600:
        return f"{seconds // 60}m{seconds % 60:02d}s"
    return f"{seconds // 3600}h{seconds % 3600 // 60:02d}m"
