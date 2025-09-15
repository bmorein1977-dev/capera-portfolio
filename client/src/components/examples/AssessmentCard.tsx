import AssessmentCard from '../AssessmentCard';

const mockAssessment = {
  id: '1',
  title: 'Equipment Safety Assessment',
  type: 'practical' as const,
  status: 'pending' as const,
  candidate: {
    name: 'Emma Wilson',
    avatar: '',
    role: 'Production Operator',
  },
  assessor: {
    name: 'David Kim',
    avatar: '',
  },
  dueDate: '2024-02-15',
  skills: ['Safety Procedures', 'Equipment Operation', 'Emergency Response'],
  isSafetyCritical: true,
  description: 'Comprehensive assessment of safety procedures and emergency response protocols for equipment operation.',
};

export default function AssessmentCardExample() {
  return <AssessmentCard assessment={mockAssessment} />;
}