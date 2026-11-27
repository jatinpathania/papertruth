import { Suspense, useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { motion, useMotionValueEvent, useScroll } from 'framer-motion';
import { useAuth } from '../context/AuthContext.jsx';
import { prefetch, prefetchIdle } from '../routes.js';

// The official mark, cut out of its white backing so only the logo shows. It
// is the same file the favicon uses, and it is eager rather than lazy: it sits
// in the first thing painted, where a late-arriving logo is a visible pop.
export function BrandMark() {
  return (
    <span className="brand-mark" aria-hidden="true">
      <img src="/logo.png" alt="" width="256" height="256" decoding="async" />
    </span>
  );
}

export function Brand({ to = '/' }) {
  return (
    <NavLink to={to} className="brand">
      <BrandMark />
      <span>
        Paper<b>Truth</b>
      </span>
    </NavLink>
  );
}

function initials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] || '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase() || '?';
}

const warm = (to) => ({ onMouseEnter: () => prefetch(to), onFocus: () => prefetch(to), onTouchStart: () => prefetch(to) });

export default function Layout() {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { scrollY, scrollYProgress } = useScroll();
  const [scrolled, setScrolled] = useState(false);
  const [showTop, setShowTop] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useMotionValueEvent(scrollY, 'change', (value) => {
    setScrolled(value > 16);
    setShowTop(value > 700);
  });

  // The route swap is instant, so scrolling back up is ours to do.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  useEffect(() => {
    prefetchIdle(user ? ['/exams', '/results', '/about'] : ['/about', '/register']);
  }, [user]);

  const links = [
    { to: '/', label: 'Home', end: true },
    { to: '/exams', label: 'Exams' },
    { to: '/results', label: 'Results' },
    { to: '/about', label: 'About' },
    ...(isAdmin ? [{ to: '/admin', label: 'Admin', end: true }] : [])
  ];

  const signOut = () => {
    logout();
    setMenuOpen(false);
    navigate('/', { replace: true });
  };

  return (
    <div className="app">
      <motion.div className="scroll-progress" style={{ scaleX: scrollYProgress }} aria-hidden="true" />

      <header className={`topbar${scrolled ? ' scrolled' : ''}`}>
        <Brand />

        <nav className={`nav${menuOpen ? ' open' : ''}`} aria-label="Main">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              onClick={() => setMenuOpen(false)}
              {...warm(link.to)}
            >
              {link.label}
            </NavLink>
          ))}
        </nav>

        <div className="topbar-end">
          {user ? (
            <div className="user-chip">
              <span className="avatar" aria-hidden="true">
                {initials(user.name)}
              </span>
              <span className="user-meta">
                <span className="user-name">{user.name}</span>
                <span className="user-role">{isAdmin ? 'Exam cell' : 'Student'}</span>
              </span>
              <button type="button" className="small subtle" onClick={signOut}>
                Sign out
              </button>
            </div>
          ) : (
            <div className="auth-actions">
              <Link className="btn subtle" to="/login">
                Login
              </Link>
              <Link className="btn primary" to="/register" {...warm('/register')}>
                Register
              </Link>
            </div>
          )}

          <button
            type="button"
            className="nav-toggle icon-btn subtle no-ripple"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? '✕' : '☰'}
          </button>
        </div>
      </header>

      <main>
        <Suspense fallback={<div className="route-loading"><span className="spinner" /></div>}>
          <Outlet />
        </Suspense>
      </main>

      <footer className="site-footer">
        <div className="footer-grid">
          <div className="footer-about">
            <Brand />
            <p>
              Crowd-built answer keys — honest about what the class isn't sure of.
              Reconstructed from what everyone remembers, never from a leaked paper.
            </p>
          </div>

          <nav aria-label="Product">
            <h4>Product</h4>
            <NavLink to="/exams" {...warm('/exams')}>Exams</NavLink>
            <NavLink to="/results" {...warm('/results')}>Your results</NavLink>
            <NavLink to="/about" {...warm('/about')}>How it works</NavLink>
          </nav>

          <nav aria-label="Methods">
            <h4>Methods</h4>
            <NavLink to="/about" {...warm('/about')}>Weighted consensus</NavLink>
            <NavLink to="/about" {...warm('/about')}>Simple majority</NavLink>
            <NavLink to="/about" {...warm('/about')}>Popularity-aware</NavLink>
          </nav>

          <nav aria-label="Account">
            <h4>Account</h4>
            {user ? (
              <>
                <NavLink to="/exams" {...warm('/exams')}>Dashboard</NavLink>
                {isAdmin && <NavLink to="/admin" {...warm('/admin')}>Exam cell</NavLink>}
                <button type="button" className="link-button no-ripple" onClick={signOut}>
                  Sign out
                </button>
              </>
            ) : (
              <>
                <NavLink to="/login">Login</NavLink>
                <NavLink to="/register" {...warm('/register')}>Register</NavLink>
              </>
            )}
          </nav>
        </div>

        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} PaperTruth</span>
          <span className="footer-note">Anonymous by design · Contested questions are never scored</span>
          <a
            href="#top"
            onClick={(event) => (event.preventDefault(), window.scrollTo({ top: 0, behavior: 'smooth' }))}
          >
            Back to top ↑
          </a>
        </div>
      </footer>

      {showTop && (
        <button
          type="button"
          className="to-top icon-btn primary no-ripple"
          aria-label="Back to top"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        >
          ↑
        </button>
      )}
    </div>
  );
}
