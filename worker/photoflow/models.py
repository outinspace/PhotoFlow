"""Every document the pipeline reads or writes, as a validated model.

Two of these are written by other programs — device logs come from browsers, and
the catalog is re-read by the worker on its next run — so parsing them is the one
place a shape mismatch can be caught before it silently corrupts a catalog.
Validating on write matters just as much: the gallery reads these files directly,
and a malformed field would surface as a blank grid rather than an error.

Item and File field names match src/types.ts exactly, so a shard entry drops
straight into the gallery without translation. Mutable state (favourites,
deletions, albums) is deliberately absent from the catalog: it lives in meta/,
which is what lets a month shard become immutable once that month is over.
"""

from typing import Annotated, Literal, Union

from pydantic import BaseModel, ConfigDict, Field


class Strict(BaseModel):
    # Rejecting unknown fields turns a renamed key into an immediate error rather
    # than a value that silently stops being written.
    model_config = ConfigDict(extra="forbid")


class FileRecord(Strict):
    fileId: str
    contentType: str
    originalFileName: str
    sizeBytes: int
    uploadTimeUtc: str
    hashSha256: str
    lastProcessedTimeUtc: str | None = None
    failedProcessingTimeUtc: str | None = None
    tileVersion: int | None = None
    previewVersion: int | None = None
    thumbHash: str | None = None
    # True when the original is already browser-playable and is served as its own
    # preview, so no near-duplicate transcode was stored.
    previewIsOriginal: bool = False


class ItemRecord(Strict):
    itemId: int
    captureTime: str
    files: list[FileRecord] = Field(default_factory=list)

    videoLength: float | None = None
    widthPixels: int | None = None
    heightPixels: int | None = None
    longitude: float | None = None
    latitude: float | None = None
    altitude: float | None = None
    city: str | None = None
    region: str | None = None
    megapixels: float | None = None
    exposureTime: str | None = None
    aperature: float | None = None
    fNumber: float | None = None
    iso: int | None = None
    cameraMake: str | None = None
    cameraModel: str | None = None


class ShardDocument(Strict):
    month: str
    items: list[ItemRecord] = Field(default_factory=list)


class ShardEntry(Strict):
    month: str
    items: int
    updatedAt: str


class EmbeddingsInfo(Strict):
    dim: int
    dtype: str
    modelRepo: str
    months: list[str] = Field(default_factory=list)


class UrlPrefixes(Strict):
    originalPrefix: str
    tileImagePrefix: str
    previewPrefix: str


class Counts(Strict):
    items: int
    files: int


class ManifestDocument(Strict):
    manifestVersion: int
    generatedAt: str
    versions: dict[str, int]
    urls: UrlPrefixes
    shards: list[ShardEntry] = Field(default_factory=list)
    embeddings: EmbeddingsInfo
    counts: Counts


# --- Mutations, written by browsers -----------------------------------------

class FavoriteOp(Strict):
    op: Literal["item.favorite"]
    seq: int
    ts: str
    itemId: int
    value: bool


class DeletedOp(Strict):
    op: Literal["item.deleted"]
    seq: int
    ts: str
    itemId: int
    value: str | None


class AlbumNameOp(Strict):
    op: Literal["album.create", "album.rename"]
    seq: int
    ts: str
    albumId: int
    name: str


class AlbumDeleteOp(Strict):
    op: Literal["album.delete"]
    seq: int
    ts: str
    albumId: int


class AlbumShareOp(Strict):
    op: Literal["album.share"]
    seq: int
    ts: str
    albumId: int
    secret: str


class AlbumMemberOp(Strict):
    op: Literal["album.member"]
    seq: int
    ts: str
    albumId: int
    itemId: int
    value: bool


Operation = Annotated[
    Union[FavoriteOp, DeletedOp, AlbumNameOp, AlbumDeleteOp, AlbumShareOp, AlbumMemberOp],
    Field(discriminator="op"),
]


class DeviceLogDocument(Strict):
    deviceId: str
    ops: list[Operation] = Field(default_factory=list)


class StateDocument(BaseModel):
    """The compacted mutation state.

    Unlike the others this stays loosely typed: it is a map of per-field values
    with timestamps, and pinning its inner shape would mean a schema change every
    time a new mutable field is added.
    """

    stateVersion: int = 1
    compactedAt: str | None = None
    cursors: dict[str, int] = Field(default_factory=dict)
    items: dict[str, dict] = Field(default_factory=dict)
    albums: dict[str, dict] = Field(default_factory=dict)


class StepReport(Strict):
    name: str
    seconds: float
    failed: bool


class HeartbeatDocument(Strict):
    finishedAt: str
    ok: bool
    steps: list[StepReport] = Field(default_factory=list)
    notes: list[str] = Field(default_factory=list)
    itemCount: int
