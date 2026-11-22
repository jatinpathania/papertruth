
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { api } from '../api/client.js';
import { useAsync } from '../api/useAsync.js';
import { useAuth } from '../context/AuthContext.jsx';
import {
  Bleed,
  AnimatedNumber,
  Badge,
  ErrorNote,
  Page,
  Ring,
  Section,
  Spinner,
  StatusBadge,
  Tilt,
  formatDate
} from '../components/ui.jsx';
import { staggerContainer, staggerItem } from '../components/motion.js';


export default function ExamList() {
  const { isAdmin } = useAuth();
  const { data, error, loading, reload } = useAsync(() => api.exams(), []);

  if (loading) return <Spinner label="Loading exams…" />;

  const exams = data?.exams || [];
  const openNow = exams.filter((exam) => exam.acceptingSubmissions).length;
  const answersCollected = exams.reduce((sum, exam) => sum + (exam.submissionCount || 0), 0);
  const questionsCovered = exams.reduce((sum, exam) => sum + (exam.questionCount || 0), 0);
  const mine = exams.filter((exam) => exam.hasSubmitted).length;

  const tiles = [
    { icon: '📝', value: exams.length, label: 'Exams on PaperTruth', accent: 'var(--brand)' },
    { icon: '👥', value: answersCollected, label: 'Answer sheets pooled', accent: 'var(--accent)' },
    { icon: '❓', value: questionsCovered, label: 'Questions covered', accent: 'var(--method-sp)' },
    { icon: '✅', value: mine, label: 'You have submitted', accent: 'var(--ok)' }
  ];

  return (
    <Page className="p-exams">
      <header className="page-head">
        <span className="section-kicker">Your papers</span>
        <h1>Exams</h1>
        {isAdmin && (
          <div className="hero-actions mt-2">
            <Link className="btn primary" to="/admin/exams/new">
              + New exam
            </Link>
          </div>
        )}
      </header>

      <Bleed cut className="stat-bleed">
      <motion.div className="stat-strip" initial="initial" animate="animate" variants={staggerContainer.variants}>
        {tiles.map((tile) => (
          <Tilt key={tile.label} className="stat-tile" variants={staggerItem} style={{ '--tile-accent': tile.accent }}>
            <span className="stat-tile-icon" aria-hidden="true">
              {tile.icon}
            </span>
            <span className="stat-tile-value">
              <AnimatedNumber value={tile.value} />
            </span>
            <span className="stat-tile-label">{tile.label}</span>
          </Tilt>
        ))}
      </motion.div>
      </Bleed>

      <ErrorNote error={error} onRetry={reload} />

      <Section
        id="exams"
        align="left"
        variant="wipeSide"
        kicker="Available"
        title="Pick an exam"
        lead="Open ones are still collecting answers. Closed ones already have a key you can score yourself against."
      >
        {exams.length === 0 && !error && (
          <div className="empty">
            No exams yet.
            {isAdmin ? (
              <>
                {' '}
                <Link to="/admin/exams/new">Create one</Link>, or run <code>npm run simulate</code> in{' '}
                <code>server/</code> to seed a 150-respondent demo.
              </>
            ) : (
              ' Ask the exam cell to open one.'
            )}
          </div>
        )}

        <motion.div
          className="grid cols-2"
          initial="initial"
          whileInView="animate"
          viewport={{ once: true, margin: '-60px' }}
          variants={staggerContainer.variants}
        >
          {exams.map((exam) => {
            const peak = Math.max(...exams.map((e) => e.submissionCount || 0), 1);
            const participation = (exam.submissionCount || 0) / peak;
            return (
              <Tilt as="article" key={exam.id} className="exam-card" max={6} variants={staggerItem}>
                <div className="exam-card-top">
                  <span className="exam-code">{exam.courseCode}</span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <h3>{exam.title}</h3>
                    <p className="exam-sub">{exam.subject}</p>
                  </div>
                  <StatusBadge exam={exam} />
                </div>

                <div className="exam-facts">
                  <div className="exam-fact">
                    <b>
                      <AnimatedNumber value={exam.questionCount} />
                    </b>
                    <span>Questions</span>
                  </div>
                  <div className="exam-fact">
                    <b>
                      <AnimatedNumber value={exam.submissionCount} />
                    </b>
                    <span>Sheets in</span>
                  </div>
                  <div className="exam-fact">
                    <b>
                      +{exam.markingScheme.correctMarks}
                      {exam.markingScheme.negativeMarks > 0 ? `/−${exam.markingScheme.negativeMarks}` : ''}
                    </b>
                    <span>Marking</span>
                  </div>
                </div>

                <div className="row" style={{ gap: 14 }}>
                  <Ring value={participation} size={52} color="var(--brand)" label={`${exam.submissionCount}`} fontSize="0.74rem" />
                  <div className="small muted" style={{ flex: 1, minWidth: 0 }}>
                    <div>
                      {exam.hasSubmitted ? 'Your sheet is in the pool.' : 'Your sheet is not in yet.'}
                    </div>
                    <div className="tiny">closes {formatDate(exam.closesAt)}</div>
                  </div>
                </div>

                <div className="row" style={{ gap: 6 }}>
                  {exam.hasSubmitted && <Badge tone="ok">✓ Submitted</Badge>}
                  {exam.collectPredictions && <Badge tone="info">Asks what others picked</Badge>}
                  {exam.isSimulated && <Badge tone="neutral">Demo cohort</Badge>}
                </div>

                <div className="exam-actions">
                  {!exam.hasSubmitted && exam.acceptingSubmissions ? (
                    <Link className="btn primary" to={`/exams/${exam.id}/submit`}>
                      Add my answers <span className="arrow">→</span>
                    </Link>
                  ) : null}
                  <Link className="btn" to={`/exams/${exam.id}/results`}>
                    📊 My results
                  </Link>
                  <Link className="btn" to={`/exams/${exam.id}/disputes`}>
                    ⚡ Disputed
                  </Link>
                  {isAdmin && (
                    <>
                      <Link className="btn" to={`/admin/exams/${exam.id}/monitor`}>
                        Live monitor
                      </Link>
                      <Link className="btn" to={`/admin/exams/${exam.id}/analytics`}>
                        Analytics
                      </Link>
                    </>
                  )}
                </div>
              </Tilt>
            );
          })}
        </motion.div>
      </Section>

    </Page>
  );
}
