"""First-run bucket setup: the CORS rule, and refusing a public bucket.

The app talks to the bucket straight from the browser, so two things have to be
true before it works at all: a CORS rule naming the app's origin, and a bucket
that refuses anonymous reads. Both are set once in the provider's console and
both are easy to miss, so a run with someone watching checks them and offers to
fix them.

Backblaze B2 does not implement the S3 CORS calls, and its bucket type is what
makes a B2 bucket public, so there is a path for each provider.

Nothing here runs unattended: with no terminal there is nobody to answer, and a
nightly job must not stop to ask.
"""

import base64
import json
import sys
import urllib.error
import urllib.request

# The same object the connect screen writes to test anonymous reads.
PROBE_KEY = "meta/.access-check"
B2_AUTHORIZE_URL = "https://api.backblazeb2.com/b2api/v3/b2_authorize_account"


def ensure_ready(config, storage) -> bool:
    """Check the bucket over with the operator. False means stop, do not run."""
    if not sys.stdin.isatty():
        return True

    return _ensure_cors(config, storage) and _ensure_private(config, storage)


# --- CORS --------------------------------------------------------------------


def s3_cors_rules(origin: str) -> list[dict]:
    """Reads carry their signature in the query string and are not preflighted;
    writes carry it in headers and are, which is why PUT and the signing headers
    have to be allowed."""
    return [{
        "AllowedOrigins": [origin],
        "AllowedMethods": ["GET", "HEAD", "PUT"],
        "AllowedHeaders": ["*"],
        "ExposeHeaders": ["ETag"],
        "MaxAgeSeconds": 3600,
    }]


def b2_cors_rules(origin: str) -> list[dict]:
    """The same rule in B2's own shape. The operations are the S3 ones because
    the app uses the S3 endpoint; a rule allowing only the b2_ operations looks
    right in the console and does nothing here."""
    return [{
        "corsRuleName": "photoflow",
        "allowedOrigins": [origin],
        "allowedOperations": ["s3_get", "s3_head", "s3_put"],
        "allowedHeaders": ["*"],
        "exposeHeaders": ["etag"],
        "maxAgeSeconds": 3600,
    }]


def _ensure_cors(config, storage) -> bool:
    backblaze = _is_backblaze(config)

    try:
        bucket = _b2_bucket(config) if backblaze else None
        allowed = _origins(bucket["corsRules"] if backblaze else _s3_cors(storage))
    except Exception as error:
        # Usually a key without permission to read bucket settings. Not being
        # able to look is no reason to refuse to run.
        print(f"Could not read the bucket's CORS rules ({error}); skipping the check.")
        return True

    if config.app_origin in allowed or "*" in allowed:
        return True

    print(f"\nBucket '{config.bucket}' has no CORS rule for the app.")
    print("Without one the browser is refused before a request leaves the page.")
    if allowed:
        print(f"Origins allowed now: {', '.join(sorted(allowed))}")

    if not _confirm("Add a CORS rule now?"):
        print("Left alone. The app cannot read this bucket until a rule allows its origin.")
        return False

    origin = _ask("App origin:", config.app_origin)
    rules = b2_cors_rules(origin) if backblaze else s3_cors_rules(origin)

    try:
        if backblaze:
            _b2_update(config, bucket, corsRules=rules)
        else:
            storage.client.put_bucket_cors(
                Bucket=config.bucket, CORSConfiguration={"CORSRules": rules}
            )
    except Exception as error:
        print(f"\nCould not set the rule: {error}")
        print("The key probably cannot change bucket settings — on B2 that is the")
        print("writeBuckets capability. Set this by hand in the provider's console:\n")
        print(json.dumps(rules, indent=2))
        return False

    print(f"CORS rule set for {origin}.")
    return True


def _s3_cors(storage) -> list[dict]:
    from botocore.exceptions import ClientError

    try:
        return storage.client.get_bucket_cors(Bucket=storage.bucket)["CORSRules"]
    except ClientError as error:
        if error.response["Error"]["Code"] in ("NoSuchCORSConfiguration", "NoSuchCORSConfig"):
            return []
        raise


def _origins(rules) -> set[str]:
    return {
        origin.rstrip("/")
        for rule in rules or []
        for origin in rule.get("AllowedOrigins") or rule.get("allowedOrigins") or []
    }


# --- public or private -------------------------------------------------------


def _ensure_private(config, storage) -> bool:
    backblaze = _is_backblaze(config)

    try:
        bucket = _b2_bucket(config) if backblaze else None
        public = bucket["bucketType"] != "allPrivate" if backblaze else _serves_unsigned_reads(storage)
    except Exception as error:
        print(f"Could not tell whether the bucket is public ({error}); skipping the check.")
        return True

    if not public:
        return True

    print(f"\nBucket '{config.bucket}' serves reads to anyone.")
    print("Photoflow signs every read with a key held in one browser, which is what")
    print("makes deleting that key end access. A public bucket undoes all of it.")

    if not _confirm("Make it private now?"):
        print("Left alone. Photoflow needs a private bucket.")
        return False

    try:
        if backblaze:
            _b2_update(config, bucket, bucketType="allPrivate")
        else:
            # Only meaningful on AWS itself; other providers answer with an error
            # and fall through to the manual instruction below.
            storage.client.put_public_access_block(
                Bucket=config.bucket,
                PublicAccessBlockConfiguration={
                    "BlockPublicAcls": True,
                    "IgnorePublicAcls": True,
                    "BlockPublicPolicy": True,
                    "RestrictPublicBuckets": True,
                },
            )
            if _serves_unsigned_reads(storage):
                raise RuntimeError("the bucket still answers unsigned reads")
    except Exception as error:
        print(f"\nCould not make it private: {error}")
        print("Change it by hand in the provider's console, then run this again.")
        return False

    print("Bucket is private now.")
    return True


def _serves_unsigned_reads(storage) -> bool:
    """Write one byte, then read it back carrying no credentials.

    Reading the bucket's own ACLs and policies would mean a different answer per
    provider; what the browser gets is the same question everywhere. A success
    means public, and anything else means the read was refused.
    """
    import boto3
    from botocore import UNSIGNED
    from botocore.config import Config as BotoConfig
    from botocore.exceptions import ClientError

    anonymous = boto3.client(
        "s3",
        endpoint_url=storage.client.meta.endpoint_url,
        region_name=storage.client.meta.region_name,
        config=BotoConfig(signature_version=UNSIGNED),
    )

    storage.put(PROBE_KEY, b"x", "text/plain")
    try:
        anonymous.get_object(Bucket=storage.bucket, Key=PROBE_KEY)
        return True
    except ClientError:
        return False
    finally:
        # Best effort: what is left behind is one byte under meta/, which nothing
        # lists and nothing reads.
        try:
            storage.delete(PROBE_KEY)
        except ClientError:
            pass


# --- Backblaze B2 ------------------------------------------------------------


def _is_backblaze(config) -> bool:
    return "backblazeb2.com" in config.endpoint_url


def _b2_bucket(config) -> dict:
    """The bucket as B2 describes it, plus the auth needed to change it.

    B2's S3 endpoint implements neither the CORS calls nor a bucket type, so this
    is the only way to read or set either. The S3 key id and secret are the B2
    keyID and applicationKey, so no extra credential is involved.
    """
    credentials = base64.b64encode(
        f"{config.access_key_id}:{config.secret_access_key}".encode()
    ).decode()
    request = urllib.request.Request(
        B2_AUTHORIZE_URL, headers={"Authorization": f"Basic {credentials}"}
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        auth = json.load(response)

    # v3 nests what v2 kept at the top level; both shapes are still in the wild.
    api_url = auth.get("apiInfo", {}).get("storageApi", {}).get("apiUrl") or auth["apiUrl"]
    account_id = auth["accountId"]
    listed = _b2_post(
        f"{api_url}/b2api/v3/b2_list_buckets",
        auth["authorizationToken"],
        {"accountId": account_id, "bucketName": config.bucket},
    )["buckets"]

    if not listed:
        raise RuntimeError(f"B2 has no bucket named {config.bucket}")

    return {**listed[0], "_api_url": api_url, "_token": auth["authorizationToken"],
            "_account_id": account_id}


def _b2_update(config, bucket: dict, **fields) -> None:
    _b2_post(
        f"{bucket['_api_url']}/b2api/v3/b2_update_bucket",
        bucket["_token"],
        {"accountId": bucket["_account_id"], "bucketId": bucket["bucketId"], **fields},
    )


def _b2_post(url: str, token: str, payload: dict) -> dict:
    request = urllib.request.Request(
        url,
        data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json", "Authorization": token},
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            return json.load(response)
    except urllib.error.HTTPError as error:
        # B2 explains itself in the body; the status alone says nothing useful.
        raise RuntimeError(error.read().decode("utf-8", "replace")[:300]) from error


# --- asking ------------------------------------------------------------------

try:
    import readline  # noqa: F401  — gives input() line editing and history
except ImportError:
    readline = None


def _confirm(question: str) -> bool:
    while True:
        try:
            answer = input(f"{question} [Y/n] ").strip().lower()
        except EOFError:
            return False
        if answer in ("", "y", "yes"):
            return True
        if answer in ("n", "no"):
            return False


def _ask(question: str, default: str) -> str:
    """Prefilled and editable, so changing one character does not mean retyping
    the whole URL."""
    if readline:
        readline.set_startup_hook(lambda: readline.insert_text(default))
    try:
        return input(f"{question} ").strip() or default
    except EOFError:
        return default
    finally:
        if readline:
            readline.set_startup_hook()
