import { lazy, Suspense } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { Page, Reveal, Section, Bleed, Headline, FigureStrip, PullQuote } from '../components/ui.jsx';

const Scene3D = lazy(() => import('../components/Scene3D.jsx'));

const PILLARS = [
  {
    icon: '📊',
    title: 'Weighted consensus',
    body: 'Smarter than majority vote. Reliable recollections count for more.'
  },
  {
    icon: '🛡️',
    title: 'Honest disputes',
    body: "We flag what we're unsure about instead of guessing."
  },
  {
    icon: '👥',
    title: 'Fair for everyone',
    body: 'Anonymous and transparent. Nobody sees who answered what.'
  }
];

const SCALE = [
  { value: '1', label: 'paper', note: 'One exam, reconstructed from memory alone.' },
  { value: '150', unit: '+', label: 'recollections', note: 'The more sheets arrive, the sharper the key gets.' },
  { value: '3', label: 'methods, side by side', note: 'Majority, weighted and popularity-aware — never one hidden number.' },
  { value: '0', label: 'questions guessed', note: 'Where the class is split, nothing is scored.' }
];

const STEPS = [
  {
    title: 'Everyone writes down what they remember',
    body: 'No solving, no leaked paper. Just recollections, submitted anonymously.'
  },
  {
    title: 'The crowd is weighted, not counted',
    body: 'Students who track the emerging consensus across the paper count for more on the questions that split the class.'
  },
  {
    title: 'Contested questions go to discussion',
    body: 'Where the class genuinely disagrees, nothing is scored. The question opens for debate instead.'
  }
];

export default function Landing() {
  const { user } = useAuth();
  const primaryTo = user ? '/exams' : '/register';
  const primaryLabel = user ? 'View exams' : 'Get started';

  return (
    <Page className="p-landing landing">
      <section className="landing-hero">
        <div className="landing-hero-copy">
          <span className="landing-wordmark">PaperTruth</span>
          <Headline
            className="landing-title"
            lines={["The class's", { text: 'answer key.', grad: true }]}
          />
          <p className="landing-lede">
            We reconstruct a probable answer key from the whole cohort's recollections —
            and show where the class disagrees.
          </p>
          <div className="landing-actions">
            <Link className="btn primary lg" to={primaryTo}>
              {primaryLabel} <span className="arrow">→</span>
            </Link>
            <Link className="btn lg" to="/about">
              Learn more
            </Link>
          </div>
        </div>

        <div className="landing-hero-art" aria-hidden="true">
          <Suspense fallback={null}>
            <Scene3D layout="right" />
          </Suspense>
        </div>
      </section>

      <Reveal variant="rise">
        <FigureStrip items={SCALE} />
      </Reveal>

      <div className="landing-pillars">
        {PILLARS.map((pillar, index) => (
          <Reveal
            key={pillar.title}
            delay={index * 0.08}
            variant={index === 1 ? 'settle' : 'rise'}
          >
            <article className="pillar-card">
              <span className="pillar-icon" aria-hidden="true">
                {pillar.icon}
              </span>
              <h3>{pillar.title}</h3>
              <p>{pillar.body}</p>
            </article>
          </Reveal>
        ))}
      </div>

      <Bleed tone="quiet">
        <Section
          align="left"
          variant="wipeSide"
          kicker="How it works"
          title="Three steps, no guesswork"
          lead="The point is not to be fast. It is to be honest about what a cohort collectively knows — and about what it does not."
        >
          <ol className="landing-steps">
            {STEPS.map((step, index) => (
              <Reveal
                key={step.title}
                delay={index * 0.1}
                variant={index % 2 ? 'slideRight' : 'slideLeft'}
              >
                <li className="landing-step">
                  <span className="landing-step-num">{index + 1}</span>
                  <div>
                    <h3>{step.title}</h3>
                    <p>{step.body}</p>
                  </div>
                </li>
              </Reveal>
            ))}
          </ol>
        </Section>
      </Bleed>

      <Reveal variant="slideLeft">
        <PullQuote cite="Why the weighting exists">
          A question built on a common misconception is answered <em>wrongly by most of
          the class</em>. Plain voting locks that mistake in — and reports it confidently.
        </PullQuote>
      </Reveal>

      <Reveal variant="zoom">
        <div className="landing-cta">
          <div>
            <h2>The key gets better with every sheet</h2>
            <p>
              Each person who adds what they remember sharpens the key for everyone else —
              including the questions currently marked as contested.
            </p>
          </div>
          <Link className="btn primary lg" to={primaryTo}>
            {primaryLabel} <span className="arrow">→</span>
          </Link>
        </div>
      </Reveal>
    </Page>
  );
}
