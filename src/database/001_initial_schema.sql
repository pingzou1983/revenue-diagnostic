-- PostgreSQL 14+; initial empty database only, pending product and legal review.
-- IDs are supplied by the application. No business rules, users, or credentials are seeded.
-- Authentication, field-level confirmation, immutable report versions, authorization,
-- state transitions, and deletion/retention workflows must also be enforced by services.

BEGIN;

CREATE SCHEMA revenue_diagnostic;
SET LOCAL search_path TO revenue_diagnostic, pg_catalog;

CREATE TABLE app_user (
    id uuid PRIMARY KEY,
    login_provider varchar(32) NOT NULL,
    provider_subject varchar(128) NOT NULL,
    status varchar(16) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    version integer NOT NULL DEFAULT 1 CHECK (version > 0),
    UNIQUE (login_provider, provider_subject)
);

CREATE TABLE hotel (
    id uuid PRIMARY KEY,
    name varchar(200) NOT NULL,
    brand varchar(100),
    city varchar(100),
    business_area varchar(100),
    room_count integer CHECK (room_count > 0),
    diamond_level varchar(16),
    diamond_platform varchar(32),
    diamond_source_ref text,
    diamond_confirmed_by uuid REFERENCES app_user(id),
    diamond_confirmed_at timestamptz,
    price_authority varchar(24) NOT NULL DEFAULT 'unknown'
        CHECK (price_authority IN ('self', 'approval', 'none', 'unknown')),
    channel_authority varchar(24) NOT NULL DEFAULT 'unknown'
        CHECK (channel_authority IN ('self', 'approval', 'none', 'unknown')),
    business_timezone varchar(64),
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by uuid REFERENCES app_user(id),
    updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by uuid REFERENCES app_user(id),
    version integer NOT NULL DEFAULT 1 CHECK (version > 0)
);

CREATE TABLE processing_consent (
    id uuid PRIMARY KEY,
    subject_ref text NOT NULL,
    granted_by uuid NOT NULL REFERENCES app_user(id),
    purpose varchar(64) NOT NULL,
    scope_ref jsonb NOT NULL,
    notice_version varchar(100) NOT NULL,
    granted_at timestamptz NOT NULL,
    status varchar(16) NOT NULL CHECK (status IN ('active', 'withdrawn', 'expired')),
    withdrawn_at timestamptz,
    source_ref text,
    withdrawal_result jsonb,
    CHECK (status <> 'withdrawn' OR withdrawn_at IS NOT NULL)
);

CREATE TABLE hotel_grant (
    id uuid PRIMARY KEY,
    hotel_id uuid NOT NULL REFERENCES hotel(id),
    grantee_user_id uuid NOT NULL REFERENCES app_user(id),
    role varchar(24) NOT NULL CHECK (role IN ('owner', 'staff', 'consultant')),
    permissions jsonb NOT NULL,
    status varchar(16) NOT NULL CHECK (status IN ('pending', 'active', 'revoked', 'expired')),
    granted_by uuid REFERENCES app_user(id),
    granted_at timestamptz,
    grant_basis_ref text,
    expires_at timestamptz,
    revoked_at timestamptz,
    revoke_reason text,
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    version integer NOT NULL DEFAULT 1 CHECK (version > 0),
    CHECK (status <> 'active' OR (granted_by IS NOT NULL AND granted_at IS NOT NULL)),
    CHECK (status <> 'revoked' OR revoked_at IS NOT NULL)
);
CREATE UNIQUE INDEX hotel_grant_active_unique
    ON hotel_grant (hotel_id, grantee_user_id, role) WHERE status = 'active';
CREATE INDEX hotel_grant_user_idx ON hotel_grant (grantee_user_id, hotel_id);

CREATE TABLE system_role_grant (
    id uuid PRIMARY KEY,
    grantee_user_id uuid NOT NULL REFERENCES app_user(id),
    role varchar(32) NOT NULL,
    permissions jsonb NOT NULL,
    status varchar(16) NOT NULL CHECK (status IN ('pending', 'active', 'revoked', 'expired')),
    granted_by uuid REFERENCES app_user(id),
    granted_at timestamptz,
    expires_at timestamptz,
    revoked_at timestamptz,
    CHECK (status <> 'active' OR (granted_by IS NOT NULL AND granted_at IS NOT NULL)),
    CHECK (status <> 'revoked' OR revoked_at IS NOT NULL)
);
CREATE UNIQUE INDEX system_role_grant_active_unique
    ON system_role_grant (grantee_user_id, role) WHERE status = 'active';

CREATE TABLE contact (
    id uuid PRIMARY KEY,
    hotel_id uuid NOT NULL REFERENCES hotel(id),
    name varchar(200) NOT NULL,
    contact_details text,
    purpose text NOT NULL,
    authorization_ref text,
    source_ref text,
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    version integer NOT NULL DEFAULT 1 CHECK (version > 0),
    UNIQUE (id, hotel_id)
);

CREATE TABLE service_intake (
    id uuid PRIMARY KEY,
    creator_id uuid NOT NULL REFERENCES app_user(id),
    consent_id uuid NOT NULL REFERENCES processing_consent(id),
    project_name varchar(200) NOT NULL,
    city varchar(100),
    project_stage varchar(24) NOT NULL
        CHECK (project_stage IN ('operating', 'preparation', 'renovation', 'exit_planning', 'other', 'unknown')),
    operating_status varchar(24) NOT NULL
        CHECK (operating_status IN ('open', 'suspended', 'not_open', 'unknown')),
    primary_objective text NOT NULL,
    suitability_status varchar(24) NOT NULL DEFAULT 'pending'
        CHECK (suitability_status IN ('pending', 'eligible', 'out_of_scope')),
    referral_status varchar(24) NOT NULL DEFAULT 'pending'
        CHECK (referral_status IN ('pending', 'recorded', 'closed')),
    referral_by uuid REFERENCES app_user(id),
    referral_at timestamptz,
    hotel_id uuid REFERENCES hotel(id),
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    version integer NOT NULL DEFAULT 1 CHECK (version > 0),
    CHECK (referral_status <> 'recorded' OR (referral_by IS NOT NULL AND referral_at IS NOT NULL))
);

CREATE TABLE intake_grant (
    id uuid PRIMARY KEY,
    intake_id uuid NOT NULL REFERENCES service_intake(id),
    grantee_user_id uuid NOT NULL REFERENCES app_user(id),
    status varchar(16) NOT NULL CHECK (status IN ('pending', 'active', 'revoked', 'expired')),
    granted_by uuid REFERENCES app_user(id),
    granted_at timestamptz,
    grant_basis_ref text,
    expires_at timestamptz,
    revoked_at timestamptz,
    CHECK (status <> 'active' OR (granted_by IS NOT NULL AND granted_at IS NOT NULL)),
    CHECK (status <> 'revoked' OR revoked_at IS NOT NULL)
);
CREATE UNIQUE INDEX intake_grant_active_unique
    ON intake_grant (intake_id, grantee_user_id) WHERE status = 'active';

CREATE TABLE action_authority (
    id uuid PRIMARY KEY,
    hotel_id uuid NOT NULL REFERENCES hotel(id),
    action_type varchar(24) NOT NULL CHECK (action_type IN ('price', 'commission', 'advertising', 'promotion')),
    channel_scope jsonb NOT NULL,
    authority_status varchar(16) NOT NULL CHECK (authority_status IN ('self', 'approval', 'none', 'unknown')),
    approver_ref text,
    evidence_ref text,
    effective_start date,
    effective_end date,
    verification_status varchar(20) NOT NULL,
    confirmed_by uuid REFERENCES app_user(id),
    confirmed_at timestamptz,
    version integer NOT NULL DEFAULT 1 CHECK (version > 0),
    CHECK (effective_end IS NULL OR effective_start IS NULL OR effective_end >= effective_start),
    CHECK (verification_status <> 'confirmed' OR (confirmed_by IS NOT NULL AND confirmed_at IS NOT NULL))
);

CREATE TABLE rule_version (
    id uuid PRIMARY KEY,
    version_name varchar(100) NOT NULL UNIQUE,
    status varchar(16) NOT NULL CHECK (status IN ('draft', 'approved', 'published', 'retired')),
    parameters jsonb NOT NULL,
    templates jsonb NOT NULL,
    created_by uuid NOT NULL REFERENCES app_user(id),
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    approved_by uuid REFERENCES app_user(id),
    approved_at timestamptz,
    published_by uuid REFERENCES app_user(id),
    published_at timestamptz,
    CHECK (status NOT IN ('approved', 'published') OR (approved_by IS NOT NULL AND approved_at IS NOT NULL)),
    CHECK (status <> 'published' OR (published_by IS NOT NULL AND published_at IS NOT NULL))
);

CREATE TABLE diagnosis (
    id uuid PRIMARY KEY,
    hotel_id uuid NOT NULL REFERENCES hotel(id),
    creator_id uuid NOT NULL REFERENCES app_user(id),
    period_start date NOT NULL,
    period_end date NOT NULL,
    status varchar(24) NOT NULL DEFAULT 'draft',
    data_level varchar(8) CHECK (data_level IN ('L1', 'L2', 'L3')),
    input_revision integer NOT NULL DEFAULT 1 CHECK (input_revision > 0),
    rule_version_id uuid REFERENCES rule_version(id),
    current_step varchar(64),
    progress_saved_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by uuid REFERENCES app_user(id),
    version integer NOT NULL DEFAULT 1 CHECK (version > 0),
    UNIQUE (id, hotel_id),
    CHECK (period_end >= period_start)
);
CREATE INDEX diagnosis_hotel_idx ON diagnosis (hotel_id, created_at);

CREATE TABLE source_file (
    id uuid PRIMARY KEY,
    diagnosis_id uuid NOT NULL,
    hotel_id uuid NOT NULL,
    type varchar(32) NOT NULL,
    object_key text NOT NULL UNIQUE,
    checksum varchar(128) NOT NULL,
    captured_at timestamptz,
    uploaded_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    uploaded_by uuid NOT NULL REFERENCES app_user(id),
    UNIQUE (id, hotel_id),
    UNIQUE (id, diagnosis_id, hotel_id),
    FOREIGN KEY (diagnosis_id, hotel_id) REFERENCES diagnosis(id, hotel_id)
);

CREATE TABLE evidence_value (
    id uuid PRIMARY KEY,
    diagnosis_id uuid NOT NULL,
    hotel_id uuid NOT NULL,
    entity_type varchar(64) NOT NULL,
    entity_id uuid NOT NULL,
    field_key varchar(100) NOT NULL,
    source_type varchar(24) NOT NULL CHECK (source_type IN ('screenshot', 'manual', 'import')),
    source_file_id uuid,
    recognized_value jsonb,
    confirmed_value jsonb,
    verification_status varchar(20) NOT NULL
        CHECK (verification_status IN ('unverified', 'confirmed', 'unknown', 'not_applicable', 'rejected')),
    confirmed_by uuid REFERENCES app_user(id),
    confirmed_at timestamptz,
    correction_reason text,
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    version integer NOT NULL DEFAULT 1 CHECK (version > 0),
    FOREIGN KEY (diagnosis_id, hotel_id) REFERENCES diagnosis(id, hotel_id),
    FOREIGN KEY (source_file_id, diagnosis_id, hotel_id) REFERENCES source_file(id, diagnosis_id, hotel_id),
    CHECK (source_type <> 'screenshot' OR source_file_id IS NOT NULL),
    CHECK (verification_status <> 'confirmed' OR
        (confirmed_value IS NOT NULL AND confirmed_value <> 'null'::jsonb AND confirmed_by IS NOT NULL AND confirmed_at IS NOT NULL))
);
CREATE INDEX evidence_entity_idx ON evidence_value (diagnosis_id, entity_type, entity_id, field_key);

CREATE TABLE hotel_period (
    id uuid PRIMARY KEY,
    hotel_id uuid NOT NULL REFERENCES hotel(id),
    period_start date NOT NULL,
    period_end date NOT NULL,
    date_basis varchar(32) NOT NULL,
    scope jsonb NOT NULL,
    available_room_nights integer CHECK (available_room_nights >= 0),
    sold_room_nights integer CHECK (sold_room_nights >= 0),
    room_revenue numeric(18,2) CHECK (room_revenue >= 0),
    currency char(3),
    revenue_basis jsonb,
    amount_kind varchar(16) NOT NULL CHECK (amount_kind IN ('actual', 'estimate', 'unknown')),
    source_mode varchar(24) NOT NULL,
    source_ref text,
    aggregate_members jsonb,
    verification_status varchar(20) NOT NULL,
    fact_revision integer NOT NULL CHECK (fact_revision > 0),
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (id, hotel_id),
    CHECK (period_end >= period_start),
    CHECK (room_revenue IS NULL OR currency IS NOT NULL)
);
CREATE INDEX hotel_period_lookup_idx ON hotel_period (hotel_id, period_start, period_end, date_basis);

CREATE TABLE hotel_daily (
    id uuid PRIMARY KEY,
    hotel_id uuid NOT NULL REFERENCES hotel(id),
    business_date date NOT NULL,
    date_basis varchar(32) NOT NULL,
    scope jsonb NOT NULL,
    available_room_nights integer CHECK (available_room_nights >= 0),
    sold_room_nights integer CHECK (sold_room_nights >= 0),
    room_revenue numeric(18,2) CHECK (room_revenue >= 0),
    currency char(3),
    revenue_basis jsonb,
    source_reported_adr numeric(18,2) CHECK (source_reported_adr >= 0),
    source_ref text,
    quality_status varchar(20) NOT NULL,
    fact_revision integer NOT NULL CHECK (fact_revision > 0),
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (id, hotel_id),
    CHECK ((room_revenue IS NULL AND source_reported_adr IS NULL) OR currency IS NOT NULL)
);
CREATE INDEX hotel_daily_lookup_idx ON hotel_daily (hotel_id, business_date, date_basis);

-- One channel metric per row preserves each metric's date, population and attribution basis.
CREATE TABLE channel_fact (
    id uuid PRIMARY KEY,
    hotel_id uuid NOT NULL REFERENCES hotel(id),
    channel_code varchar(32) NOT NULL,
    metric_name varchar(64) NOT NULL,
    metric_value numeric(20,4) CHECK (metric_value >= 0),
    unit varchar(32) NOT NULL,
    currency char(3),
    period_start date NOT NULL,
    period_end date NOT NULL,
    date_basis varchar(32) NOT NULL,
    metric_definition text NOT NULL,
    order_status varchar(32),
    population_scope jsonb,
    dedup_basis text,
    attribution_window varchar(64),
    scope jsonb NOT NULL,
    source_ref text,
    verification_status varchar(20) NOT NULL,
    fact_revision integer NOT NULL CHECK (fact_revision > 0),
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (id, hotel_id),
    CHECK (period_end >= period_start),
    CHECK (unit <> 'currency' OR metric_value IS NULL OR currency IS NOT NULL)
);
CREATE INDEX channel_fact_lookup_idx ON channel_fact (hotel_id, channel_code, metric_name, period_start, period_end);

CREATE TABLE commission_policy (
    id uuid PRIMARY KEY,
    hotel_id uuid NOT NULL REFERENCES hotel(id),
    channel_code varchar(32) NOT NULL,
    base_rate numeric(9,6) CHECK (base_rate BETWEEN 0 AND 1),
    additional_rate numeric(9,6) CHECK (additional_rate BETWEEN 0 AND 1),
    rate_relationship text,
    calculation_basis text,
    effective_start date,
    effective_end date,
    effective_date_basis varchar(24),
    room_scope jsonb,
    activity_scope jsonb,
    eligible_order_scope jsonb,
    affected_baseline jsonb,
    additional_promotion_fee numeric(18,2) CHECK (additional_promotion_fee >= 0),
    actual_settlement_amount numeric(18,2) CHECK (actual_settlement_amount >= 0),
    currency char(3),
    settlement_start date,
    settlement_end date,
    contract_source_ref text,
    verification_status varchar(20) NOT NULL,
    fact_revision integer NOT NULL CHECK (fact_revision > 0),
    UNIQUE (id, hotel_id),
    CHECK (effective_start IS NULL OR effective_end IS NULL OR effective_end >= effective_start),
    CHECK (settlement_start IS NULL OR settlement_end IS NULL OR settlement_end >= settlement_start),
    CHECK ((additional_promotion_fee IS NULL AND actual_settlement_amount IS NULL) OR currency IS NOT NULL)
);

CREATE TABLE promotion (
    id uuid PRIMARY KEY,
    hotel_id uuid NOT NULL REFERENCES hotel(id),
    channel_code varchar(32) NOT NULL,
    starts_on date NOT NULL,
    ends_on date NOT NULL,
    discount_type varchar(24),
    discount_value numeric(18,6) CHECK (discount_value >= 0),
    currency char(3),
    payer varchar(24) CHECK (payer IN ('hotel', 'platform', 'shared', 'unknown')),
    payer_split jsonb,
    revenue_basis text,
    eligible_scope jsonb,
    source_ref text,
    verification_status varchar(20) NOT NULL,
    fact_revision integer NOT NULL CHECK (fact_revision > 0),
    UNIQUE (id, hotel_id),
    CHECK (ends_on >= starts_on)
);

CREATE TABLE competitor (
    id uuid PRIMARY KEY,
    diagnosis_id uuid NOT NULL,
    hotel_id uuid NOT NULL,
    name varchar(200) NOT NULL,
    location_description text,
    distance_meters numeric(12,2) CHECK (distance_meters >= 0),
    segment varchar(100),
    diamond_level varchar(16),
    renovation_year integer,
    opening_year integer,
    room_area_sqm numeric(10,2) CHECK (room_area_sqm > 0),
    rating numeric(8,3),
    selection_reason text,
    comparability_status varchar(24) NOT NULL DEFAULT 'unverified'
        CHECK (comparability_status IN ('comparable', 'not_comparable', 'unverified')),
    comparability_basis text,
    UNIQUE (id, diagnosis_id, hotel_id),
    FOREIGN KEY (diagnosis_id, hotel_id) REFERENCES diagnosis(id, hotel_id)
);

CREATE TABLE competitor_observation (
    id uuid PRIMARY KEY,
    competitor_id uuid NOT NULL,
    diagnosis_id uuid NOT NULL,
    hotel_id uuid NOT NULL,
    stay_date date,
    captured_at timestamptz,
    stay_date_visible boolean,
    captured_at_visible boolean,
    room_type text,
    price_conditions jsonb,
    listed_price numeric(18,2) CHECK (listed_price >= 0),
    currency char(3),
    source_file_id uuid,
    source_ref text,
    verification_status varchar(20) NOT NULL,
    fact_revision integer NOT NULL CHECK (fact_revision > 0),
    FOREIGN KEY (competitor_id, diagnosis_id, hotel_id) REFERENCES competitor(id, diagnosis_id, hotel_id),
    FOREIGN KEY (source_file_id, diagnosis_id, hotel_id) REFERENCES source_file(id, diagnosis_id, hotel_id),
    CHECK (listed_price IS NULL OR currency IS NOT NULL)
);

CREATE TABLE hotel_price_observation (
    id uuid PRIMARY KEY,
    diagnosis_id uuid NOT NULL,
    hotel_id uuid NOT NULL,
    stay_date date,
    captured_at timestamptz,
    stay_date_visible boolean,
    captured_at_visible boolean,
    room_type text,
    price_conditions jsonb,
    listed_price numeric(18,2) CHECK (listed_price >= 0),
    currency char(3),
    source_file_id uuid,
    source_ref text,
    verification_status varchar(20) NOT NULL,
    fact_revision integer NOT NULL CHECK (fact_revision > 0),
    FOREIGN KEY (diagnosis_id, hotel_id) REFERENCES diagnosis(id, hotel_id),
    FOREIGN KEY (source_file_id, diagnosis_id, hotel_id) REFERENCES source_file(id, diagnosis_id, hotel_id),
    CHECK (listed_price IS NULL OR currency IS NOT NULL)
);

-- Optional competitor metrics use separate rows to retain their individual periods and sources.
CREATE TABLE competitor_metric (
    id uuid PRIMARY KEY,
    competitor_id uuid NOT NULL,
    diagnosis_id uuid NOT NULL,
    hotel_id uuid NOT NULL,
    metric_name varchar(64) NOT NULL,
    metric_value numeric(20,4),
    unit varchar(32) NOT NULL,
    currency char(3),
    period_start date,
    period_end date,
    metric_basis jsonb,
    source_ref text,
    verification_status varchar(20) NOT NULL,
    fact_revision integer NOT NULL CHECK (fact_revision > 0),
    FOREIGN KEY (competitor_id, diagnosis_id, hotel_id) REFERENCES competitor(id, diagnosis_id, hotel_id),
    CHECK (period_start IS NULL OR period_end IS NULL OR period_end >= period_start),
    CHECK (unit <> 'currency' OR metric_value IS NULL OR currency IS NOT NULL)
);

CREATE TABLE operating_expense (
    id uuid PRIMARY KEY,
    hotel_id uuid NOT NULL REFERENCES hotel(id),
    period_start date NOT NULL,
    period_end date NOT NULL,
    expense_category varchar(32) NOT NULL,
    description text,
    amount numeric(18,2) CHECK (amount >= 0),
    currency char(3) NOT NULL,
    expense_scope varchar(24) NOT NULL,
    channel_code varchar(32),
    allocation_basis text,
    amount_kind varchar(16) NOT NULL CHECK (amount_kind IN ('actual', 'estimate', 'unknown')),
    accounting_basis text,
    channel_cost_overlap varchar(16) NOT NULL CHECK (channel_cost_overlap IN ('yes', 'no', 'unknown')),
    source_ref text,
    verification_status varchar(20) NOT NULL,
    confirmed_by uuid REFERENCES app_user(id),
    confirmed_at timestamptz,
    fact_revision integer NOT NULL CHECK (fact_revision > 0),
    UNIQUE (id, hotel_id),
    CHECK (period_end >= period_start),
    CHECK (verification_status <> 'confirmed' OR (confirmed_by IS NOT NULL AND confirmed_at IS NOT NULL))
);

CREATE TABLE social_media_period (
    id uuid PRIMARY KEY,
    hotel_id uuid NOT NULL REFERENCES hotel(id),
    platform_code varchar(32) NOT NULL,
    period_start date NOT NULL,
    period_end date NOT NULL,
    account_or_content_scope varchar(200),
    views bigint CHECK (views >= 0),
    impressions bigint CHECK (impressions >= 0),
    interactions bigint CHECK (interactions >= 0),
    inquiries bigint CHECK (inquiries >= 0),
    confirmed_bookings bigint CHECK (confirmed_bookings >= 0),
    metric_definitions jsonb,
    dedup_basis text,
    booking_source text,
    attribution_window varchar(64),
    source_ref text,
    verification_status varchar(20) NOT NULL,
    fact_revision integer NOT NULL CHECK (fact_revision > 0),
    UNIQUE (id, hotel_id),
    CHECK (period_end >= period_start),
    CHECK (confirmed_bookings IS NULL OR booking_source IS NOT NULL)
);

CREATE TABLE input_snapshot (
    id uuid PRIMARY KEY,
    diagnosis_id uuid NOT NULL,
    hotel_id uuid NOT NULL,
    input_revision integer NOT NULL CHECK (input_revision > 0),
    selected_members jsonb NOT NULL,
    assumption_values jsonb NOT NULL,
    missing_items jsonb NOT NULL,
    rule_version_id uuid REFERENCES rule_version(id),
    rule_state varchar(24) NOT NULL CHECK (rule_state IN ('applied', 'not_applicable', 'missing')),
    formula_version varchar(100),
    engine_version varchar(100),
    precision_policy jsonb,
    rounding_policy jsonb,
    result_values jsonb,
    retention_state varchar(32) NOT NULL,
    deletion_state varchar(32) NOT NULL,
    created_by uuid NOT NULL REFERENCES app_user(id),
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (id, diagnosis_id, hotel_id, input_revision),
    FOREIGN KEY (diagnosis_id, hotel_id) REFERENCES diagnosis(id, hotel_id),
    CHECK ((rule_state = 'applied' AND rule_version_id IS NOT NULL) OR
           (rule_state <> 'applied' AND rule_version_id IS NULL)),
    CHECK (result_values IS NULL OR
        (formula_version IS NOT NULL AND engine_version IS NOT NULL AND precision_policy IS NOT NULL AND rounding_policy IS NOT NULL))
);
CREATE INDEX input_snapshot_diagnosis_idx ON input_snapshot (diagnosis_id, input_revision);

CREATE TABLE scenario (
    id uuid PRIMARY KEY,
    diagnosis_id uuid NOT NULL,
    hotel_id uuid NOT NULL,
    scenario_type varchar(20) NOT NULL CHECK (scenario_type IN ('commission', 'advertising', 'promotion')),
    period_start date NOT NULL,
    period_end date NOT NULL,
    channel_code varchar(32) NOT NULL,
    currency char(3),
    date_basis varchar(32),
    baseline_revision integer NOT NULL CHECK (baseline_revision > 0),
    calculation_snapshot_id uuid,
    room_scope jsonb,
    order_scope jsonb,
    capacity integer CHECK (capacity >= 0),
    assumptions jsonb NOT NULL,
    budget numeric(18,2) CHECK (budget >= 0),
    projected_spend numeric(18,2) CHECK (projected_spend >= 0),
    actual_spend_fact_id uuid,
    projected_amounts jsonb,
    missing_items jsonb NOT NULL,
    comparability_status varchar(24) NOT NULL,
    rule_version_id uuid REFERENCES rule_version(id),
    FOREIGN KEY (diagnosis_id, hotel_id) REFERENCES diagnosis(id, hotel_id),
    FOREIGN KEY (calculation_snapshot_id, diagnosis_id, hotel_id, baseline_revision)
        REFERENCES input_snapshot(id, diagnosis_id, hotel_id, input_revision),
    FOREIGN KEY (actual_spend_fact_id, hotel_id) REFERENCES channel_fact(id, hotel_id),
    CHECK (period_end >= period_start),
    CHECK ((budget IS NULL AND projected_spend IS NULL) OR currency IS NOT NULL)
);

CREATE TABLE experiment (
    id uuid PRIMARY KEY,
    diagnosis_id uuid NOT NULL,
    hotel_id uuid NOT NULL,
    type varchar(24) NOT NULL CHECK (type IN ('price', 'commission', 'advertising', 'promotion')),
    status varchar(24) NOT NULL CHECK (status IN ('draft', 'planned', 'running', 'stopped', 'completed')),
    baseline jsonb,
    control_conditions jsonb,
    start_date date,
    end_date date,
    original_value jsonb,
    target_value jsonb,
    owner_id uuid REFERENCES app_user(id),
    stop_condition text,
    observation_metrics jsonb,
    review_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    version integer NOT NULL DEFAULT 1 CHECK (version > 0),
    UNIQUE (id, diagnosis_id, hotel_id),
    FOREIGN KEY (diagnosis_id, hotel_id) REFERENCES diagnosis(id, hotel_id),
    CHECK (start_date IS NULL OR end_date IS NULL OR end_date >= start_date),
    CHECK (status = 'draft' OR
        (baseline IS NOT NULL AND control_conditions IS NOT NULL AND start_date IS NOT NULL AND end_date IS NOT NULL
         AND original_value IS NOT NULL AND target_value IS NOT NULL AND owner_id IS NOT NULL AND stop_condition IS NOT NULL))
);

CREATE TABLE experiment_result (
    id uuid PRIMARY KEY,
    experiment_id uuid NOT NULL,
    diagnosis_id uuid NOT NULL,
    hotel_id uuid NOT NULL,
    business_date date NOT NULL,
    executed_value jsonb,
    status varchar(24) NOT NULL,
    metrics jsonb,
    source_ref text,
    verification_status varchar(20) NOT NULL,
    manual_decision varchar(24) CHECK (manual_decision IN ('retain', 'adjust', 'stop', 'undetermined')),
    decision_reason text,
    recorded_by uuid NOT NULL REFERENCES app_user(id),
    recorded_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (experiment_id, diagnosis_id, hotel_id) REFERENCES experiment(id, diagnosis_id, hotel_id)
);

CREATE TABLE report_version (
    id uuid PRIMARY KEY,
    diagnosis_id uuid NOT NULL,
    hotel_id uuid NOT NULL,
    revision integer NOT NULL CHECK (revision > 0),
    input_revision integer NOT NULL CHECK (input_revision > 0),
    snapshot_id uuid NOT NULL,
    status varchar(16) NOT NULL CHECK (status IN ('draft', 'pending', 'approved', 'rejected')),
    content_ref text NOT NULL,
    created_by uuid NOT NULL REFERENCES app_user(id),
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (diagnosis_id, revision),
    UNIQUE (id, diagnosis_id, hotel_id),
    FOREIGN KEY (diagnosis_id, hotel_id) REFERENCES diagnosis(id, hotel_id),
    FOREIGN KEY (snapshot_id, diagnosis_id, hotel_id, input_revision)
        REFERENCES input_snapshot(id, diagnosis_id, hotel_id, input_revision)
);

CREATE TABLE report_review (
    id uuid PRIMARY KEY,
    report_version_id uuid NOT NULL REFERENCES report_version(id),
    reviewer_id uuid NOT NULL REFERENCES app_user(id),
    decision varchar(16) NOT NULL CHECK (decision IN ('approve', 'reject')),
    reason text NOT NULL,
    changes jsonb,
    reviewed_at timestamptz NOT NULL
);

CREATE TABLE report_delivery (
    id uuid PRIMARY KEY,
    report_version_id uuid NOT NULL,
    diagnosis_id uuid NOT NULL,
    hotel_id uuid NOT NULL,
    recipient_user_id uuid REFERENCES app_user(id),
    recipient_contact_id uuid,
    method varchar(16) NOT NULL CHECK (method IN ('online', 'manual')),
    status varchar(16) NOT NULL CHECK (status IN ('pending', 'available', 'sent', 'confirmed', 'failed', 'revoked')),
    operator_id uuid NOT NULL REFERENCES app_user(id),
    event_at timestamptz,
    evidence_ref text,
    FOREIGN KEY (report_version_id, diagnosis_id, hotel_id) REFERENCES report_version(id, diagnosis_id, hotel_id),
    FOREIGN KEY (recipient_contact_id, hotel_id) REFERENCES contact(id, hotel_id),
    CHECK ((recipient_user_id IS NOT NULL) <> (recipient_contact_id IS NOT NULL)),
    CHECK (method <> 'online' OR recipient_user_id IS NOT NULL),
    CHECK (status = 'pending' OR event_at IS NOT NULL)
);

CREATE TABLE report_delivery_event (
    id uuid PRIMARY KEY,
    delivery_id uuid NOT NULL REFERENCES report_delivery(id),
    event_type varchar(24) NOT NULL CHECK (event_type IN ('available', 'sent', 'confirmed', 'read', 'downloaded', 'failed', 'revoked')),
    actor_id uuid REFERENCES app_user(id),
    occurred_at timestamptz NOT NULL,
    evidence_ref text
);

CREATE TABLE follow_up (
    id uuid PRIMARY KEY,
    hotel_id uuid NOT NULL REFERENCES hotel(id),
    diagnosis_id uuid,
    experiment_id uuid,
    record_kind varchar(24) NOT NULL CHECK (record_kind IN ('communication', 'action')),
    action_type varchar(24),
    action_description text,
    communication_note text,
    owner_user_id uuid REFERENCES app_user(id),
    owner_role varchar(100),
    target_date date,
    action_status varchar(24) CHECK (action_status IN ('pending', 'planned', 'in_progress', 'completed', 'paused', 'cancelled')),
    tracking_metric jsonb,
    target_value jsonb,
    actual_result jsonb,
    result_source text,
    recorded_at timestamptz,
    baseline_diamond varchar(16),
    target_diamond varchar(16),
    visibility varchar(24) NOT NULL CHECK (visibility IN ('internal', 'approved_for_report')),
    created_by uuid NOT NULL REFERENCES app_user(id),
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    version integer NOT NULL DEFAULT 1 CHECK (version > 0),
    FOREIGN KEY (diagnosis_id, hotel_id) REFERENCES diagnosis(id, hotel_id),
    FOREIGN KEY (experiment_id, diagnosis_id, hotel_id) REFERENCES experiment(id, diagnosis_id, hotel_id),
    CHECK (experiment_id IS NULL OR diagnosis_id IS NOT NULL),
    CHECK (record_kind <> 'action' OR (action_description IS NOT NULL AND action_status IS NOT NULL)),
    CHECK (action_status <> 'completed' OR (actual_result IS NOT NULL AND result_source IS NOT NULL AND recorded_at IS NOT NULL))
);

CREATE TABLE business_job (
    id uuid PRIMARY KEY,
    job_type varchar(16) NOT NULL CHECK (job_type IN ('recognition', 'export')),
    hotel_id uuid NOT NULL,
    diagnosis_id uuid NOT NULL,
    source_file_id uuid,
    report_version_id uuid,
    requested_by uuid NOT NULL REFERENCES app_user(id),
    requested_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status varchar(16) NOT NULL CHECK (status IN ('queued', 'running', 'succeeded', 'failed', 'cancelled')),
    attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
    idempotency_key varchar(200) NOT NULL,
    request_fingerprint varchar(128) NOT NULL,
    started_at timestamptz,
    finished_at timestamptz,
    result_ref text,
    error_code varchar(100),
    safe_error_message text,
    UNIQUE (requested_by, job_type, idempotency_key),
    FOREIGN KEY (diagnosis_id, hotel_id) REFERENCES diagnosis(id, hotel_id),
    FOREIGN KEY (source_file_id, diagnosis_id, hotel_id) REFERENCES source_file(id, diagnosis_id, hotel_id),
    FOREIGN KEY (report_version_id, diagnosis_id, hotel_id) REFERENCES report_version(id, diagnosis_id, hotel_id),
    CHECK ((job_type = 'recognition' AND source_file_id IS NOT NULL AND report_version_id IS NULL) OR
           (job_type = 'export' AND report_version_id IS NOT NULL AND source_file_id IS NULL)),
    CHECK (status <> 'failed' OR (error_code IS NOT NULL AND safe_error_message IS NOT NULL)),
    CHECK (status <> 'succeeded' OR (finished_at IS NOT NULL AND result_ref IS NOT NULL))
);
CREATE INDEX business_job_status_idx ON business_job (status, requested_at);

CREATE TABLE business_job_attempt (
    id uuid PRIMARY KEY,
    job_id uuid NOT NULL REFERENCES business_job(id),
    attempt_number integer NOT NULL CHECK (attempt_number > 0),
    status varchar(16) NOT NULL CHECK (status IN ('running', 'succeeded', 'failed', 'cancelled')),
    started_at timestamptz NOT NULL,
    finished_at timestamptz,
    result_ref text,
    error_code varchar(100),
    safe_error_message text,
    UNIQUE (job_id, attempt_number)
);

CREATE TABLE deletion_request (
    id uuid PRIMARY KEY,
    requested_by uuid NOT NULL REFERENCES app_user(id),
    hotel_id uuid,
    diagnosis_id uuid,
    scope jsonb NOT NULL,
    status varchar(32) NOT NULL CHECK (status IN ('pending', 'processing', 'online_cleared_backup_pending', 'completed', 'restricted', 'failed')),
    requested_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    processed_by uuid REFERENCES app_user(id),
    online_result jsonb,
    backup_result jsonb,
    failure_reason text,
    completed_at timestamptz,
    CHECK (diagnosis_id IS NULL OR hotel_id IS NOT NULL),
    CHECK (status <> 'completed' OR (online_result IS NOT NULL AND backup_result IS NOT NULL AND completed_at IS NOT NULL)),
    CHECK (status <> 'failed' OR failure_reason IS NOT NULL)
);

CREATE TABLE audit_event (
    id uuid PRIMARY KEY,
    actor_id uuid REFERENCES app_user(id),
    hotel_id uuid,
    resource_type varchar(64) NOT NULL,
    resource_id uuid NOT NULL,
    action varchar(64) NOT NULL,
    result varchar(32) NOT NULL,
    reason_code varchar(100),
    occurred_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX audit_event_resource_idx ON audit_event (resource_type, resource_id, occurred_at);

COMMIT;
