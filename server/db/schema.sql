CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS app_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  full_name text NOT NULL,
  password_hash text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS app_users_email_lower_idx ON app_users (lower(email));

CREATE TABLE IF NOT EXISTS app_sessions (
  token_hash text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS app_sessions_expiry_idx ON app_sessions(expires_at);

CREATE TABLE IF NOT EXISTS contractors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  cnpj text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id uuid REFERENCES contractors(id) ON DELETE RESTRICT,
  full_name text NOT NULL,
  job_title text NOT NULL DEFAULT '',
  birth_date date,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS employees_contractor_idx ON employees(contractor_id);
CREATE INDEX IF NOT EXISTS employees_name_idx ON employees USING gin (to_tsvector('simple', full_name));

CREATE TABLE IF NOT EXISTS employee_contractor_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
  contractor_id uuid NOT NULL REFERENCES contractors(id) ON DELETE RESTRICT,
  started_on date NOT NULL DEFAULT CURRENT_DATE,
  ended_on date,
  CHECK (ended_on IS NULL OR ended_on >= started_on)
);
CREATE UNIQUE INDEX IF NOT EXISTS employee_one_current_contractor
  ON employee_contractor_history(employee_id) WHERE ended_on IS NULL;

CREATE TABLE IF NOT EXISTS documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
  document_type text NOT NULL,
  issue_date date NOT NULL,
  expires_on date NOT NULL,
  manual_expiry boolean NOT NULL DEFAULT false,
  drive_file_name text,
  drive_url text,
  is_training boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (expires_on >= issue_date)
);
CREATE INDEX IF NOT EXISTS documents_employee_expiry_idx ON documents(employee_id, expires_on);
CREATE INDEX IF NOT EXISTS documents_issue_date_idx ON documents(issue_date) WHERE is_training;

CREATE TABLE IF NOT EXISTS audit_log (
  id bigserial PRIMARY KEY,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  action text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_log_entity_idx ON audit_log(entity_type, entity_id, created_at DESC);

