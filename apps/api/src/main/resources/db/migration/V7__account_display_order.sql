alter table accounts add column display_order integer not null default 0 check (display_order >= 0);

with ordered_accounts as (
    select
        id,
        row_number() over (order by created_at asc, name asc) - 1 as next_display_order
    from accounts
)
update accounts
set display_order = (
    select ordered_accounts.next_display_order
    from ordered_accounts
    where ordered_accounts.id = accounts.id
);
