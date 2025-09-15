import SkillCard from '../SkillCard';

const mockSkill = {
  id: '1',
  name: 'Equipment Operation',
  category: 'Technical',
  level: 'advanced' as const,
  status: 'in_progress' as const,
  progress: 75,
  expiryDate: '2025-01-15',
  lastAssessed: '2024-01-15',
  assessor: 'David Kim',
  description: 'Advanced machinery operation including setup, calibration, and troubleshooting of complex manufacturing equipment.',
  isSafetyCritical: true,
};

export default function SkillCardExample() {
  return <SkillCard skill={mockSkill} />;
}