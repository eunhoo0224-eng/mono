from archive_tool import index_csv, status_cmd


def test_status_groups_by_status_column(archive_root):
    index_csv.append_row(archive_root / "index.csv", {
        "id": "001", "date": "2026-07-10", "track": "C", "slug": "a",
        "place": "", "tags": "", "count": "1", "status": "raw",
        "title_ko": "", "title_en": "", "note": "",
    })
    index_csv.append_row(archive_root / "index.csv", {
        "id": "002", "date": "2026-06-02", "track": "P", "slug": "b",
        "place": "", "tags": "", "count": "2", "status": "selected",
        "title_ko": "", "title_en": "", "note": "",
    })

    grouped = status_cmd.run_status(archive_root)
    assert [r["slug"] for r in grouped["raw"]] == ["a"]
    assert [r["slug"] for r in grouped["selected"]] == ["b"]
    assert grouped["web"] == []
    assert grouped["published"] == []
