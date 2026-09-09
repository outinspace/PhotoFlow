"""Runtime configuration, read once from the environment.

Every self-hosted install differs only by these values, so they are the entire
contract between the repo and its operator.
"""

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

ENV_FILE = Path(__file__).resolve().parent.parent / ".env"


class ConfigError(Exception):
    pass


def _required(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise ConfigError(
            f"{name} is not set. See worker/.env.example for the full list of required settings."
        )
    return value


@dataclass(frozen=True)
class Config:
    endpoint_url: str
    bucket: str
    access_key_id: str
    secret_access_key: str
    region: str
    # Cap per run so a first run over a huge library cannot exhaust CI minutes.
    max_files_per_run: int
    # Separate cap for repairing already-catalogued files, so a large backlog is
    # worked through over several nights instead of stalling one run.
    max_backfill_per_run: int
    clip_model_repo: str
    healthcheck_url: str | None
    # Quality of a transcoded preview, on the scale of whichever encoder runs.
    # Hardware and software encoders do not agree on a number, so there is one for
    # each; the defaults were matched to produce the same file size on a 1440p clip.
    # Last, and defaulted, so that every existing caller stays valid.
    video_quality_hardware: int = 40
    video_quality_software: int = 28
    # Where the app is served from. The CORS rule the first run offers to write
    # names this origin, and the browser is refused if it names another.
    app_origin: str = "https://photoflow.outin.space"
    # What a run may put in its work directory, shared by ingest and backfill.
    # Both download everything before derive touches the first file, so it all sits
    # on disk at once, and a file count cannot bound that: a thousand phone photos
    # fit on a CI runner and a few hundred 4K clips do not.
    max_bytes_per_run: int = 6 * 1024**3

    @staticmethod
    def from_env() -> "Config":
        # Settings come from worker/.env when running locally. Real environment
        # variables take precedence, so a stale local file can never override what
        # CI passes in.
        load_dotenv(ENV_FILE)

        return Config(
            endpoint_url=_required("PHOTOFLOW_S3_ENDPOINT").rstrip("/"),
            bucket=_required("PHOTOFLOW_S3_BUCKET"),
            access_key_id=_required("PHOTOFLOW_S3_ACCESS_KEY_ID"),
            secret_access_key=_required("PHOTOFLOW_S3_SECRET_ACCESS_KEY"),
            region=os.environ.get("PHOTOFLOW_S3_REGION", "us-east-1"),
            max_files_per_run=int(os.environ.get("PHOTOFLOW_MAX_FILES_PER_RUN", "2000")),
            max_backfill_per_run=int(os.environ.get("PHOTOFLOW_MAX_BACKFILL_PER_RUN", "500")),
            max_bytes_per_run=int(
                os.environ.get("PHOTOFLOW_MAX_BYTES_PER_RUN", str(6 * 1024**3))
            ),
            video_quality_hardware=int(os.environ.get("PHOTOFLOW_VIDEO_QUALITY_HARDWARE", "40")),
            video_quality_software=int(os.environ.get("PHOTOFLOW_VIDEO_QUALITY_SOFTWARE", "28")),
            clip_model_repo=os.environ.get("PHOTOFLOW_CLIP_MODEL_REPO", "Xenova/clip-vit-base-patch32"),
            healthcheck_url=os.environ.get("PHOTOFLOW_HEALTHCHECK_URL") or None,
            app_origin=os.environ.get(
                "PHOTOFLOW_APP_ORIGIN", "https://photoflow.outin.space"
            ).rstrip("/"),
        )
