import { Link } from 'react-router-dom';
import { api } from '../../api/client.js';
import { useAsync } from '../../api/useAsync.js';
import { motion } from 'framer-motion';
import { Card, ErrorNote, Page, Spinner, StatusBadge, Tilt, formatDate } from '../../components/ui.jsx';
import { staggerContainer, staggerItem } from '../../components/motion.js';

const TOOLS = [
  { path: 'monitor', label: 'Live monitor', icon: '📡' },
  { path: 'analytics', label: 'Analytics', icon: '📊' },
  { path: 'validation', label: 'Official key', icon: '🗝️' },
  { path: 'integrity', label: 'Integrity', icon: '🛡️' }
];

export default function AdminHome() {
  const { data, error, loading, reload } = useAsync(() => api.exams(), []);

  if (loading) return <Spinner label="Loading exams…" />;

  return (
    <Page>
      <div className="page-head">
        <div>
          <span className="eyebrow">🛰️ Control room</span>
          <h1>Exam cell</h1>
          <p className="lede">
            Watch responses arrive, compute the consensus, compare the methods against an
            official key, and check the integrity report for correlated submissions.
          </p>
        </div>
        <Link className="btn primary lg" to="/admin/exams/new">
          ✨ New exam
        </Link>
      </div>

      <ErrorNote error={error} onRetry={reload} />

      <motion.div className="grid cols-2" initial="initial" animate="animate" variants={staggerContainer.variants}>
        {(data?.exams || []).map((exam) => (
          <Tilt key={exam.id} max={5} variants={staggerItem} style={{ height: '100%' }}>
          <Card
            className="admin-exam"
            title={exam.title}
            subtitle={`${exam.courseCode} · ${exam.submissionCount} submissions · closes ${formatDate(
              exam.closesAt
            )}`}
            actions={<StatusBadge exam={exam} />}
          >
            <div className="tool-grid">
              {TOOLS.map((tool) => (
                <Link key={tool.path} className="btn tool-btn" to={`/admin/exams/${exam.id}/${tool.path}`}>
                  <span className="tool-icon" aria-hidden="true">
                    {tool.icon}
                  </span>
                  {tool.label}
                </Link>
              ))}
            </div>
          </Card>
          </Tilt>
        ))}
        {(data?.exams || []).length === 0 && !error && (
          <div className="empty">
            No exams yet. Create one, or run <code>npm run simulate</code> in{' '}
            <code>server/</code> to seed a 150-respondent demo cohort with a known answer
            key.
          </div>
        )}
      </motion.div>
    </Page>
  );
}
