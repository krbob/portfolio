-- Source-revision checks must not read the pages containing historical JSON payloads.
create index operational_state_revisions on operational_state (state_key, updated_at);
