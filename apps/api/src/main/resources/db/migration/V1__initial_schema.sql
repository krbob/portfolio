create table accounts (
    id text primary key,
    name text not null,
    institution text not null,
    type text not null check (type in ('BROKERAGE', 'BOND_REGISTER', 'CASH')),
    base_currency text not null check (length(base_currency) = 3),
    is_active integer not null default 1 check (is_active in (0, 1)),
    created_at text not null,
    updated_at text not null
);

create table instruments (
    id text primary key,
    name text not null,
    kind text not null check (kind in ('ETF', 'STOCK', 'BOND_EDO', 'CASH', 'FX_RATE', 'BENCHMARK_GOLD')),
    asset_class text not null check (asset_class in ('EQUITIES', 'BONDS', 'CASH', 'FX', 'BENCHMARK')),
    symbol text,
    currency text not null check (length(currency) = 3),
    valuation_source text not null check (valuation_source in ('STOCK_ANALYST', 'EDO_CALCULATOR', 'MANUAL')),
    is_active integer not null default 1 check (is_active in (0, 1)),
    created_at text not null,
    updated_at text not null
);

create table edo_terms (
    instrument_id text primary key references instruments(id) on delete cascade,
    purchase_date text not null,
    first_period_rate_bps integer not null check (first_period_rate_bps >= 0),
    margin_bps integer not null check (margin_bps >= 0),
    principal_units integer not null check (principal_units > 0),
    maturity_date text not null,
    check (maturity_date > purchase_date)
);

create table transactions (
    id text primary key,
    account_id text not null references accounts(id) on delete restrict,
    instrument_id text references instruments(id) on delete restrict,
    type text not null check (type in ('BUY', 'SELL', 'REDEEM', 'DEPOSIT', 'WITHDRAWAL', 'FEE', 'TAX', 'INTEREST', 'CORRECTION')),
    trade_date text not null,
    settlement_date text,
    quantity text,
    unit_price text,
    gross_amount text not null,
    fee_amount text not null default '0',
    tax_amount text not null default '0',
    currency text not null check (length(currency) = 3),
    fx_rate_to_pln text,
    notes text not null default '',
    created_at text not null,
    updated_at text not null,
    check (settlement_date is null or settlement_date >= trade_date),
    check (trim(gross_amount) <> '' and cast(gross_amount as real) >= 0),
    check (trim(fee_amount) <> '' and cast(fee_amount as real) >= 0),
    check (trim(tax_amount) <> '' and cast(tax_amount as real) >= 0),
    check (fx_rate_to_pln is null or (trim(fx_rate_to_pln) <> '' and cast(fx_rate_to_pln as real) > 0)),
    check (
        case
            when type in ('BUY', 'SELL', 'REDEEM') then
                instrument_id is not null
                and quantity is not null
                and trim(quantity) <> ''
                and cast(quantity as real) > 0
                and unit_price is not null
                and trim(unit_price) <> ''
                and cast(unit_price as real) >= 0
            when type in ('DEPOSIT', 'WITHDRAWAL', 'FEE', 'TAX', 'INTEREST') then
                quantity is null
                and unit_price is null
            when type = 'CORRECTION' then
                trim(notes) <> ''
            else 1
        end
    )
);

create table portfolio_targets (
    id text primary key,
    asset_class text not null check (asset_class in ('EQUITIES', 'BONDS', 'CASH', 'FX', 'BENCHMARK')),
    target_weight text not null check (trim(target_weight) <> '' and cast(target_weight as real) >= 0 and cast(target_weight as real) <= 1),
    created_at text not null,
    updated_at text not null
);

create table daily_snapshots (
    snapshot_date text primary key,
    total_value_pln text not null check (trim(total_value_pln) <> '' and cast(total_value_pln as real) >= 0),
    total_value_usd text not null check (trim(total_value_usd) <> '' and cast(total_value_usd as real) >= 0),
    total_value_au text not null check (trim(total_value_au) <> '' and cast(total_value_au as real) >= 0),
    total_contributions_pln text not null check (trim(total_contributions_pln) <> '' and cast(total_contributions_pln as real) >= 0),
    total_contributions_usd text not null check (trim(total_contributions_usd) <> '' and cast(total_contributions_usd as real) >= 0),
    total_contributions_au text not null check (trim(total_contributions_au) <> '' and cast(total_contributions_au as real) >= 0),
    equity_weight text not null check (trim(equity_weight) <> '' and cast(equity_weight as real) >= 0 and cast(equity_weight as real) <= 1),
    bond_weight text not null check (trim(bond_weight) <> '' and cast(bond_weight as real) >= 0 and cast(bond_weight as real) <= 1),
    created_at text not null
);

create index transactions_account_id_trade_date_idx on transactions(account_id, trade_date desc);
create index transactions_instrument_id_trade_date_idx on transactions(instrument_id, trade_date desc);
create index instruments_kind_asset_class_idx on instruments(kind, asset_class);
