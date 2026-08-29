-- 'spark' as a signup provenance. The 20 August testers who paid through
-- Spark are being imported into testing_signups (owner, 2026-08-28: "put
-- those on the spark csv on the testing list with no recorded payment in our
-- crm"), and stamping them 'staff' or 'link' would lie about where they came
-- from. Runs alone: Postgres refuses to USE a new enum value in the same
-- transaction that adds it, so the import is a second file.
-- No verify select here: even reading enum_range trips "unsafe use of new
-- value" pre-commit. The import file's insert is the verification.
alter type public.signup_source add value if not exists 'spark';
