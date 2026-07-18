create table portfolio_target_phases (
    id text primary key,
    effective_from text not null unique,
    created_at text not null,
    updated_at text not null
);

insert into portfolio_target_phases (id, effective_from, created_at, updated_at)
select
    '00000000-0000-0000-0000-000000000013',
    coalesce((select min(trade_date) from transactions), date('now')),
    min(created_at),
    max(updated_at)
from portfolio_targets
having count(*) > 0;

create table portfolio_targets_v13 (
    id text primary key,
    phase_id text not null references portfolio_target_phases(id) on delete cascade,
    asset_class text not null check (asset_class in ('EQUITIES', 'BONDS', 'CASH')),
    target_weight text not null check (
        trim(target_weight) <> ''
        and cast(target_weight as real) >= 0
        and cast(target_weight as real) <= 1
    ),
    created_at text not null,
    updated_at text not null,
    unique (phase_id, asset_class)
);

insert into portfolio_targets_v13 (id, phase_id, asset_class, target_weight, created_at, updated_at)
select
    id,
    '00000000-0000-0000-0000-000000000013',
    asset_class,
    target_weight,
    created_at,
    updated_at
from portfolio_targets;

drop table portfolio_targets;
alter table portfolio_targets_v13 rename to portfolio_targets;

create index portfolio_targets_phase_id_idx on portfolio_targets(phase_id);
