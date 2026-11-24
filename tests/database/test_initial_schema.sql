-- Run only against a fresh test database after 001_initial_schema.sql.
-- All test data is synthetic and rolled back.
BEGIN;
SET LOCAL search_path TO revenue_diagnostic, pg_catalog;

INSERT INTO app_user (id, login_provider, provider_subject)
VALUES ('00000000-0000-0000-0000-000000000001', 'test', 'test-user');
INSERT INTO hotel (id, name)
VALUES ('00000000-0000-0000-0000-000000000002', 'Test A'),
       ('00000000-0000-0000-0000-000000000003', 'Test B');
INSERT INTO diagnosis (id, hotel_id, creator_id, period_start, period_end)
VALUES ('00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000002',
        '00000000-0000-0000-0000-000000000001', '2026-01-01', '2026-01-31'),
       ('00000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000003',
        '00000000-0000-0000-0000-000000000001', '2026-01-01', '2026-01-31');
INSERT INTO hotel_period
    (id, hotel_id, period_start, period_end, date_basis, scope, amount_kind, source_mode, verification_status, fact_revision)
VALUES ('00000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000002',
        '2026-01-01', '2026-01-31', 'stay', '{}', 'unknown', 'manual', 'unverified', 1);
INSERT INTO input_snapshot
    (id, diagnosis_id, hotel_id, input_revision, selected_members, assumption_values, missing_items,
     rule_state, retention_state, deletion_state, created_by)
VALUES ('00000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000004',
        '00000000-0000-0000-0000-000000000002', 1, '[]', '{}', '[]',
        'missing', 'active', 'none', '00000000-0000-0000-0000-000000000001');

DO $test$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM hotel_period WHERE id = '00000000-0000-0000-0000-000000000006'
                   AND room_revenue IS NULL AND sold_room_nights IS NULL) THEN
        RAISE EXCEPTION 'Unknown values must remain NULL';
    END IF;

    BEGIN
        INSERT INTO source_file (id, diagnosis_id, hotel_id, type, object_key, checksum, uploaded_by)
        VALUES ('00000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000004',
                '00000000-0000-0000-0000-000000000003', 'pms', 'test-key', 'test-checksum',
                '00000000-0000-0000-0000-000000000001');
        RAISE EXCEPTION 'Cross-hotel source was accepted';
    EXCEPTION WHEN foreign_key_violation THEN NULL;
    END;

    BEGIN
        INSERT INTO report_version
            (id, diagnosis_id, hotel_id, revision, input_revision, snapshot_id, status, content_ref, created_by)
        VALUES ('00000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-000000000005',
                '00000000-0000-0000-0000-000000000003', 1, 1, '00000000-0000-0000-0000-000000000007',
                'draft', 'test-content', '00000000-0000-0000-0000-000000000001');
        RAISE EXCEPTION 'Snapshot from a different diagnosis was accepted';
    EXCEPTION WHEN foreign_key_violation THEN NULL;
    END;

    BEGIN
        INSERT INTO evidence_value
            (id, diagnosis_id, hotel_id, entity_type, entity_id, field_key, source_type,
             verification_status, confirmed_by, confirmed_at)
        VALUES ('00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000004',
                '00000000-0000-0000-0000-000000000002', 'hotel', '00000000-0000-0000-0000-000000000002',
                'room_count', 'manual', 'confirmed', '00000000-0000-0000-0000-000000000001', CURRENT_TIMESTAMP);
        RAISE EXCEPTION 'Confirmed evidence without a value was accepted';
    EXCEPTION WHEN check_violation THEN NULL;
    END;

    BEGIN
        INSERT INTO input_snapshot
            (id, diagnosis_id, hotel_id, input_revision, selected_members, assumption_values, missing_items,
             rule_state, result_values, retention_state, deletion_state, created_by)
        VALUES ('00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000004',
                '00000000-0000-0000-0000-000000000002', 2, '[]', '{}', '[]',
                'missing', '{}', 'active', 'none', '00000000-0000-0000-0000-000000000001');
        RAISE EXCEPTION 'Calculated snapshot without calculation versions was accepted';
    EXCEPTION WHEN check_violation THEN NULL;
    END;

    BEGIN
        INSERT INTO deletion_request (id, requested_by, scope, status, completed_at)
        VALUES ('00000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000001',
                '{}', 'completed', CURRENT_TIMESTAMP);
        RAISE EXCEPTION 'Deletion was completed without online and backup results';
    EXCEPTION WHEN check_violation THEN NULL;
    END;

    BEGIN
        INSERT INTO hotel_period
            (id, hotel_id, period_start, period_end, date_basis, scope, amount_kind, source_mode, verification_status, fact_revision)
        VALUES ('00000000-0000-0000-0000-000000000013', '00000000-0000-0000-0000-000000000002',
                '2026-02-01', '2026-01-31', 'stay', '{}', 'unknown', 'manual', 'unverified', 1);
        RAISE EXCEPTION 'Invalid period was accepted';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
END
$test$;

ROLLBACK;
