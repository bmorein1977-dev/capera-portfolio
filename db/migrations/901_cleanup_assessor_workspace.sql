-- Migration 901: Cleanup Assessor Workspace Ghost Candidates
-- This removes orphaned allocations and assessments where users no longer exist

-- 1. Delete candidate_allocations where candidate doesn't exist in users
DELETE FROM candidate_allocations
WHERE candidate_id NOT IN (SELECT id FROM users WHERE is_archived = false);

-- 2. Delete candidate_allocations where assessor doesn't exist in users
DELETE FROM candidate_allocations
WHERE assessor_id NOT IN (SELECT id FROM users WHERE is_archived = false);

-- 3. Delete assessments where candidate doesn't exist or is archived
DELETE FROM assessments
WHERE candidate_id NOT IN (SELECT id FROM users WHERE is_archived = false);

-- 4. Delete assessments where assessor doesn't exist or is archived
DELETE FROM assessments
WHERE assessor_id NOT IN (SELECT id FROM users WHERE is_archived = false);

-- Optional: Archive seed/demo users if they exist (uncomment if needed)
-- UPDATE users SET is_archived = true WHERE email IN ('emma.wilson@example.com', 'alex.thompson@example.com');
