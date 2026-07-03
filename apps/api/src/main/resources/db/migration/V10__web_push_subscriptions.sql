create table web_push_subscriptions (
    endpoint text primary key,
    p256dh text not null check (trim(p256dh) <> ''),
    auth text not null check (trim(auth) <> ''),
    user_agent text,
    created_at text not null,
    updated_at text not null
);

create index web_push_subscriptions_updated_at_idx on web_push_subscriptions(updated_at desc);
