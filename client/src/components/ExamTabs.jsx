import { NavLink } from 'react-router-dom';

// Once you are inside an exam, these three views are the whole exam. Without a
// tab strip the discussion threads were only reachable from scattered links.
export default function ExamTabs({ examId, className = '' }) {
  if (!examId) return null;
  const tabs = [
    { to: `/exams/${examId}/submit`, label: 'Your answers', icon: '✍️' },
    { to: `/exams/${examId}/results`, label: 'Results', icon: '📊' },
    { to: `/exams/${examId}/disputes`, label: 'Discussion', icon: '💬' }
  ];

  return (
    <nav className={`exam-tabs ${className}`} aria-label="Exam sections">
      {tabs.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          className={({ isActive }) => `exam-tab${isActive ? ' active' : ''}`}
        >
          <span aria-hidden="true">{tab.icon}</span>
          {tab.label}
        </NavLink>
      ))}
    </nav>
  );
}
