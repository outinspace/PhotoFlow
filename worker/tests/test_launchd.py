import plistlib
import sys

import pytest

from photoflow import launchd


def test_plist_runs_this_interpreter_with_the_photoflow_settings(monkeypatch):
    monkeypatch.setenv("PHOTOFLOW_S3_BUCKET", "photos")
    monkeypatch.setenv("UNRELATED", "no")

    generated = plistlib.loads(plistlib.dumps(launchd.plist("photos", 9, 30)))

    # One agent and one log per bucket, so two libraries can share a Mac.
    assert generated["Label"] == "space.outin.photoflow.photos"
    assert generated["StandardOutPath"].endswith("photoflow-photos.log")
    assert generated["StartCalendarInterval"] == {"Hour": 9, "Minute": 30}
    # In this checkout the agent goes through uv run, so a git pull is picked up.
    assert generated["ProgramArguments"][1:] == ["run", "--directory", str(launchd.PROJECT), "worker"]
    assert generated["EnvironmentVariables"]["PHOTOFLOW_S3_BUCKET"] == "photos"
    assert "UNRELATED" not in generated["EnvironmentVariables"]
    assert "PATH" in generated["EnvironmentVariables"]
    assert generated["StandardErrorPath"] == generated["StandardOutPath"]


def test_parse_time():
    assert launchd.parse_time("09:00") == (9, 0)
    assert launchd.parse_time("21:30") == (21, 30)
    assert launchd.parse_time("7") == (7, 0)
    for bad in ("24:00", "9:60", "noon", ""):
        with pytest.raises(ValueError):
            launchd.parse_time(bad)


def test_on_hotspot_recognises_an_iphone_gateway():
    tethered = "   route to: default\n    gateway: 172.20.10.1\n  interface: en0\n"
    at_home = "   route to: default\n    gateway: 192.168.1.1\n  interface: en0\n"

    assert launchd.on_hotspot(tethered)
    assert not launchd.on_hotspot(at_home)
    assert not launchd.on_hotspot("")


def test_report_failure_is_silent_in_a_terminal(monkeypatch, tmp_path):
    monkeypatch.setattr(launchd, "FAILURE_NOTE", tmp_path / "failed.txt")
    monkeypatch.setattr(sys.stderr, "isatty", lambda: True)

    launchd.report_failure("boom")

    assert not (tmp_path / "failed.txt").exists()
