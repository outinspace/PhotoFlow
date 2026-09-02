"""Precompute CLIP image embeddings so search can run in the browser.

The heavy half of semantic search — encoding every photo — happens here, once per
photo, ever. The browser only encodes the search phrase and compares it against
these vectors, which is why no search API is needed.

Vectors are stored int8-quantised: 512 values plus a float32 scale is 516 bytes
per item, so an entire 30k-photo library is about 15MB to download once.
"""

import os
import struct

import numpy as np
from PIL import Image, ImageOps

from .. import progress

EMBEDDING_VERSION = 1
EMBEDDING_DIM = 512
IMAGE_SIZE = 224

# The same weights the browser loads for the text half, so both sides of the
# comparison live in one vector space.
VISION_MODEL_FILE = "onnx/vision_model.onnx"

CLIP_MEAN = np.array([0.48145466, 0.4578275, 0.40821073], dtype=np.float32)
CLIP_STD = np.array([0.26862954, 0.26130258, 0.27577711], dtype=np.float32)

_EMBEDDING_OUTPUT_NAMES = ("image_embeds", "pooler_output", "last_hidden_state")


def run(context) -> None:
    pending = [
        entry
        for entry in list(context.ingested) + list(context.backfill)
        if entry.needs_embedding
        and (entry.content_type.startswith("image/") or _has_poster(context, entry))
    ]

    if not pending:
        context.note("no new items to embed")
        return

    session = _load_session(context)
    if session is None:
        context.note("CLIP model unavailable, skipping embeddings (search will be unavailable)")
        return

    encoded = 0
    for entry in progress.track(pending, "embedding"):
        item_id = getattr(entry, "item_id", None)
        if item_id is None or item_id in context.new_embeddings:
            continue

        try:
            pixels = _preprocess(_source_image_path(context, entry))
            vector = _encode(session, pixels)
            context.new_embeddings[item_id] = quantize(vector)

            # Stamped on the item so the next run knows this one is done and does
            # not fetch and encode it again.
            item = context.items.get(item_id)
            if item is not None:
                item.embeddingVersion = EMBEDDING_VERSION

            encoded += 1
        except Exception as error:
            context.note(f"embedding failed for {entry.original_file_name}: {error}")

    context.note(f"embedded {encoded} items")


def quantize(vector: np.ndarray) -> bytes:
    """Pack a unit-length float vector as int8 values plus the scale to undo them."""
    scale = float(np.abs(vector).max()) or 1.0
    quantized = np.clip(np.round(vector / scale * 127), -127, 127).astype(np.int8)
    return struct.pack("<f", scale) + quantized.tobytes()


def dequantize(packed: bytes) -> np.ndarray:
    scale = struct.unpack_from("<f", packed, 0)[0]
    values = np.frombuffer(packed, dtype=np.int8, offset=4).astype(np.float32)
    return values * (scale / 127)


def _load_session(context):
    try:
        import onnxruntime
        from huggingface_hub import hf_hub_download

        path = hf_hub_download(context.config.clip_model_repo, VISION_MODEL_FILE)
        return onnxruntime.InferenceSession(path, providers=["CPUExecutionProvider"])
    except Exception as error:
        context.note(f"could not load CLIP model: {error}")
        return None


def _encode(session, pixels: np.ndarray) -> np.ndarray:
    input_name = session.get_inputs()[0].name
    output_names = [output.name for output in session.get_outputs()]

    name = next((n for n in _EMBEDDING_OUTPUT_NAMES if n in output_names), output_names[0])
    result = session.run([name], {input_name: pixels})[0]

    vector = np.asarray(result, dtype=np.float32)
    # A hidden-state output arrives per-token; the first token is the summary one.
    while vector.ndim > 1:
        vector = vector[0]

    norm = np.linalg.norm(vector)
    return vector / norm if norm else vector


def _preprocess(path: str) -> np.ndarray:
    with Image.open(path) as source:
        image = ImageOps.exif_transpose(source).convert("RGB")

        scale = IMAGE_SIZE / min(image.width, image.height)
        image = image.resize(
            (round(image.width * scale), round(image.height * scale)), Image.BICUBIC
        )

        left = (image.width - IMAGE_SIZE) // 2
        top = (image.height - IMAGE_SIZE) // 2
        image = image.crop((left, top, left + IMAGE_SIZE, top + IMAGE_SIZE))

        pixels = np.asarray(image, dtype=np.float32) / 255.0

    pixels = (pixels - CLIP_MEAN) / CLIP_STD
    return pixels.transpose(2, 0, 1)[np.newaxis, :].astype(np.float32)


def _source_image_path(context, entry) -> str:
    """Videos are embedded from the poster frame derive already pulled."""
    if entry.content_type.startswith("image/"):
        return entry.local_path

    poster = os.path.join(context.work_dir, f"{entry.file_id}.poster.jpeg")
    return poster if os.path.exists(poster) else entry.local_path


def _has_poster(context, entry) -> bool:
    return os.path.exists(os.path.join(context.work_dir, f"{entry.file_id}.poster.jpeg"))
