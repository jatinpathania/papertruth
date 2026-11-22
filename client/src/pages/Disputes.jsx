import { lazy, Suspense, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { api } from '../api/client.js';
import { useAsync } from '../api/useAsync.js';
import {
  AnimatedNumber,
  DisputeBadge,
  ErrorNote,
  Headline,
  MiniBars,
  Page,
  Reveal,
  Ring,
  Section,
  Spinner,
  Tilt
} from '../components/ui.jsx';
import { staggerContainer, staggerItem } from '../components/motion.js';
import ExamTabs from '../components/ExamTabs.jsx';


const LEGEND = [
  {
    icon: '🌪️',
    title: 'Answers scattered',
    body: 'People spread themselves across every option. Nobody could have been reading the same question the same way.'
  },
  {
    icon: '⚖️',
    title: 'Too close to call',
    body: 'Two options finished within a hair of each other. Picking a winner would be a coin toss wearing a suit.'
  },
  {
    icon: '💬',
    title: 'Argue it out',
    body: 'Open a question to see the full split and post what you remember. The thread is pseudonymous.'
  }
];

export default function Disputes() {
  const { examId } = useParams();
  const [onlyFlagged, setOnlyFlagged] = useState(false);

  const { data, error, loading, reload } = useAsync(
    () => api.disputes(examId, { limit: 12, onlyFlagged }),
    [examId, onlyFlagged]
  );

  if (loading) return <Spinner label="Ranking the contested questions…" />;

  if (error) {
    return (
      <Page className="p-disputes">
        <ErrorNote error={error} onRetry={reload} />
      </Page>
    );
  }

  const disputes = data.disputes || [];
  const flaggedCount = disputes.filter((question) => question.disputed).length;
  const totalPosts = disputes.reduce((sum, question) => sum + (question.postCount || 0), 0);
  const worst = disputes[0];

  const tiles = [
    { icon: '⚡', value: flaggedCount, label: 'Flagged as contested', accent: 'var(--warn)' },
    { icon: '📋', value: disputes.length, label: 'Questions ranked here', accent: 'var(--brand)' },
    { icon: '💬', value: totalPosts, label: 'Posts in the threads', accent: 'var(--accent)' },
    {
      icon: '🥇',
      value: worst ? worst.questionNumber : 0,
      label: 'Most split question',
      accent: 'var(--danger)',
      prefix: 'Q'
    }
  ];

  return (
    <Page className="p-disputes">
      <ExamTabs examId={examId} />

      <div className="hero-xl mt-2">
        <div className="hero-xl-inner">
          <motion.span
            className="section-kicker"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            ● {data.exam.title}
          </motion.span>
          <Headline className="hero-title" delay={0.05} lines={['Where the class', { text: "couldn't agree", grad: true }]} />
          <motion.p
            className="hero-lede"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.16 }}
          >
            These questions split the room. Rather than guess a key for them, PaperTruth
            leaves them open — tap one to see exactly how the vote fell and make your case.
          </motion.p>
          <motion.div
            className="hero-actions"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.26 }}
          >
            <a className="btn primary lg" href="#contested">
              See the {disputes.length} question{disputes.length === 1 ? '' : 's'}
            </a>
            <button
              type="button"
              className={onlyFlagged ? 'primary lg' : 'lg'}
              onClick={() => setOnlyFlagged((v) => !v)}
            >
              {onlyFlagged ? '✓ Flagged only' : 'Show flagged only'}
            </button>
          </motion.div>
        </div>
        <div className="scroll-cue" aria-hidden="true">
          <span>Scroll</span>
          <span>↓</span>
        </div>
      </div>

      <motion.div className="stat-strip" initial="initial" animate="animate" variants={staggerContainer.variants}>
        {tiles.map((tile) => (
          <Tilt key={tile.label} className="stat-tile" variants={staggerItem} style={{ '--tile-accent': tile.accent }}>
            <span className="stat-tile-icon" aria-hidden="true">
              {tile.icon}
            </span>
            <span className="stat-tile-value">
              {tile.prefix}
              <AnimatedNumber value={tile.value} />
            </span>
            <span className="stat-tile-label">{tile.label}</span>
          </Tilt>
        ))}
      </motion.div>

      <Section
        align="left"
        variant="wipeSide"
        id="contested"
        kicker="Ranked by disagreement"
        title="The contested questions"
        lead="Most split at the top. The little columns are how the class voted — the tall one is what the key currently says."
      >
        {disputes.length === 0 ? (
          <div className="empty">
            No computed answer key for this exam yet, or nothing is contested. An admin
            needs to compute it first.
          </div>
        ) : (
          <div className="grid" style={{ gap: 14 }}>
            {disputes.map((question, index) => {
              const disagreement = Math.round((question.normalisedEntropy || 0) * 100);
              const accent = question.disputed ? 'var(--warn)' : 'var(--method-majority)';
              return (
                <Reveal
                    key={question.questionNumber}
                    delay={Math.min(index, 6) * 0.05}
                    variant={index % 3 === 0 ? 'slideLeft' : index % 3 === 1 ? 'slideRight' : 'zoom'}
                  >
                  <Link
                    to={`/exams/${examId}/disputes/${question.questionNumber}`}
                    className="dispute-row-link"
                  >
                    <Tilt
                      as="article"
                      className={`dispute-tile${index === 0 ? ' dispute-tile--lead' : ''}${index > 0 && index < 3 ? ' dispute-tile--major' : ''}`}
                      max={4}
                      lift={4}
                      style={{ '--tile-accent': accent }}
                    >
                      {index === 0 && <span className="dispute-flag">Most contested</span>}
                      <span className="dispute-qbadge">
                        <small>Q</small>
                        {question.questionNumber}
                      </span>

                      <div className="dispute-tile-body">
                        <div className="row" style={{ gap: 8 }}>
                          {question.topic && <span className="topic-pill">{question.topic}</span>}
                          <DisputeBadge question={question} />
                        </div>
                        <p className="dispute-tile-text">
                          {question.text || 'No question text was recorded — the answers are all we have.'}
                        </p>
                        <div className="row tiny muted" style={{ gap: 14 }}>
                          <span>
                            key says <b className="mono">{question.consensusAnswer || '—'}</b>
                          </span>
                          <span>{question.totalResponses} answers</span>
                          <span>
                            💬 {question.postCount} post{question.postCount === 1 ? '' : 's'}
                          </span>
                          <span>{disagreement}% split</span>
                        </div>
                      </div>

                      <div className="dispute-tile-side">
                        <MiniBars
                          distribution={question.distribution}
                          winner={question.consensusAnswer}
                        />
                        <Ring
                          value={question.confidence || 0}
                          size={54}
                          color={accent}
                          fontSize="0.74rem"
                        />
                        <span className="dispute-arrow" aria-hidden="true">
                          →
                        </span>
                      </div>
                    </Tilt>
                  </Link>
                </Reveal>
              );
            })}
          </div>
        )}
      </Section>

      <Section
        kicker="Reading the room"
        title="What gets a question flagged"
        lead="Two different kinds of mess, plus what you can do about either one."
      >
        <div className="explain-grid">
          {LEGEND.map((item, index) => (
            <Reveal key={item.title} delay={index * 0.08} variant={index % 2 ? 'swing' : 'settle'}>
              <Tilt className="explain-card">
                <span className="explain-icon" aria-hidden="true">
                  {item.icon}
                </span>
                <div>
                  <strong>{item.title}</strong>
                  <span>{item.body}</span>
                </div>
              </Tilt>
            </Reveal>
          ))}
        </div>
      </Section>

      <Reveal variant="swing">
        <div className="cta-band">
          <div style={{ flex: 1, minWidth: 260 }}>
            <h2>Disputed questions aren't scored</h2>
            <p>
              None of these count for or against you — your results page shows them as a
              range instead, so a contested question never quietly costs you marks.
            </p>
          </div>
          <Link className="btn primary lg" to={`/exams/${examId}/results`}>
            See my score <span className="arrow">→</span>
          </Link>
        </div>
      </Reveal>
    </Page>
  );
}
