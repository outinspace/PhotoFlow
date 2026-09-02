"""ThumbHash encoder.

A port of the reference encoder from https://github.com/evanw/thumbhash, so the
hashes this produces decode correctly in the gallery's existing thumbhash worker.
The gallery paints these as placeholders while real tiles load.
"""

import math


def rgba_to_thumb_hash(width: int, height: int, rgba: bytes) -> bytes:
    if width > 100 or height > 100:
        raise ValueError(f"{width}x{height} doesn't fit in 100x100")

    pixel_count = width * height

    average_r = average_g = average_b = average_a = 0.0
    for i in range(pixel_count):
        j = i * 4
        alpha = rgba[j + 3] / 255
        average_r += alpha / 255 * rgba[j]
        average_g += alpha / 255 * rgba[j + 1]
        average_b += alpha / 255 * rgba[j + 2]
        average_a += alpha

    if average_a:
        average_r /= average_a
        average_g /= average_a
        average_b /= average_a

    has_alpha = average_a < pixel_count
    luminance_limit = 5 if has_alpha else 7
    lx = max(1, round(luminance_limit * width / max(width, height)))
    ly = max(1, round(luminance_limit * height / max(width, height)))

    luminance = []
    yellow_blue = []
    red_green = []
    alphas = []

    for i in range(pixel_count):
        j = i * 4
        alpha = rgba[j + 3] / 255
        r = average_r * (1 - alpha) + alpha / 255 * rgba[j]
        g = average_g * (1 - alpha) + alpha / 255 * rgba[j + 1]
        b = average_b * (1 - alpha) + alpha / 255 * rgba[j + 2]
        luminance.append((r + g + b) / 3)
        yellow_blue.append((r + g) / 2 - b)
        red_green.append(r - g)
        alphas.append(alpha)

    def encode_channel(channel, nx, ny):
        dc = 0.0
        ac = []
        scale = 0.0

        for cy in range(ny):
            cx = 0
            while cx * ny < nx * (ny - cy):
                fx = [math.cos(math.pi / width * cx * (x + 0.5)) for x in range(width)]
                f = 0.0
                for y in range(height):
                    fy = math.cos(math.pi / height * cy * (y + 0.5))
                    row = y * width
                    for x in range(width):
                        f += channel[x + row] * fx[x] * fy
                f /= pixel_count
                if cx or cy:
                    ac.append(f)
                    scale = max(scale, abs(f))
                else:
                    dc = f
                cx += 1

        if scale:
            ac = [0.5 + 0.5 / scale * value for value in ac]

        return dc, ac, scale

    l_dc, l_ac, l_scale = encode_channel(luminance, max(3, lx), max(3, ly))
    p_dc, p_ac, p_scale = encode_channel(yellow_blue, 3, 3)
    q_dc, q_ac, q_scale = encode_channel(red_green, 3, 3)
    a_dc, a_ac, a_scale = encode_channel(alphas, 5, 5) if has_alpha else (0.0, [], 0.0)

    is_landscape = width > height
    header24 = (
        round(63 * l_dc)
        | (round(31.5 + 31.5 * p_dc) << 6)
        | (round(31.5 + 31.5 * q_dc) << 12)
        | (round(31 * l_scale) << 18)
        | (int(has_alpha) << 23)
    )
    header16 = (
        (ly if is_landscape else lx)
        | (round(63 * p_scale) << 3)
        | (round(63 * q_scale) << 9)
        | (int(is_landscape) << 15)
    )

    hash_bytes = [
        header24 & 255,
        (header24 >> 8) & 255,
        header24 >> 16,
        header16 & 255,
        header16 >> 8,
    ]

    if has_alpha:
        hash_bytes.append(round(15 * a_dc) | (round(15 * a_scale) << 4))

    ac_start = len(hash_bytes)
    ac_index = 0
    channels = [l_ac, p_ac, q_ac, a_ac] if has_alpha else [l_ac, p_ac, q_ac]

    for channel_ac in channels:
        for value in channel_ac:
            index = ac_start + (ac_index >> 1)
            while len(hash_bytes) <= index:
                hash_bytes.append(0)
            hash_bytes[index] |= round(15 * value) << ((ac_index & 1) << 2)
            ac_index += 1

    return bytes(hash_bytes)
