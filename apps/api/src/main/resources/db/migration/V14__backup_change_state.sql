create table backup_change_state (
    singleton_id integer primary key check (singleton_id = 1),
    current_revision integer not null check (current_revision >= 0),
    checkpoint_revision integer check (
        checkpoint_revision is null
        or (checkpoint_revision >= 0 and checkpoint_revision <= current_revision)
    ),
    dirty_since text,
    last_changed_at text,
    checkpointed_at text,
    checkpoint_file_name text,
    checkpoint_file_sha256 text check (
        checkpoint_file_sha256 is null
        or (
            length(checkpoint_file_sha256) = 64
            and checkpoint_file_sha256 not glob '*[^0-9a-f]*'
        )
    ),
    reconciliation_required integer not null default 1 check (reconciliation_required in (0, 1)),
    check ((checkpoint_file_name is null) = (checkpoint_file_sha256 is null))
);

insert into backup_change_state (
    singleton_id,
    current_revision,
    checkpoint_revision,
    dirty_since,
    last_changed_at,
    checkpointed_at,
    checkpoint_file_name,
    checkpoint_file_sha256,
    reconciliation_required
)
select
    1,
    case when
        exists (select 1 from accounts)
        or exists (select 1 from instruments)
        or exists (select 1 from edo_terms)
        or exists (select 1 from transactions)
        or exists (select 1 from portfolio_target_phases)
        or exists (select 1 from portfolio_targets)
        or exists (select 1 from transaction_import_profiles)
        or exists (
            select 1
            from app_preferences
            where preference_key <> 'portfolio.alerts.active'
              and instr(preference_key, 'portfolio.market-data.') <> 1
              and instr(preference_key, 'market-data.snapshot.') <> 1
              and instr(preference_key, 'market-data.snapshot-meta.') <> 1
        )
    then 1 else 0 end,
    case when
        exists (select 1 from accounts)
        or exists (select 1 from instruments)
        or exists (select 1 from edo_terms)
        or exists (select 1 from transactions)
        or exists (select 1 from portfolio_target_phases)
        or exists (select 1 from portfolio_targets)
        or exists (select 1 from transaction_import_profiles)
        or exists (
            select 1
            from app_preferences
            where preference_key <> 'portfolio.alerts.active'
              and instr(preference_key, 'portfolio.market-data.') <> 1
              and instr(preference_key, 'market-data.snapshot.') <> 1
              and instr(preference_key, 'market-data.snapshot-meta.') <> 1
        )
    then null else 0 end,
    case when
        exists (select 1 from accounts)
        or exists (select 1 from instruments)
        or exists (select 1 from edo_terms)
        or exists (select 1 from transactions)
        or exists (select 1 from portfolio_target_phases)
        or exists (select 1 from portfolio_targets)
        or exists (select 1 from transaction_import_profiles)
        or exists (
            select 1
            from app_preferences
            where preference_key <> 'portfolio.alerts.active'
              and instr(preference_key, 'portfolio.market-data.') <> 1
              and instr(preference_key, 'market-data.snapshot.') <> 1
              and instr(preference_key, 'market-data.snapshot-meta.') <> 1
        )
    then strftime('%Y-%m-%dT%H:%M:%fZ', 'now') else null end,
    case when
        exists (select 1 from accounts)
        or exists (select 1 from instruments)
        or exists (select 1 from edo_terms)
        or exists (select 1 from transactions)
        or exists (select 1 from portfolio_target_phases)
        or exists (select 1 from portfolio_targets)
        or exists (select 1 from transaction_import_profiles)
        or exists (
            select 1
            from app_preferences
            where preference_key <> 'portfolio.alerts.active'
              and instr(preference_key, 'portfolio.market-data.') <> 1
              and instr(preference_key, 'market-data.snapshot.') <> 1
              and instr(preference_key, 'market-data.snapshot-meta.') <> 1
        )
    then strftime('%Y-%m-%dT%H:%M:%fZ', 'now') else null end,
    null,
    null,
    null,
    case when
        exists (select 1 from accounts)
        or exists (select 1 from instruments)
        or exists (select 1 from edo_terms)
        or exists (select 1 from transactions)
        or exists (select 1 from portfolio_target_phases)
        or exists (select 1 from portfolio_targets)
        or exists (select 1 from transaction_import_profiles)
        or exists (
            select 1
            from app_preferences
            where preference_key <> 'portfolio.alerts.active'
              and instr(preference_key, 'portfolio.market-data.') <> 1
              and instr(preference_key, 'market-data.snapshot.') <> 1
              and instr(preference_key, 'market-data.snapshot-meta.') <> 1
        )
    then 1 else 0 end;

-- Every canonical write advances the revision in the same SQLite transaction.
-- Operational/read-model/audit tables intentionally have no triggers.

create trigger backup_revision_accounts_insert after insert on accounts begin
    update backup_change_state set
        dirty_since = coalesce(dirty_since, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        last_changed_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
        current_revision = current_revision + 1
    where singleton_id = 1;
end;
create trigger backup_revision_accounts_update after update on accounts begin
    update backup_change_state set
        dirty_since = coalesce(dirty_since, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        last_changed_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
        current_revision = current_revision + 1
    where singleton_id = 1;
end;
create trigger backup_revision_accounts_delete after delete on accounts begin
    update backup_change_state set
        dirty_since = coalesce(dirty_since, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        last_changed_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
        current_revision = current_revision + 1
    where singleton_id = 1;
end;

create trigger backup_revision_instruments_insert after insert on instruments begin
    update backup_change_state set
        dirty_since = coalesce(dirty_since, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        last_changed_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
        current_revision = current_revision + 1
    where singleton_id = 1;
end;
create trigger backup_revision_instruments_update after update on instruments begin
    update backup_change_state set
        dirty_since = coalesce(dirty_since, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        last_changed_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
        current_revision = current_revision + 1
    where singleton_id = 1;
end;
create trigger backup_revision_instruments_delete after delete on instruments begin
    update backup_change_state set
        dirty_since = coalesce(dirty_since, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        last_changed_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
        current_revision = current_revision + 1
    where singleton_id = 1;
end;

create trigger backup_revision_edo_terms_insert after insert on edo_terms begin
    update backup_change_state set
        dirty_since = coalesce(dirty_since, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        last_changed_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
        current_revision = current_revision + 1
    where singleton_id = 1;
end;
create trigger backup_revision_edo_terms_update after update on edo_terms begin
    update backup_change_state set
        dirty_since = coalesce(dirty_since, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        last_changed_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
        current_revision = current_revision + 1
    where singleton_id = 1;
end;
create trigger backup_revision_edo_terms_delete after delete on edo_terms begin
    update backup_change_state set
        dirty_since = coalesce(dirty_since, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        last_changed_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
        current_revision = current_revision + 1
    where singleton_id = 1;
end;

create trigger backup_revision_transactions_insert after insert on transactions begin
    update backup_change_state set
        dirty_since = coalesce(dirty_since, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        last_changed_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
        current_revision = current_revision + 1
    where singleton_id = 1;
end;
create trigger backup_revision_transactions_update after update on transactions begin
    update backup_change_state set
        dirty_since = coalesce(dirty_since, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        last_changed_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
        current_revision = current_revision + 1
    where singleton_id = 1;
end;
create trigger backup_revision_transactions_delete after delete on transactions begin
    update backup_change_state set
        dirty_since = coalesce(dirty_since, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        last_changed_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
        current_revision = current_revision + 1
    where singleton_id = 1;
end;

create trigger backup_revision_target_phases_insert after insert on portfolio_target_phases begin
    update backup_change_state set
        dirty_since = coalesce(dirty_since, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        last_changed_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
        current_revision = current_revision + 1
    where singleton_id = 1;
end;
create trigger backup_revision_target_phases_update after update on portfolio_target_phases begin
    update backup_change_state set
        dirty_since = coalesce(dirty_since, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        last_changed_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
        current_revision = current_revision + 1
    where singleton_id = 1;
end;
create trigger backup_revision_target_phases_delete after delete on portfolio_target_phases begin
    update backup_change_state set
        dirty_since = coalesce(dirty_since, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        last_changed_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
        current_revision = current_revision + 1
    where singleton_id = 1;
end;

create trigger backup_revision_targets_insert after insert on portfolio_targets begin
    update backup_change_state set
        dirty_since = coalesce(dirty_since, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        last_changed_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
        current_revision = current_revision + 1
    where singleton_id = 1;
end;
create trigger backup_revision_targets_update after update on portfolio_targets begin
    update backup_change_state set
        dirty_since = coalesce(dirty_since, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        last_changed_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
        current_revision = current_revision + 1
    where singleton_id = 1;
end;
create trigger backup_revision_targets_delete after delete on portfolio_targets begin
    update backup_change_state set
        dirty_since = coalesce(dirty_since, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        last_changed_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
        current_revision = current_revision + 1
    where singleton_id = 1;
end;

create trigger backup_revision_import_profiles_insert after insert on transaction_import_profiles begin
    update backup_change_state set
        dirty_since = coalesce(dirty_since, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        last_changed_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
        current_revision = current_revision + 1
    where singleton_id = 1;
end;
create trigger backup_revision_import_profiles_update after update on transaction_import_profiles begin
    update backup_change_state set
        dirty_since = coalesce(dirty_since, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        last_changed_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
        current_revision = current_revision + 1
    where singleton_id = 1;
end;
create trigger backup_revision_import_profiles_delete after delete on transaction_import_profiles begin
    update backup_change_state set
        dirty_since = coalesce(dirty_since, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        last_changed_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
        current_revision = current_revision + 1
    where singleton_id = 1;
end;

create trigger backup_revision_app_preferences_insert after insert on app_preferences
when new.preference_key <> 'portfolio.alerts.active'
 and instr(new.preference_key, 'portfolio.market-data.') <> 1
 and instr(new.preference_key, 'market-data.snapshot.') <> 1
 and instr(new.preference_key, 'market-data.snapshot-meta.') <> 1
begin
    update backup_change_state set
        dirty_since = coalesce(dirty_since, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        last_changed_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
        current_revision = current_revision + 1
    where singleton_id = 1;
end;
create trigger backup_revision_app_preferences_update after update on app_preferences
when (
    old.preference_key <> 'portfolio.alerts.active'
    and instr(old.preference_key, 'portfolio.market-data.') <> 1
    and instr(old.preference_key, 'market-data.snapshot.') <> 1
    and instr(old.preference_key, 'market-data.snapshot-meta.') <> 1
) or (
    new.preference_key <> 'portfolio.alerts.active'
    and instr(new.preference_key, 'portfolio.market-data.') <> 1
    and instr(new.preference_key, 'market-data.snapshot.') <> 1
    and instr(new.preference_key, 'market-data.snapshot-meta.') <> 1
)
begin
    update backup_change_state set
        dirty_since = coalesce(dirty_since, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        last_changed_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
        current_revision = current_revision + 1
    where singleton_id = 1;
end;
create trigger backup_revision_app_preferences_delete after delete on app_preferences
when old.preference_key <> 'portfolio.alerts.active'
 and instr(old.preference_key, 'portfolio.market-data.') <> 1
 and instr(old.preference_key, 'market-data.snapshot.') <> 1
 and instr(old.preference_key, 'market-data.snapshot-meta.') <> 1
begin
    update backup_change_state set
        dirty_since = coalesce(dirty_since, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        last_changed_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
        current_revision = current_revision + 1
    where singleton_id = 1;
end;
