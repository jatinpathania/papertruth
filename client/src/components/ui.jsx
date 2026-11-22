import { useEffect, useId, useState } from 'react';
import {
  AnimatePresence,
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform
} from 'framer-motion';
import { METHOD_LABELS, METHOD_COLORS } from './charts/palette.js';
import { fadeUp, popIn, REVEAL } from './motion.js';

export function Page({ children, className = '' }) {
  return (
    <motion.div className={`page ${className}`} initial="initial" animate="animate" exit="exit" variants={fadeUp}>
      {children}
    </motion.div>
  );
}

export function Reveal({ children, className = '', delay = 0, variant = 'rise', ...rest }) {
  const reduce = useReducedMotion();
  const spec = REVEAL[variant] || REVEAL.rise;
  if (reduce) return <div className={className} {...rest}>{children}</div>;
  return (
    <motion.div
      className={className}
      initial={spec.from}
      whileInView={spec.to}
      viewport={{ once: true, margin: '-70px' }}
      transition={{ ...spec.transition, delay }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

// Layout primitives that let a section escape the standard centred column.
export function Bleed({ children, className = '', tone, cut = false }) {
  return (
    <div
      className={`bleed${cut ? ' bleed--cut' : ''} ${className}`}
      data-tone={tone || undefined}
    >
      <div className="bleed-inner">{children}</div>
    </div>
  );
}

export function Narrow({ children, className = '' }) {
  return <div className={`narrow ${className}`}>{children}</div>;
}

export function Bento({ children, className = '' }) {
  return <div className={`bento ${className}`}>{children}</div>;
}

export function BentoTile({ children, span = '', className = '', ...rest }) {
  return (
    <div className={`bento-tile ${span ? `bento-tile--${span}` : ''} ${className}`} {...rest}>
      {children}
    </div>
  );
}

// Kept as a component so call sites stay unchanged, but it no longer transforms
// anything: moving a card or button under the cursor made them feel laggy to press.
// Hover feedback is CSS-only now, and real motion lives in the background.
export function Tilt({ as: Tag = 'div', className = '', max, lift, children, style, ...rest }) {
  void max;
  void lift;
  const { variants, initial, animate, whileInView, viewport, transition, ...plain } = rest;
  void variants; void initial; void animate; void whileInView; void viewport; void transition;
  return (
    <Tag className={`tilt ${className}`} style={style} {...plain}>
      {children}
    </Tag>
  );
}

export function Headline({ lines, className = '', as = 'h1', delay = 0 }) {
  const Tag = motion[as] || motion.h1;
  let index = 0;
  const label = lines.map((line) => (typeof line === 'string' ? line : line.text)).join(' ');
  return (
    <Tag className={`headline ${className}`} aria-label={label} initial="initial" animate="animate">
      {lines.map((line, lineIndex) => {
        const part = typeof line === 'string' ? { text: line } : line;
        return (
          <span key={lineIndex} className="headline-line" aria-hidden="true">
            {part.text.split(' ').map((word, wordIndex, words) => {
              const i = index++;
              return (
                <motion.span
                  key={wordIndex}
                  className={`headline-word${part.grad ? ' grad' : ''}`}
                  variants={{
                    initial: { opacity: 0, y: '0.45em' },
                    animate: {
                      opacity: 1,
                      y: 0,
                      transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: delay + i * 0.045 }
                    }
                  }}
                >
                  {word}
                  {wordIndex < words.length - 1 ? ' ' : ''}
                </motion.span>
              );
            })}
          </span>
        );
      })}
    </Tag>
  );
}

export function Section({ kicker, title, lead, children, className = '', id, variant = 'rise', align = '' }) {
  return (
    <section className={`section ${align ? `section--${align}` : ''} ${className}`} id={id}>
      {(kicker || title || lead) && (
        <Reveal className="section-head" variant={variant}>
          {kicker && <span className="section-kicker">{kicker}</span>}
          {title && <h2>{title}</h2>}
          {lead && <p className="section-lead">{lead}</p>}
        </Reveal>
      )}
      {children}
    </section>
  );
}

// Typographic blocks. A page reaches for these when a paragraph would otherwise
// be the fourth one at the same size.
export function Lede({ children, size = 'md', className = '' }) {
  return <p className={`lede${size === 'xl' ? ' lede--xl' : ''} ${className}`}>{children}</p>;
}

export function PullQuote({ children, cite, className = '' }) {
  return (
    <blockquote className={`pull-quote ${className}`}>
      {children}
      {cite && <cite>{cite}</cite>}
    </blockquote>
  );
}

export function MixHead({ whisper, shout, grad = false, as = 'h2', className = '' }) {
  const Tag = as;
  return (
    <Tag className={`mix-head ${className}`}>
      {whisper && <span className="whisper">{whisper}</span>}
      <span className={`shout${grad ? ' grad' : ''}`}>{shout}</span>
    </Tag>
  );
}

export function FigureStrip({ items = [], className = '' }) {
  return (
    <div className={`figure-strip ${className}`}>
      {items.map((item) => (
        <div className="figure" key={item.label}>
          <span className="figure-value">
            {item.value}
            {item.unit && <span className="unit">{item.unit}</span>}
          </span>
          <span className="figure-label">{item.label}</span>
          {item.note && <span className="figure-note">{item.note}</span>}
        </div>
      ))}
    </div>
  );
}

export function DefList({ rows = [], className = '' }) {
  return (
    <div className={`def-list ${className}`}>
      {rows.map((row) => (
        <div className="def-row" key={row.term}>
          <h3 className="def-term">{row.term}</h3>
          <p className="def-desc">{row.desc}</p>
        </div>
      ))}
    </div>
  );
}

export function Card({ title, subtitle, actions, children, className = '', animated = false, ...rest }) {
  const content = (
    <>
      {(title || actions) && (
        <header className="card-head">
          <div>
            {title && <h3 className="card-title">{title}</h3>}
            {subtitle && <p className="card-sub">{subtitle}</p>}
          </div>
          {actions && <div className="row">{actions}</div>}
        </header>
      )}
      {children}
    </>
  );

  if (animated) {
    return (
      <motion.section className={`card ${className}`} initial="initial" animate="animate" variants={popIn} {...rest}>
        {content}
      </motion.section>
    );
  }

  return (
    <section className={`card ${className}`} {...rest}>
      {content}
    </section>
  );
}

export function AnimatedNumber({ value, decimals = 0, suffix = '' }) {
  const numeric = Number(value);
  const motionValue = useMotionValue(0);
  const rounded = useTransform(motionValue, (v) => v.toFixed(decimals));
  const [display, setDisplay] = useState((0).toFixed(decimals));

  useEffect(() => {
    if (Number.isNaN(numeric)) return undefined;
    const controls = animate(motionValue, numeric, { duration: 0.9, ease: [0.16, 1, 0.3, 1] });
    const unsubscribe = rounded.on('change', setDisplay);
    return () => {
      controls.stop();
      unsubscribe();
    };
  }, [numeric]);

  if (Number.isNaN(numeric)) return <>{value}</>;
  return (
    <>
      {display}
      {suffix}
    </>
  );
}

export function ScoreGauge({ value, max, size = 108, stroke = 10, label, hint }) {
  const safeMax = max || 1;
  const fraction = Math.max(0, Math.min(1, value / safeMax));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const [dash, setDash] = useState(circumference);
  const gradientId = `gauge-${useId().replace(/:/g, '')}`;
  const tickRadius = radius + stroke + 4;
  const tickCircumference = 2 * Math.PI * tickRadius;

  useEffect(() => {
    const controls = animate(circumference, circumference * (1 - fraction), {
      duration: 1.4,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: setDash
    });
    return () => controls.stop();
  }, [fraction, circumference]);

  return (
    <div className="gauge">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#7cf3ff" />
            <stop offset="55%" stopColor="#22e2f5" />
            <stop offset="100%" stopColor="#c084fc" />
          </linearGradient>
        </defs>
        <circle
          className="gauge-ticks"
          cx={size / 2}
          cy={size / 2}
          r={tickRadius}
          strokeDasharray={`1.5 ${tickCircumference / 60 - 1.5}`}
        />
        <circle className="gauge-track" cx={size / 2} cy={size / 2} r={radius} style={{ strokeWidth: stroke }} />
        <circle
          className="gauge-fill"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={`url(#${gradientId})`}
          style={{ stroke: `url(#${gradientId})`, strokeWidth: stroke }}
          strokeDasharray={circumference}
          strokeDashoffset={dash}
        />
        <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central" className="gauge-value">
          <AnimatedNumber value={value} decimals={1} />
        </text>
      </svg>
      <div>
        {label && <div className="stat-label">{label}</div>}
        <div className="gauge-max">out of {formatNumber(max, 0)}</div>
        {hint && <div className="stat-hint">{hint}</div>}
      </div>
    </div>
  );
}

export function Ring({ value, size = 56, stroke = 5, color = 'var(--brand)', label, fontSize = '0.8rem' }) {
  const fraction = Math.max(0, Math.min(1, Number(value) || 0));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const [offset, setOffset] = useState(circumference);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setOffset(circumference * (1 - fraction)));
    return () => cancelAnimationFrame(frame);
  }, [fraction, circumference]);

  return (
    <span className="ring" style={{ '--ring-color': color, width: size, height: size }}>
      <svg width={size} height={size}>
        <circle className="ring-track" cx={size / 2} cy={size / 2} r={radius} strokeWidth={stroke} />
        <circle
          className="ring-fill"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <span className="ring-label" style={{ fontSize, color }}>
        {label ?? `${Math.round(fraction * 100)}%`}
      </span>
    </span>
  );
}

export function MiniBars({ distribution = {}, winner, max = 5 }) {
  const options = Object.keys(distribution).sort().slice(0, max);
  if (!options.length) return null;
  const peak = Math.max(...options.map((o) => distribution[o] || 0), 1);

  return (
    <div className="mini-bars" aria-hidden="true">
      {options.map((option) => (
        <span key={option} className={`mini-bar${option === winner ? ' win' : ''}`}>
          <span className="mini-bar-track">
            <motion.span
              className="mini-bar-col"
              initial={{ height: 0 }}
              whileInView={{ height: `${Math.max(((distribution[option] || 0) / peak) * 100, 8)}%` }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            />
          </span>
          <span className="mini-bar-label">{option}</span>
        </span>
      ))}
    </div>
  );
}

export function OptionTiles({ distribution = {}, winner, total }) {
  const options = Object.keys(distribution).sort();
  if (!options.length) return <p className="muted small mb-0">No answers were recorded for this question.</p>;
  const sum = total ?? options.reduce((acc, o) => acc + (distribution[o] || 0), 0);

  return (
    <div className="option-tiles">
      {options.map((option, index) => {
        const count = distribution[option] || 0;
        const share = sum > 0 ? count / sum : 0;
        const isWinner = option === winner;
        return (
          <motion.div
            key={option}
            className={`option-tile${isWinner ? ' win' : ''}`}
            style={{
              '--share': `${Math.max(share * 100, 3)}%`,
              '--tile-accent': isWinner ? 'var(--brand)' : 'var(--text-muted)'
            }}
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1], delay: index * 0.07 }}
          >
            <span className="option-tile-letter">{option}</span>
            <span className="option-tile-share">
              <AnimatedNumber value={share * 100} decimals={0} suffix="%" />
            </span>
            <span className="option-tile-count">{count} picked it</span>
            {isWinner && <span className="option-tile-crown">★ class answer</span>}
          </motion.div>
        );
      })}
    </div>
  );
}

export function Disclosure({ summary, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="disclosure">
      <button
        type="button"
        className="disclosure-trigger"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span>{summary}</span>
        <motion.span
          className="disclosure-chevron"
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          aria-hidden="true"
        >
          ▾
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            style={{ overflow: 'hidden' }}
          >
            <div className="disclosure-body">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function OutcomeGrid({ rows = [], onSelect, selected }) {
  const toneClass = {
    CORRECT: 'correct',
    INCORRECT: 'incorrect',
    DISPUTED: 'disputed',
    UNATTEMPTED: 'unattempted'
  };
  return (
    <div className="outcome-grid">
      {rows.map((row) => (
        <motion.button
          key={row.questionNumber}
          type="button"
          className={`outcome-chip ${toneClass[row.outcome] || 'unattempted'}${
            selected === row.questionNumber ? ' active' : ''
          }`}
          onClick={() => onSelect?.(row)}
          title={`Q${row.questionNumber} — ${row.topic || ''}`}
        >
          {row.questionNumber}
        </motion.button>
      ))}
    </div>
  );
}

export function Stat({ label, value, hint, accent = false }) {
  return (
    <div className={`stat${accent ? ' accent' : ''}`}>
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
      {hint && <span className="stat-hint">{hint}</span>}
    </div>
  );
}

export function Badge({ tone = 'neutral', children }) {
  return <span className={`badge ${tone}`}>{children}</span>;
}

export function Spinner({ label = 'Loading…' }) {
  return (
    <motion.div
      className="loading-block"
      role="status"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4, delay: 0.15 }}
    >
      <span className="loader-orb" aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
      {label}
    </motion.div>
  );
}

export function Empty({ children }) {
  return <div className="empty">{children}</div>;
}

export function ErrorNote({ error, onRetry }) {
  if (!error) return null;
  const isOffline = error.status === 0;
  return (
    <div className={`notice ${isOffline ? 'warn' : 'danger'}`}>
      <strong>{isOffline ? 'Cannot reach the server.' : 'Something went wrong.'}</strong>{' '}
      {error.message}
      {onRetry && (
        <>
          {' '}
          <button className="small subtle" onClick={onRetry} type="button">
            Try again
          </button>
        </>
      )}
    </div>
  );
}

export function MethodTag({ method, short = false, labels = METHOD_LABELS }) {
  const color = METHOD_COLORS[method];
  const label = labels[method] || METHOD_LABELS[method] || method;
  return (
    <span className="nowrap">
      <span className="method-swatch" style={{ background: color }} aria-hidden="true" />
      {short ? label.replace('Surprisingly popular', 'Surp. popular') : label}
    </span>
  );
}

export function StatusBadge({ exam }) {
  if (!exam) return null;
  if (exam.status === 'OPEN' && exam.acceptingSubmissions) return <Badge tone="ok">Open for answers</Badge>;
  if (exam.status === 'OPEN') return <Badge tone="warn">Window not active</Badge>;
  if (exam.status === 'CLOSED') return <Badge tone="neutral">Closed</Badge>;
  return <Badge tone="brand">Results computed</Badge>;
}

export function DistributionBars({ distribution = {}, consensusAnswer, officialAnswer, total }) {
  const options = Object.keys(distribution).sort();
  const sum = total ?? options.reduce((acc, o) => acc + (distribution[o] || 0), 0);
  if (!options.length) return <p className="muted small mb-0">No answers recorded for this question.</p>;

  return (
    <div className="dist">
      {options.map((option) => {
        const count = distribution[option] || 0;
        const share = sum > 0 ? count / sum : 0;
        const isConsensus = option === consensusAnswer;
        const isOfficial = officialAnswer !== undefined && option === officialAnswer;
        return (
          <div
            key={option}
            className={`dist-row${isOfficial ? ' truth' : isConsensus ? ' consensus' : ''}`}
          >
            <span className="dist-option">{option}</span>
            <span className="dist-track">
              <span className="dist-fill" style={{ width: `${Math.max(share * 100, 1.5)}%` }} />
            </span>
            <span className="dist-count">
              {(share * 100).toFixed(0)}% · {count}
              {isConsensus ? ' ✓' : ''}
              {isOfficial ? ' ★' : ''}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function DisputeBadge({ question }) {
  if (!question?.disputed) return <Badge tone="ok">Consensus</Badge>;
  const reasons = question.disputeReasons || [];
  const label = reasons.includes('HIGH_ENTROPY')
    ? reasons.includes('NARROW_MARGIN')
      ? 'Disputed — scattered and split'
      : 'Disputed — answers scattered'
    : 'Disputed — too close to call';
  return <Badge tone="warn">{label}</Badge>;
}

export function OutcomeBadge({ outcome }) {
  switch (outcome) {
    case 'CORRECT':
      return <Badge tone="ok">✓ Matches consensus</Badge>;
    case 'INCORRECT':
      return <Badge tone="danger">✗ Differs</Badge>;
    case 'DISPUTED':
      return <Badge tone="warn">⚠ Not scored — disputed</Badge>;
    case 'UNATTEMPTED':
      return <Badge tone="neutral">— Not answered</Badge>;
    default:
      return <Badge tone="neutral">No consensus</Badge>;
  }
}

export function MethodPicker({ value, methods = [], onChange, id = 'method-picker', label = 'Method', labels = METHOD_LABELS }) {
  return (
    <span className="row" style={{ gap: 8 }}>
      <label htmlFor={id} style={{ margin: 0 }}>
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        style={{ width: 'auto' }}
      >
        {methods.map((method) => (
          <option key={method} value={method}>
            {labels[method] || METHOD_LABELS[method] || method}
          </option>
        ))}
      </select>
    </span>
  );
}

export function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export function formatNumber(value, digits = 2) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return Number(value).toFixed(digits);
}

export function percentText(value, digits = 1) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return `${(value * 100).toFixed(digits)}%`;
}
