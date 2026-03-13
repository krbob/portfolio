create extension if not exists "pgcrypto";

create table accounts (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    institution text not null,
    type text not null check (type in ('BROKERAGE', 'BOND_REGISTER', 'CASH')),
    base_currency char(3) not null,
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table instruments (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    kind text not null check (kind in ('ETF', 'STOCK', 'BOND_EDO', 'CASH', 'FX_RATE', 'BENCHMARK_GOLD')),
    asset_class text not null check (asset_class in ('EQUITIES', 'BONDS', 'CASH', 'FX', 'BENCHMARK')),
    symbol text,
    currency char(3) not null,
    valuation_source text not null check (valuation_source in ('STOCK_ANALYST', 'EDO_CALCULATOR', 'MANUAL')),
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table edo_terms (
    instrument_id uuid primary key references instruments(id) on delete cascade,
    purchase_date date not null,
    first_period_rate_bps integer not null check (first_period_rate_bps >= 0),
    margin_bps integer not null check (margin_bps >= 0),
    principal_units integer not null check (principal_units > 0),
    maturity_date date not null,
    check (maturity_date > purchase_date)
);

create table transactions (
    id uuid primary key default gen_random_uuid(),
    account_id uuid not null references accounts(id) on delete restrict,
    instrument_id uuid references instruments(id) on delete restrict,
    type text not null check (type in ('BUY', 'SELL', 'DEPOSIT', 'WITHDRAWAL', 'FEE', 'TAX', 'INTEREST', 'CORRECTION')),
    trade_date date not null,
    settlement_date date,
    quantity numeric(28, 10),
    unit_price numeric(28, 10),
    gross_amount numeric(18, 2) not null check (gross_amount >= 0),
    fee_amount numeric(18, 2) not null default 0 check (fee_amount >= 0),
    tax_amount numeric(18, 2) not null default 0 check (tax_amount >= 0),
    currency char(3) not null,
    fx_rate_to_pln numeric(18, 8),
    notes text not null default '',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    check (settlement_date is null or settlement_date >= trade_date),
    check (fx_rate_to_pln is null or fx_rate_to_pln > 0),
    check (
        case
            when type in ('BUY', 'SELL') then
                instrument_id is not null
                and quantity is not null
                and quantity > 0
                and unit_price is not null
                and unit_price >= 0
            when type in ('DEPOSIT', 'WITHDRAWAL', 'FEE', 'TAX', 'INTEREST') then
                quantity is null
                and unit_price is null
            when type = 'CORRECTION' then
                btrim(notes) <> ''
            else true
        end
    )
);

create table portfolio_targets (
    id uuid primary key default gen_random_uuid(),
    asset_class text not null check (asset_class in ('EQUITIES', 'BONDS', 'CASH', 'FX', 'BENCHMARK')),
    target_weight numeric(8, 6) not null check (target_weight >= 0 and target_weight <= 1),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table daily_snapshots (
    snapshot_date date primary key,
    total_value_pln numeric(18, 2) not null check (total_value_pln >= 0),
    total_value_usd numeric(18, 2) not null check (total_value_usd >= 0),
    total_value_au numeric(18, 6) not null check (total_value_au >= 0),
    total_contributions_pln numeric(18, 2) not null check (total_contributions_pln >= 0),
    total_contributions_usd numeric(18, 2) not null check (total_contributions_usd >= 0),
    total_contributions_au numeric(18, 6) not null check (total_contributions_au >= 0),
    equity_weight numeric(8, 6) not null check (equity_weight >= 0 and equity_weight <= 1),
    bond_weight numeric(8, 6) not null check (bond_weight >= 0 and bond_weight <= 1),
    created_at timestamptz not null default now()
);

create index transactions_account_id_trade_date_idx on transactions(account_id, trade_date desc);
create index transactions_instrument_id_trade_date_idx on transactions(instrument_id, trade_date desc);
create index instruments_kind_asset_class_idx on instruments(kind, asset_class);
