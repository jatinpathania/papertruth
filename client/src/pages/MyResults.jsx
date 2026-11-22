import { lazy, Suspense, useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import Confetti from '../components/Confetti.jsx';
import { api } from '../api/client.js';
import { useAsync } from '../api/useAsync.js';
import { TopicPerformanceChart } from '../components/charts/index.jsx';
import {
  AnimatedNumber,
  Badge,
  Card,
  Disclosure,
  ErrorNote,
  MethodPicker,
  MethodTag,
  OutcomeBadge,
  OutcomeGrid,
  Page,
  Reveal,
  Ring,
  ScoreGauge,
  Section,
  Spinner,
  Tilt,
  formatNumber,
  percentText
} from '../components/ui.jsx';
import { staggerContainer, staggerItem } from '../components/motion.js';
import ExamTabs from '../components/ExamTabs.jsx';


const STUDENT_METHOD_LABELS = {
  WEIGHTED_EM: 'Balanced (recommended)',
  MAJORITY: 'Simple majority',
  SURPRISINGLY_POPULAR: 'Popularity-aware'
};

export default function MyResults() {
  const { examId } = useParams();
  const [method, setMethod] = useState('WEIGHTED_EM');
  const [filter, setFilter] = useState('ALL');
  const [selectedQ, setSelectedQ] = useState(null);
  const location = useLocation();
  const [celebrate] = useState(() => Boolean(location.state?.justSubmitted));
  const [toast, setToast] = useState(celebrate);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(false), 5200);
    return () => clearTimeout(timer);
  }, [toast]);

  const { data, error, loading, reload } = useAsync(() => api.myResults(examId, method), [examId, method]);
  const comparison = useAsync(() => api.myResultsCompare(examId), [examId]);

  if (loading) return <Spinner label="Scoring your answers…" />;

  if (error) {
    return (
      <Page className="p-results">
        <ErrorNote error={error} onRetry={reload} />
        <div className="row mt-2">
          <Link className="btn" to="/exams">
            Back to exams
          </Link>
          <Link className="btn" to={`/exams/${examId}/submit`}>
            Submit answers
          </Link>
        </div>
      </Page>
    );
  }

  const perQuestion = data.perQuestion || [];
  const rows = perQuestion.filter((row) => {
    if (filter === 'WRONG') return row.outcome === 'INCORRECT';
    if (filter === 'DISPUTED') return row.outcome === 'DISPUTED';
    if (filter === 'CORRECT') return row.outcome === 'CORRECT';
    return true;
  });

  const weakestTopics = (data.topicBreakdown || [])
    .filter((topic) => topic.correct + topic.incorrect > 0)
    .sort((a, b) => a.accuracy - b.accuracy)
    .slice(0, 3);

  const scored = data.correct + data.incorrect;
  const tiles = [
    { icon: '✅', value: data.correct, label: 'Matched the class', accent: 'var(--ok)' },
    { icon: '❌', value: data.incorrect, label: 'Went the other way', accent: 'var(--danger)' },
    { icon: '⚡', value: data.disputed, label: 'Too close to call', accent: 'var(--warn)' },
    { icon: '🎯', value: scored > 0 ? Math.round((data.correct / scored) * 100) : 0, label: 'Hit rate', accent: 'var(--brand)', suffix: '%' }
  ];

  return (
    <Page className="p-results">
      <ExamTabs examId={examId} />
      {celebrate && <Confetti />}
      <AnimatePresence>
        {toast && (
          <motion.div
            className="toast"
            role="status"
            initial={{ opacity: 0, y: 40, x: '-50%', scale: 0.9 }}
            animate={{ opacity: 1, y: 0, x: '-50%', scale: 1 }}
            exit={{ opacity: 0, y: 30, x: '-50%', scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 320, damping: 26 }}
          >
            <span className="toast-icon" aria-hidden="true">
              🎉
            </span>
            <span>
              <strong>Your sheet is in the pool.</strong>{' '}
              <span className="muted">Here's where you stand right now.</span>
            </span>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="page-head">
        <div>
          <span className="eyebrow">Your results</span>
          <h1>My estimated score</h1>
          <p className="lede">{data.exam.title}</p>
        </div>
        <MethodPicker
          value={method}
          methods={['WEIGHTED_EM', 'MAJORITY', 'SURPRISINGLY_POPULAR']}
          onChange={setMethod}
          label="Scoring method"
          labels={STUDENT_METHOD_LABELS}
        />
      </div>

      <motion.div initial="initial" animate="animate" variants={staggerContainer.variants}>
        <motion.div variants={staggerItem}>
          <Card className="score-hero" animated>
            <ScoreGauge value={data.score} max={data.scoredMax} size={168} stroke={12} label="Your score" />
            <p className="score-summary">
              You got <strong>{data.correct}</strong> right and <strong>{data.incorrect}</strong> wrong out
              of {data.correct + data.incorrect} scored questions
              {data.disputed > 0 && (
                <>
                  {' '}
                  — <strong>{data.disputed}</strong> more were too close to call, so they weren't scored
                  either way.
                </>
              )}
            </p>
          </Card>
        </motion.div>

        <motion.div variants={staggerItem} className="stat-strip stat-strip--varied mt-3">
          {tiles.map((tile, index) => (
            <Tilt
              key={tile.label}
              className={`stat-tile stat-tile--v${index % 4}`}
              style={{ '--tile-accent': tile.accent }}
            >
              <span className="stat-tile-icon" aria-hidden="true">
                {tile.icon}
              </span>
              <span className="stat-tile-value">
                <AnimatedNumber value={tile.value} suffix={tile.suffix || ''} />
              </span>
              <span className="stat-tile-label">{tile.label}</span>
            </Tilt>
          ))}
        </motion.div>

        {data.disputed > 0 && (
          <motion.div variants={staggerItem} className="notice warn">
            Your true score lies between <strong>{formatNumber(data.worstCase, 1)}</strong> and{' '}
            <strong>{formatNumber(data.bestCase, 1)}</strong>, depending on how those{' '}
            {data.disputed} contested question{data.disputed === 1 ? '' : 's'} eventually settle.
          </motion.div>
        )}

        <motion.div variants={staggerItem}>
          <Card className="mt-2" title="Tap a question to see it" subtitle="Every chip is one question, coloured by how your answer compares with the class key.">
            <OutcomeGrid rows={perQuestion} onSelect={(row) => setSelectedQ(row)} selected={selectedQ?.questionNumber} />
            <div className="outcome-legend">
              <span>
                <span className="dot" style={{ background: 'var(--ok)' }} /> matches the class
              </span>
              <span>
                <span className="dot" style={{ background: 'var(--danger)' }} /> differs
              </span>
              <span>
                <span className="dot" style={{ background: 'var(--warn)' }} /> too close to call
              </span>
              <span>
                <span className="dot" style={{ background: 'var(--text-muted)' }} /> not answered
              </span>
            </div>

            {selectedQ && (
              <motion.div
                className="qcard mt-2"
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
              >
                <div className="qcard-head">
                  <span className="qnum">Q{selectedQ.questionNumber}</span>
                  {selectedQ.topic && <Badge tone="neutral">{selectedQ.topic}</Badge>}
                  <OutcomeBadge outcome={selectedQ.outcome} />
                </div>
                <div className="row" style={{ gap: 20 }}>
                  <span className="small">
                    You said <span className="mono strong">{selectedQ.yourAnswer || '—'}</span>
                  </span>
                  <span className="small">
                    Class key <span className="mono strong">{selectedQ.consensusAnswer || '—'}</span>
                  </span>
                  <span className="small muted">{percentText(selectedQ.cohortShare, 0)} agreed with you</span>
                  <span className="small muted">
                    {selectedQ.marks === 0 ? '0' : formatNumber(selectedQ.marks, 1)} marks
                  </span>
                </div>
              </motion.div>
            )}
          </Card>
        </motion.div>

      </motion.div>

      {weakestTopics.length > 0 && (
        <Section
          align="left"
          variant="slideLeft"
          kicker="Revision list"
          title="Where you're losing the most marks"
          lead="Your three weakest topics on this paper, worst first. The ring is how much of each one you got right."
        >
          <div className="grid cols-3">
            {weakestTopics.map((topic, index) => {
              const accent = topic.accuracy >= 0.4 ? 'var(--warn)' : 'var(--danger)';
              return (
                <Reveal key={topic.topic} delay={index * 0.08} variant={index % 2 ? 'settle' : 'zoom'}>
                  <Tilt className="feature-card" style={{ '--tile-accent': accent }}>
                    <div className="row" style={{ gap: 14 }}>
                      <Ring value={topic.accuracy} size={64} stroke={6} color={accent} fontSize="0.86rem" />
                      <div style={{ minWidth: 0 }}>
                        <h3 style={{ marginBottom: 2 }}>{topic.topic}</h3>
                        <p>
                          {topic.correct} right · {topic.incorrect} wrong
                        </p>
                      </div>
                    </div>
                  </Tilt>
                </Reveal>
              );
            })}
          </div>
        </Section>
      )}

      <Disclosure summary="See the full breakdown — every method, every topic, every question">
        <div className="grid cols-2">
          <Card
            title="Accuracy by topic"
            subtitle="Counting only the questions that were actually scored."
          >
            <TopicPerformanceChart topics={data.topicBreakdown} />
          </Card>

          <Card
            title="Score under each method"
            subtitle="A large gap between methods means your paper had a lot of contested questions."
          >
            {comparison.loading && <Spinner label="Comparing…" />}
            {comparison.error && <ErrorNote error={comparison.error} />}
            {comparison.data && (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Method</th>
                      <th className="num">Score</th>
                      <th className="num">Right</th>
                      <th className="num">Wrong</th>
                      <th className="num">Disputed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(comparison.data.methods).map(([key, row]) => (
                      <tr key={key}>
                        <td>
                          <MethodTag method={key} short labels={STUDENT_METHOD_LABELS} />
                        </td>
                        <td className="num">
                          {formatNumber(row.score, 1)} / {formatNumber(row.scoredMax, 0)}
                        </td>
                        <td className="num">{row.correct}</td>
                        <td className="num">{row.incorrect}</td>
                        <td className="num">{row.disputed}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        <Card
          className="mt-3"
          title="Question by question"
          subtitle="Your answer against the class key, and the share of the class that agreed with you."
          actions={
            <div className="pill-row">
              {[
                ['ALL', `All ${data.totalQuestions}`],
                ['WRONG', `Differs ${data.incorrect}`],
                ['DISPUTED', `Disputed ${data.disputed}`],
                ['CORRECT', `Matches ${data.correct}`]
              ].map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  className={`small${filter === key ? ' primary' : ''}`}
                  onClick={() => setFilter(key)}
                >
                  {label}
                </button>
              ))}
            </div>
          }
        >
          <div className="table-wrap scroll-y">
            <table>
              <thead>
                <tr>
                  <th>Q</th>
                  <th>Topic</th>
                  <th>You</th>
                  <th>Class key</th>
                  <th className="num">Agreed with you</th>
                  <th className="num">Confidence</th>
                  <th>Status</th>
                  <th className="num">Marks</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.questionNumber}>
                    <td className="strong">{row.questionNumber}</td>
                    <td className="small muted">{row.topic}</td>
                    <td className="mono strong">{row.yourAnswer || '—'}</td>
                    <td className="mono">{row.consensusAnswer || '—'}</td>
                    <td className="num">{percentText(row.cohortShare, 0)}</td>
                    <td className="num">{percentText(row.confidence, 0)}</td>
                    <td>
                      <OutcomeBadge outcome={row.outcome} />
                    </td>
                    <td className="num">{row.marks === 0 ? '0' : formatNumber(row.marks, 1)}</td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={8} className="center muted">
                      Nothing in this category.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <p className="chart-note">
            Disputed rows are informational: the class's answers were too scattered for the
            key to be evidence either way.{' '}
            <Link to={`/exams/${examId}/disputes`}>Open the dispute threads</Link> to argue
            the case for a question.
          </p>
        </Card>
      </Disclosure>

      <Reveal className="mt-3" variant="wipe">
        <div className="cta-band">
          <div style={{ flex: 1, minWidth: 260 }}>
            <h2>
              {data.disputed > 0
                ? `${data.disputed} question${data.disputed === 1 ? '' : 's'} still up for debate`
                : 'Every question has a settled answer'}
            </h2>
            <p>
              {data.disputed > 0
                ? 'Those are not counted for or against you. Open them if you want to argue the case.'
                : 'Nothing on this paper was contested — the key here is as solid as the class can make it.'}
            </p>
          </div>
          <Link className="btn lg" to="/exams">
            ← All exams
          </Link>
          <Link className="btn primary lg" to={`/exams/${examId}/disputes`}>
            ⚡ Disputed questions <span className="arrow">→</span>
          </Link>
        </div>
      </Reveal>

      <p className="tiny muted mt-2 center">
        Key computed {new Date(data.computedAt).toLocaleString()}
        {data.disputed > 0 && <> · {data.disputed} unresolved</>}
      </p>
    </Page>
  );
}
