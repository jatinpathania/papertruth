import { Link } from 'react-router-dom';
import {
  Page,
  Reveal,
  Section,
  Bleed,
  Narrow,
  Lede,
  PullQuote,
  MixHead,
  DefList,
  FigureStrip
} from '../components/ui.jsx';

const METHODS = [
  {
    name: 'Simple majority',
    tone: 'majority',
    body: 'Count the votes, take the winner. The baseline — and the thing that fails on trap questions, because a shared misconception outvotes the people who actually remember.'
  },
  {
    name: 'Balanced (weighted)',
    tone: 'em',
    body: "Reliability is inferred, not declared. Someone who tracks the emerging consensus across the rest of the paper counts for more on the questions that split the class. This is the one we recommend."
  },
  {
    name: 'Popularity-aware',
    tone: 'sp',
    body: 'Each person also predicts what most people answered. The option chosen more often than it was predicted to be is the one an informed minority knows about.'
  }
];

const GUARANTEES = [
  {
    icon: '⚖️',
    accent: 'var(--method-sp)',
    title: 'It admits what it does not know',
    body: 'Contested questions are left unscored and sent to a discussion page, rather than quietly picked for you.'
  },
  {
    icon: '🕶️',
    accent: 'var(--accent)',
    title: 'Nobody sees your name',
    body: 'Answers and discussion posts are pseudonymous. Your classmates see the argument, not who made it.'
  },
  {
    icon: '📈',
    accent: 'var(--ok)',
    title: 'A score with a range',
    body: 'You get a best case and a worst case, so a handful of disputed questions never turns into a fake-precise number.'
  }
];

const VOCAB = [
  {
    term: 'Consensus',
    desc: 'The answer the cohort converges on once reliability is taken into account. Not the same thing as the most popular answer.'
  },
  {
    term: 'Contested',
    desc: 'A question where the answers are scattered, or where the top two are nearly tied. It is excluded from your score and opened for discussion instead.'
  },
  {
    term: 'Weight',
    desc: 'How much one person’s recollection counts on a hard question, inferred from how closely they matched the cohort everywhere else.'
  },
  {
    term: 'Range',
    desc: 'Your score if every contested question went your way, and your score if none of them did. The truth sits between the two.'
  }
];

const SHAPE = [
  { value: '2', label: 'weeks', note: 'Typical wait for an official key — if one is published at all.' },
  { value: '100', unit: '%', label: 'anonymous', note: 'Every answer and every post carries an ID, never a name.' },
  { value: '3', label: 'methods shown', note: 'You compare them yourself rather than trusting one.' }
];

const FAQ = [
  {
    q: 'Is this cheating?',
    a: 'No. Nothing here touches the paper before or during the exam. It only works on what people remember afterwards, once the exam is over.'
  },
  {
    q: 'Can other students see my answers?',
    a: 'No. Submissions and discussion posts carry an anonymous respondent ID, never your name. Classmates see the argument, not who made it.'
  },
  {
    q: 'What if the class is genuinely split?',
    a: 'Then we say so. A question where the answers are scattered, or where the top two are nearly tied, is marked contested, left out of your score, and opened for discussion instead.'
  },
  {
    q: 'So how accurate is my score?',
    a: "You get a range, not a false-precise number. Contested questions are excluded, so your real score sits between a best case and a worst case — and we show you both."
  }
];

export default function About() {
  return (
    <Page className="p-about">
      <header className="about-hero">
        <MixHead
          as="h1"
          whisper="About PaperTruth"
          shout="What this actually does"
          grad
        />
        <Lede size="xl">
          An exam ends. The official key will not appear for weeks — if ever.
        </Lede>
        <p className="about-lede drop-cap">
          Hundreds of students remember what they wrote, but no single person knows the
          truth. PaperTruth combines those recollections into a probable answer key, and
          is explicit about the questions where no reliable consensus exists.
        </p>
      </header>

      <Reveal variant="rise">
        <FigureStrip items={SHAPE} />
      </Reveal>

      <Bleed cut>
        <Narrow>
          <span className="label-caps">The core idea</span>
          <h2>Majority vote fails exactly where it matters</h2>
          <PullQuote cite="The problem with counting">
            A question built around a common misconception is answered{' '}
            <em>wrongly by most of the class</em>.
          </PullQuote>
          <p>
            Plain voting locks that mistake in, and reports it with high confidence. So we
            stop treating every respondent as equally informative — and infer who was
            recalling the paper well from how they did on the rest of it.
          </p>
        </Narrow>
      </Bleed>

      <Section
        align="left"
        variant="slideLeft"
        kicker="Three methods"
        title="You can see all of them, side by side"
        lead="Nothing is hidden behind one number. Every exam is scored by each method so you can compare."
      >
        <div className="about-methods">
          {METHODS.map((method, index) => (
            <Reveal
              key={method.name}
              delay={index * 0.08}
              variant={index === 1 ? 'zoom' : index === 0 ? 'slideLeft' : 'slideRight'}
            >
              <article className={`about-method about-method--${method.tone}`}>
                <h3>{method.name}</h3>
                <p>{method.body}</p>
              </article>
            </Reveal>
          ))}
        </div>
      </Section>

      <Section
        align="left"
        variant="wipe"
        kicker="Four words"
        title="The vocabulary, once"
        lead="These four turn up on every results page. Worth two minutes."
      >
        <Reveal variant="rise">
          <DefList rows={VOCAB} />
        </Reveal>
      </Section>

      <Bleed tone="quiet">
        <Section
          align="left"
          variant="settle"
          kicker="Why bother"
          title="Built to be trusted, not just fast"
          lead="An answer key you cannot question is just a rumour with better formatting."
        >
          <div className="guarantees">
            {GUARANTEES.map((item, index) => (
              <Reveal
                key={item.title}
                delay={index * 0.08}
                variant={index === 0 ? 'slideLeft' : index === 1 ? 'zoom' : 'slideRight'}
              >
                <article className="guarantee-card" style={{ '--tile-accent': item.accent }}>
                  <span className="guarantee-icon" aria-hidden="true">
                    {item.icon}
                  </span>
                  <h3>{item.title}</h3>
                  <p>{item.body}</p>
                </article>
              </Reveal>
            ))}
          </div>
        </Section>
      </Bleed>

      <Section
        align="right"
        variant="wipe"
        kicker="Questions"
        title="The things people ask first"
      >
        <div className="about-faq">
          {FAQ.map((item, index) => (
            <Reveal key={item.q} delay={index * 0.06} variant={index % 2 ? 'settle' : 'rise'}>
              <article className="about-faq-item">
                <h3>{item.q}</h3>
                <p>{item.a}</p>
              </article>
            </Reveal>
          ))}
        </div>
      </Section>

      <Reveal variant="zoom">
        <div className="landing-cta">
          <div>
            <h2>See it on a real paper</h2>
            <p>Open an exam, add what you remember, and watch the key sharpen.</p>
          </div>
          <Link className="btn primary lg" to="/exams">
            View exams <span className="arrow">→</span>
          </Link>
        </div>
      </Reveal>
    </Page>
  );
}
