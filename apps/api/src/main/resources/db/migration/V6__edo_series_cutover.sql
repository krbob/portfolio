drop table if exists edo_terms;

create table edo_terms (
    instrument_id text primary key references instruments(id) on delete cascade,
    series_month text not null,
    first_period_rate_bps integer not null check (first_period_rate_bps >= 0),
    margin_bps integer not null check (margin_bps >= 0)
);
