import pytest

from archive_tool import naming


def test_folder_name_roundtrip():
    name = naming.folder_name("20260710", "C", "studio-group")
    assert name == "20260710_C_studio-group"
    parsed = naming.parse_folder_name(name)
    assert parsed == naming.ParsedFolder(date="20260710", track="C", slug="studio-group")


def test_file_name_roundtrip():
    name = naming.file_name("20260710", "C", "studio-group", 14, ".JPG")
    assert name == "20260710_C_studio-group_014.jpg"
    parsed = naming.parse_file_name(name)
    assert parsed.seq == 14
    assert parsed.ext == "jpg"


@pytest.mark.parametrize("slug", ["한글", "Studio", "studio_group", "-studio", "studio-"])
def test_invalid_slug_rejected(slug):
    with pytest.raises(naming.NamingError):
        naming.validate_slug(slug)


def test_invalid_track_rejected():
    with pytest.raises(naming.NamingError):
        naming.validate_track("X")


def test_parse_rejects_bad_names():
    assert naming.parse_folder_name("not-a-valid-folder") is None
    assert naming.parse_file_name("not-a-valid-file.jpg") is None
