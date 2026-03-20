create table app_preferences (
    preference_key text primary key,
    value_json text not null check (trim(value_json) <> ''),
    updated_at text not null
);
