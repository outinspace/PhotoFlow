"""Prepare a local MinIO bucket and fill incoming/ with sample photos.

Generates its own images rather than copying anything real, so play-testing never
involves a live bucket or personal photos.

    docker compose -f dev/docker-compose.yml up -d
    uv run --project worker python dev/seed.py
"""

import json
import os
import subprocess
import sys
import tempfile
from datetime import datetime, timedelta

import boto3
from botocore.client import Config
from PIL import Image, ImageDraw

ENDPOINT = os.environ.get("PHOTOFLOW_S3_ENDPOINT", "http://localhost:9000")
BUCKET = os.environ.get("PHOTOFLOW_S3_BUCKET", "photoflow-dev")
ACCESS_KEY = os.environ.get("PHOTOFLOW_S3_ACCESS_KEY_ID", "photoflowdev")
SECRET_KEY = os.environ.get("PHOTOFLOW_S3_SECRET_ACCESS_KEY", "photoflowdev123")

PLACES = [
    ("Reykjavik", 64.1466, -21.9426),
    ("Lisbon", 38.7223, -9.1393),
    ("Kyoto", 35.0116, 135.7681),
    ("Cape Town", -33.9249, 18.4241),
]

COLOURS = [(198, 96, 64), (72, 122, 168), (108, 158, 106), (176, 148, 84), (132, 96, 160)]


def make_photo(path, index, taken, place):
    image = Image.new("RGB", (1600, 1200), COLOURS[index % len(COLOURS)])
    draw = ImageDraw.Draw(image)

    # Enough structure that thumbnails and embeddings differ between photos.
    for step in range(0, 1600, 80):
        draw.line([(step, 0), (step - 400 + index * 40, 1200)], fill=(255, 255, 255), width=3)
    draw.ellipse([600 + index * 20, 400, 1000 + index * 20, 800], fill=(250, 244, 232))

    image.save(path, "JPEG", quality=88)

    city, latitude, longitude = place
    subprocess.run(
        ["exiftool", "-overwrite_original", "-q",
         f"-DateTimeOriginal={taken:%Y:%m:%d %H:%M:%S}",
         f"-CreateDate={taken:%Y:%m:%d %H:%M:%S}",
         "-Make=Photoflow", f"-Model=Sample Camera {index % 3 + 1}",
         "-FNumber=1.8", "-ISO=200", "-ExposureTime=0.004",
         f"-GPSLatitude={abs(latitude)}", f"-GPSLatitudeRef={'N' if latitude >= 0 else 'S'}",
         f"-GPSLongitude={abs(longitude)}", f"-GPSLongitudeRef={'E' if longitude >= 0 else 'W'}",
         str(path)],
        check=True,
    )
    return city


def make_clip(path, index, taken):
    # Duration varies so each clip has distinct content; identical clips would be
    # collapsed by content-hash dedup before they ever reached the catalog.
    subprocess.run(
        ["ffmpeg", "-y", "-loglevel", "error",
         "-f", "lavfi", "-i", f"testsrc=duration={2 + index % 3}:size=1280x720:rate=24",
         "-c:v", "libx264", "-pix_fmt", "yuv420p", str(path)],
        check=True,
    )

    # A real Live Photo's clip carries the same capture time as its still, which
    # is what puts the pair in one item. Without this they stay separate.
    subprocess.run(
        ["exiftool", "-overwrite_original", "-q", "-api", "QuickTimeUTC=1",
         f"-QuickTime:CreateDate={taken:%Y:%m:%d %H:%M:%S}",
         f"-QuickTime:ModifyDate={taken:%Y:%m:%d %H:%M:%S}",
         str(path)],
        check=True,
    )


def main() -> int:
    for tool in ("exiftool", "ffmpeg"):
        if not subprocess.run(["which", tool], capture_output=True).stdout:
            print(f"{tool} is required (brew install exiftool ffmpeg)", file=sys.stderr)
            return 1

    s3 = boto3.client(
        "s3", endpoint_url=ENDPOINT,
        aws_access_key_id=ACCESS_KEY, aws_secret_access_key=SECRET_KEY,
        region_name="us-east-1", config=Config(signature_version="s3v4"),
    )

    try:
        s3.create_bucket(Bucket=BUCKET)
    except s3.exceptions.BucketAlreadyOwnedByYou:
        pass

    # Media is read anonymously in a real deployment, so mirror that here.
    s3.put_bucket_policy(Bucket=BUCKET, Policy=json.dumps({
        "Version": "2012-10-17",
        "Statement": [{
            "Effect": "Allow", "Principal": {"AWS": ["*"]},
            "Action": ["s3:GetObject"], "Resource": [f"arn:aws:s3:::{BUCKET}/*"],
        }],
    }))

    work = tempfile.mkdtemp(prefix="photoflow-seed-")
    uploaded = 0
    base = datetime(2026, 3, 1, 9, 0, 0)

    for index in range(12):
        taken = base + timedelta(days=index * 9, hours=index)
        place = PLACES[index % len(PLACES)]

        name = f"IMG_{4000 + index}.JPG"
        path = os.path.join(work, name)
        make_photo(path, index, taken, place)

        with open(path, "rb") as handle:
            s3.put_object(Bucket=BUCKET, Key=f"incoming/{name}", Body=handle, ContentType="image/jpeg")
        uploaded += 1

        # A matching clip on some photos exercises both Live Photo grouping and
        # the video passthrough path.
        if index % 4 == 0:
            clip_name = f"IMG_{4000 + index}.MP4"
            clip_path = os.path.join(work, clip_name)
            make_clip(clip_path, index, taken)
            with open(clip_path, "rb") as handle:
                s3.put_object(Bucket=BUCKET, Key=f"incoming/{clip_name}", Body=handle, ContentType="video/mp4")
            uploaded += 1

    print(f"Uploaded {uploaded} files to s3://{BUCKET}/incoming/")
    print("\nNow run the worker:\n")
    print(f"  cd worker && PHOTOFLOW_S3_ENDPOINT={ENDPOINT} \\")
    print(f"    PHOTOFLOW_S3_BUCKET={BUCKET} \\")
    print(f"    PHOTOFLOW_S3_ACCESS_KEY_ID={ACCESS_KEY} \\")
    print(f"    PHOTOFLOW_S3_SECRET_ACCESS_KEY={SECRET_KEY} \\")
    print(f"    PHOTOFLOW_PUBLIC_BASE_URL={ENDPOINT}/{BUCKET} \\")
    print("    uv run photoflow-worker")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

