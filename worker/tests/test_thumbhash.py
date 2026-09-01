import base64

from photoflow.thumbhash import rgba_to_thumb_hash


def solid(width: int, height: int, colour: tuple[int, int, int]) -> bytes:
    return bytes(bytearray(list(colour) + [255]) * (width * height))


def test_encodes_to_the_compact_size_the_gallery_expects():
    encoded = rgba_to_thumb_hash(32, 32, solid(32, 32, (200, 40, 40)))

    # Opaque hashes are 5 header bytes plus packed 4-bit coefficients; the format
    # is only useful because it stays tiny enough to inline in the catalog.
    assert 20 <= len(encoded) <= 32
    assert base64.b64encode(encoded).decode("ascii")


def test_different_images_produce_different_hashes():
    red = rgba_to_thumb_hash(32, 32, solid(32, 32, (200, 40, 40)))
    blue = rgba_to_thumb_hash(32, 32, solid(32, 32, (40, 40, 200)))

    assert red != blue


def test_landscape_flag_differs_from_portrait():
    landscape = rgba_to_thumb_hash(40, 20, solid(40, 20, (120, 120, 120)))
    portrait = rgba_to_thumb_hash(20, 40, solid(20, 40, (120, 120, 120)))

    assert landscape != portrait


def test_rejects_images_larger_than_the_format_allows():
    try:
        rgba_to_thumb_hash(120, 120, solid(120, 120, (0, 0, 0)))
    except ValueError:
        return
    raise AssertionError("expected a ValueError for an oversized image")


def test_output_matches_the_bytes_the_javascript_decoder_was_verified_against():
    """Locks the wire format.

    This exact string was decoded with the `thumbhash` npm package the gallery
    uses, and produced the expected gradient. Regenerating different bytes here
    means placeholders would break in the browser without any test failing.
    """
    from PIL import Image

    image = Image.new("RGB", (60, 40))
    pixels = image.load()
    for y in range(40):
        for x in range(60):
            pixels[x, y] = (int(255 * x / 60), int(255 * y / 40), 90)

    rgba = image.convert("RGBA")
    encoded = rgba_to_thumb_hash(rgba.width, rgba.height, rgba.tobytes())

    assert base64.b64encode(encoded).decode("ascii") == "HAkKNZpwd3eAeIh3iHiId3BwB/d4"
