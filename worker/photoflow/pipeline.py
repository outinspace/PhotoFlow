"""The ETL pipeline.

The whole worker is this list of steps, run in order. Each step is a plain
function that takes the shared Context, does one job, and reports what it did.
Adding a stage means writing a function and adding it to STEPS.
"""

import time
import traceback
from dataclasses import dataclass, field

from . import keys, progress
from .config import Config
from .models import HeartbeatDocument, ItemRecord, StepReport
from .storage import Storage
from .steps import backfill, cleanup, compact, derive, discover, embed, extract, ingest, publish


@dataclass
class Context:
    config: Config
    storage: Storage
    # Cleaned up by the caller.
    work_dir: str

    # Every item already in the catalog, keyed by itemId, loaded by discover and
    # written back by publish.
    items: dict[int, ItemRecord] = field(default_factory=dict)
    # Content hashes already in the catalog, for dedupe.
    known_hashes: set[str] = field(default_factory=set)
    # incoming/ objects this run will process.
    pending: list = field(default_factory=list)
    # fileId -> request key, for files the app asked to have rebuilt.
    reprocess: dict = field(default_factory=dict)
    # Already-catalogued files missing a derived output, repaired a batch per run.
    backfill: list = field(default_factory=list)
    # Items touched this run, so publish only rewrites the shards that changed.
    dirty_months: set[str] = field(default_factory=set)
    # Embeddings produced this run, keyed by itemId.
    new_embeddings: dict[int, bytes] = field(default_factory=dict)
    merged_state: dict = field(default_factory=dict)
    notes: list[str] = field(default_factory=list)

    def note(self, message: str) -> None:
        progress.interrupt()
        self.notes.append(message)
        print(f"  {message}", flush=True)


@dataclass
class StepResult:
    name: str
    seconds: float
    error: str | None = None


STEPS = [
    discover.run,
    ingest.run,
    backfill.run,
    extract.run,
    derive.run,
    embed.run,
    compact.run,
    publish.run,
    cleanup.run,
]


def run(context: Context) -> list[StepResult]:
    results: list[StepResult] = []

    for step in STEPS:
        name = step.__module__.rsplit(".", 1)[-1]
        progress.interrupt()
        print(f"\n[{name}]", flush=True)
        started = time.monotonic()

        try:
            step(context)
            results.append(StepResult(name=name, seconds=time.monotonic() - started))
        except Exception:
            error = traceback.format_exc()
            progress.interrupt()
            print(error, flush=True)
            results.append(
                StepResult(name=name, seconds=time.monotonic() - started, error=error)
            )
            # A failed step leaves the catalog untouched rather than half-written.
            break

    write_heartbeat(context, results)
    return results


def write_heartbeat(context: Context, results: list[StepResult]) -> None:
    """Publish what happened, so the gallery can show staleness without an API."""
    from datetime import datetime, timezone

    context.storage.put_model(
        keys.META_HEARTBEAT,
        HeartbeatDocument(
            finishedAt=datetime.now(timezone.utc).isoformat(),
            ok=all(result.error is None for result in results),
            steps=[
                StepReport(
                    name=result.name,
                    seconds=round(result.seconds, 1),
                    failed=result.error is not None,
                )
                for result in results
            ],
            notes=context.notes,
            itemCount=len(context.items),
        ),
    )
