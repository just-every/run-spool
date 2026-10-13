-- When the scheduled handler last ran, written on every tick, idle or not.
ALTER TABLE alert_scheduler ADD COLUMN last_run INTEGER;
