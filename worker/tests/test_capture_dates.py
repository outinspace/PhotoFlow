"""Where a photo's date comes from when its metadata does not carry one.

A file with no EXIF date used to be stamped with the moment the worker ingested it,
which put it at the top of the gallery under today. Most such files do carry a date
in the filename, which is what these cover.
"""

import pytest

from photoflow.steps.extract import _parse_exif_date, capture_time_from_filename


@pytest.mark.parametrize(
    "file_name,expected",
    [
        ("IMG-20240315-WA0001.jpg", "2024-03-15 00:00"),
        ("VID-20231225-WA0007.mp4", "2023-12-25 00:00"),
        ("WhatsApp Image 2024-03-15 at 14.22.05.jpeg", "2024-03-15 14:22"),
        ("IMG_20240315_142205.jpg", "2024-03-15 14:22"),
        # Pixel appends milliseconds, which must not break the time off the end.
        ("PXL_20240315_142205123.jpg", "2024-03-15 14:22"),
        ("Screenshot 2024-03-15 at 14.22.05.png", "2024-03-15 14:22"),
        # The uploader's collision-dodging suffix must not be read as a date.
        ("IMG_20240315_142205_1730928000000.jpg", "2024-03-15 14:22"),
    ],
)
def test_a_date_in_the_filename_is_recovered(file_name, expected):
    found = capture_time_from_filename(file_name)
    assert found is not None
    assert found.strftime("%Y-%m-%d %H:%M") == expected


@pytest.mark.parametrize(
    "file_name",
    [
        "IMG_4021.HEIC",       # an iPhone name carries no date
        "DSC00123.JPG",
        "IMG-20241345-WA0001.jpg",   # month 13
        "IMG-20990101-WA0001.jpg",   # has not happened yet
        "100_2024.JPG",              # digits, but not a date
    ],
)
def test_digits_that_are_not_a_date_are_refused(file_name):
    assert capture_time_from_filename(file_name) is None


@pytest.mark.parametrize(
    "raw,expected",
    [
        ("2024:03:15 14:22:05", "2024-03-15T14:22:05+00:00"),
        # A negative offset used to fail outright, losing the date; the worker's own
        # timezone decided whether a date survived.
        ("2024:03:15 14:22:05-05:00", "2024-03-15T14:22:05-05:00"),
        # A positive offset used to be discarded and read as UTC, two hours out.
        ("2024:03:15 14:22:05+02:00", "2024-03-15T14:22:05+02:00"),
    ],
)
def test_an_offset_is_kept_rather_than_dropped(raw, expected):
    assert _parse_exif_date(raw).isoformat() == expected


def test_quicktime_says_it_has_no_date_with_zeroes():
    assert _parse_exif_date("0000:00:00 00:00:00") is None
