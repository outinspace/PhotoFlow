"""Runtime configuration, read once from the environment.

Every self-hosted install differs only by these values, so they are the entire
contract between the repo and its operator.
"""

import os
from dataclasses import dataclass


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
    # Public base URL that reads go through. A CDN in front of the bucket is
    # strongly preferred, so the gallery gets HTTP/2+3 multiplexing instead of the
    # browser's per-host connection cap; without one it falls back to the bucket.
    public_base_url: str
    # Optional path segment inserted after each media folder, e.g. "some-tenant-id/".
    # Empty for new installs; set it to point the worker at a bucket laid out by the
    # legacy API, which nested media under a tenant id.
    path_prefix: str
    # Cap per run so a first run over a huge library cannot exhaust CI minutes.
    max_files_per_run: int
    # Videos at or below this height that already use a browser-safe codec are served
    # as-is instead of being transcoded into a near-duplicate preview file.
    passthrough_max_height: int
    clip_model_repo: str
    healthcheck_url: str | None

    @staticmethod
    def from_env() -> "Config":
        endpoint_url = _required("PHOTOFLOW_S3_ENDPOINT").rstrip("/")
        bucket = _required("PHOTOFLOW_S3_BUCKET")

        # Optional, and the same fallback the app's setup screen uses: with no CDN,
        # photos are served by the bucket itself.
        public_base_url = os.environ.get("PHOTOFLOW_PUBLIC_BASE_URL", "").strip()
        public_base_url = (public_base_url or f"{endpoint_url}/{bucket}").rstrip("/") + "/"

        path_prefix = os.environ.get("PHOTOFLOW_PATH_PREFIX", "").strip().strip("/")
        if path_prefix:
            path_prefix += "/"

        return Config(
            endpoint_url=endpoint_url,
            bucket=bucket,
            access_key_id=_required("PHOTOFLOW_S3_ACCESS_KEY_ID"),
            secret_access_key=_required("PHOTOFLOW_S3_SECRET_ACCESS_KEY"),
            region=os.environ.get("PHOTOFLOW_S3_REGION", "us-east-1"),
            public_base_url=public_base_url,
            path_prefix=path_prefix,
            max_files_per_run=int(os.environ.get("PHOTOFLOW_MAX_FILES_PER_RUN", "2000")),
            passthrough_max_height=int(os.environ.get("PHOTOFLOW_PASSTHROUGH_MAX_HEIGHT", "1080")),
            clip_model_repo=os.environ.get("PHOTOFLOW_CLIP_MODEL_REPO", "Xenova/clip-vit-base-patch32"),
            healthcheck_url=os.environ.get("PHOTOFLOW_HEALTHCHECK_URL") or None,
        )
