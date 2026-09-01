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
        """Read and validate a document, or None if it is not there.

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
    def __init__(self, config):
        import boto3

        self.bucket = config.bucket
        self.client = boto3.client(
            "s3",
            endpoint_url=config.endpoint_url,
            aws_access_key_id=config.access_key_id,
            aws_secret_access_key=config.secret_access_key,
            region_name=config.region,
        )

    def list(self, prefix: str) -> list[StoredObject]:
        results: list[StoredObject] = []
        paginator = self.client.get_paginator("list_objects_v2")
        for page in paginator.paginate(Bucket=self.bucket, Prefix=prefix):
            for entry in page.get("Contents", []):
                results.append(StoredObject(key=entry["Key"], size=entry["Size"]))
        return results

    def get(self, key: str) -> bytes:
        return self.client.get_object(Bucket=self.bucket, Key=key)["Body"].read()

    def put(self, key: str, body: bytes, content_type: str) -> None:
        self.client.put_object(Bucket=self.bucket, Key=key, Body=body, ContentType=content_type)

    def delete(self, key: str) -> None:
        self.client.delete_object(Bucket=self.bucket, Key=key)

    def exists(self, key: str) -> bool:
        from botocore.exceptions import ClientError

        try:
            self.client.head_object(Bucket=self.bucket, Key=key)
            return True
        except ClientError as error:
            if error.response["Error"]["Code"] in ("404", "NoSuchKey", "NotFound"):
                return False
            raise

    def download(self, key: str, destination: str) -> None:
        self.client.download_file(self.bucket, key, destination)

    def upload(self, path: str, key: str, content_type: str) -> None:
        self.client.upload_file(
            path, self.bucket, key, ExtraArgs={"ContentType": content_type}
        )
