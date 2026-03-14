create table read_model_snapshots (
    cache_key text primary key,
    model_name text not null,
    model_version integer not null check (model_version > 0),
    inputs_from date,
    inputs_to date,
    source_updated_at timestamptz,
    generated_at timestamptz not null,
    invalidation_reason text not null,
    payload_json jsonb not null,
    payload_size_bytes integer not null check (payload_size_bytes >= 0)
);

create index read_model_snapshots_generated_at_idx on read_model_snapshots(generated_at desc);
