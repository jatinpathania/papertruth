import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAsync } from '../api/useAsync.js';
import { Page, Reveal, Section, ErrorNote, Spinner, Badge, StatusBadge, formatDate } from '../components/ui.jsx';

export default function Results() {
  const { data, loading, error, reload } = useAsync(() => api.exams(), []);
  const exams = data?.exams || data || [];
  const submitted = exams.filter((exam) => exam.hasSubmitted);
  const waiting = exams.filter((exam) => !exam.hasSubmitted);

  if (loading) return <Spinner label="Loading your results…" />;

  return (
    <Page className="p-results">
      <header className="page-head">
        <span className="section-kicker">Results</span>
        <h1>Your exam results</h1>
        <p className="lede">
          Every paper you have added your recollections to. Contested questions are left
          out of the score, so what you see is a range, not a guess.
        </p>
      </header>

      <ErrorNote error={error} onRetry={reload} />

      <Section
        align="left"
        variant="wipeSide"
        kicker="Submitted"
        title="Papers you are part of"
        lead="Open one to see the class's answer key next to what you wrote."
      >
        {submitted.length === 0 ? (
          <div className="empty">
            You have not submitted to any exam yet.{' '}
            <Link to="/exams">Pick an exam</Link> and add what you remember — your sheet
            sharpens the key for everyone.
          </div>
        ) : (
          <div className="results-list">
            {submitted.map((exam, index) => (
              <Reveal
                key={exam.id}
                delay={Math.min(index, 6) * 0.06}
                variant={index % 2 ? 'slideRight' : 'slideLeft'}
              >
                <Link className="results-row" to={`/exams/${exam.id}/results`}>
                  <span className="results-code">{exam.courseCode}</span>
                  <div className="results-row-body">
                    <h3>{exam.title}</h3>
                    <p className="tiny muted">
                      {exam.subject} · {exam.questionCount} questions · {exam.submissionCount} sheets in
                    </p>
                  </div>
                  <div className="results-row-side">
                    <StatusBadge exam={exam} />
                    <span className="results-go" aria-hidden="true">→</span>
                  </div>
                </Link>
              </Reveal>
            ))}
          </div>
        )}
      </Section>

      {waiting.length > 0 && (
        <Section
          align="right"
          variant="settle"
          kicker="Not yet"
          title="Papers still waiting for your sheet"
          lead="No results until your answers are in — and the key is better with them."
        >
          <div className="results-list">
            {waiting.map((exam, index) => (
              <Reveal key={exam.id} delay={Math.min(index, 6) * 0.05} variant="rise">
                <Link className="results-row results-row--muted" to={`/exams/${exam.id}/submit`}>
                  <span className="results-code">{exam.courseCode}</span>
                  <div className="results-row-body">
                    <h3>{exam.title}</h3>
                    <p className="tiny muted">closes {formatDate(exam.closesAt)}</p>
                  </div>
                  <div className="results-row-side">
                    <Badge tone="neutral">Add your answers</Badge>
                    <span className="results-go" aria-hidden="true">→</span>
                  </div>
                </Link>
              </Reveal>
            ))}
          </div>
        </Section>
      )}
    </Page>
  );
}
