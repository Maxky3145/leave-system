-- 0003_smtp_settings.sql
ALTER TABLE email_settings ADD COLUMN smtp_host TEXT DEFAULT 'smtp.swu.ac.th';
ALTER TABLE email_settings ADD COLUMN smtp_port INTEGER DEFAULT 587;
ALTER TABLE email_settings ADD COLUMN smtp_user TEXT DEFAULT '';
ALTER TABLE email_settings ADD COLUMN smtp_pass TEXT DEFAULT '';
ALTER TABLE email_settings ADD COLUMN smtp_secure INTEGER DEFAULT 0;