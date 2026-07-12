create table operational_state (
    state_key text primary key,
    value_json text not null check (trim(value_json) <> ''),
    updated_at text not null
);

insert into operational_state (state_key, value_json, updated_at)
select preference_key, value_json, updated_at
from app_preferences
where preference_key = 'portfolio.alerts.active'
   or preference_key like 'portfolio.market-data.%'
   or preference_key like 'market-data.snapshot.%'
   or preference_key like 'market-data.snapshot-meta.%';

delete from app_preferences
where preference_key = 'portfolio.alerts.active'
   or preference_key like 'portfolio.market-data.%'
   or preference_key like 'market-data.snapshot.%'
   or preference_key like 'market-data.snapshot-meta.%';
