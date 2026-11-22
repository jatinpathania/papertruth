import { lazy, Suspense, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { api } from '../api/client.js';
import { useAsync } from '../api/useAsync.js';
import {
  AnimatedNumber,
  Badge,
  Card,
  Disclosure,
  DisputeBadge,
  DistributionBars,
  ErrorNote,
  Headline,
  MethodTag,
  OptionTiles,
  Page,
  Reveal,
  Ring,
  Section,
  Spinner,
  Tilt,
  formatDate,
  formatNumber,
  percentText
} from '../components/ui.jsx';
import ExamTabs from '../components/ExamTabs.jsx';


const STUDENT_METHOD_LABELS = {
  WEIGHTED_EM: 'Balanced',
  MAJORITY: 'Majority',
  SURPRISINGLY_POPULAR: 'Popularity-aware'
};

const METHOD_BLURBS = {
  MAJORITY: 'Straight head count. Whatever the most people wrote wins.',
  WEIGHTED_EM: 'Counts people who were right elsewhere more heavily than people who guessed.',
  SURPRISINGLY_POPULAR: 'Looks for the option picked more often than anyone expected it to be.'
};

export default function DisputeDetail() {
  const { examId, questionNumber } = useParams();
  const qn = Number(questionNumber);
  const { data, error, loading, reload } = useAsync(() => api.question(examId, qn), [examId, qn]);

  if (loading) return <Spinner label="Loading the question…" />;

  if (error) {
    return (
      <Page className="p-detail">
        <ErrorNote error={error} onRetry={reload} />
        <Link className="btn mt-2" to={`/exams/${examId}/disputes`}>
          ← Back to disputed questions
        </Link>
      </Page>
    );
  }

  const winner = data.methods?.WEIGHTED_EM?.consensusAnswer;
  const topShare = Math.max(...Object.values(data.distribution || { x: 0 }), 0);
  const leadShare = data.totalResponses > 0 ? topShare / data.totalResponses : 0;

  return (
    <Page className="p-detail">
      <ExamTabs examId={examId} />
      <Link className="back-link" to={`/exams/${examId}/disputes`}>
        ← All disputed questions
      </Link>

      <div className="hero-xl dispute-hero mt-2">
        <div className="hero-xl-inner">
          <motion.span
            className="section-kicker"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            ● {data.question?.topic || 'Contested question'}
          </motion.span>
          <Headline className="hero-title" delay={0.05} lines={['Question', { text: `#${qn}`, grad: true }]} />
          <motion.p
            className="hero-lede"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.16 }}
          >
            {data.question?.text || "No question text was recorded — the class's answers are all we have."}
          </motion.p>
          <motion.div
            className="row mt-2"
            style={{ gap: 12 }}
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.26 }}
          >
            <DisputeBadge question={data} />
            <span className="small muted">
              <AnimatedNumber value={data.totalResponses} /> people answered it
            </span>
          </motion.div>
        </div>
        <div className="scroll-cue" aria-hidden="true">
          <span>Scroll</span>
          <span>↓</span>
        </div>
      </div>

      {}
      <Section
        align="left"
        variant="wipe"
        kicker="Step 1 — the vote"
        title="What the class answered"
        lead="Each tile fills up with the share of people who chose it. The glowing one is what the key currently says."
      >
        <OptionTiles distribution={data.distribution} winner={winner} total={data.totalResponses} />

        <Reveal className="mt-3" delay={0.1} variant="slideRight">
          <div className="explain-grid">
            <div className="explain-card figure" style={{ '--tile-accent': 'var(--brand)' }}>
              <span className="explain-icon" aria-hidden="true">
                🏆
              </span>
              <div>
                <strong>{winner || '—'}</strong>
                <span>is the front-runner right now</span>
              </div>
            </div>
            <div className="explain-card figure" style={{ '--tile-accent': 'var(--warn)' }}>
              <span className="explain-icon" aria-hidden="true">
                📉
              </span>
              <div>
                <strong>{Math.round(leadShare * 100)}%</strong>
                <span>is all the lead it has — under half the class is a weak lead</span>
              </div>
            </div>
            <div className="explain-card figure" style={{ '--tile-accent': 'var(--danger)' }}>
              <span className="explain-icon" aria-hidden="true">
                🚫
              </span>
              <div>
                <strong>0</strong>
                <span>marks it costs you — contested questions are left unscored</span>
              </div>
            </div>
          </div>
        </Reveal>

        <Reveal className="mt-3" delay={0.15} variant="settle">
          <Disclosure summary="Show the exact bars and counts">
            <DistributionBars
              distribution={data.distribution}
              consensusAnswer={winner}
            />
          </Disclosure>
        </Reveal>
      </Section>

      <Section
        kicker="Step 2 — the verdicts"
        title="What each method thinks"
        lead="Three different ways of combining the same answers. When they disagree, the question really is up for debate."
      >
        <div className="grid cols-3">
          {Object.entries(data.methods).map(([method, row], index) => (
            <Reveal key={method} delay={index * 0.08} variant={index === 1 ? 'zoom' : index === 0 ? 'slideLeft' : 'slideRight'}>
              <Tilt className="method-card">
                <MethodTag method={method} labels={STUDENT_METHOD_LABELS} />
                <div className="row" style={{ gap: 14, alignItems: 'center' }}>
                  <div className="method-card-answer mono">{row.consensusAnswer || '—'}</div>
                  <Ring
                    value={row.confidence || 0}
                    size={56}
                    color={row.consensusAnswer === winner ? 'var(--brand)' : 'var(--text-muted)'}
                  />
                </div>
                <p className="small muted mb-0">{METHOD_BLURBS[method]}</p>
                {row.overturnsMajority && <Badge tone="brand">beat the majority</Badge>}
              </Tilt>
            </Reveal>
          ))}
        </div>
        <Reveal delay={0.1} variant="wipeSide">
          <div className={`notice mt-2 ${data.agreement ? 'ok' : 'warn'}`}>
            {data.agreement
              ? '✓ All three ways of combining the class landed on the same answer here.'
              : '⚠ The methods disagree with each other — a sign this one is genuinely up for debate.'}
          </div>
        </Reveal>

        <Reveal className="mt-2" delay={0.15}>
          <Disclosure summary="See the raw numbers behind each method">
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Method</th>
                    <th>Answer</th>
                    <th className="num">Confidence</th>
                    <th className="num">Raw share</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(data.methods).map(([method, row]) => (
                    <tr key={method}>
                      <td>
                        <MethodTag method={method} short labels={STUDENT_METHOD_LABELS} />
                      </td>
                      <td className="mono strong">{row.consensusAnswer || '—'}</td>
                      <td className="num">{percentText(row.confidence, 0)}</td>
                      <td className="num">{percentText(row.rawAgreement, 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {data.methods?.SURPRISINGLY_POPULAR && <SurprisinglyPopularNote row={data.methods.SURPRISINGLY_POPULAR} />}
          </Disclosure>
        </Reveal>
      </Section>

      <Section
        kicker="Step 3 — your turn"
        title="Make the case"
        lead="You wrote this paper. If you remember something the numbers can't see, this is where it goes."
      >
        <Reveal>
          <Card subtitle="Only respondents who submitted answers for this exam can post. Posts are pseudonymous.">
            <Thread examId={examId} questionNumber={qn} />
          </Card>
        </Reveal>
      </Section>

      <Reveal>
        <div className="cta-band">
          <div style={{ flex: 1, minWidth: 260 }}>
            <h2>Seen enough?</h2>
            <p>Head back to the ranked list, or check what this question does to your score.</p>
          </div>
          <Link className="btn lg" to={`/exams/${examId}/disputes`}>
            ← All disputed
          </Link>
          <Link className="btn primary lg" to={`/exams/${examId}/results`}>
            My score <span className="arrow">→</span>
          </Link>
        </div>
      </Reveal>
    </Page>
  );
}

function SurprisinglyPopularNote({ row }) {
  const options = Object.keys(row.spScores || {}).sort();
  if (!options.length) return null;
  return (
    <div className="mt-2">
      <p className="sub-label">Chosen vs. expected to be popular</p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Option</th>
              <th className="num">Chose it</th>
              <th className="num">Predicted it would win</th>
              <th className="num">Gap</th>
            </tr>
          </thead>
          <tbody>
            {options.map((option) => (
              <tr key={option}>
                <td className="mono strong">{option}</td>
                <td className="num">{percentText(row.actual?.[option], 0)}</td>
                <td className="num">{percentText(row.predicted?.[option], 0)}</td>
                <td className="num strong">
                  {row.spScores[option] > 0 ? '+' : ''}
                  {formatNumber(row.spScores[option], 2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="chart-note">
        When an option gets picked more often than people expected it to win, that's a
        sign it's the real answer — even if it wasn't the most popular choice.
      </p>
    </div>
  );
}

function Thread({ examId, questionNumber }) {
  const { data, error, loading, reload, setData } = useAsync(
    () => api.thread(examId, questionNumber),
    [examId, questionNumber]
  );
  const [body, setBody] = useState('');
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState(null);

  const post = async (event) => {
    event.preventDefault();
    if (!body.trim()) return;
    setPosting(true);
    setPostError(null);
    try {
      const { post: created } = await api.postToThread(examId, questionNumber, body.trim());
      setData({ ...data, posts: [...(data?.posts || []), created] });
      setBody('');
    } catch (caught) {
      setPostError(caught);
    } finally {
      setPosting(false);
    }
  };

  const vote = async (postId) => {
    try {
      const result = await api.voteOnPost(examId, questionNumber, postId);
      setData({
        ...data,
        posts: data.posts.map((p) =>
          p.id === postId ? { ...p, votes: result.votes, hasVoted: result.hasVoted } : p
        )
      });
    } catch (caught) {
      setPostError(caught);
    }
  };

  if (loading) return <Spinner label="Loading thread…" />;
  if (error) return <ErrorNote error={error} onRetry={reload} />;
  if (!data) return null;

  return (
    <>
      {data.posts.length === 0 ? (
        <div className="empty">No posts yet. Make the first argument.</div>
      ) : (
        <div className="scroll-y">
          {data.posts.map((entry) => (
            <article key={entry.id} className="thread-post">
              <div className="thread-meta">
                <code>{entry.label || entry.respondentId}</code>
                {entry.isMine && <Badge tone="brand">you</Badge>}
                <span>{formatDate(entry.createdAt)}</span>
                <span className="spacer" />
                <button
                  type="button"
                  className={`small vote-btn${entry.hasVoted ? ' primary' : ''}`}
                  onClick={() => vote(entry.id)}
                  aria-label={entry.hasVoted ? 'Remove your vote' : 'Agree with this post'}
                >
                  ▲ {entry.votes}
                </button>
              </div>
              <p className="mb-0">{entry.body}</p>
            </article>
          ))}
        </div>
      )}

      <form onSubmit={post} className="mt-2">
        <label htmlFor={`post-body-${questionNumber}`}>Add to the discussion</label>
        <textarea
          id={`post-body-${questionNumber}`}
          value={body}
          maxLength={2000}
          placeholder="What do you remember about this question, and why?"
          onChange={(event) => setBody(event.target.value)}
        />
        {postError && <ErrorNote error={postError} />}
        <div className="row mt-1">
          <button className="primary" type="submit" disabled={posting || !body.trim()}>
            {posting ? 'Posting…' : 'Post to the thread'}
          </button>
          <span className="tiny muted">{body.length}/2000</span>
        </div>
      </form>
    </>
  );
}
