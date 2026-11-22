import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../api/client.js';
import { useAsync } from '../../api/useAsync.js';
import { CohortSizeCurve, MethodAccuracyChart } from '../../components/charts/index.jsx';
import {
  Page,
  Badge,
  Card,
  ErrorNote,
  MethodTag,
  Spinner,
  Stat,
  formatDate,
  formatNumber,
  percentText
} from '../../components/ui.jsx';

export default function Validation() {
  const { examId } = useParams();
  const key = useAsync(() => api.officialKey(examId), [examId]);
  const [curveOptions, setCurveOptions] = useState({ step: 10, trials: 5 });

  const hasKey = Boolean(key.data?.hasKey);
  const validation = useAsync(() => api.validation(examId), [examId, hasKey], { skip: !hasKey });
  const curve = useAsync(
    () => api.curve(examId, curveOptions),
    [examId, hasKey, curveOptions.step, curveOptions.trials],
    { skip: !hasKey }
  );

  if (key.loading) return <Spinner label="Checking for an official key…" />;

  return (
    <Page>
      <div className="page-head">
        <div>
          <span className="eyebrow">🛰️ Exam cell</span>
          <h1>Validation</h1>
          <p className="lede">
            Everything else in PaperTruth is an estimate. Upload the department's real key
            and each method can be measured instead of argued about — including how many
            respondents each one needs before its estimate is trustworthy.
          </p>
        </div>
        {hasKey && <Badge tone="ok">Key on file · {key.data.answerCount} answers</Badge>}
      </div>

      <KeyUpload examId={examId} keyState={key} />

      {!hasKey ? (
        <div className="notice warn mt-3">
          <strong>No official key yet.</strong> Upload one above to unlock the accuracy
          comparison and the learning curve.
        </div>
      ) : (
        <>
          {validation.loading && <Spinner label="Comparing methods…" />}
          {validation.error && <ErrorNote error={validation.error} onRetry={validation.reload} />}

          {validation.data && <MethodComparison data={validation.data} />}

          <Card
            className="mt-3"
            title="Accuracy vs number of respondents"
            subtitle="For each cohort size, several random subsamples are drawn and every method is run on each; the lines are the averages. Sampling is seeded, so the curve is reproducible."
            actions={
              <div className="row">
                <label htmlFor="curve-step" style={{ margin: 0 }} className="tiny">
                  step
                </label>
                <select
                  id="curve-step"
                  value={curveOptions.step}
                  style={{ width: 'auto' }}
                  onChange={(event) =>
                    setCurveOptions((previous) => ({ ...previous, step: Number(event.target.value) }))
                  }
                >
                  {[5, 10, 20, 25].map((step) => (
                    <option key={step} value={step}>
                      {step}
                    </option>
                  ))}
                </select>
                <label htmlFor="curve-trials" style={{ margin: 0 }} className="tiny">
                  trials
                </label>
                <select
                  id="curve-trials"
                  value={curveOptions.trials}
                  style={{ width: 'auto' }}
                  onChange={(event) =>
                    setCurveOptions((previous) => ({ ...previous, trials: Number(event.target.value) }))
                  }
                >
                  {[3, 5, 8, 12].map((trials) => (
                    <option key={trials} value={trials}>
                      {trials}
                    </option>
                  ))}
                </select>
              </div>
            }
          >
            {curve.loading && <Spinner label="Running subsamples…" />}
            {curve.error && <ErrorNote error={curve.error} onRetry={curve.reload} />}
            {curve.data && (
              <>
                <CohortSizeCurve curve={curve.data.curve} methods={curve.data.methods} />
                <p className="chart-note">
                  Watch the shape, not just the height. Majority voting flattens out early
                  and stays there: its errors are systematic — the whole cohort shares the
                  misconception — so more respondents cannot fix them. The weighted methods
                  keep climbing, because more respondents mean sharper reliability
                  estimates. {curve.data.trials} trials per point, seed {curve.data.seed}.
                </p>
                <CurveTable curve={curve.data.curve} methods={curve.data.methods} />
              </>
            )}
          </Card>

          <Mismatches examId={examId} />
        </>
      )}

      <div className="row mt-3">
        <Link className="btn" to={`/admin/exams/${examId}/analytics`}>
          ← Analytics
        </Link>
        <Link className="btn" to={`/admin/exams/${examId}/integrity`}>
          Integrity report →
        </Link>
      </div>
    </Page>
  );
}

function KeyUpload({ examId, keyState }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);

  const parsed = useMemo(() => parseKey(text), [text]);

  const upload = async () => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const result = await api.uploadKey(examId, parsed);
      setMessage(`Stored ${result.answerCount} answers.`);
      setText('');
      keyState.reload();
    } catch (caught) {
      setError(caught);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card
      title="Official answer key"
      subtitle="Paste the key as a comma-separated list in question order (A, C, B, …) or as explicit pairs (1:A, 2:C). Partial keys are fine — only the questions present are compared."
      actions={
        keyState.data?.hasKey ? (
          <span className="tiny muted">uploaded {formatDate(keyState.data.uploadedAt)}</span>
        ) : null
      }
    >
      <textarea
        aria-label="Official answer key"
        value={text}
        placeholder="A, C, B, D, A, …   or   1:A, 2:C, 3:B"
        onChange={(event) => setText(event.target.value)}
      />
      <div className="row mt-1">
        <button className="primary" type="button" onClick={upload} disabled={busy || parsed.length === 0}>
          {busy ? 'Uploading…' : keyState.data?.hasKey ? 'Replace the key' : 'Upload the key'}
        </button>
        <span className="small muted">
          {parsed.length > 0
            ? `${parsed.length} answer(s) parsed — Q${parsed[0].questionNumber} … Q${parsed.at(-1).questionNumber}`
            : 'Nothing parsed yet'}
        </span>
      </div>
      {message && <div className="notice ok mt-2">{message}</div>}
      {error && (
        <div className="mt-2">
          <ErrorNote error={error} />
        </div>
      )}
      {keyState.data?.hasKey && keyState.data.answers?.length > 0 && (
        <details className="mt-2">
          <summary className="small muted">Show the stored key</summary>
          <p className="mono small mt-1">
            {keyState.data.answers
              .map((entry) => `${entry.questionNumber}:${entry.answer}`)
              .join('  ')}
          </p>
        </details>
      )}
    </Card>
  );
}

function MethodComparison({ data }) {
  const best = data.methods[0];
  const majority = data.methods.find((m) => m.method === 'MAJORITY');
  const em = data.methods.find((m) => m.method === 'WEIGHTED_EM');
  const gain = em && majority ? em.accuracy - majority.accuracy : null;

  return (
    <>
      <div className="grid cols-4 mt-3">
        <Stat
          accent
          label="Best method"
          value={percentText(best.accuracy, 1)}
          hint={best.label}
        />
        <Stat
          label="Gain over majority"
          value={gain === null ? '—' : `${gain >= 0 ? '+' : ''}${(gain * 100).toFixed(1)} pts`}
          hint="weighted EM vs plurality voting"
        />
        <Stat
          label="Plurality overturned"
          value={`${data.overturnedWonByWeighting} / ${data.overturnedQuestions.length}`}
          hint="of those flips, how many were right"
        />
        <Stat
          label="Questions compared"
          value={data.keyedQuestions}
          hint={`${data.respondents} respondents`}
        />
      </div>

      <Card
        className="mt-3"
        title="Method accuracy against the official key"
        subtitle="Overall, and split by whether the question was flagged as disputed. A method that is accurate on unflagged questions and poor on flagged ones is behaving exactly as intended — the flag is the system admitting it does not know."
      >
        <MethodAccuracyChart methods={data.methods} />
        <div className="table-wrap mt-2">
          <table>
            <thead>
              <tr>
                <th>Method</th>
                <th className="num">Overall</th>
                <th className="num">Clear consensus</th>
                <th className="num">Flagged disputed</th>
                <th className="num">Matched</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {data.methods.map((row) => (
                <tr key={row.method}>
                  <td>
                    <MethodTag method={row.method} short />
                  </td>
                  <td className="num strong">{percentText(row.accuracy, 1)}</td>
                  <td className="num">
                    {percentText(row.undisputedAccuracy, 1)}{' '}
                    <span className="tiny muted">({row.undisputedComparable})</span>
                  </td>
                  <td className="num">
                    {percentText(row.disputedAccuracy, 1)}{' '}
                    <span className="tiny muted">({row.disputedComparable})</span>
                  </td>
                  <td className="num">
                    {row.matched} / {row.comparable}
                  </td>
                  <td className="small muted">
                    {row.method === 'WEIGHTED_EM'
                      ? `${row.converged ? 'converged' : 'hit the iteration cap'} in ${row.iterations} iterations`
                      : row.method === 'SURPRISINGLY_POPULAR'
                        ? 'uses the prediction question'
                        : 'baseline'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {data.overturnedQuestions.length > 0 && (
        <Card
          className="mt-3"
          title="Verdict on every overturned question"
          subtitle="Where weighted EM disagreed with the plurality, the official key settles it."
        >
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Q</th>
                  <th>Plurality said</th>
                  <th>Weighting said</th>
                  <th>Official answer</th>
                  <th>Outcome</th>
                </tr>
              </thead>
              <tbody>
                {data.overturnedQuestions.map((row) => (
                  <tr key={row.questionNumber}>
                    <td className="strong">{row.questionNumber}</td>
                    <td className="mono">{row.majorityAnswer}</td>
                    <td className="mono strong">{row.weightedAnswer}</td>
                    <td className="mono">{row.officialAnswer}</td>
                    <td>
                      {row.weightedCorrect ? (
                        <Badge tone="ok">✓ weighting was right</Badge>
                      ) : row.majorityCorrect ? (
                        <Badge tone="danger">✗ plurality was right</Badge>
                      ) : (
                        <Badge tone="warn">both wrong</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </>
  );
}

function CurveTable({ curve, methods }) {
  return (
    <details className="mt-2">
      <summary className="small muted">Show the numbers behind the curve</summary>
      <div className="table-wrap mt-1">
        <table>
          <thead>
            <tr>
              <th className="num">Respondents</th>
              {methods.map((method) => (
                <th key={method} className="num">
                  <MethodTag method={method} short />
                </th>
              ))}
              <th className="num">Trials</th>
            </tr>
          </thead>
          <tbody>
            {curve.map((row) => (
              <tr key={row.cohortSize}>
                <td className="num strong">{row.cohortSize}</td>
                {methods.map((method) => (
                  <td key={method} className="num">
                    {percentText(row[method], 1)}
                    <span className="tiny muted">
                      {' '}
                      ({percentText(row[`${method}_min`], 0)}–{percentText(row[`${method}_max`], 0)})
                    </span>
                  </td>
                ))}
                <td className="num">{row.trials}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

function Mismatches({ examId }) {
  const { data, error, loading } = useAsync(() => api.mismatches(examId), [examId]);
  const [method, setMethod] = useState('WEIGHTED_EM');

  if (loading) return <Spinner label="Loading mismatches…" />;
  if (error) return <ErrorNote error={error} />;

  const rows = data?.methods?.[method]?.mismatches || [];

  return (
    <Card
      className="mt-3"
      title="Where the estimate was wrong"
      subtitle="Every question this method got wrong, with the confidence it claimed. High-confidence errors are the ones worth understanding."
      actions={
        <select value={method} onChange={(event) => setMethod(event.target.value)} style={{ width: 'auto' }}>
          {Object.keys(data?.methods || {}).map((key) => (
            <option key={key} value={key}>
              {data.labels[key] || key}
            </option>
          ))}
        </select>
      }
    >
      {rows.length === 0 ? (
        <div className="empty">This method matched the official key on every compared question.</div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Q</th>
                <th>Consensus said</th>
                <th>Official answer</th>
                <th className="num">Confidence claimed</th>
                <th className="num">Entropy</th>
                <th>Flagged?</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.questionNumber}>
                  <td className="strong">{row.questionNumber}</td>
                  <td className="mono">{row.consensusAnswer}</td>
                  <td className="mono strong">{row.officialAnswer}</td>
                  <td className="num">{percentText(row.confidence, 0)}</td>
                  <td className="num">{formatNumber(row.normalisedEntropy, 2)}</td>
                  <td>
                    {row.disputed ? (
                      <Badge tone="ok">yes — flagged as disputed</Badge>
                    ) : (
                      <Badge tone="danger">no — claimed confidently</Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function parseKey(text) {
  const cleaned = `${text}`.trim();
  if (!cleaned) return [];
  const tokens = cleaned.split(/[\s,;]+/).filter(Boolean);
  const pairs = [];
  let sequential = 1;
  for (const token of tokens) {
    const explicit = token.match(/^(\d+)[:.=-](.+)$/);
    if (explicit) {
      pairs.push({ questionNumber: Number(explicit[1]), answer: explicit[2].trim() });
    } else {
      pairs.push({ questionNumber: sequential, answer: token });
      sequential += 1;
    }
  }
  const byNumber = new Map();
  for (const pair of pairs) if (pair.answer) byNumber.set(pair.questionNumber, pair.answer);
  return [...byNumber.entries()]
    .map(([questionNumber, answer]) => ({ questionNumber, answer }))
    .sort((a, b) => a.questionNumber - b.questionNumber);
}
