-- 0002_email_settings.sql
ALTER TABLE email_settings ADD COLUMN api_url TEXT DEFAULT '';
ALTER TABLE email_settings ADD COLUMN api_key TEXT DEFAULT '';
ALTER TABLE email_settings ADD COLUMN from_email TEXT DEFAULT '';
ALTER TABLE email_settings ADD COLUMN hint TEXT DEFAULT '';