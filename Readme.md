# Photoflow

A self-hosted photo library — an alternative to iCloud Photos and Google Photos — that
runs with **no server and no API**.

Your photos live in your own S3-compatible bucket. A scheduled job turns new uploads
into a static catalog, and the app reads that catalog directly. Nothing sits in
between, so there is nothing to pay for and nothing to keep running.

```
  phone / browser  ──upload──▶  bucket: incoming/
                                     │
                     nightly GitHub Actions job (worker/)
                                     │
                                     ▼
                    bucket: original/  tile-image/  preview/
                            catalog/   meta/
                                     │
                                  CDN (Cloudflare)
                                     │
                                     ▼
                            this app, in the browser
```

## What it costs

Your storage bill, and nothing else. GitHub Actions' free tier covers the nightly job
for a typical library, and a static host plus a CDN are free at this scale.

## What you need

1. An **S3-compatible bucket** (Backblaze B2, Cloudflare R2, AWS S3, Wasabi…).
2. A **CDN in front of it** on a domain you control. This is not optional for a good
   experience: the gallery loads hundreds of thumbnails at once, and a CDN gives it
   HTTP/2+3 multiplexing. Reading the bucket endpoint directly caps the browser at
   roughly six parallel connections and scrolling will feel slow.
3. A **GitHub account** to run the nightly job.
4. Somewhere to host a static site (Cloudflare Pages, Netlify, GitHub Pages).

## Setup

### 1. Create the bucket

Create a bucket and make it **publicly readable**. Objects are addressed by content
hash, so paths are unguessable, but treat the bucket as public: anyone with a URL can
read that object.

Point your CDN at the bucket and note the public URL (e.g. `https://photos.example.com`).

**Set a CORS rule that permits writes.** Most providers' "make it public" preset only
allows `GET` and `HEAD`, which is enough to display photos but not to upload one or
favourite anything — the browser signs those requests itself, and the preflight fails.
The rule needs `PUT` in the allowed methods and the signing headers in the allowed
headers:

```json
[{
  "AllowedOrigins": ["https://your-app-domain"],
  "AllowedMethods": ["GET", "HEAD", "PUT"],
  "AllowedHeaders": ["*"],
  "ExposeHeaders": ["ETag"],
  "MaxAgeSeconds": 3600
}]
```

On Backblaze B2 this means a custom rule; the built-in "share everything" preset is
read-only and will not work.

Turn on **object versioning** if your provider supports it. Nothing in Photoflow ever
deletes or rewrites an original, but versioning protects you from a mistake outside it.

### 2. Create two API keys

- **A worker key** — read and write on this bucket only. Used by the nightly job.
- **An app key** — read, write and list on this bucket. Used by your browser. It needs
  list because the app discovers other devices' mutation logs under `meta/log/`. Scope it
  to this one bucket and nothing else in your account.
- **An upload key** *(optional)* — write-only, scoped to `incoming/`, for your phone's
  backup app. A backup app only ever uploads, so a leaked key there can add junk but
  cannot read or destroy your library.

### 3. Fork this repo and set its secrets

Under **Settings → Secrets and variables → Actions**:

| Secret | Example |
| --- | --- |
| `PHOTOFLOW_S3_ENDPOINT` | `https://s3.us-west-004.backblazeb2.com` |
| `PHOTOFLOW_S3_BUCKET` | `my-photos` |
| `PHOTOFLOW_S3_ACCESS_KEY_ID` | the worker key |
| `PHOTOFLOW_S3_SECRET_ACCESS_KEY` | the worker key's secret |
| `PHOTOFLOW_HEALTHCHECK_URL` | *(optional)* a [healthchecks.io](https://healthchecks.io) ping URL |

| Variable | Example | |
| --- | --- | --- |
| `PHOTOFLOW_PUBLIC_BASE_URL` | `https://photos.example.com` | optional; defaults to the bucket |
| `PHOTOFLOW_S3_REGION` | `us-west-004` | optional; derived from the endpoint |
| `PHOTOFLOW_MAX_FILES_PER_RUN` | `2000` | optional |
| `PHOTOFLOW_MAX_BACKFILL_PER_RUN` | `500` | optional; repairs per run |

Then enable Actions on the fork (forks start with workflows disabled) and run
**Process photos** once manually to check it works.

Set up the healthcheck. Without it, a job that quietly stops running is invisible
until you notice photos are missing.

**The app must be served over HTTPS**, or over plain `http` on `localhost` exactly.
Photoflow signs its own bucket requests with WebCrypto, and browsers only expose that in
a secure context. Opening the app over `http` at a LAN address or a custom local
hostname leaves `crypto.subtle` undefined and every request fails.

### 4. Deploy the app

```bash
npm install
npm run build
```

Deploy `src/dist/` to any static host. There is no build-time configuration — the same
build works for anyone.

If you serve the app from the **same domain** as your photos, you are done. Otherwise
edit `photoflow.config.json` in the deployed output and set where photos are read from:

```json
{ "publicBaseUrl": "https://photos.example.com" }
```

That file is only needed so share links work for visitors who have never opened the app;
your own browser uses whatever you enter on the connect screen. Editing it does not
require rebuilding.

Open the app and enter your endpoint, bucket name, and key. The region is worked out
from the endpoint, and the CDN URL is optional — leave it blank and photos load from the
bucket directly. Everything is stored in that browser and never sent anywhere else.

If the connection fails, the screen says which step broke — unreachable host, CORS
blocking reads, CORS blocking signed writes, bad credentials, or a key that cannot
list — rather than a generic error.

Put the app behind [Cloudflare Access](https://developers.cloudflare.com/cloudflare-one/policies/access/)
(free for up to 50 users) if you would rather not have it publicly reachable.

### 5. Set up phone backup

Photos are picked up from `incoming/` in the bucket, so any app that can upload to S3
works. [PhotoSync](https://www.photosync-app.com/) is the usual choice on iOS and
Android: create an S3 destination, point it at your bucket with the upload key, set the
directory to `incoming`, and turn on autotransfer while charging.

## How it works

**The catalog is static.** `catalog/manifest.json` lists one JSON shard per *upload*
month. Sharding on upload date rather than capture date means a month stops changing
once it is over, so browsers cache it indefinitely and each visit fetches only the
manifest and the current month.

**Mutations avoid conflicts by construction.** Favourites, deletions and album
membership are written by browsers, not the worker. Each device writes only
`meta/log/<its own id>.json` and never touches another device's file, so there is no
locking, no read-modify-write, and no need for conditional writes. The nightly job
merges the logs (last write wins per field) into `meta/state.json`. Album membership is
tracked per photo rather than as one list, so two devices adding different photos to the
same album both survive.

**Search runs in the browser.** The worker precomputes a CLIP embedding per photo
(~516 bytes each) and stores them next to the shards. The browser downloads those once
and encodes only your search phrase locally. There is no search API.

**Videos are usually not transcoded.** A clip that is already H.264 at 1080p or less is
served as its own preview, which avoids storing a near-duplicate of every video. HEVC
and oversized clips get a compatibility transcode to H.264.

**Originals are never modified.** The pipeline only ever reads them.

## Play-testing locally

You can exercise the whole thing against a local S3 server, with generated photos, with
no bucket and no cost:

```bash
docker compose -f dev/docker-compose.yml up -d
uv run --project worker --with pillow python dev/seed.py
```

That creates a bucket, makes it anonymously readable, and fills `incoming/` with sample
photos and clips (including Live Photo pairs). Then run the worker as the seed script
prints, `npm start`, and connect the app to:

| Field | Value |
| --- | --- |
| S3 endpoint | `http://localhost:9000` |
| Bucket | `photoflow-dev` |
| Region | `us-east-1` |
| Public base URL | `http://localhost:9000/photoflow-dev` |
| Access key / secret | `photoflowdev` / `photoflowdev123` |

MinIO's console is at `http://localhost:9001` if you want to watch objects appear.
`MINIO_API_CORS_ALLOW_ORIGIN` in the compose file is what lets the browser sign its own
writes — without it every upload and favourite fails a CORS preflight.

Reset with `docker compose -f dev/docker-compose.yml down -v`.

## Migrating from the older API-backed Photoflow

The photos do not move. Their object keys are unchanged; only the metadata is
rewritten, from the SQLite database into the catalog and mutable state that
replace it.

Download the database from **Menu → Export Data** in the old app, then:

```bash
cd worker
PHOTOFLOW_PATH_PREFIX=<your-tenant-id>/ uv run photoflow-migrate photoflow.db --dry-run
PHOTOFLOW_PATH_PREFIX=<your-tenant-id>/ uv run photoflow-migrate photoflow.db
```

`PHOTOFLOW_PATH_PREFIX` is what points the catalog at the old layout, which nested
media under a tenant folder. The dry run reports what it would write and stops.

Favourites, deletions, albums and share links all carry over. Two things are
deliberately left out and rebuilt by the worker instead:

- **Thumbnails.** The old API kept them in one bucket shared between tenants; they
  belong in your own bucket now. Every file is imported with no thumbnail, and the
  worker rebuilds them — from the 2000px preview, not the original, so this costs
  a few GB of transfer rather than the whole library.
- **Search vectors.** They came from a different model to the one the browser now
  uses, so comparing across the two returns nonsense. They are recomputed from the
  thumbnails.

Previews are kept as they are, so no video is transcoded twice.

Both rebuilds happen a batch at a time on each ordinary run, capped by
`PHOTOFLOW_MAX_BACKFILL_PER_RUN` (500 by default), so a large library is worked
through over several nights rather than stalling one run. Search is unavailable
until the vectors finish. Run the worker locally to get through it faster:

```bash
PHOTOFLOW_MAX_BACKFILL_PER_RUN=100000 uv run photoflow-worker
```

## The worker

An ETL pipeline of eight steps, run in order (`worker/photoflow/pipeline.py`):

| Step | What it does |
| --- | --- |
| `discover` | Load the existing catalog; list `incoming/` and reprocess requests |
| `ingest` | Hash, dedupe, store originals under their content hash |
| `backfill` | Queue a batch of catalogued files missing a thumbnail or search vector |
| `extract` | exiftool metadata; group Live Photo pairs into one item |
| `derive` | Tiles, previews, ThumbHash placeholders |
| `embed` | CLIP image embeddings for search |
| `compact` | Merge device mutation logs into `meta/state.json` |
| `publish` | Write changed shards, the manifest, and embeddings |
| `cleanup` | Clear `incoming/` — only for work that was published |

Run it locally:

```bash
cd worker
cp .env.example .env   # then fill it in
uv run photoflow-worker
```

The worker loads `worker/.env` itself, from any working directory. Real environment
variables override it, which is why the same code needs no `.env` in CI.

Run it as a module if you prefer — `uv run python -m photoflow` — but not as a file path
(`uv run photoflow/__main__.py`), which takes the module out of its package and breaks
its relative imports.

Tests need no credentials and touch no network:

```bash
cd worker && uv run --extra dev pytest
```

## Known gaps

This is a prototype. What is not done yet:

- **One month can dominate the shards.** Sharding is by upload month, so importing
  a back catalogue in one go puts most of the library in a single shard — 19.7 MB of
  a 33 MB catalog, in one real case. It works, but any edit to a photo in that month
  makes every client re-fetch it. Splitting oversized months is the fix.
- **The first import of a large library** should be run locally rather than in CI —
  thousands of video transcodes will exhaust free CI minutes. `PHOTOFLOW_MAX_FILES_PER_RUN`
  caps each run.
- **Processing is nightly**, so photos uploaded today get thumbnails tomorrow. Run the
  workflow manually if you want them sooner.
- **The CLIP model choice is unverified for redistribution.** The default
  (`Xenova/clip-vit-base-patch32`) is an ONNX export of a permissively licensed model,
  but confirm the licence before publishing a fork that ships weights.
