CREATE TABLE provider_usage (
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  day TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, provider, day)
);

CREATE INDEX idx_provider_usage_lookup ON provider_usage (provider, day);
