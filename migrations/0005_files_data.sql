-- Store file content in D1 (base64) — replaces R2 so no payment card is required.
ALTER TABLE files ADD COLUMN data TEXT;
