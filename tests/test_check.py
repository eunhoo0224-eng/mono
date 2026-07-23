from archive_tool import check, ingest


def test_check_finds_nothing_after_clean_ingest(sample_input_dir, archive_root):
    plan = ingest.plan_ingest(sample_input_dir, archive_root, track="C", slug="studio-group")
    ingest.apply_ingest(plan)

    violations = check.run_check(archive_root)
    assert violations == []


def test_check_catches_manually_broken_filename(sample_input_dir, archive_root):
    plan = ingest.plan_ingest(sample_input_dir, archive_root, track="C", slug="studio-group")
    ingest.apply_ingest(plan)

    broken = plan.raw_dir / "20260710_C_studio-group_001.jpg"
    broken.rename(plan.raw_dir / "oops.jpg")

    violations = check.run_check(archive_root)
    categories = {v.category for v in violations}
    assert "bad-file-name" in categories
    assert any("oops.jpg" in v.message for v in violations)


def test_check_catches_count_mismatch(sample_input_dir, archive_root):
    plan = ingest.plan_ingest(sample_input_dir, archive_root, track="C", slug="studio-group")
    ingest.apply_ingest(plan)

    (plan.raw_dir / "20260710_C_studio-group_001.jpg").unlink()

    violations = check.run_check(archive_root)
    assert any(v.category == "count-mismatch" for v in violations)


def test_check_catches_folder_without_index(archive_root):
    (archive_root / "20260710_C_orphan" / "00_raw").mkdir(parents=True)

    violations = check.run_check(archive_root)
    assert any(v.category == "folder-without-index" for v in violations)


def test_check_catches_duplicate_id(archive_root):
    from archive_tool import index_csv

    index_csv.append_row(archive_root / "index.csv", {
        "id": "001", "date": "2026-07-10", "track": "C", "slug": "a",
        "place": "", "tags": "", "count": "1", "status": "raw",
        "title_ko": "", "title_en": "", "note": "",
    })
    index_csv.append_row(archive_root / "index.csv", {
        "id": "001", "date": "2026-07-11", "track": "P", "slug": "b",
        "place": "", "tags": "", "count": "1", "status": "raw",
        "title_ko": "", "title_en": "", "note": "",
    })

    violations = check.run_check(archive_root)
    assert any(v.category == "duplicate-id" for v in violations)
