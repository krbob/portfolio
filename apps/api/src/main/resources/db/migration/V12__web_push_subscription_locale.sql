alter table web_push_subscriptions
    add column locale text not null default 'pl'
    check (locale in ('pl', 'en'));
