begin;

truncate table daily_snapshots restart identity cascade;
truncate table portfolio_targets restart identity cascade;
truncate table transactions restart identity cascade;
truncate table edo_terms restart identity cascade;
truncate table instruments restart identity cascade;
truncate table accounts restart identity cascade;

insert into accounts (id, name, institution, type, base_currency, is_active)
values
    ('11111111-1111-1111-1111-111111111111', 'Interactive Brokers', 'Interactive Brokers', 'BROKERAGE', 'USD', true),
    ('22222222-2222-2222-2222-222222222222', 'XTB', 'XTB', 'BROKERAGE', 'USD', true),
    ('33333333-3333-3333-3333-333333333333', 'mBank Brokerage', 'mBank', 'BROKERAGE', 'USD', true),
    ('44444444-4444-4444-4444-444444444444', 'Treasury Bonds Register', 'PKO BP', 'BOND_REGISTER', 'PLN', true);

insert into instruments (id, name, kind, asset_class, symbol, currency, valuation_source, is_active)
values
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'Vanguard FTSE All-World UCITS ETF', 'ETF', 'EQUITIES', 'VWRA.L', 'USD', 'STOCK_ANALYST', true),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1', 'EDO 04/2034', 'BOND_EDO', 'BONDS', null, 'PLN', 'EDO_CALCULATOR', true),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2', 'EDO 11/2034', 'BOND_EDO', 'BONDS', null, 'PLN', 'EDO_CALCULATOR', true),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb3', 'EDO 05/2035', 'BOND_EDO', 'BONDS', null, 'PLN', 'EDO_CALCULATOR', true),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb4', 'EDO 12/2035', 'BOND_EDO', 'BONDS', null, 'PLN', 'EDO_CALCULATOR', true);

insert into edo_terms (instrument_id, purchase_date, first_period_rate_bps, margin_bps, principal_units, maturity_date)
values
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1', '2024-04-11', 680, 150, 100, '2034-04-11'),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2', '2024-11-05', 650, 150, 150, '2034-11-05'),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb3', '2025-05-13', 590, 150, 120, '2035-05-13'),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb4', '2025-12-16', 560, 150, 180, '2035-12-16');

insert into transactions (
    id,
    account_id,
    instrument_id,
    type,
    trade_date,
    settlement_date,
    quantity,
    unit_price,
    gross_amount,
    fee_amount,
    tax_amount,
    currency,
    fx_rate_to_pln,
    notes
)
values
    ('c0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', null, 'DEPOSIT', '2024-03-18', '2024-03-18', null, null, 2500.00, 0, 0, 'USD', 3.99000000, 'Initial cash for VWRA purchase'),
    ('c0000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'BUY', '2024-03-19', '2024-03-21', 12.0000000000, 123.4000000000, 1480.80, 1.25, 0, 'USD', 3.98500000, 'VWRA accumulation purchase'),
    ('c0000000-0000-0000-0000-000000000003', '22222222-2222-2222-2222-222222222222', null, 'DEPOSIT', '2024-08-12', '2024-08-12', null, null, 1900.00, 0, 0, 'USD', 4.01000000, 'Top-up for XTB'),
    ('c0000000-0000-0000-0000-000000000004', '22222222-2222-2222-2222-222222222222', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'BUY', '2024-08-13', '2024-08-14', 10.0000000000, 133.6000000000, 1336.00, 0.00, 0, 'USD', 4.00500000, 'VWRA accumulation purchase'),
    ('c0000000-0000-0000-0000-000000000005', '44444444-4444-4444-4444-444444444444', null, 'DEPOSIT', '2024-04-10', '2024-04-10', null, null, 10000.00, 0, 0, 'PLN', 1.00000000, 'Cash for EDO order'),
    ('c0000000-0000-0000-0000-000000000006', '44444444-4444-4444-4444-444444444444', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1', 'BUY', '2024-04-11', '2024-04-11', 100.0000000000, 100.0000000000, 10000.00, 0, 0, 'PLN', 1.00000000, 'EDO series purchase'),
    ('c0000000-0000-0000-0000-000000000007', '33333333-3333-3333-3333-333333333333', null, 'DEPOSIT', '2025-02-14', '2025-02-14', null, null, 2300.00, 0, 0, 'USD', 4.02000000, 'Savings transfer for ETF'),
    ('c0000000-0000-0000-0000-000000000008', '33333333-3333-3333-3333-333333333333', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'BUY', '2025-02-17', '2025-02-19', 13.0000000000, 145.8000000000, 1895.40, 3.50, 0, 'USD', 4.01800000, 'VWRA accumulation purchase'),
    ('c0000000-0000-0000-0000-000000000009', '44444444-4444-4444-4444-444444444444', null, 'DEPOSIT', '2024-11-04', '2024-11-04', null, null, 15000.00, 0, 0, 'PLN', 1.00000000, 'Cash for EDO order'),
    ('c0000000-0000-0000-0000-000000000010', '44444444-4444-4444-4444-444444444444', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2', 'BUY', '2024-11-05', '2024-11-05', 150.0000000000, 100.0000000000, 15000.00, 0, 0, 'PLN', 1.00000000, 'EDO series purchase'),
    ('c0000000-0000-0000-0000-000000000011', '11111111-1111-1111-1111-111111111111', null, 'DEPOSIT', '2025-09-10', '2025-09-10', null, null, 2600.00, 0, 0, 'USD', 3.87000000, 'Additional ETF contribution'),
    ('c0000000-0000-0000-0000-000000000012', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'BUY', '2025-09-11', '2025-09-15', 14.0000000000, 158.2000000000, 2214.80, 1.30, 0, 'USD', 3.86500000, 'VWRA accumulation purchase'),
    ('c0000000-0000-0000-0000-000000000013', '44444444-4444-4444-4444-444444444444', null, 'DEPOSIT', '2025-05-12', '2025-05-12', null, null, 12000.00, 0, 0, 'PLN', 1.00000000, 'Cash for EDO order'),
    ('c0000000-0000-0000-0000-000000000014', '44444444-4444-4444-4444-444444444444', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb3', 'BUY', '2025-05-13', '2025-05-13', 120.0000000000, 100.0000000000, 12000.00, 0, 0, 'PLN', 1.00000000, 'EDO series purchase'),
    ('c0000000-0000-0000-0000-000000000015', '33333333-3333-3333-3333-333333333333', null, 'DEPOSIT', '2025-12-08', '2025-12-08', null, null, 1800.00, 0, 0, 'USD', 3.94000000, 'Additional ETF contribution'),
    ('c0000000-0000-0000-0000-000000000016', '33333333-3333-3333-3333-333333333333', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'BUY', '2025-12-09', '2025-12-11', 9.0000000000, 165.4000000000, 1488.60, 3.50, 0, 'USD', 3.93800000, 'VWRA accumulation purchase'),
    ('c0000000-0000-0000-0000-000000000017', '44444444-4444-4444-4444-444444444444', null, 'DEPOSIT', '2025-12-15', '2025-12-15', null, null, 18000.00, 0, 0, 'PLN', 1.00000000, 'Cash for EDO order'),
    ('c0000000-0000-0000-0000-000000000018', '44444444-4444-4444-4444-444444444444', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb4', 'BUY', '2025-12-16', '2025-12-16', 180.0000000000, 100.0000000000, 18000.00, 0, 0, 'PLN', 1.00000000, 'EDO series purchase'),
    ('c0000000-0000-0000-0000-000000000019', '22222222-2222-2222-2222-222222222222', null, 'DEPOSIT', '2026-02-12', '2026-02-12', null, null, 1450.00, 0, 0, 'USD', 3.96000000, 'Additional ETF contribution'),
    ('c0000000-0000-0000-0000-000000000020', '22222222-2222-2222-2222-222222222222', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'BUY', '2026-02-13', '2026-02-17', 8.0000000000, 170.7500000000, 1366.00, 0.00, 0, 'USD', 3.95500000, 'VWRA accumulation purchase');

commit;
