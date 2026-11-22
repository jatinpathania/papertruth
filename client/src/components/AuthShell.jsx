import { motion } from 'framer-motion';
import { Headline, Tilt } from './ui.jsx';
import { Brand } from './Layout.jsx';


const POINTS = [
  { icon: '🕶️', title: 'Pseudonymous', body: 'Answers link to an anonymous ID, never your name.' },
  { icon: '⚖️', title: 'Honest about doubt', body: 'Contested questions are flagged, not guessed.' },
  { icon: '📈', title: 'A score with a range', body: 'Best and worst case, never fake precision.' }
];

export default function AuthShell({ children }) {
  return (
    <div className="auth-shell">

      <section className="auth-pitch">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <Brand to="/login" />
        </motion.div>
        <motion.span
          className="section-kicker mt-3"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          ● Crowd-built answer keys
        </motion.span>
        <Headline
          className="hero-title"
          delay={0.15}
          lines={['The whole class', { text: 'remembers more', grad: true }, 'than you do.']}
        />
        <motion.p
          className="hero-lede"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.55, ease: [0.16, 1, 0.3, 1] }}
        >
          Pool everyone's memory of the paper into one probable answer key — and see
          exactly where nobody is really sure.
        </motion.p>
        <motion.ul
          className="auth-points"
          initial="initial"
          animate="animate"
          variants={{ animate: { transition: { staggerChildren: 0.09, delayChildren: 0.7 } } }}
        >
          {POINTS.map((point) => (
            <motion.li
              key={point.title}
              variants={{
                initial: { opacity: 0, x: -18 },
                animate: { opacity: 1, x: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } }
              }}
            >
              <span className="auth-point-icon" aria-hidden="true">
                {point.icon}
              </span>
              <span>
                <strong>{point.title}</strong>
                <span>{point.body}</span>
              </span>
            </motion.li>
          ))}
        </motion.ul>
      </section>

      <Tilt
        className="auth-card"
        max={5}
        lift={0}
        initial={{ opacity: 0, y: 30, scale: 0.94 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
      >
        {children}
      </Tilt>
    </div>
  );
}
