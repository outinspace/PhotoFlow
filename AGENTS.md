# Agent Guidelines

## Project context

Photoflow is a self-hosted photo gallery — a privacy-focused alternative to Apple iCloud
Photos and Google Photos. It runs with **no server and no API**. Users connect their own
S3-compatible bucket; a scheduled job writes a static catalog into it, and the app reads
that catalog directly from a CDN in front of the bucket.

This one repo holds both halves:

- **`src/`** — the front end: a React PWA (TypeScript, Vite, Tailwind). It reads the
  catalog over HTTPS and signs its own writes with the user's S3 credentials, which live
  only in that browser's local storage.
- **`worker/`** — the nightly ETL pipeline: Python, managed with `uv`, run by GitHub
  Actions. It turns uploads in `incoming/` into originals, tiles, previews, embeddings
  and catalog shards.

Read `Readme.md` for the architecture and the reasoning behind it.

## Things that are load-bearing

- **Bucket key shapes** are a contract between the two halves. They are declared in
  `worker/photoflow/keys.py` and `src/storage/keys.ts` — change both or neither.
- **`src/types.ts` matches `worker/photoflow/models.py`.** A shard entry is dropped
  straight into the gallery without translation.
- **The mutation merge is implemented twice** — `worker/photoflow/steps/compact.py` and
  `src/storage/mutations.ts` — because both the browser and the compactor merge the same
  logs. They must agree. Both have test suites that mirror each other case for case.
- **Catalog shards are immutable once their month is over.** Never write mutable state
  (favourites, deletions, albums) into a shard; it goes in `meta/`.
- **Each device writes only its own mutation log.** That single-writer rule is what
  removes write conflicts entirely — do not add code that writes another device's file.
- **Originals are never modified or deleted** by anything in this repo.
- **`--workers` may exceed 1**, so `ingest` and `derive` run their per-file work on
  threads. Anything they share needs a lock — the dedupe check in `ingest` claims a
  hash under one, or two copies of a photo in the same batch would both pass it.
- **Pillow's `draft()` refuses to go below either dimension it is given**, so the
  size asked for must follow whichever stored dimension becomes the width after the
  EXIF rotation. Getting this wrong does not fail: it quietly returns previews at
  three-quarters of the intended width for every rotated photo, which is most of a
  phone library. `derive._draft_to_preview` handles it, with a test.
- **`extract` reads the whole batch in one exiftool call** and maps results back by
  path. Results are keyed rather than positional on purpose, so a file exiftool
  cannot read drops out instead of shifting metadata onto its neighbours.

## Coding guidelines

Prioritise readability and long-term maintainability over cleverness or brevity.

- Avoid unnecessary complexity. If a simpler approach works, use it.
- Don't add abstractions, utilities, or helpers unless they're used in more than one place.
- Don't add error handling, validation, or fallbacks for scenarios that can't happen.
- Use comments to explain the *intent* of code blocks that aren't immediately obvious — not
  to restate what the code does.
- Don't add comments, docstrings, or type annotations to code you didn't change.
- Match the style and conventions of the surrounding code.
- JSON documents are validated with pydantic on both read and write
  (`worker/photoflow/models.py`). Add new stored documents as models there rather than
  passing raw dicts.

## Tests

```bash
npm test                              # front end (vitest)
cd worker && uv run --extra dev pytest # worker
```

Worker tests need no credentials and make no network calls: `MemoryStorage` covers the
pipeline, and `moto` covers real S3 semantics. Never write a test that requires live
bucket credentials.
