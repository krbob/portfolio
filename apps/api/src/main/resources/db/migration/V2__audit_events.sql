create table audit_events (
    id uuid primary key default gen_random_uuid(),
    category text not null check (category in ('ACCOUNTS', 'INSTRUMENTS', 'TRANSACTIONS', 'TARGETS', 'IMPORTS', 'BACKUPS', 'SYSTEM')),
    action text not null,
    outcome text not null check (outcome in ('SUCCESS', 'FAILURE')),
    entity_type text,
    entity_id text,
    message text not null,
    metadata_json text not null default '{}',
    occurred_at timestamptz not null default now()
);

create index audit_events_occurred_at_idx on audit_events(occurred_at desc);
create index audit_events_category_occurred_at_idx on audit_events(category, occurred_at desc);
