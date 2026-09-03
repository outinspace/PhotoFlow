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

Create a bucket and make it **publicly readable**. Media is addressed by content
hash, so those paths are unguessable, but treat the bucket as public: anyone with a
URL can read that object.

**Generate a private prefix**, and understand what it is for. Media keys are hashes,
but the catalog sits at a fixed path — so without this, anyone who guesses or is
given your bucket URL can fetch `catalog/manifest.json`, walk its shards, and read
the location, camera and filename of every photo in the library, plus the hash of
every original. The prefix moves the catalog, the mutation logs and `incoming/` to a
folder nobody can guess:

```bash
python3 -c "import secrets; print(secrets.token_hex(16))"
```

Put the same value in `PHOTOFLOW_PRIVATE_PREFIX` and in the app's storage settings.
This works because **object storage will not list a public bucket's contents** — the
prefix would be worthless against a provider that allowed anonymous listing, so check
that yours refuses it before relying on this. Backblaze B2 does refuse it.

The prefix is a secret with no expiry. Treat it like a password: keep it out of
screenshots, bug reports and pasted URLs. If it leaks, generate a new one, move the
catalog to it and re-link your devices — the media does not have to move. The
trade-off you are accepting is that a leaked media URL is permanent, because a
content hash cannot be rotated without renaming the file. A private bucket with
signed reads avoids that, at the cost of the CDN and of share links that expire after
seven days.

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

**The catalog is static.** `catalog/manifest.json` lists the JSON shards, one per
*upload* month. Sharding on upload date rather than capture date means a month stops
changing once it is over, so browsers cache it indefinitely and each visit fetches only
the manifest and the current month.

A month holding more than 2,000 items is split into numbered parts, and a part is only
rewritten when its own contents change. Without that, importing a back catalogue puts
most of a library into whichever month it was imported in — 19.7 MB of a 33 MB catalog
in one real case — and editing a single photo in that month would make every client
fetch all of it again. Parts are ordered by item id rather than capture time, because
an id never changes and so the boundaries between parts stay put.

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

Photos are migrated the same way any photo arrives: they land in the new bucket's
`incoming/` folder and the worker catalogues them. There is no separate import path
for the files themselves — they get new ids, fresh thumbnails and fresh search
vectors, exactly as an upload would.

If your photos are already in a bucket at the same provider, copy them across
server side — nothing is downloaded, and the bytes stay identical, which the next
step depends on:

```bash
cd worker
uv run photoflow-copy-media OLD-BUCKET TENANT-ID photoflow.db --dry-run
uv run photoflow-copy-media OLD-BUCKET TENANT-ID photoflow.db
```

That also renames as it copies. The old bucket keys each file by a GUID with no
extension, and the worker needs the real filename: without it every file looks like
`application/octet-stream`, and the two halves of a Live Photo no longer share a
stem to be paired by. The old database holds those names, so it drives the copy.
Each item's files land in their own folder, so a filename used twice in the library
cannot overwrite itself.

It skips what is already there, so a run that stops can simply be run again, and
`PHOTOFLOW_S3_BUCKET` must be the *new* bucket. Deleted photos come across by
default; pass `--skip-deleted` to leave them behind. The key needs read on the old
bucket and write on the new one.

What the worker cannot know is what you did to those photos in the old app. That
is what the migration script carries over:

```bash
cd worker
uv run photoflow-migrate photoflow.db --dry-run   # once the worker has catalogued the copies
uv run photoflow-migrate photoflow.db
```

`photoflow.db` is the tenant database from **Menu → Export Data** in the old app.
The script matches old photos to new ones by **content hash** — the old database
stored one per file, and the new catalog uses the same hash as each file's id — and
writes favourites, deletions and album membership as a mutation log, the same kind of
file a phone writes when you favourite something. The app picks it up immediately and
the next worker run compacts it. Nothing about it is a special case.

Run the dry run first and read the report. Photos not yet copied and processed show
as unmatched; run again once they are, and it continues from where the worker left
off. A Live Photo the new grouping paired differently shows as split, and its edits
apply to each part.

### Photos with no date of their own

Not every file records when it was taken. WhatsApp downloads carry no EXIF at all,
and screenshots often carry none either. Such a file used to be dated as of the run
that ingested it, which put a photo from years ago at the top of the gallery under
today's date — and, because `captureTime` also drives the year and month filters,
trip detection and the "one year ago" memories, put it in the wrong place in all of
those too.

The worker now reads the date out of the filename when the metadata has none.
`IMG-20240315-WA0001.jpg`, `WhatsApp Image 2024-03-15 at 14.22.05.jpeg`,
`IMG_20240315_142205.jpg`, `PXL_...`, and the usual screenshot spellings are all
recognised, and a run reports how many files it dated that way. For a WhatsApp file
this is the day it was sent rather than the day it was taken, which is an
approximation — but it lands the photo in the right month instead of today.

For photos already catalogued, this repairs them in place:

```bash
uv run photoflow-redate --dry-run
uv run photoflow-redate
```

It reads and rewrites the catalog only. No original is touched, nothing is
re-downloaded, and no thumbnail or search vector is rebuilt — shards key on **upload**
month, so a corrected capture date does not move an item between them. An item is
only re-dated when its capture time is exactly the upload time of one of its files,
which is the fingerprint of the old fallback: it used one timestamp for both. A photo
whose camera recorded a real date is therefore never overwritten by a guess from its
filename. The dry run also reports how many photos have no date anywhere, which is
the set no amount of parsing can fix.

Share links are not carried over: a link is a document the app writes when you share,
and carrying only the secret would show a link that leads nowhere. Re-share those
albums from the app; the report names them.

Edits made in the new app before the migration runs are kept. Each operation is
timestamped from the old database row, so anything you did more recently wins the
merge.

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
uv run photoflow-worker              # one file at a time
uv run photoflow-worker --workers 8  # a laptop getting through a large import
```

`--workers` sets how many files are processed at once, and defaults to 1 so a
default run and CI behave exactly as before. On a laptop, measured over 12MP
photos: 2.4× at 4 workers, 3.0× at 8. Somewhere around the number of cores is the
useful setting; far beyond it buys nothing.

Three things in the pipeline were shaped around how a laptop actually spends the
time, all measured on an M1 Pro:

- **Metadata is read for the whole batch in one exiftool call.** exiftool is a Perl
  script, so starting it costs about 60ms against roughly 2ms of reading. A process
  per file spent 97% of the step on startup. Worth 13–31× depending on the mix of
  photos and video, and it is the one step `--workers` never helped, because it is
  sequential by nature.
- **JPEGs are decoded at the smallest scale that still covers the preview.** Most of
  the cost of building a tile and a preview is resizing pixels, not reading them, so
  halving the decode quarters the work. This does nothing for HEIC, which has no
  equivalent, and nothing for portrait photos, whose short side is already close to
  the preview width.
- **Video is encoded on the hardware encoder** (`h264_videotoolbox`) when the machine
  has one, falling back to `libx264` where it does not, such as CI. At the default
  quality the output file is the same size — 3.73MB against 3.76MB over a test set.
  The wall-clock gain alone is only about 1.6×, but it uses a third of the CPU, and
  that is the real point: `libx264` alone occupies roughly seven cores for a single
  clip, which is why video used to plateau at 1.8× no matter how many workers it was
  given. `PHOTOFLOW_VIDEO_QUALITY_HARDWARE` and `PHOTOFLOW_VIDEO_QUALITY_SOFTWARE`
  tune this; the two scales are unrelated, and the defaults were matched by size.

End to end over a mixed batch, before against after: 14.05s → 10.29s at one worker,
6.67s → 3.60s at eight.

Two things that were tried and measured as *not* worth it, so that they are not
tried again: CoreML for the CLIP embeddings is no faster than the CPU provider on
this model (27.0ms against 26.6ms), and scaling the video poster frame inside ffmpeg
costs more than the Pillow decode it saves.

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

- **The first import of a large library** should be run locally rather than in CI —
  thousands of video transcodes will exhaust free CI minutes. `PHOTOFLOW_MAX_FILES_PER_RUN`
  caps each run. Raise it for a local run so the whole backlog goes through at once.
- **Processing is nightly**, so photos uploaded today get thumbnails tomorrow. Run the
  workflow manually if you want them sooner.
- **The CLIP model choice is unverified for redistribution.** The default
  (`Xenova/clip-vit-base-patch32`) is an ONNX export of a permissively licensed model,
  but confirm the licence before publishing a fork that ships weights.
