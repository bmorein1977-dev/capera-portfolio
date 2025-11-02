-- Migration Script: Add Competency Levels for Elements with Multiple Proficiency Levels
-- This consolidates duplicate element records into a single element with multiple levels

-- Example: For "Safety Instrumented System Honeywell C300" which appears 5 times with different codes
-- We'll create one master element and add Basic/Intermediate/Advanced levels

-- First, let's identify elements that should have levels (those with proficiency_scheme > 1)
-- For now, we'll manually create levels for a test element

-- Insert Basic, Intermediate, and Advanced levels for an element
-- Replace 'ELEMENT_ID_HERE' with actual element ID

INSERT INTO competency_levels (element_id, name, code, description, "order", is_active)
VALUES 
  ('13369566-44f5-4997-8e15-d4c17d9e88b5', 'Basic', 'B', 'Basic level proficiency', 0, true),
  ('13369566-44f5-4997-8e15-d4c17d9e88b5', 'Intermediate', 'I', 'Intermediate level proficiency', 1, true),
  ('13369566-44f5-4997-8e15-d4c17d9e88b5', 'Advanced', 'A', 'Advanced level proficiency', 2, true);

-- Verify the levels were created
SELECT 
  e.name as element_name,
  e.code as element_code,
  l.name as level_name,
  l.code as level_code,
  l."order"
FROM competency_levels l
JOIN competency_elements e ON l.element_id = e.id
WHERE e.id = '13369566-44f5-4997-8e15-d4c17d9e88b5'
ORDER BY l."order";
