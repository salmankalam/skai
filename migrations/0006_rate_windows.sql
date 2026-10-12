CREATE TABLE rate_windows (
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  window_start INTEGER NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, provider, window_start)
);

CREATE INDEX idx_rate_windows_cleanup ON rate_windows (window_start);
