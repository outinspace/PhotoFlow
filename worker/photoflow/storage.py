"""Object storage access.

Two implementations share one interface so the pipeline and its tests run against
the same code path: S3Storage talks to a real S3-compatible bucket, MemoryStorage
keeps objects in a dict. Tests only ever use MemoryStorage, so running them needs
no credentials and touches no network.
"""

import json
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import TypeVar

from pydantic import BaseModel, ValidationError

TModel = TypeVar("TModel", bound=BaseModel)


class DocumentError(Exception):
    """A stored document did not match its schema."""


@dataclass(frozen=True)
class StoredObject:
    key: str
    size: int


# Keys that are already unguessable and stay where they are. Media is named by
# content hash, and a share document by the secret in its link, so neither gains
# anything from a private prefix — and both are read straight from the CDN by URL,
# which is what keeps the gallery fast.
PUBLIC_PREFIXES = ("original/", "tile-image/", "preview/", "share/")


class Storage(ABC):
    @abstractmethod
    def list(self, prefix: str) -> list[StoredObject]: ...

    @abstractmethod
    def get(self, key: str) -> bytes: ...

    @abstractmethod
    def put(self, key: str, body: bytes, content_type: str) -> None: ...

    @abstractmethod
    def delete(self, key: str) -> None: ...

    @abstractmethod
    def exists(self, key: str) -> bool: ...

    def get_json(self, key: str, default=None):
        if not self.exists(key):
            return default
        return json.loads(self.get(key).decode("utf-8"))

    def put_json(self, key: str, value) -> None:
        body = json.dumps(value, separators=(",", ":"), sort_keys=True).encode("utf-8")
        self.put(key, body, "application/json")

    def get_model(self, key: str, model: type[TModel]) -> TModel | None:
        """Read and validate a document, or None if it is absent.

        A document that exists but does not parse is an error worth stopping for:
        continuing would mean overwriting it with a catalog built from a partial
        reading of it.
        """
        if not self.exists(key):
            return None

        try:
            return model.model_validate_json(self.get(key))
        except ValidationError as error:
            raise DocumentError(f"{key} does not match {model.__name__}: {error}") from error

    def put_model(self, key: str, document: BaseModel) -> None:
        # Validating on the way out too, so a bad value is caught here rather than
        # by the gallery, which has no way to report it.
        body = document.model_dump_json(by_alias=True).encode("utf-8")
        self.put(key, body, "application/json")


class MemoryStorage(Storage):
    def __init__(self, objects: dict[str, bytes] | None = None):
        self.objects: dict[str, bytes] = dict(objects or {})

    def list(self, prefix: str) -> list[StoredObject]:
        return [
            StoredObject(key=key, size=len(body))
            for key, body in sorted(self.objects.items())
            if key.startswith(prefix)
        ]

    def get(self, key: str) -> bytes:
        return self.objects[key]

    def put(self, key: str, body: bytes, content_type: str) -> None:
        self.objects[key] = body

    def delete(self, key: str) -> None:
        self.objects.pop(key, None)

    def exists(self, key: str) -> bool:
        return key in self.objects


class S3Storage(Storage):
    """A real bucket, with the private prefix applied on the way in and out.

    Every caller deals in logical keys — "catalog/manifest.json" — and this is the
    only place that knows where they actually live. Doing it here rather than in
    keys.py means the gallery, the worker and the tests all go on naming objects the
    same way, and there is one place to audit for what is public.
    """

    def __init__(self, config, workers: int = 1):
        import boto3
        from botocore.config import Config as BotoConfig

        self.bucket = config.bucket
        prefix = getattr(config, "private_prefix", "") or ""
        self.private_prefix = f"{prefix.strip('/')}/" if prefix else ""
        self.client = boto3.client(
            "s3",
            endpoint_url=config.endpoint_url,
            aws_access_key_id=config.access_key_id,
            aws_secret_access_key=config.secret_access_key,
            region_name=config.region,
            # botocore pools ten connections by default; more workers than that
            # would spend their time queueing for one.
            config=BotoConfig(max_pool_connections=max(10, workers * 2)),
        )

    def resolve(self, key: str) -> str:
        """Where a logical key actually lives in the bucket."""
        if not self.private_prefix or key.startswith(PUBLIC_PREFIXES):
            return key
        return self.private_prefix + key

    def _logical(self, key: str) -> str:
        """The inverse, for keys coming back from a listing.

        Listings must hand back the same names callers passed in, or a key read from
        one and then given to get() or delete() would be prefixed twice.
        """
        if self.private_prefix and key.startswith(self.private_prefix):
            return key[len(self.private_prefix):]
        return key

    def list(self, prefix: str) -> list[StoredObject]:
        results: list[StoredObject] = []
        paginator = self.client.get_paginator("list_objects_v2")
        for page in paginator.paginate(Bucket=self.bucket, Prefix=self.resolve(prefix)):
            for entry in page.get("Contents", []):
                results.append(
                    StoredObject(key=self._logical(entry["Key"]), size=entry["Size"])
                )
        return results

    def get(self, key: str) -> bytes:
        return self.client.get_object(Bucket=self.bucket, Key=self.resolve(key))["Body"].read()

    def put(self, key: str, body: bytes, content_type: str) -> None:
        self.client.put_object(
            Bucket=self.bucket, Key=self.resolve(key), Body=body, ContentType=content_type
        )

    def delete(self, key: str) -> None:
        self.client.delete_object(Bucket=self.bucket, Key=self.resolve(key))

    def exists(self, key: str) -> bool:
        from botocore.exceptions import ClientError

        try:
            self.client.head_object(Bucket=self.bucket, Key=self.resolve(key))
            return True
        except ClientError as error:
            if error.response["Error"]["Code"] in ("404", "NoSuchKey", "NotFound"):
                return False
            raise

    def download(self, key: str, destination: str) -> None:
        self.client.download_file(self.bucket, self.resolve(key), destination)

    def upload(self, path: str, key: str, content_type: str) -> None:
        self.client.upload_file(
            path, self.bucket, self.resolve(key), ExtraArgs={"ContentType": content_type}
        )
