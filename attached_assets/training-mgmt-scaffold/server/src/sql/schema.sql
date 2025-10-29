DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'training_status') THEN
    CREATE TYPE training_status AS ENUM ('MANDATORY','OPTIONAL','NA');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'booking_status') THEN
    CREATE TYPE booking_status AS ENUM ('REQUESTED','PENDING_APPROVAL','APPROVED','BOOKED','WAITLISTED','CANCELLED','COMPLETED','NO_SHOW');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'approval_state') THEN
    CREATE TYPE approval_state AS ENUM ('PENDING','APPROVED','REJECTED','EXPIRED');
  END IF;
END $$;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS venues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  address TEXT,
  city TEXT,
  country TEXT,
  lat DOUBLE PRECISION,
  lon DOUBLE PRECISION
);

CREATE TABLE IF NOT EXISTS training_courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  modality TEXT,
  duration_hours INT,
  cost NUMERIC(10,2),
  provider_id UUID REFERENCES providers(id),
  language TEXT,
  tags TEXT[],
  prerequisites UUID[]
);

CREATE TABLE IF NOT EXISTS training_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID REFERENCES training_courses(id),
  start_at TIMESTAMPTZ,
  end_at TIMESTAMPTZ,
  timezone TEXT,
  capacity INT,
  seats_remaining INT,
  venue_id UUID REFERENCES venues(id),
  language TEXT,
  instructor TEXT,
  status TEXT
);

CREATE TABLE IF NOT EXISTS roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS training_matrix (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id UUID REFERENCES roles(id),
  course_id UUID REFERENCES training_courses(id),
  status training_status NOT NULL,
  requires_approval BOOLEAN DEFAULT FALSE,
  cost_cap NUMERIC(10,2),
  approver_chain JSONB
);

CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  session_id UUID REFERENCES training_sessions(id),
  status booking_status NOT NULL,
  price_locked NUMERIC(10,2),
  funding_source TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID REFERENCES bookings(id),
  step INT,
  approver_role TEXT,
  state approval_state NOT NULL DEFAULT 'PENDING',
  decided_at TIMESTAMPTZ,
  comment TEXT
);
