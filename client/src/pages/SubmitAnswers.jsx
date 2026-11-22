import { lazy, Suspense, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { api } from '../api/client.js';
import { useAsync } from '../api/useAsync.js';
import { Badge, ErrorNote, Page, Ring, Spinner, StatusBadge } from '../components/ui.jsx';
import { staggerContainer, staggerItem } from '../components/motion.js';
import ExamTabs from '../components/ExamTabs.jsx';


const CONFIDENCE_LABELS = {
  0: 'not set',
  1: '1 — guessing',
  2: '2 — unsure',
  3: '3 — fairly sure',
  4: '4 — confident',
  5: '5 — certain'
};

export default function SubmitAnswers() {
  const { examId } = useParams();
  const navigate = useNavigate();
  const { data, error, loading } = useAsync(() => api.exam(examId), [examId]);

  const [answers, setAnswers] = useState({});
  const [predictions, setPredictions] = useState({});
  const [confidences, setConfidences] = useState({});
  const [submitError, setSubmitError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [showPredictions, setShowPredictions] = useState(true);

  const exam = data?.exam;
  const questions = data?.questions || [];
  const answeredCount = Object.values(answers).filter(Boolean).length;
  const predictedCount = Object.values(predictions).filter(Boolean).length;

  const progress = useMemo(
    () => (questions.length ? Math.round((answeredCount / questions.length) * 100) : 0),
    [answeredCount, questions.length]
  );

  if (loading) return <Spinner label="Loading the paper…" />;
  if (error) return <Page><ErrorNote error={error} /></Page>;

  if (data?.hasSubmitted) {
    return (
      <Page>
        <StatePanel
          icon="✅"
          tone="ok"
          title="Your sheet is already in"
          body="One submission per student keeps things fair — everyone gets exactly one say. Your answers are already shaping the class key."
        >
          <Link className="btn primary lg" to={`/exams/${examId}/results`}>
            See my estimated score <span className="arrow">→</span>
          </Link>
          <Link className="btn lg" to={`/exams/${examId}/disputes`}>
            ⚡ Disputed questions
          </Link>
        </StatePanel>
      </Page>
    );
  }

  if (!exam?.acceptingSubmissions) {
    return (
      <Page>
        <StatePanel
          icon="🔒"
          tone="warn"
          title="The submission window is closed"
          body="This exam is no longer accepting answers. You can still see the key and the questions the class is arguing about."
        >
          <Link className="btn primary lg" to={`/exams/${examId}/results`}>
            See the results <span className="arrow">→</span>
          </Link>
          <Link className="btn lg" to="/exams">
            ← Back to exams
          </Link>
        </StatePanel>
      </Page>
    );
  }

  const submit = async (event) => {
    event.preventDefault();
    setSubmitError(null);
    setBusy(true);
    try {
      const payload = questions
        .filter((q) => answers[q.number])
        .map((q) => ({
          questionNumber: q.number,
          answer: answers[q.number],
          predictedMajority: exam.collectPredictions ? predictions[q.number] : undefined,
          confidence: confidences[q.number] || undefined
        }));
      if (payload.length === 0) {
        setSubmitError(new Error('Answer at least one question before submitting.'));
        setBusy(false);
        return;
      }
      await api.submit(examId, payload);
      navigate(`/exams/${examId}/results`, { replace: true, state: { justSubmitted: true, answered: payload.length } });
    } catch (caught) {
      setSubmitError(caught);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Page>
      <ExamTabs examId={examId} />
      <div className="hero-banner submit-hero">
        <div className="hero-content">
          <span className="eyebrow">{exam.courseCode} · answer sheet</span>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <h1 className="mb-0">{exam.title}</h1>
            <StatusBadge exam={exam} />
          </div>
          <p className="lede mb-0">
            Fill in what you remember — it's fine to skip questions. A blank helps more
            than a guess: guesses just add noise for everyone else's answers to work
            through.
          </p>

          <div className="mt-2">
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <span className="small strong">
                {answeredCount} of {questions.length} answered
              </span>
              <span className="small muted">{progress}%</span>
            </div>
            <div className="progress-track mt-1">
              <motion.div
                className="progress-fill"
                initial={false}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              />
            </div>
          </div>
        </div>
      </div>

      {exam.collectPredictions && (
        <div className="notice mt-2">
          <strong>This exam also asks what you think most people picked.</strong> That
          helps catch cases where the popular answer is actually wrong — even a
          well-informed few can end up being right.
          <div className="row mt-1">
            <button type="button" className="small" onClick={() => setShowPredictions((v) => !v)}>
              {showPredictions ? 'Hide the prediction inputs' : 'Show the prediction inputs'}
            </button>
          </div>
        </div>
      )}

      <form onSubmit={submit}>
        <section className="qmap glass mt-2" aria-label="Question map">
          <div className="row between">
            <div>
              <h3 className="card-title">Question map</h3>
              <p className="card-sub">Tap a number to jump to it. Filled ones are answered.</p>
            </div>
            <span className="tiny muted">
              <span className="qmap-key answered" /> answered <span className="qmap-key" /> blank
            </span>
          </div>
          <div className="qmap-grid">
            {questions.map((question) => {
              const done = Boolean(answers[question.number]);
              return (
                <a
                  key={question.number}
                  href={`#q-${question.number}`}
                  className={`qmap-cell${done ? ' answered' : ''}`}
                  aria-label={`Question ${question.number}${done ? ', answered ' + answers[question.number] : ', blank'}`}
                >
                  {question.number}
                  {done && <span className="qmap-pick">{String(answers[question.number]).slice(0, 2)}</span>}
                </a>
              );
            })}
          </div>
        </section>

        <motion.div
          className="grid cols-2 mt-2"
          initial="initial"
          animate="animate"
          variants={staggerContainer.variants}
        >
          {questions.map((question) => {
            const options = question.options?.length ? question.options : ['A', 'B', 'C', 'D'];
            const answered = Boolean(answers[question.number]);
            return (
              <motion.div
                key={question.number}
                id={`q-${question.number}`}
                className={`qcard${answered ? ' answered' : ''}`}
                variants={staggerItem}
              >
                <div className="qcard-head">
                  <span className="qnum">Q{question.number}</span>
                  {question.topic && <Badge tone="neutral">{question.topic}</Badge>}
                  {answered && (
                    <button
                      type="button"
                      className="small subtle"
                      style={{ marginLeft: 'auto' }}
                      onClick={() => {
                        const next = { ...answers };
                        delete next[question.number];
                        setAnswers(next);
                      }}
                    >
                      Clear
                    </button>
                  )}
                </div>
                {question.text && <p className="qtext">{question.text}</p>}

                {question.type === 'SHORT' ? (
                  <input
                    aria-label={`Your answer to question ${question.number}`}
                    placeholder="Type what you answered"
                    value={answers[question.number] || ''}
                    onChange={(event) =>
                      setAnswers({ ...answers, [question.number]: event.target.value })
                    }
                  />
                ) : (
                  <div className="options" role="group" aria-label={`Your answer to question ${question.number}`}>
                    {options.map((option) => (
                      <button
                        key={option}
                        type="button"
                        className="option"
                        aria-pressed={answers[question.number] === option}
                        onClick={() =>
                          setAnswers({
                            ...answers,
                            [question.number]: answers[question.number] === option ? '' : option
                          })
                        }
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                )}

                {exam.collectPredictions && showPredictions && question.type !== 'SHORT' && (
                  <>
                    <p className="sub-label">Which option do you think most people chose?</p>
                    <div
                      className="options"
                      role="group"
                      aria-label={`Predicted popular answer for question ${question.number}`}
                    >
                      {options.map((option) => (
                        <button
                          key={option}
                          type="button"
                          className="option prediction"
                          aria-pressed={predictions[question.number] === option}
                          onClick={() =>
                            setPredictions({
                              ...predictions,
                              [question.number]:
                                predictions[question.number] === option ? '' : option
                            })
                          }
                        >
                          {option}
                        </button>
                      ))}
                    </div>
                  </>
                )}

                <p className="sub-label">How sure are you? (optional)</p>
                <div className="slider-row">
                  <input
                    type="range"
                    min="0"
                    max="5"
                    step="1"
                    aria-label={`Confidence for question ${question.number}`}
                    value={confidences[question.number] || 0}
                    style={{ '--fill': `${((confidences[question.number] || 0) / 5) * 100}%` }}
                    onChange={(event) =>
                      setConfidences({ ...confidences, [question.number]: Number(event.target.value) })
                    }
                  />
                  <span className="slider-value">
                    {CONFIDENCE_LABELS[confidences[question.number] || 0]}
                  </span>
                </div>
              </motion.div>
            );
          })}
        </motion.div>

        <div className="sticky-actions">
          <Ring value={questions.length ? answeredCount / questions.length : 0} size={46} stroke={4} fontSize="0.7rem" />
          <div>
            <strong>
              {answeredCount} of {questions.length}
            </strong>{' '}
            answered <span className="muted small">({progress}%)</span>
            {exam.collectPredictions && (
              <span className="muted small"> · {predictedCount} predictions</span>
            )}
          </div>
          <div className="spacer" />
          {submitError && <ErrorNote error={submitError} />}
          <button className="primary lg" type="submit" disabled={busy || answeredCount === 0}>
            {busy ? (
              <>
                <span className="spinner" /> Submitting…
              </>
            ) : (
              <>
                Submit my answers <span className="arrow">→</span>
              </>
            )}
          </button>
        </div>
      </form>
    </Page>
  );
}

function StatePanel({ icon, tone, title, body, children }) {
  return (
    <motion.section
      className={`state-panel glass ${tone}`}
      initial={{ opacity: 0, y: 30, rotateX: -12, transformPerspective: 1000 }}
      animate={{ opacity: 1, y: 0, rotateX: 0 }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
    >
      <motion.span
        className="state-icon"
        aria-hidden="true"
        initial={{ scale: 0, rotate: -40 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 14, delay: 0.25 }}
      >
        {icon}
      </motion.span>
      <h1>{title}</h1>
      <p className="hero-lede">{body}</p>
      <div className="hero-actions">{children}</div>
    </motion.section>
  );
}
