"""Run the worker nightly from a Mac, with launchd as the scheduler.

`photoflow-worker install` writes a LaunchAgent that runs this same interpreter at
3am with the settings the command was run with, and `uninstall` removes it. launchd
never starts a second copy of a label that is still running, which keeps the
pipeline the sole writer of the catalog, and a run missed while the machine slept
fires when it wakes.
"""

import os
import plistlib
import shutil
import subprocess
import sys
from pathlib import Path

LABEL = "space.outin.photoflow"
PLIST = Path.home() / "Library" / "LaunchAgents" / f"{LABEL}.plist"
LOG = Path.home() / "Library" / "Logs" / "photoflow.log"
FAILURE_NOTE = Path.home() / "Library" / "Logs" / "photoflow-failed.txt"
TOOLS = ("ffmpeg", "exiftool")


def install() -> int:
    if sys.platform != "darwin":
        print("install only knows launchd; on another OS schedule `photoflow-worker` yourself.", file=sys.stderr)
        return 2

    missing = [tool for tool in TOOLS if not shutil.which(tool)]
    if missing:
        print(f"Not on PATH: {', '.join(missing)}. Run: brew install {' '.join(missing)}", file=sys.stderr)
        return 2

    LOG.parent.mkdir(parents=True, exist_ok=True)
    PLIST.parent.mkdir(parents=True, exist_ok=True)
    with open(PLIST, "wb") as handle:
        plistlib.dump(plist(), handle)
    PLIST.chmod(0o600)  # it holds the bucket key

    _launchctl("bootout", f"gui/{os.getuid()}/{LABEL}", check=False)
    _launchctl("bootstrap", f"gui/{os.getuid()}", str(PLIST))

    print(f"Installed. Runs nightly at 03:00; a run missed while asleep happens on wake.")
    print(f"Log: {LOG}")
    print(f"Run now: launchctl kickstart gui/{os.getuid()}/{LABEL}")
    print("Re-run install after changing any PHOTOFLOW_* setting.")
    return 0


def uninstall() -> int:
    _launchctl("bootout", f"gui/{os.getuid()}/{LABEL}", check=False)
    PLIST.unlink(missing_ok=True)
    print("Uninstalled.")
    return 0


def plist() -> dict:
    # The settings are baked in at install time, so the agent needs no .env and no
    # working directory. PATH is copied too: launchd's own is bare, and ffmpeg and
    # exiftool live wherever Homebrew put them.
    environment = {k: v for k, v in os.environ.items() if k.startswith("PHOTOFLOW_")}
    environment["PATH"] = os.environ.get("PATH", "/usr/bin:/bin")
    return {
        "Label": LABEL,
        "ProgramArguments": [sys.executable, "-m", "photoflow"],
        "StartCalendarInterval": {"Hour": 3, "Minute": 0},
        "StandardOutPath": str(LOG),
        "StandardErrorPath": str(LOG),
        "EnvironmentVariables": environment,
    }


def report_failure(reason: str) -> None:
    """Make a failed unattended run visible: write a short note and open it.

    Only when there is no terminal to have printed to, so a run started by hand
    just shows its output. Under launchd, TextEdit is the window the user sees.
    """
    if sys.platform != "darwin" or sys.stderr.isatty():
        return

    try:
        FAILURE_NOTE.parent.mkdir(parents=True, exist_ok=True)
        FAILURE_NOTE.write_text(
            "Photoflow could not process new photos.\n\n"
            f"{reason.strip()}\n\n"
            f"Full log: {LOG}\n"
            "It tries again tomorrow at 03:00. To try now, run photoflow-worker in a terminal.\n"
        )
        subprocess.run(["open", "-a", "TextEdit", str(FAILURE_NOTE)], check=False)
    except Exception as error:
        print(f"could not report failure: {error}", file=sys.stderr)


def _launchctl(*arguments: str, check: bool = True) -> None:
    subprocess.run(["launchctl", *arguments], check=check, capture_output=not check)
