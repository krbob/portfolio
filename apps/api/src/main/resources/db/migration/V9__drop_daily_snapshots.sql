-- Remove unused daily_snapshots table; portfolio history is computed from transactions and cached in read_model_snapshots.
DROP TABLE IF EXISTS daily_snapshots;
