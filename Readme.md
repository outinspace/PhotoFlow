# Photoflow

A self-hosted photo library that runs with **no server and no API**. It is an
alternative to iCloud Photos and Google Photos for people who want to keep their
photos as ordinary files in a bucket they control.

Your photos live in your own S3-compatible bucket. A scheduled job turns new uploads
into a static catalog, and the app reads that catalog straight out of the bucket.
There is no backend between the two, so the bill is your storage and nothing else.
[Backblaze B2](https://www.backblaze.com/cloud-storage) is the cheap option and the
one to start with; GitHub Actions runs the scheduled job on its free tier.

The bucket stays **private**. Every read is signed in the browser with a bucket API
key that only ever exists in that browser's local storage, so nothing is world
readable and there is no server holding a credential. Deleting the key ends access to
everything ever signed with it.

## What it does

- **Mobile first**, and a full desktop app too.
- **Works offline.** It is a PWA, so the gallery keeps working with no connection.
- **Fast.** Thumbnails and placeholders are precomputed, and the catalog is cached
  a month at a time rather than fetched per photo.
- **AI search that runs in your browser.** Search phrases like "red bicycle in the
  snow"; no query ever leaves the device.
- **A map** of everywhere you have taken a photo.
- **Automatic trip detection**, plus year and "one year ago" views.
- **Albums**, and **temporary share links** for an album or a single photo, which
  need no account at the other end.
- **First-class Apple Live Photos.** Both halves stay together as one photo.
- **You own the storage.** It is your bucket, your keys, and ordinary files in it.
  Originals are never modified or deleted by anything in this repo.

## Status

Photoflow is young. Its author uses it every day, and the catalog has a migration
system so upgrades carry an existing library forward, but expect rough edges. Open an
issue when something breaks.

## Setup

You need an S3-compatible bucket, a GitHub account, and somewhere to host a static
site (Cloudflare Pages, Netlify and GitHub Pages are all free at this scale).

### 1. Create a private bucket

Create the bucket and **keep it private**. The connect screen refuses a public one:
it writes a one-byte object, tries to read it back with no signature, and will not
connect if that succeeds.

**Set a CORS rule**, or the browser is refused before a request leaves the page.
Running `photoflow-worker` from a terminal offers to write it for you and to check
that the bucket is private. It asks nothing when both are already right, and asks
nothing at all in CI, where there is nobody to answer. Setting it by hand works too.

Reads carry their signature in the query string and are not preflighted; writes carry
it in headers and are, which is why `PUT` and the signing headers have to be allowed:

```json
[{
  "AllowedOrigins": ["https://your-app-domain"],
  "AllowedMethods": ["GET", "HEAD", "PUT"],
  "AllowedHeaders": ["*"],
  "ExposeHeaders": ["ETag"],
  "MaxAgeSeconds": 3600
}]
```

On Backblaze B2 this means a custom rule. The built-in "share everything" preset is
read-only and will not work. B2's S3 endpoint has no CORS calls, so the worker uses
B2's own API there; that needs a key with `writeBuckets`, and it prints the rule to
paste when the key it has cannot do it.

Turn on **object versioning** if your provider offers it. Nothing in Photoflow ever
deletes or rewrites an original, but versioning protects you from a mistake outside it.

### 2. Create the API keys

Scope each one to this bucket and nothing else in your account.

- **A worker key**: read and write. Used by the scheduled job.
- **An app key**: read, write and list. Used by your browser. It needs list to find
  other devices' mutation logs, and write because uploads, favourites and albums are
  all written straight from the browser. This key is also the revocation lever:
  deleting it invalidates every URL ever signed with it, share links included.
- **An upload key** *(optional)*: write-only, scoped to `incoming/`, for your
  phone's backup app. A leaked key there can add junk but cannot read or destroy
  anything.

### 3. Fork this repo and set its secrets

Under **Settings → Secrets and variables → Actions**:

| Secret | Example |
| --- | --- |
| `PHOTOFLOW_S3_ENDPOINT` | `https://s3.us-west-004.backblazeb2.com` |
| `PHOTOFLOW_S3_BUCKET` | `my-photos` |
| `PHOTOFLOW_S3_ACCESS_KEY_ID` | the worker key |
| `PHOTOFLOW_S3_SECRET_ACCESS_KEY` | the worker key's secret |
| `PHOTOFLOW_HEALTHCHECK_URL` | *(optional)* a [healthchecks.io](https://healthchecks.io) ping URL |

| Variable | Default |
| --- | --- |
| `PHOTOFLOW_S3_REGION` | `us-east-1` (B2 needs the region from the endpoint, e.g. `us-west-004`) |
| `PHOTOFLOW_MAX_FILES_PER_RUN` | `1000` |

The full set of settings, with what each one does, is in
[`worker/.env.example`](worker/.env.example).

Then enable Actions on the fork, since forks start with workflows disabled, and run
**Process photos** once by hand to check it works. It is scheduled nightly after that.

Set up the healthcheck. Without it, a job that quietly stops running is invisible
until you notice photos are missing. Note also that GitHub disables a scheduled
workflow in a repository with no commits for 60 days; pushing any commit to the fork
turns it back on.

### 4. Deploy the app

```bash
npm install
npm run build
```

Deploy `src/dist/` to any static host. There is nothing to configure at build time
and no file to edit afterwards. Nothing in the output names a bucket, which is what
lets one deployment serve any number of people, each with their own.

**It must be served over HTTPS**, or over plain `http` on `localhost` exactly. The
app signs its own requests with WebCrypto, and browsers only expose that in a secure
context.

Open it and enter your endpoint, bucket and app key. The region is worked out from
the endpoint. Everything is stored in that browser and sent nowhere else. If the
connection fails, the screen names the step that broke rather than showing a generic
error. A second device is connected by scanning a QR code from the first.

### 5. Set up phone backup

Photos are picked up from `incoming/`, so any app that can upload to S3 works.
[PhotoSync](https://www.photosync-app.com/) is the usual choice on iOS and Android:
create an S3 destination, point it at your bucket with the upload key, set the
directory to `incoming`, and turn on autotransfer while charging.

### Optional: a CDN for pictures

Worth adding once things work. The gallery loads hundreds of thumbnails at once, and
a bucket endpoint caps the browser at roughly six parallel connections where a CDN
gives it HTTP/2+3 multiplexing. The address is entered on the connect screen, so each
person can point at their own.

It covers **pictures only**. The catalog and every write go to the bucket endpoint
regardless, so a misconfigured CDN costs slow images rather than a library that will
not load. It has to forward the host header and path unchanged, because the signature
covers both; the connect screen checks exactly that.

## How it works

```
  phone / browser  ──upload──▶  bucket: incoming/
                                     │
                          scheduled job (worker/)
                                     │
                                     ▼
                    bucket: original/  tile-image/  preview/
                            catalog/   meta/
                                     │
                                     ▼
                            this app, in the browser
```

- **The catalog is static JSON**, one shard per upload month, so a month stops
  changing once it is over and browsers cache it indefinitely.
- **Favourites, albums and deletions are written by browsers**, each device to its
  own log file, and merged by the job. One writer per file means no conflicts and no
  locking.
- **Search embeddings are precomputed** by the job, about 516 bytes a photo. The
  browser downloads them once and encodes only your search phrase locally.
- **Originals are never modified or deleted** by anything in this repo.
- **Every video gets a transcoded preview**, including one already in a codec the
  browser plays: what a camera writes is laid out for a file rather than for a
  network, and starting playback promptly is what the preview is for.

The pipeline is nine steps run in order, listed in
[`worker/photoflow/pipeline.py`](worker/photoflow/pipeline.py).

## Development

```
src/      the app: React, TanStack Router and Query, Tailwind, Vite
worker/   the scheduled job: Python, run with uv
dev/      a local S3 server and a seed script, for working without a real bucket
```

Front-end and worker tests need no credentials and touch no network:

```bash
npm test                               # front end
cd worker && uv run --extra dev pytest # worker
```

Run the worker locally against your own bucket with a `.env` copied from
[`worker/.env.example`](worker/.env.example):

```bash
cd worker
uv run photoflow-worker              # one file at a time
uv run photoflow-worker --workers 8  # a laptop getting through a large import
```

`--workers` defaults to 1, so CI behaves as it always has. Somewhere around the
number of cores is the useful setting; far beyond it buys nothing.

Or exercise the whole thing against a local S3 server with generated photos, no
bucket and no cost:

```bash
docker compose -f dev/docker-compose.yml up -d
uv run --project worker --with pillow python dev/seed.py
npm start
```

That creates a private bucket and fills `incoming/` with sample photos and clips,
then prints the worker command to run and what to connect the app to. Reset with
`docker compose -f dev/docker-compose.yml down -v`.

## Contributing

Issues and pull requests are welcome. Keep changes small and include a test where
one fits; both test suites run in CI. Anything that touches how files are laid out
in the bucket needs a catalog migration in `worker/photoflow/migrations/`, so that
existing libraries keep working.

## License

[MIT](LICENSE).
