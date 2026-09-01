from datetime import datetime, timezone

from photoflow.grouping import group_key, group_keys_for
from photoflow.ids import item_id_from_group_key


def at(day: int, hour: int = 12) -> datetime:
    return datetime(2026, 3, day, hour, tzinfo=timezone.utc)


def test_item_ids_stay_inside_javascript_safe_integers():
    for index in range(500):
        item_id = item_id_from_group_key(f"photo-{index}")
        assert 0 <= item_id <= 2**53 - 1


def test_item_id_is_stable_for_the_same_key():
    assert item_id_from_group_key("img_4021:100") == item_id_from_group_key("img_4021:100")


def test_item_ids_do_not_collide_across_many_keys():
    ids = {item_id_from_group_key(f"img_{index}:200") for index in range(20_000)}
    assert len(ids) == 20_000


def test_live_photo_halves_share_a_group_key():
    still = group_key("IMG_4021.HEIC", at(18))
    video = group_key("IMG_4021.MOV", at(18))
    assert still == video


def test_upload_timestamp_suffix_is_ignored():
    assert group_key("IMG_4021_1730928000000.HEIC", at(18)) == group_key("IMG_4021.MOV", at(18))


def test_same_filename_years_apart_is_not_one_item():
    old = group_key("IMG_4021.HEIC", datetime(2019, 3, 18, tzinfo=timezone.utc))
    new = group_key("IMG_4021.HEIC", at(18))
    assert old != new


def test_a_pair_straddling_a_window_boundary_still_matches():
    # Two files minutes apart can land either side of a window edge; the second
    # candidate key is what lets them still find each other.
    early = at(1, hour=23)
    late = at(2, hour=1)

    shared = set(group_keys_for("IMG_1.HEIC", early)) & set(group_keys_for("IMG_1.MOV", late))
    assert shared
