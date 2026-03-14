create table transaction_import_profiles (
    id text primary key,
    name text not null,
    description text not null,
    delimiter text not null check (delimiter in ('COMMA', 'SEMICOLON', 'TAB')),
    date_format text not null check (date_format in ('ISO_LOCAL_DATE', 'DMY_DOTS', 'DMY_SLASH', 'MDY_SLASH')),
    decimal_separator text not null check (decimal_separator in ('DOT', 'COMMA')),
    skip_duplicates_by_default integer not null check (skip_duplicates_by_default in (0, 1)),
    header_mappings_json text not null,
    defaults_json text not null,
    created_at text not null,
    updated_at text not null
);

create unique index idx_transaction_import_profiles_name
    on transaction_import_profiles(name);
