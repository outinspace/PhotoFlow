"""Run the worker nightly from a Mac, with launchd as the scheduler.

`uv run worker install` writes a LaunchAgent that runs the worker daily, at a time
the operator picks, with the settings the command was run with; `uninstall` removes
it. In a checkout the agent goes through `uv run`, so a `git pull` is picked up,
dependencies included, on the next run. launchd
never starts a second copy of a label that is still running, which keeps the
pipeline the sole writer of the catalog, and a run missed while the machine slept
fires when it wakes.
"""

import os
import plistlib
import re
import shutil
import subprocess
import sys
from pathlib import Path

# One agent per bucket, so a Mac can process several libraries. Bucket names are
# limited to letters, digits, dots and dashes, which are safe in a label and a path.
LABEL = "space.outin.photoflow"
LOGS = Path.home() / "Library" / "Logs"
FAILURE_NOTE = LOGS / "photoflow-failed.txt"
TOOLS = ("ffmpeg", "exiftool")
DEFAULT_TIME = "09:00"
# The checkout's worker/ directory when running from one; site-packages otherwise.
PROJECT = Path(__file__).resolve().parents[1]


def label(bucket: str) -> str:
    return f"{LABEL}.{bucket}"


def plist_path(bucket: str) -> Path:
    return Path.home() / "Library" / "LaunchAgents" / f"{label(bucket)}.plist"


def log_path(bucket: str) -> Path:
    return LOGS / f"photoflow-{bucket}.log"


def install(bucket: str) -> int:
    if sys.platform != "darwin":
        print("install only knows launchd; on another OS schedule `uv run worker` yourself.", file=sys.stderr)
        return 2

    missing = [tool for tool in TOOLS if not shutil.which(tool)]
    if missing:
        print(f"Not on PATH: {', '.join(missing)}. Run: brew install {' '.join(missing)}", file=sys.stderr)
        return 2

    hour, minute = ask_time()
    path = plist_path(bucket)

    LOGS.mkdir(parents=True, exist_ok=True)
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "wb") as handle:
        plistlib.dump(plist(bucket, hour, minute), handle)
    path.chmod(0o600)  # it holds the bucket key

    _launchctl("bootout", f"gui/{os.getuid()}/{label(bucket)}", check=False)
    _launchctl("bootstrap", f"gui/{os.getuid()}", str(path))

    print(f"Installed for {bucket}. Runs daily at {hour:02d}:{minute:02d}; a run missed while asleep happens on wake.")
    print(f"Log: {log_path(bucket)}")
    print(f"Run now: launchctl kickstart gui/{os.getuid()}/{label(bucket)}")
    print("Re-run install after changing any PHOTOFLOW_* setting.")
    return 0


def uninstall(bucket: str) -> int:
    _launchctl("bootout", f"gui/{os.getuid()}/{label(bucket)}", check=False)
    plist_path(bucket).unlink(missing_ok=True)
    print(f"Uninstalled for {bucket}.")
    return 0


def ask_time() -> tuple[int, int]:
    """Daily run time as (hour, minute); the default when there is nobody to ask."""
    answer = DEFAULT_TIME
    if sys.stdin.isatty():
        answer = input(f"Run every day at (24-hour clock) [{DEFAULT_TIME}]: ").strip() or DEFAULT_TIME
    return parse_time(answer)


def parse_time(text: str) -> tuple[int, int]:
    match = re.fullmatch(r"(\d{1,2})(?::(\d{2}))?", text.strip())
    if not match:
        raise ValueError(f"{text!r} is not a time like 09:00 or 21:30")
    hour, minute = int(match[1]), int(match[2] or 0)
    if not (0 <= hour <= 23 and 0 <= minute <= 59):
        raise ValueError(f"{text!r} is not a time like 09:00 or 21:30")
    return hour, minute


def program() -> list[str]:
    """How the agent starts the worker.

    From a checkout, through `uv run`, which syncs dependencies first: a `git pull`
    is then all an update takes. Anywhere else, this interpreter directly.
    """
    uv = shutil.which("uv")
    if uv and (PROJECT / "pyproject.toml").exists():
        return [uv, "run", "--directory", str(PROJECT), "worker"]
    return [sys.executable, "-m", "photoflow"]


def plist(bucket: str, hour: int, minute: int) -> dict:
    # The settings are baked in at install time, so the agent needs no .env and no
    # working directory. PATH is copied too: launchd's own is bare, and ffmpeg and
    # exiftool live wherever Homebrew put them.
    environment = {k: v for k, v in os.environ.items() if k.startswith("PHOTOFLOW_")}
    environment["PATH"] = os.environ.get("PATH", "/usr/bin:/bin")
    return {
        "Label": label(bucket),
        "ProgramArguments": program(),
        "StartCalendarInterval": {"Hour": hour, "Minute": minute},
        "StandardOutPath": str(log_path(bucket)),
        "StandardErrorPath": str(log_path(bucket)),
        "EnvironmentVariables": environment,
    }


# An iPhone Personal Hotspot always hands out 172.20.10.0/28 with the phone at .1,
# over Wi-Fi, USB and Bluetooth alike.
HOTSPOT_GATEWAY = "172.20.10.1"


def on_hotspot(route_output: str | None = None) -> bool:
    """True when this Mac is tethered to an iPhone, so a batch of originals should
    not be pulled over a phone plan.

    ponytail: iPhone only. Android hotspots use varying private ranges; asking
    Network.framework whether the path is "expensive" would catch them all.
    """
    if route_output is None:
        if sys.platform != "darwin":
            return False
        try:
            route_output = subprocess.run(
                ["route", "-n", "get", "default"], capture_output=True, text=True, timeout=5
            ).stdout
        except Exception:
            return False
    return any(
        line.strip() == f"gateway: {HOTSPOT_GATEWAY}" for line in route_output.splitlines()
    )


def report_failure(reason: str, bucket: str | None = None) -> None:
    """Make a failed unattended run visible: write a short note and open it.

    Only when there is no terminal to have printed to, so a run started by hand
    just shows its output. Under launchd, TextEdit is the window the user sees.
    """
    if sys.platform != "darwin" or sys.stderr.isatty():
        return

    try:
        FAILURE_NOTE.parent.mkdir(parents=True, exist_ok=True)
        FAILURE_NOTE.write_text(
            f"Photoflow could not process new photos{f' in {bucket}' if bucket else ''}.\n\n"
            f"{reason.strip()}\n\n"
            f"Full log: {log_path(bucket) if bucket else LOGS}\n"
            "It tries again at the next scheduled run. To try now, run `uv run worker` in a terminal.\n"
        )
        subprocess.run(["open", "-a", "TextEdit", str(FAILURE_NOTE)], check=False)
    except Exception as error:
        print(f"could not report failure: {error}", file=sys.stderr)


def _launchctl(*arguments: str, check: bool = True) -> None:
    subprocess.run(["launchctl", *arguments], check=check, capture_output=not check)
