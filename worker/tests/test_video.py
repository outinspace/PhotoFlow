from photoflow.video import VideoInfo, can_pass_through


def info(codec="h264", height=1080, container="mov") -> VideoInfo:
    return VideoInfo(codec=codec, height=height, duration=12.0, container=container)


def test_typical_phone_clip_is_served_as_its_own_preview():
    assert can_pass_through(info(), max_height=1080)


def test_hevc_is_transcoded_because_browser_support_is_not_universal():
    assert not can_pass_through(info(codec="hevc"), max_height=1080)


def test_oversized_video_is_transcoded():
    assert not can_pass_through(info(height=2160), max_height=1080)


def test_unusual_container_is_transcoded():
    assert not can_pass_through(info(container="matroska"), max_height=1080)


def test_unknown_height_is_transcoded():
    assert not can_pass_through(info(height=None), max_height=1080)
