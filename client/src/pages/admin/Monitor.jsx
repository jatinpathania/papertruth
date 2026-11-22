import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../api/client.js';
import { useAsync } from '../../api/useAsync.js';
import { useExamLive } from '../../context/useExamLive.js';
import { ConfidenceHistogram, SubmissionTimelineChart } from '../../components/charts/index.jsx';
import {
  Page,
  Badge,
  Card,
  ErrorNote,
  MethodTag,
  Spinner,
  Stat,
  StatusBadge,
  formatDate,
  formatNumber,
  percentText
} from '../../components/ui.jsx';

export default function Monitor() {
  const { examId } = useParams();
  const monitor = useAsync(() => api.monitor(examId), [examId]);
  const live = useAsync(() => api.liveConsensus(examId), [examId]);

  const [count, setCount] = useState(null);
  const [series, setSeries] = useState([]);
  const [liveSummary, setLiveSummary] = useState(null);
  const [computing, setComputing] = useState(false);
  const [computeError, setComputeError] = useState(null);
  const [computedAt, setComputedAt] = useState(null);

  useEffect(() => {
    if (!monitor.data) return;
    setCount(monitor.data.submissionCount);
    const timeline = monitor.data.timeline || [];
    const points = timeline.map((entry, index) => ({
      label: new Date(entry.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      submissions: index + 1,
      confidence: null
    }));
    setSeries(points.slice(-60));
  }, [monitor.data]);

  useEffect(() => {
    if (live.data) setLiveSummary(live.data);
  }, [live.data]);

  const onSubmission = useCallback((payload) => {
    setCount((previous) => payload.respondentCount ?? (previous ?? 0) + 1);
    setLiveSummary(payload);
    const confidence = payload.methods?.WEIGHTED_EM?.meanConfidence ?? null;
    setSeries((previous) =>
      [
        ...previous,
        {
          label: new Date(payload.submittedAt || Date.now()).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
          }),
          submissions: payload.respondentCount ?? previous.length + 1,
          confidence: confidence === null ? null : Number((confidence * 100).toFixed(1))
        }
      ].slice(-60)
    );
  }, []);

  const onComputed = useCallback((payload) => {
    setComputedAt(payload.computedAt);
    setLiveSummary((previous) => ({ ...(previous || {}), methods: payload.summaries }));
  }, []);

  const { connected, lastEvent } = useExamLive(examId, { onSubmission, onComputed });

  const compute = async () => {
    setComputing(true);
    setComputeError(null);
    try {
      const result = await api.compute(examId);
      setComputedAt(new Date().toISOString());
      setLiveSummary({ respondentCount: result.results?.[0]?.respondentCount, methods: result.summaries });
      live.reload();
    } catch (caught) {
      setComputeError(caught);
    } finally {
      setComputing(false);
    }
  };

  const closeWindow = async () => {
    await api.setExamStatus(examId, { status: 'CLOSED' });
    monitor.reload();
  };

  const openWindow = async () => {
    await api.setExamStatus(examId, { status: 'OPEN' });
    monitor.reload();
  };

  if (monitor.loading) return <Spinner label="Loading the monitor…" />;
  if (monitor.error)
    return (
      <Page>
        <ErrorNote error={monitor.error} onRetry={monitor.reload} />
      </Page>
    );

  const exam = monitor.data.exam;
  const em = liveSummary?.methods?.WEIGHTED_EM;
  const majority = liveSummary?.methods?.MAJORITY;

  return (
    <Page>
      <div className="page-head">
        <div>
          <span className="eyebrow">🛰️ Exam cell</span>
          <h1>Live monitor</h1>
          <p className="lede">
            {exam.title} · {exam.courseCode}. Responses stream in over a websocket; the
            consensus is recomputed on each one so you can watch confidence firm up.
          </p>
        </div>
        <div className="row">
          <span className="row tiny muted" style={{ gap: 6 }}>
            <span className={`live-dot${connected ? '' : ' off'}`} aria-hidden="true" />
            {connected ? 'live' : 'disconnected'}
          </span>
          <StatusBadge exam={exam} />
        </div>
      </div>

      <div className="grid cols-4">
        <Stat accent label="Submissions" value={count ?? '—'} hint={`window closes ${formatDate(exam.closesAt)}`} />
        <Stat
          label="Mean confidence (EM)"
          value={em ? percentText(em.meanConfidence, 1) : '—'}
          hint="reliability-weighted support for the winning answer"
        />
        <Stat
          label="Disputed questions"
          value={majority ? `${majority.disputedQuestions} / ${majority.answeredQuestions}` : '—'}
          hint="entropy above threshold, or a margin under 10 points"
        />
        <Stat
          label="Plurality overturned"
          value={em ? em.overturnedByWeighting : '—'}
          hint="questions where weighting changed the answer"
        />
      </div>

      <div className="row mt-2">
        <button className="primary" type="button" onClick={compute} disabled={computing || !count}>
          {computing ? 'Computing…' : 'Compute consensus now'}
        </button>
        {exam.status === 'OPEN' ? (
          <button type="button" onClick={closeWindow}>
            Close the submission window
          </button>
        ) : (
          <button type="button" onClick={openWindow}>
            Reopen the window
          </button>
        )}
        <Link className="btn" to={`/admin/exams/${examId}/analytics`}>
          Analytics
        </Link>
        <Link className="btn" to={`/admin/exams/${examId}/validation`}>
          Official key
        </Link>
        <span className="spacer" />
        {computedAt && <Badge tone="brand">computed {formatDate(computedAt)}</Badge>}
      </div>

      {computeError && (
        <div className="mt-2">
          <ErrorNote error={computeError} />
        </div>
      )}

      <div className="grid cols-2 mt-3">
        <Card
          title="Responses over time"
          subtitle="Cumulative submissions, with the weighted consensus's mean confidence on the right axis."
        >
          <SubmissionTimelineChart points={series} />
          <p className="chart-note">
            Confidence only appears for points recorded live in this session — the stored
            timeline has counts but no historical confidence.
          </p>
        </Card>

        <Card
          title="Confidence across all questions"
          subtitle="Where the mass sits on the left, the key is not yet trustworthy."
        >
          <ConfidenceHistogram histogram={em?.confidenceHistogram || majority?.confidenceHistogram || []} />
        </Card>
      </div>

      <Card
        className="mt-3"
        title="Method summaries"
        subtitle="Recomputed on every submission. Nothing here is stored until you press compute."
      >
        {!liveSummary?.methods ? (
          <div className="empty">No submissions yet.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Method</th>
                  <th className="num">Mean confidence</th>
                  <th className="num">Mean entropy</th>
                  <th className="num">Disputed</th>
                  <th className="num">Overturns plurality</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(liveSummary.methods).map(([method, summary]) => (
                  <tr key={method}>
                    <td>
                      <MethodTag method={method} short />
                    </td>
                    <td className="num">{percentText(summary.meanConfidence, 1)}</td>
                    <td className="num">{formatNumber(summary.meanNormalisedEntropy, 3)}</td>
                    <td className="num">{summary.disputedQuestions}</td>
                    <td className="num">{summary.overturnedByWeighting ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {lastEvent && (
          <p className="chart-note">
            Last event: {lastEvent.type === 'submission' ? 'submission received' : 'consensus computed'} at{' '}
            {new Date(lastEvent.at).toLocaleTimeString()}.
          </p>
        )}
      </Card>
    </Page>
  );
}
