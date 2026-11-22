import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../api/client.js';
import { useAsync } from '../../api/useAsync.js';
import {
  Page,
  Badge,
  Card,
  ErrorNote,
  Spinner,
  Stat,
  formatNumber
} from '../../components/ui.jsx';

export default function Integrity() {
  const { examId } = useParams();
  const [params, setParams] = useState({ rareAnswerThreshold: '', rareMatchThreshold: '' });
  const [applied, setApplied] = useState({});
  const { data, error, loading, reload } = useAsync(() => api.integrity(examId, applied), [examId, applied]);

  if (loading) return <Spinner label="Comparing every pair of submissions…" />;
  if (error)
    return (
      <Page>
        <ErrorNote error={error} onRetry={reload} />
      </Page>
    );

  const { calibration } = data;

  return (
    <Page>
      <div className="page-head">
        <div>
          <span className="eyebrow">🛰️ Exam cell</span>
          <h1>Integrity report</h1>
          <p className="lede">
            Two detectors. Identical answer vectors are found by hashing, in one pass.
            Near-identical patterns are found by counting matches on <em>rare</em> answers
            only — agreeing on a popular option means nothing, while two people arriving at
            the same rare wrong answer usually shared a source. Flagged pairs are merged
            into groups with a union-find structure.
          </p>
        </div>
      </div>

      <div className="grid cols-4">
        <Stat accent label="Respondents" value={data.totalRespondents} hint={`${calibration.comparedPairs.toLocaleString()} pairs compared`} />
        <Stat label="Groups flagged" value={data.clusters.length} hint="clusters of two or more" />
        <Stat
          label="Identical submissions"
          value={data.identicalGroups.length}
          hint="byte-identical answer vectors"
        />
        <Stat
          label="Rare-match threshold"
          value={calibration.rareMatchThreshold}
          hint={
            calibration.isDefault
              ? `chance gives ${formatNumber(calibration.expectedRareMatches, 2)} per pair`
              : 'set manually'
          }
        />
      </div>

      <div className="notice mt-2">
        <strong>How the threshold is set.</strong> An innocent pair shares about{' '}
        {formatNumber(calibration.expectedRareMatches, 2)} rare answers by chance on this
        paper, give or take {formatNumber(calibration.rareMatchStdDev, 2)}. Because there are{' '}
        {calibration.comparedPairs.toLocaleString()} pairs to compare, a bar that looks safe for
        one pair would still be crossed by somebody, so the default sits{' '}
        {calibration.sigmaMultiplier ?? 6} standard deviations above chance — which lands at{' '}
        {calibration.rareMatchThreshold} here.
      </div>

      <Card
        className="mt-3"
        title="Tune the detector"
        subtitle="Leave the threshold blank to keep the calibrated value."
      >
        <div className="row" style={{ gap: 14, alignItems: 'flex-end' }}>
          <div className="field" style={{ marginBottom: 0, maxWidth: 220 }}>
            <label htmlFor="rare">Rare answer cut-off</label>
            <input
              id="rare"
              type="number"
              step="0.05"
              min="0.05"
              max="0.9"
              placeholder="0.2"
              value={params.rareAnswerThreshold}
              onChange={(event) =>
                setParams((p) => ({ ...p, rareAnswerThreshold: event.target.value }))
              }
            />
            <p className="help">An answer chosen by fewer than this fraction counts as rare.</p>
          </div>
          <div className="field" style={{ marginBottom: 0, maxWidth: 220 }}>
            <label htmlFor="matches">Rare matches to flag a pair</label>
            <input
              id="matches"
              type="number"
              min="1"
              placeholder={`${calibration.rareMatchThreshold} (calibrated)`}
              value={params.rareMatchThreshold}
              onChange={(event) =>
                setParams((p) => ({ ...p, rareMatchThreshold: event.target.value }))
              }
            />
          </div>
          <button
            type="button"
            className="primary"
            onClick={() =>
              setApplied({
                rareAnswerThreshold: params.rareAnswerThreshold || undefined,
                rareMatchThreshold: params.rareMatchThreshold || undefined
              })
            }
          >
            Re-run
          </button>
          <button
            type="button"
            onClick={() => {
              setParams({ rareAnswerThreshold: '', rareMatchThreshold: '' });
              setApplied({});
            }}
          >
            Reset
          </button>
        </div>
      </Card>

      {data.clusters.length === 0 ? (
        <div className="notice ok mt-3">
          <strong>Nothing flagged.</strong> No group of respondents shares more answers than
          chance can explain.
        </div>
      ) : (
        <Card
          className="mt-3"
          title="Flagged groups"
          subtitle="Evidence, not a verdict: these submissions are correlated far beyond chance. What that means is for the department to decide."
        >
          <div className="grid cols-2">
            {data.clusters.map((cluster, index) => (
              <div key={cluster.respondentIds.join('-')} className="qcard">
                <div className="qcard-head">
                  <span className="qnum">Group {index + 1}</span>
                  <Badge tone={cluster.containsIdenticalSubmissions ? 'danger' : 'warn'}>
                    {cluster.containsIdenticalSubmissions
                      ? 'identical submissions'
                      : 'near-identical pattern'}
                  </Badge>
                  <span className="spacer" />
                  <span className="small muted">{cluster.size} respondents</span>
                </div>
                <div className="pill-row">
                  {cluster.labels.map((label) => (
                    <code key={label} className="badge neutral">
                      {label}
                    </code>
                  ))}
                </div>
                <p className="small muted mt-2 mb-0">
                  Up to <strong>{cluster.maxRareMatches}</strong> matching rare answers within
                  the group (average {formatNumber(cluster.avgRareMatches, 1)}), against a
                  threshold of {calibration.rareMatchThreshold} and a chance expectation of{' '}
                  {formatNumber(calibration.expectedRareMatches, 2)}.
                </p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {data.suspiciousPairs.length > 0 && (
        <Card
          className="mt-3"
          title="Flagged pairs"
          subtitle={`${data.suspiciousPairCount} pair(s) exceeded the threshold${
            data.suspiciousPairCount > data.suspiciousPairs.length ? ` — showing the strongest ${data.suspiciousPairs.length}` : ''
          }.`}
        >
          <div className="table-wrap scroll-y">
            <table>
              <thead>
                <tr>
                  <th>Respondent A</th>
                  <th>Respondent B</th>
                  <th className="num">Rare answers shared</th>
                  <th className="num">Answers shared in total</th>
                </tr>
              </thead>
              <tbody>
                {data.suspiciousPairs.map((pair) => (
                  <tr key={`${pair.a}-${pair.b}`}>
                    <td className="mono small">{pair.labelA}</td>
                    <td className="mono small">{pair.labelB}</td>
                    <td className="num strong">{pair.rareMatches}</td>
                    <td className="num">{pair.sharedAnswers}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="chart-note">
            The pairwise scan is O(n²·m) — every pair, every question. At a few hundred
            respondents that is a few million set lookups and runs in well under a second;
            beyond a few thousand it would want MinHash/LSH banding instead.
          </p>
        </Card>
      )}

      <div className="row mt-3">
        <Link className="btn" to={`/admin/exams/${examId}/analytics`}>
          ← Analytics
        </Link>
        <Link className="btn" to={`/admin/exams/${examId}/validation`}>
          Validation
        </Link>
      </div>
    </Page>
  );
}
