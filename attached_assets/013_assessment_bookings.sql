-- 013_assessment_bookings.sql
-- Purpose: Simple booking system to schedule assessments and notify participants.

CREATE TABLE IF NOT EXISTS assessment_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assessor_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  element_id uuid REFERENCES elements(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  location text,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','cancelled','completed')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Optional: outbound email log table (for auditing)
CREATE TABLE IF NOT EXISTS outbound_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid REFERENCES assessment_bookings(id) ON DELETE CASCADE,
  to_email text NOT NULL,
  subject text NOT NULL,
  body text NOT NULL,
  sent_at timestamptz DEFAULT now(),
  provider_message_id text
);
