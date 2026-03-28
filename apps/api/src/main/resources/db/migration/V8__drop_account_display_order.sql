-- Remove the display_order column; accounts are now sorted by creation date.
ALTER TABLE accounts DROP COLUMN display_order;
