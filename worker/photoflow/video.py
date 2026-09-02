"""Deciding what to do with a video.

Most phone clips are already H.264 at 1080p or less, which every browser plays.
Transcoding those produces a second file of similar size for no benefit, so they
are served as their own preview. Anything else — HEVC, oversized, exotic — gets a
compatibility transcode.
"""

import json
import subprocess
from dataclasses import dataclass

# Codecs every current browser decodes. HEVC is deliberately absent: Safari plays
# it, but Chrome only with hardware support and Firefox largely not at all.
BROWSER_SAFE_CODECS = {"h264"}
BROWSER_SAFE_CONTAINERS = {"mp4", "mov", "m4v"}

FFPROBE_TIMEOUT_SECONDS = 60


@dataclass(frozen=True)
class VideoInfo:
    codec: str | None
    height: int | None
    duration: float | None
    container: str | None


def probe(path: str) -> VideoInfo:
    result = subprocess.run(
        [
            "ffprobe", "-v", "error",
            "-select_streams", "v:0",
            "-show_entries", "stream=codec_name,height",
            "-show_entries", "format=duration,format_name",
            "-of", "json",
            path,
        ],
        capture_output=True,
        timeout=FFPROBE_TIMEOUT_SECONDS,
    )
    if result.returncode != 0:
        raise RuntimeError(result.stderr.decode("utf-8", "replace").strip())

    parsed = json.loads(result.stdout.decode("utf-8", "replace"))
    stream = (parsed.get("streams") or [{}])[0]
    container = (parsed.get("format", {}).get("format_name") or "").split(",")[0]

    duration = parsed.get("format", {}).get("duration")

    return VideoInfo(
        codec=stream.get("codec_name"),
        height=stream.get("height"),
        duration=float(duration) if duration else None,
        container=container or None,
    )


def can_pass_through(info: VideoInfo, max_height: int) -> bool:
    if info.codec not in BROWSER_SAFE_CODECS:
        return False
    if info.container is not None and info.container not in BROWSER_SAFE_CONTAINERS:
        return False
    if info.height is None or info.height > max_height:
        return False
    return True
