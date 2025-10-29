import { pool } from '../db.js';

async function main() {
  const prov = await pool.query(`INSERT INTO providers (name) VALUES ('Internal L&D'), ('Global Training Co.') RETURNING *`);

  const venues = await pool.query(`INSERT INTO venues (name, city, country, lat, lon) VALUES
    ('Madrid Training Center','Madrid','Spain',40.4168,-3.7038),
    ('Aberdeen Hub','Aberdeen','UK',57.1497,-2.0943),
    ('Lisbon Academy','Lisbon','Portugal',38.7223,-9.1393)
    RETURNING *`);

  const courses = await pool.query(`INSERT INTO training_courses (title, description, modality, duration_hours, cost, provider_id, language, tags)
    VALUES
    ('HUET','Helicopter Underwater Escape Training','in-person',8,650, $1, 'en', ARRAY['huet','safety']),
    ('H2S Awareness','Hydrogen Sulfide safety basics','virtual',4,150, $1, 'en', ARRAY['h2s','safety']),
    ('Rigging & Lifting Level 1','Foundational rigging skills','in-person',8,400, $2, 'en', ARRAY['rigging','lifting']),
    ('Work at Height','Fall protection and rescue','in-person',8,300, $2, 'en', ARRAY['work-at-height','safety'])
    RETURNING *`, [prov.rows[0].id, prov.rows[1].id]);

  await pool.query(`INSERT INTO training_sessions (course_id, start_at, end_at, timezone, capacity, seats_remaining, venue_id, language, instructor, status) VALUES
    ($1, NOW() + interval '7 days', NOW() + interval '7 days 8 hours', 'Europe/Madrid', 12, 8, $4, 'en', 'A. Smith', 'OPEN'),
    ($1, NOW() + interval '20 days', NOW() + interval '20 days 8 hours', 'Europe/Madrid', 12, 12, $5, 'en', 'B. Jones', 'OPEN'),
    ($2, NOW() + interval '10 days', NOW() + interval '10 days 4 hours', 'Europe/London', 20, 5, $4, 'en', 'C. Lee', 'OPEN'),
    ($3, NOW() + interval '15 days', NOW() + interval '15 days 8 hours', 'Europe/London', 10, 2, $6, 'en', 'D. Patel', 'OPEN'),
    ($4, NOW() + interval '9 days', NOW() + interval '9 days 8 hours', 'Europe/Lisbon', 10, 6, $6, 'en', 'E. Gomez', 'OPEN')
  `, [courses.rows[0].id, courses.rows[1].id, courses.rows[2].id, venues.rows[0].id, venues.rows[1].id, venues.rows[2].id]);

  const roles = await pool.query(`INSERT INTO roles (name) VALUES ('Offshore Tech'), ('Production Operator') RETURNING *`);
  await pool.query(`INSERT INTO training_matrix (role_id, course_id, status, requires_approval, cost_cap, approver_chain) VALUES
    ($1, $2, 'MANDATORY', false, 800, '["Manager"]'::jsonb),
    ($1, $3, 'OPTIONAL', true, 500, '["Manager","L&D"]'::jsonb),
    ($2, $2, 'MANDATORY', false, 800, '[]'::jsonb),
    ($2, $4, 'OPTIONAL', true, 400, '["Manager"]'::jsonb)
  `, [roles.rows[0].id, courses.rows[0].id, courses.rows[2].id, courses.rows[1].id, courses.rows[3].id]);

  console.log('Seed complete.');
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
