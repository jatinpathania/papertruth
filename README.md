# PaperTruth

**A crowd-consensus answer key for college exams — honest about the questions it cannot call.**

After a sessional, the official key usually appears far too late, or never. Yet the
information needed to settle it already exists, spread across the memories of the
hundreds of students who wrote the paper. PaperTruth pools those independent
recollections into a probable answer key, and separately identifies the questions where
**no reliable consensus exists**.

The central design decision: **it does not use majority voting.** Majority voting fails
precisely on the hard questions, where the majority is confidently wrong. Instead each
respondent is weighted by a reliability *inferred* from how closely they tracked the
emerging consensus across the rest of the same paper.

---

## The result that matters

`npm run simulate` builds a 50-question exam with a **known** key and 155 respondents.
Seven questions are traps — built on a shared misconception, so the plurality answer is
wrong — and four are unrecallable, with support spread evenly across the options.

| Method               | Overall | Trap questions | Unrecallable |
| -------------------- | ------- | -------------- | ------------ |
| Majority vote        | 84%     | **0 / 7**      | 3 / 4        |
| Weighted EM          | **94%** | **6 / 7**      | 2 / 4        |
| Surprisingly popular | **94%** | **7 / 7**      | 1 / 4        |

Weighting overturned the plurality on 7 questions: 6 corrected, 1 made worse. EM
converged in 7 iterations, and the reliability it inferred correlates with the
respondents' true hidden ability at **r ≈ 0.88**.

Read the *shape*, not the height. As the cohort grows from 10 to 155 respondents,
majority voting stays flat at ~84% because its errors are systematic — everyone shares
the misconception, so more respondents cannot fix it. The weighted methods climb from
89% to ~95%, because more respondents mean sharper reliability estimates. That gap is the
project's actual finding.

---

## How it works

1. **Submit** — students record what they remember, one submission per exam, blanks
   welcome. Optionally they also predict *what most people answered*.
2. **Weight, don't count** — a simplified single-parameter Dawid–Skene estimator runs EM
   over the respondent × question matrix, alternating between estimating each answer and
   each respondent's reliability. Short free-text answers are first canonicalised with
   Levenshtein distance and clustered by connected components.
3. **Admit uncertainty** — Shannon entropy over the answer distribution, plus the margin
   between the top two options, flag a question as *contested*. Contested questions are
   excluded from scoring and opened for discussion instead of being guessed.
4. **Report a range** — every score is a best case and a worst case, so excluded
   questions never turn into false precision.

Three methods always run side by side — majority, weighted EM, and surprisingly popular —
so nothing hides behind a single number. Admins can upload the official key afterwards to
score the methods against ground truth.

**Anonymity is structural, not a setting.** A respondent ID is
`HMAC-SHA256(secret, "userId:examId")`, so it is stable within an exam, different across
exams, and no reversible identity mapping is ever stored.

---

## Quick start

Needs Node 18+ and a local MongoDB on `127.0.0.1:27017`.

```bash
npm run install:all
npm run dev          # API on :5000, app on :5173, seeds a demo cohort if empty
```

Open <http://localhost:5173>. Other scripts:

```bash
npm run stop         # frees the dev ports if anything lingers
npm run simulate     # reseed the demo cohort
npm test             # 91 tests, node:test, no DB needed
npm run verify       # tests + production build
```

`server/.env` and `client/.env` are created from their `.example` files on first run,
with a fresh `JWT_SECRET` generated for you. `VITE_API_URL` is intentionally blank — the
Vite dev server proxies `/api`, so the browser only ever talks to one origin.

### Accounts

Self-registration always creates a student — `/register` hardcodes the role, since a
client that could pick its own would be an obvious privilege-escalation hole. Admin
accounts therefore come only from the seeder.

A forgotten password is recovered the same way an address is proved at sign-up: a
six-digit code is mailed out, and proving it buys a short-lived ticket that the reset
page spends on the new password. `/api/auth/password/forgot` answers identically whether
or not the address has an account, so the form cannot be used to find out who is
registered here. Without SMTP configured, the code is returned in the response and shown
in the dialog, which is how the flow is exercised locally — that only ever happens
outside production.

The seeder (`server/scripts/simulate.js`) is deliberately **not** in this repository: it
carries the sign-in credentials for the deployed instance. The simulation modules it
drives are here — `server/src/services/simulation/generateCohort.js` builds the cohort,
and `server/tests/` covers every consensus module it exercises — so the results below are
reproducible from the code, but you will need your own seeding entry point and your own
accounts.

### A five-minute tour

1. Admin → the seeded exam → **Live monitor**; in a private window, register a student
   and submit answers, and watch the counter move.
2. Admin → **Analytics** → *where reliability weighting changed the answer*. Those are
   the traps.
3. Admin → **Validation** → method comparison and the accuracy-vs-cohort-size curve. Note
   the flat majority line.
4. Admin → **Integrity** → both planted colluding groups, with the evidence.

---

## Stack and layout

React 18 · Vite · Framer Motion · Recharts · Three.js · Express · MongoDB (Mongoose) · JWT

```
api/index.js              Vercel serverless entry — wraps the same Express app
client/src/               React SPA: pages/, components/, context/, api/
server/src/
  app.js                  createApp() factory, shared by server and serverless
  routes/                 8 modules, 33 endpoints under /api
  services/consensus/     11 modules — matrix, entropy, majority, weightedEM,
                          surprisinglyPopular, shortAnswer, groups, integrity,
                          ranking, scoring, validation
  models/                 7 schemas; double submission is blocked by a unique index
server/tests/             one test file per consensus module
```

`createApp()` being a factory is what lets the identical Express app run as a long-lived
server locally and as a serverless handler on Vercel, with the Mongoose connection cached
across invocations.

## Deployment

One Vercel project serves both halves: `client/dist` as static assets, and `api/index.js`
as a serverless function at `/api/*` — same origin, so no CORS. Set `MONGODB_URI`,
`JWT_SECRET` and `CLIENT_URL`; leave `VITE_API_URL` unset. Use the **same**
`JWT_SECRET` everywhere, or respondent IDs will not match across environments.

WebSockets cannot survive on serverless, so the client polls a cheap submission count and
only fetches the full consensus when that count actually moves. Routes emit through an
optional `io` handle, so the serverless bundle never pulls socket.io in.

## Honest limitations

- Reliability is a **single** parameter per respondent, not a full confusion matrix. It is
  more stable on small cohorts and far easier to explain, but it cannot model someone who
  is strong on one topic and weak on another.
- The surprisingly-popular method needs prediction data; without it only two methods run.
- Accuracy figures come from a **simulated** cohort with a known key. They show the
  methods behave as intended, not how the app performs on a real exam hall.
- Entropy and margin thresholds are configurable per exam and were tuned on seeded data.

## Provenance

Final-year CSE project. The algorithms follow Dawid & Skene, *Maximum Likelihood
Estimation of Observer Error-Rates Using the EM Algorithm* (JRSS-C, 1979) for the
reliability-weighted consensus, simplified here to one parameter per respondent; Prelec,
Seung & McCoy, *A solution to the single-question crowd wisdom problem* (Nature, 2017) for
the surprisingly-popular criterion; and Shannon (1948) for the entropy used in dispute
scoring.
