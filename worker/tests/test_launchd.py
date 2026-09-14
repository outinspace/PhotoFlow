import plistlib
import sys

from photoflow import launchd


def test_plist_runs_this_interpreter_with_the_photoflow_settings(monkeypatch):
    monkeypatch.setenv("PHOTOFLOW_S3_BUCKET", "photos")
    monkeypatch.setenv("UNRELATED", "no")

    generated = plistlib.loads(plistlib.dumps(launchd.plist()))

    assert generated["Label"] == launchd.LABEL
    assert generated["ProgramArguments"] == [sys.executable, "-m", "photoflow"]
    assert generated["EnvironmentVariables"]["PHOTOFLOW_S3_BUCKET"] == "photos"
    assert "UNRELATED" not in generated["EnvironmentVariables"]
    assert "PATH" in generated["EnvironmentVariables"]
    assert generated["StandardErrorPath"] == generated["StandardOutPath"]


def test_report_failure_is_silent_in_a_terminal(monkeypatch, tmp_path):
    monkeypatch.setattr(launchd, "FAILURE_NOTE", tmp_path / "failed.txt")
    monkeypatch.setattr(sys.stderr, "isatty", lambda: True)

    launchd.report_failure("boom")

    assert not (tmp_path / "failed.txt").exists()
