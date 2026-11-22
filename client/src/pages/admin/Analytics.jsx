import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../api/client.js';
import { useAsync } from '../../api/useAsync.js';
import {
  AnswerDistributionChart,
  ConfidenceHistogram,
  DisputedQuestionsChart
} from '../../components/charts/index.jsx';
import {
  Page,
  Badge,
  Card,
  DisputeBadge,
  DistributionBars,
  ErrorNote,
  MethodPicker,
  MethodTag,
  Spinner,
  Stat,
  formatDate,
  formatNumber,
  percentText
} from '../../components/ui.jsx';

export default function Analytics() {
  const { examId } = useParams();
  const { data, error, loading, reload } = useAsync(() => api.consensus(examId), [examId]);
  const [method, setMethod] = useState('WEIGHTED_EM');
  const [selected, setSelected] = useState(null);
  const [computing, setComputing] = useState(false);

  const compute = async () => {
    setComputing(true);
    try {
      await api.compute(examId);
      reload();
    } finally {
      setComputing(false);
    }
  };

  if (loading) return <Spinner label="Loading the computed key…" />;
  if (error)
    return (
      <Page>
        <ErrorNote error={error} onRetry={reload} />
      </Page>
    );

  if (!data.computed) {
    return (
      <Page>
        <div className="page-head">
          <div>
            <span className="eyebrow">🛰️ Exam cell</span>
          <h1>Analytics</h1>
            <p className="lede">{data.exam.title}</p>
          </div>
        </div>
        <div className="notice warn">
          <strong>No consensus has been computed for this exam yet.</strong> Compute it once
          enough students have submitted.
        </div>
        <button className="primary mt-2" type="button" onClick={compute} disabled={computing}>
          {computing ? 'Computing…' : 'Compute consensus now'}
        </button>
      </Page>
    );
  }

  const methods = data.methods;
  const active = data.results[method] || data.results[methods[0]];
  const majority = data.results.MAJORITY;
  const summary = active.summary || {};

  return (
    <Page>
      <div className="page-head">
        <div>
          <span className="eyebrow">🛰️ Exam cell</span>
          <h1>Analytics</h1>
          <p className="lede">
            {data.exam.title} · key computed from <strong>{active.respondentCount}</strong>{' '}
            recollections on {formatDate(active.computedAt)}
            {active.method === 'WEIGHTED_EM' && (
              <>
                {' '}
                · EM {active.converged ? 'converged' : 'did not converge'} in{' '}
                {active.iterations} iteration{active.iterations === 1 ? '' : 's'}
              </>
            )}
            .
          </p>
        </div>
        <div className="row">
          <MethodPicker value={method} methods={methods} onChange={setMethod} />
          <button type="button" onClick={compute} disabled={computing}>
            {computing ? 'Recomputing…' : 'Recompute'}
          </button>
        </div>
      </div>

      <div className="grid cols-4">
        <Stat accent label="Respondents" value={active.respondentCount} hint="one submission each" />
        <Stat
          label="Mean confidence"
          value={percentText(summary.meanConfidence, 1)}
          hint="support for the winning answer"
        />
        <Stat
          label="Disputed"
          value={`${summary.disputedQuestions ?? 0} / ${summary.answeredQuestions ?? 0}`}
          hint={`${percentText(summary.disputedRate, 0)} of answered questions`}
        />
        <Stat
          label="Plurality overturned"
          value={summary.overturnedByWeighting ?? 0}
          hint="where this method disagrees with the mode"
        />
      </div>

      <div className="grid cols-2 mt-3">
        <Card
          title="Confidence distribution"
          subtitle="One bar per confidence band, counting questions. A left-heavy chart means the cohort was too small or the paper too hard to recall."
        >
          <ConfidenceHistogram histogram={summary.confidenceHistogram || []} />
        </Card>

        <Card
          title="Most contested questions"
          subtitle="Normalised entropy over the raw answer distribution — method-independent, because it describes the cohort, not the algorithm."
        >
          <DisputedQuestionsChart
            questions={[...active.perQuestion]
              .sort((a, b) => b.normalisedEntropy - a.normalisedEntropy)
              .slice(0, 10)}
            onSelect={setSelected}
            threshold={data.exam.disputeThreshold}
          />
        </Card>
      </div>

      <OverturnedTable results={data.results} onSelect={setSelected} />

      <div className="grid cols-2 mt-3">
        <Card title="Full answer key" className="pad-0">
          <div className="table-wrap scroll-y">
            <table>
              <thead>
                <tr>
                  <th>Q</th>
                  <th>Topic</th>
                  <th>Answer</th>
                  <th className="num">Confidence</th>
                  <th className="num">Entropy</th>
                  <th>State</th>
                </tr>
              </thead>
              <tbody>
                {active.perQuestion.map((row) => (
                  <tr
                    key={row.questionNumber}
                    onClick={() => setSelected(row.questionNumber)}
                    style={{
                      cursor: 'pointer',
                      background: selected === row.questionNumber ? 'var(--brand-soft)' : undefined
                    }}
                  >
                    <td className="strong">{row.questionNumber}</td>
                    <td className="small muted">{row.topic}</td>
                    <td className="mono strong">
                      {row.consensusAnswer || '—'}
                      {row.overturnsMajority && ' *'}
                    </td>
                    <td className="num">{percentText(row.confidence, 0)}</td>
                    <td className="num">{formatNumber(row.normalisedEntropy, 2)}</td>
                    <td>
                      <DisputeBadge question={row} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="chart-note" style={{ padding: '0 16px 14px' }}>
            An asterisk marks an answer that differs from the plain plurality vote.
          </p>
        </Card>

        <QuestionPanel
          examId={examId}
          questionNumber={selected}
          perQuestion={active.perQuestion}
          majorityPerQuestion={majority?.perQuestion}
        />
      </div>

      <WeightPanel examId={examId} method={method} />

      <div className="row mt-3">
        <Link className="btn" to={`/admin/exams/${examId}/validation`}>
          Compare against the official key →
        </Link>
        <Link className="btn" to={`/admin/exams/${examId}/integrity`}>
          Integrity report
        </Link>
      </div>
    </Page>
  );
}

function OverturnedTable({ results, onSelect }) {
  const rows = useMemo(() => {
    const majority = new Map(
      (results.MAJORITY?.perQuestion || []).map((q) => [q.questionNumber, q])
    );
    const em = results.WEIGHTED_EM?.perQuestion || [];
    const sp = new Map(
      (results.SURPRISINGLY_POPULAR?.perQuestion || []).map((q) => [q.questionNumber, q])
    );
    return em
      .filter((q) => q.overturnsMajority)
      .map((q) => ({
        questionNumber: q.questionNumber,
        majorityAnswer: majority.get(q.questionNumber)?.consensusAnswer ?? '—',
        majorityShare: majority.get(q.questionNumber)?.confidence ?? null,
        weightedAnswer: q.consensusAnswer,
        weightedConfidence: q.confidence,
        weightedShare: q.rawAgreement,
        spAnswer: sp.get(q.questionNumber)?.consensusAnswer ?? null,
        disputed: q.disputed
      }));
  }, [results]);

  if (rows.length === 0) return null;

  return (
    <Card
      className="mt-3"
      title="Where reliability weighting changed the answer"
      subtitle="These are the questions the project exists for: the plurality said one thing, and the respondents who agreed with the rest of the cohort said another."
    >
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Q</th>
              <th>
                <MethodTag method="MAJORITY" short />
              </th>
              <th className="num">Its share</th>
              <th>
                <MethodTag method="WEIGHTED_EM" short />
              </th>
              <th className="num">Its raw share</th>
              <th>
                <MethodTag method="SURPRISINGLY_POPULAR" short />
              </th>
              <th>State</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.questionNumber}
                onClick={() => onSelect?.(row.questionNumber)}
                style={{ cursor: 'pointer' }}
              >
                <td className="strong">{row.questionNumber}</td>
                <td className="mono">{row.majorityAnswer}</td>
                <td className="num">{percentText(row.majorityShare, 0)}</td>
                <td className="mono strong">{row.weightedAnswer}</td>
                <td className="num">{percentText(row.weightedShare, 0)}</td>
                <td className="mono">
                  {row.spAnswer || '—'}
                  {row.spAnswer && row.spAnswer === row.weightedAnswer && (
                    <>
                      {' '}
                      <Badge tone="ok">agrees</Badge>
                    </>
                  )}
                </td>
                <td>{row.disputed ? <Badge tone="warn">disputed</Badge> : <Badge tone="ok">confident</Badge>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="chart-note">
        A minority answer wins here when the respondents holding it agreed with the crowd
        everywhere else — that is the reliability signal, inferred from the same paper and
        nothing else.
      </p>
    </Card>
  );
}

function QuestionPanel({ examId, questionNumber, perQuestion, majorityPerQuestion }) {
  const row = perQuestion.find((q) => q.questionNumber === questionNumber);
  const majorityRow = majorityPerQuestion?.find((q) => q.questionNumber === questionNumber);

  if (!row) {
    return (
      <Card title="Question detail">
        <div className="empty">Select a question from the key or a bar in the chart.</div>
      </Card>
    );
  }

  return (
    <Card
      title={`Question ${row.questionNumber}`}
      subtitle={row.topic}
      actions={<DisputeBadge question={row} />}
    >
      <AnswerDistributionChart
        distribution={row.distribution}
        consensusAnswer={row.consensusAnswer}
        weighted={row.optionScores}
      />
      <div className="row mt-2 small" style={{ gap: 14 }}>
        <span>
          <strong>{row.totalResponses}</strong> answers
        </span>
        <span>entropy {formatNumber(row.normalisedEntropy, 3)}</span>
        <span>margin {percentText(row.margin, 0)}</span>
        {majorityRow && majorityRow.consensusAnswer !== row.consensusAnswer && (
          <Badge tone="brand">plurality said {majorityRow.consensusAnswer}</Badge>
        )}
      </div>
      <div className="mt-2">
        <DistributionBars
          distribution={row.distribution}
          consensusAnswer={row.consensusAnswer}
          total={row.totalResponses}
        />
      </div>
      <p className="chart-note">
        <Link to={`/exams/${examId}/disputes?q=${row.questionNumber}`}>
          Open this question's discussion thread →
        </Link>
      </p>
    </Card>
  );
}

function WeightPanel({ examId, method }) {
  const { data, error, loading } = useAsync(
    () => api.consensusMethod(examId, method),
    [examId, method],
    { skip: method !== 'WEIGHTED_EM' }
  );

  if (method !== 'WEIGHTED_EM') return null;
  if (loading) return <Spinner label="Loading respondent weights…" />;
  if (error) return <ErrorNote error={error} />;

  const weights = data?.respondentWeights || [];
  if (weights.length === 0) return null;

  const values = weights.map((w) => w.weight);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const bins = Array.from({ length: 10 }, (_, i) => ({
    bin: `${i * 10}–${i * 10 + 10}%`,
    from: i / 10,
    to: (i + 1) / 10,
    count: 0
  }));
  for (const value of values) {
    bins[Math.min(9, Math.max(0, Math.floor(value * 10)))].count += 1;
  }

  return (
    <Card
      className="mt-3"
      title="Inferred respondent reliability"
      subtitle="EM's latent parameter: each respondent's average agreement with the emerging consensus, smoothed toward the cohort mean for anyone who answered very few questions. Nobody was asked to rate themselves."
    >
      <div className="grid cols-2">
        <div>
          <ConfidenceHistogram histogram={bins} height={230} />
          <p className="chart-note">
            Mean {formatNumber(mean, 2)} · lowest {formatNumber(Math.min(...values), 2)} ·
            highest {formatNumber(Math.max(...values), 2)}. Weights are clamped to
            [0.01, 0.99] before any log is taken, so no single respondent can dominate.
          </p>
        </div>
        <div className="table-wrap scroll-y">
          <table>
            <thead>
              <tr>
                <th>Respondent</th>
                <th className="num">Weight</th>
                <th className="num">Answered</th>
              </tr>
            </thead>
            <tbody>
              {weights.slice(0, 40).map((entry) => (
                <tr key={entry.respondentId}>
                  <td className="mono small">{entry.label || entry.respondentId}</td>
                  <td className="num strong">{formatNumber(entry.weight, 3)}</td>
                  <td className="num">{entry.answered}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Card>
  );
}
