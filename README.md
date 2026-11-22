# PaperTruth

**A crowd-consensus answer key and dispute resolution system for internal college exams.**

After a sessional, the official answer key usually never appears, or appears far too
late. Students argue in group chats about which option was right, nobody can estimate
their score, genuinely defective questions go unreported, and nothing is recorded.

But the information needed to settle all of it already exists — distributed across the
memories of the hundreds of students who wrote the paper. PaperTruth aggregates those
independent recollections into a probable answer key, and, separately, identifies the
questions where **no reliable consensus exists**.

The key design decision: **it does not use majority voting.** Majority voting fails
precisely on the hard questions, where the majority is confidently wrong. Instead every
respondent is weighted by a reliability that is *inferred* from their agreement with the
emerging consensus across the rest of the same paper.

---

## Contents

- [What it does](#what-it-does)
- [Results on the seeded cohort](#results-on-the-seeded-cohort)
- [Getting started](#getting-started)
- [The consensus algorithm in plain language](#the-consensus-algorithm-in-plain-language) ← for the report
- [Project structure](#project-structure)
- [API reference](#api-reference)
- [Testing](#testing)
- [Design decisions and honest limitations](#design-decisions-and-honest-limitations)

---

## What it does

**For students**

- Submit what you remember answering — one submission per exam, blanks welcome.
- Optionally answer a second question per item: *which option do you think most people
  chose?* That is what powers the surprisingly-popular criterion.
- See an estimated score, a per-question comparison against the consensus, and a
  topic-wise breakdown of where marks were lost.
- Browse the disputed questions, ranked, each with its answer distribution and a
  discussion thread.

**For the exam cell (admin)**

- Create an exam and define the questions — the question *text* is optional, because
  students usually no longer have the paper.
- Watch submissions arrive live over Socket.IO, and watch the consensus's confidence
  firm up as they do.
- Compute the consensus with three methods and compare them side by side.
- Upload the official key after the fact and measure every method against it, including
  the accuracy-vs-cohort-size learning curve.
- Read the integrity report: groups whose submissions are correlated far beyond chance.

**Privacy.** Answers are stored against a pseudonymous `respondentId` — an HMAC of
(user, exam) keyed by the server secret. `userId` is never returned by any API response
that carries answers. The pseudonym is stable within one exam (so weights, posts and
clusters line up) and different for the same student in a different exam (so their
answers cannot be joined across papers into a profile).

---

## Results on the seeded cohort

`npm run simulate` builds a 50-question exam with a **known** answer key and 155
respondents whose abilities are drawn from a truncated normal. Seven questions are
**traps** — built around a shared misconception, so the plurality answer is wrong — and
four more are questions nobody can recall, where every option gets roughly equal support.

Accuracy against the known key (default seed 42):

| Method                    | Overall | Trap questions | Unrecallable | Normal |
| ------------------------- | ------- | -------------- | ------------ | ------ |
| Majority vote             | 84%     | **0 / 7**      | 3 / 4        | 39/39  |
| Weighted EM               | **94%** | **6 / 7**      | 2 / 4        | 39/39  |
| Surprisingly popular      | **94%** | **7 / 7**      | 1 / 4        | 39/39  |

- Weighting overturned the plurality on 7 questions: **6 corrected, 1 made worse**.
- EM converged in 7 iterations. Inferred reliability spread from 0.31 to 0.89, and
  correlates with the respondents' true (hidden) ability at **r ≈ 0.88**.
- The integrity report found both planted colluding groups and nothing else.

Accuracy vs cohort size (5 random subsamples per point):

| Respondents | Majority | Weighted EM | Surprisingly popular |
| ----------- | -------- | ----------- | -------------------- |
| 10          | 88%      | 89%         | 79%                  |
| 35          | 87%      | 92%         | 88%                  |
| 60          | 83%      | 90%         | 90%                  |
| 85          | 84%      | 94%         | 92%                  |
| 110         | 84%      | 94%         | 93%                  |
| 135         | 83%      | **96%**     | 94%                  |
| 155         | 84%      | 94%         | 94%                  |

**Read the shape, not just the height.** Majority voting saturates almost immediately and
then never improves, because its errors are *systematic* — the whole cohort shares the
misconception, so more respondents cannot fix it. The weighted methods keep climbing,
because more respondents mean sharper reliability estimates. That gap is the project's
central result, and it is the reason the learning-curve chart matters more than the
headline accuracy number.

---

## Getting started

### Prerequisites

| Requirement | Version | Notes |
| ----------- | ------- | ----- |
| Node.js     | 18+     | tested on 24.x; the test runner is Node's built-in `node --test` |
| MongoDB     | 6+      | tested on MongoDB Community Server 8.x, running locally |
| npm         | 9+      | ships with Node |

### 1. MongoDB

The app expects a local `mongod` on the default port. On Windows, MongoDB Community
Server installs as a service:

```powershell
net start MongoDB              # start it (run as administrator)
Get-Service MongoDB            # confirm it says Running
```

macOS/Linux equivalents: `brew services start mongodb-community`, or
`sudo systemctl start mongod`.

Nothing needs to be created by hand — the database (`papertruth`), its collections and
their indexes are created on first use.

### 2. Run it — one command

From the project root:

```bash
npm run dev
```

That is the whole setup. The launcher (`scripts/dev.mjs`, zero dependencies, so the
root folder needs no install of its own) does the first-run work for you:

1. creates `server/.env` and `client/.env` from their `.env.example` files, generating
   a real random `JWT_SECRET` rather than shipping one;
2. installs the server and client dependencies if `node_modules` is missing;
3. checks that MongoDB is actually listening, and says how to start it if not;
4. seeds the demo cohort the first time, when the database has no exams;
5. starts the API and the Vite dev server together, with labelled output, and stops
   both on Ctrl+C.

```
PaperTruth — crowd-consensus answer key

[dev] MongoDB is up on 127.0.0.1:27017
[dev] empty database — seeding the demo cohort…
[dev] API   http://localhost:5000
[dev] App   http://localhost:5173   ← open this
[api] [server] PaperTruth API listening on http://localhost:5000
[web]   ➜  Local:   http://localhost:5173/
```

Other root scripts:

| Command | What it does |
| ------- | ------------ |
| `npm run dev` | everything (see above) |
| `npm run stop` | free ports 5000/5173/4173 if a previous run was killed without Ctrl+C |
| `npm run dev:fresh` | reseed the demo cohort, then start |
| `npm run dev:api` / `npm run dev:web` | run only one side |
| `npm test` | the 97 algorithm tests (no database needed) |
| `npm run simulate` | reseed only |
| `npm run build` | production build of the client |
| `npm run verify` | tests + client build |
| `npm run check:realtime` | end-to-end websocket check against a running stack |

### 3. Configuration (created for you, editable)

`server/.env`:

`server/.env`:

```ini
MONGODB_URI=mongodb://127.0.0.1:27017/papertruth
JWT_SECRET=<generated on first run>
PORT=5000
CLIENT_URL=http://localhost:5173

# Optional. Used ONLY to semantically group free-text short answers.
# Leave blank: the app runs fully without it.
GEMINI_API_KEY=
```

`client/.env`:

```ini
# Blank in development on purpose: the Vite dev server proxies /api and
# /socket.io to http://localhost:5000, so the browser only ever talks to one
# origin and there is no CORS preflight. Set it only when the built client is
# served from a different origin than the API.
VITE_API_URL=
```

Neither file is in the zip or in git — `npm run dev` creates both from their
`.env.example` templates on first run, so no secret ever travels with the source. To
regenerate the server secret by hand:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

No secret is hardcoded anywhere. In development a missing `JWT_SECRET` falls back to a
loud dev-only default; in production, startup refuses rather than sign forgeable tokens.

**The Gemini key is optional.** It is used for one thing only: merging free-text short
answers that mean the same thing but share no characters (`"O(n log n)"` and
`"linearithmic"`). Without it, answers are grouped by normalisation plus Levenshtein
edit distance, and everything else behaves identically. A blank key never blocks
startup, and an API failure degrades to edit-distance grouping instead of failing the
computation.

### 4. Seeding on demand

```bash
cd server
npm run simulate
```

`npm run dev` seeds automatically the first time. To reseed later:

```bash
npm run simulate        # from the project root
```

This wipes any previous *simulated* exam (real exams are left alone), creates the
accounts, generates the cohort, stores the ground-truth key, computes the consensus,
seeds two dispute threads, and prints the accuracy table above. It exits non-zero if
weighted EM and the surprisingly-popular criterion fail to beat majority voting on the
trap questions — that comparison is the project's central claim, so a seed run that
quietly failed it would be worse than useless.

Options:

```bash
node scripts/simulate.js --respondents 300      # bigger cohort (default 150)
node scripts/simulate.js --questions 60         # longer paper  (default 50)
node scripts/simulate.js --seed 7               # a different cohort, still reproducible
node scripts/simulate.js --keep                 # keep existing simulated exams
node scripts/simulate.js --no-compute           # seed only; compute from the UI
```

### 5. Running the two sides separately

The one command above is the normal path, but each side runs on its own if you prefer
two terminals:

```bash
cd server && npm run dev        # API + websocket on http://localhost:5000
cd client && npm run dev        # UI on http://localhost:5173
```

For a production build of the client: `cd client && npm run build` (output in
`client/dist`). `npm run preview` serves that build on port 4173 and proxies the API the
same way the dev server does; if you host `dist` somewhere else, set `VITE_API_URL` at
build time instead.

### Default credentials

| Role    | Email                          | Password     |
| ------- | ------------------------------ | ------------ |
| Admin   | `admin@papertruth.com`         | `admin123`   |
| Student | `aarav@student.papertruth.com` | `student123` |

Four more students exist: `diya@`, `kabir@`, `meera@`, `rohan@`
`student.papertruth.com`, all with `student123`. Self-registration always creates a
student; admin accounts come from the seed script (a client that could pick its own role
would be an obvious privilege-escalation hole).

### A five-minute demo path

1. Sign in as **admin** → *Exams* → the seeded exam → **Live monitor**. Leave it open.
2. In another browser (or a private window), register a new student, submit a few
   answers, and watch the monitor's counter and confidence move in real time.
3. Back as admin: **Analytics** → scroll to *Where reliability weighting changed the
   answer*. Those are the trap questions.
4. **Validation** → the key is already uploaded by the seed script → the method
   comparison and the accuracy-vs-cohort-size curve. Note the flat majority line.
5. **Integrity report** → both planted colluding groups, with the evidence.
6. As a student: **My results** (score, topic breakdown) and **Disputed questions**
   (ranked list, distributions, threads).

---

## The consensus algorithm in plain language

*This section is written to be quotable in a project report.*

### The problem with counting votes

Suppose 150 students tell us what they answered for question 17. Sixty say (B), forty say
(C), and the rest are scattered. Counting votes gives (B), with an apparent confidence of
40%.

Now suppose (C) was actually correct, and (B) is a misconception that a well-taught
mistake produces — the kind of distractor examiners write deliberately. Every student who
did not really know the material converged on (B). Counting votes cannot possibly detect
this: it has no notion of *who* is voting, and no amount of extra respondents will help,
because the error is in the crowd, not in the sample size.

### The idea: infer reliability instead of asking for it

We are never told who is reliable. But we do not have to be, because we have 50 questions,
not one. A student who agrees with the crowd on the other 49 questions is probably
recalling the paper accurately; a student who disagrees with the crowd everywhere is
probably guessing. So reliability can be *estimated from the data itself*.

That gives a chicken-and-egg problem: to know who is reliable we need the answers, and to
know the answers we need to know who is reliable. **Expectation-Maximisation** is the
standard way out — alternate between the two, and let them converge.

### The algorithm

Two unknowns:

- for each question, a probability distribution over the possible answers — how likely
  each option is to be the true answer, written `p(q, a)`;
- for each respondent, one reliability number `w_r` between 0 and 1.

**Step 0 — start from the raw counts.** `p(q, a)` is initialised as the fraction of
respondents who chose `a`. This is exactly the majority-voting answer, so EM begins from
the baseline and improves on it.

**Step 1 (M-step) — score the respondents.** Each respondent's reliability is their
average agreement with the current consensus:

> `w_r` = the mean, over the questions r answered, of the current probability of the option
> r chose.

Somebody who keeps landing on options the crowd believes in scores near 1. A guesser
scores near 1/k (0.25 on a four-option paper).

**Step 2 (E-step) — re-score the answers.** Each respondent now votes with a weight equal
to the **log-odds** of their reliability, `log(w_r / (1 − w_r))`, measured relative to
chance agreement. Votes add up in log space, and the totals are turned back into
probabilities. A respondent above chance adds evidence for the option they chose; a
respondent below chance subtracts it — an unreliable person picking (B) is mild evidence
*against* (B).

**Step 3 — repeat** until nothing moves (the largest change in any probability drops below
1e-4), or 100 iterations, whichever comes first. On the seeded cohort this takes 7
iterations. Both the iteration count and whether it converged are reported, never assumed.

The effect: the forty students who said (C) are the ones who were right about everything
else, so their votes carry several times the weight of the sixty who said (B), and (C)
wins — even though it was never the most popular answer.

### The second mechanism: surprisingly popular

There is one more source of information available for free, from Prelec, Seung & McCoy
(*Nature*, 2017). Ask each student two questions: *what did you answer?* and *which option
do you think most people chose?*

People who hold uncommon correct knowledge **also know that their knowledge is uncommon**.
Someone who genuinely remembers (C) is aware that most of the class fell for (B), so they
answer (C) but predict (B). The students who fell for (B) answer (B) and predict (B).

So compare each option's actual share to the share the crowd *predicted* it would get:

> `SP(a) = Actual(a) − Predicted(a)`

The correct answer is more popular than the crowd's own model of popularity expects. That
positive residual is knowledge the crowd does not know it has, and the option with the
largest residual wins. On the seeded cohort this recovers all 7 trap questions — including
the one weighted EM misses.

### The third job: admitting ignorance

An answer key that guesses is worse than one that says "we do not know". So PaperTruth
scores every question for disagreement using **Shannon entropy** over the answer
distribution, normalised by the entropy of a uniform distribution over the options
offered:

> `Ĥ = H / log₂(k)`, where `H = −Σ pᵢ log₂ pᵢ`

`Ĥ = 0` means the cohort was unanimous; `Ĥ = 1` means the answers were spread perfectly
evenly, i.e. the crowd knows nothing. A question is flagged **disputed** when either

- `Ĥ` exceeds the exam's threshold (0.85 by default) — the answers are scattered; **or**
- the top two options are within 10 percentage points — a two-way split has *low* entropy
  but is just as unresolved.

Disputed questions get a discussion thread instead of an answer, and they are excluded
from every student's estimated score — reported as a range (best case / worst case)
rather than guessed at. On the seeded cohort, accuracy on flagged questions is far below
accuracy on unflagged ones, which is exactly what makes the flag useful: the system knows
where it is weak.

### Why the estimate is checkable

None of the above is worth anything unless it can be measured. When the official key
eventually arrives, it is uploaded and:

- every method's accuracy is computed against it, overall and split by dispute flag;
- every question where weighting overturned the plurality is listed with a verdict;
- the **learning curve** is drawn: for n = 10, 20, 30 … respondents, several random
  subsamples are drawn, every method is run on each, and the accuracies are averaged.
  Sampling is seeded, so the curve is reproducible.

---

## Project structure

```
PaperTruth/
├── server/
│   ├── src/
│   │   ├── config/            env loading and validation, mongoose connection
│   │   ├── models/            User, Exam, Question, Submission,
│   │   │                      ConsensusResult, DisputeThread, OfficialKey
│   │   ├── middleware/        JWT auth, role guards, one error shape
│   │   ├── routes/            auth, exams, submissions, consensus,
│   │   │                      disputes, results, validation, integrity
│   │   ├── realtime/          Socket.IO rooms and events
│   │   ├── services/
│   │   │   ├── consensus/     ← THE ALGORITHMS (pure, no database)
│   │   │   │   ├── matrix.js              the shared ResponseMatrix shape
│   │   │   │   ├── majority.js            plurality baseline
│   │   │   │   ├── entropy.js             Shannon entropy, dispute rules
│   │   │   │   ├── weightedEM.js          Dawid–Skene style EM  ← core
│   │   │   │   ├── surprisinglyPopular.js Prelec et al. criterion
│   │   │   │   ├── integrity.js           union-find collusion clustering
│   │   │   │   ├── ranking.js             binary heap, top-K selection
│   │   │   │   ├── shortAnswer.js         Levenshtein DP + grouping
│   │   │   │   ├── scoring.js             per-student score and diagnosis
│   │   │   │   └── validation.js          accuracy + learning curve
│   │   │   ├── simulation/    synthetic cohort with known ground truth
│   │   │   ├── consensusService.js  the only bridge between DB and algorithms
│   │   │   └── gemini.js      optional embeddings, degrades silently
│   │   └── utils/             seeded PRNG, pseudonymous respondent ids
│   ├── scripts/simulate.js    seed + verify the project's central claim
│   └── tests/                 97 unit tests (node --test)
└── client/
    └── src/
        ├── api/               fetch wrapper + the one data hook
        ├── context/           auth provider, route guards, exam socket
        ├── components/        shared UI, and charts/ (palette + 7 charts)
        └── pages/             student pages, and admin/ for the exam cell
```

Nothing under `services/consensus/` imports mongoose or performs I/O. That is what makes
the algorithms unit-testable with hand-written literals, and it is why the tests need no
database.

---

## API reference

All routes are prefixed `/api`. Authenticated routes take `Authorization: Bearer <token>`.
Admin-only routes are marked 🔒 and are guarded server-side, not just hidden in the UI.

**Auth**

| Method | Route | Purpose |
| ------ | ----- | ------- |
| POST | `/auth/register` | create a student account, returns a token |
| POST | `/auth/login` | sign in |
| GET | `/auth/me` | the current user |

**Exams**

| Method | Route | Purpose |
| ------ | ----- | ------- |
| GET | `/exams` | list, with submission counts and your own state |
| GET | `/exams/:id` | one exam, its questions, and your submission |
| POST | `/exams` 🔒 | create an exam (and optionally its questions) |
| PUT | `/exams/:id/questions` 🔒 | replace the question list (refused once answers exist) |
| PATCH | `/exams/:id/questions/:number` 🔒 | edit one question |
| PATCH | `/exams/:id/status` 🔒 | open or close the submission window |
| GET | `/exams/:id/monitor` 🔒 | submission timeline (pseudonyms only) |
| DELETE | `/exams/:id` 🔒 | delete an exam and everything attached |
| GET | `/exams/:id/respondent-id` | your own pseudonym for that exam |

**Submissions**

| Method | Route | Purpose |
| ------ | ----- | ------- |
| POST | `/exams/:id/submissions` | submit answers — one per student, enforced by a unique index |
| GET | `/exams/:id/submissions/me` | have I submitted, and what did I say |
| GET | `/exams/:id/submissions/count` | how many have answered so far |

**Consensus**

| Method | Route | Purpose |
| ------ | ----- | ------- |
| POST | `/exams/:id/consensus/compute` 🔒 | run every applicable method and store the results |
| GET | `/exams/:id/consensus` | all methods side by side |
| GET | `/exams/:id/consensus/:method` | one method in full, with respondent weights |
| GET | `/exams/:id/consensus/question/:n` | one question: distribution, every method's verdict, dispute measures |
| GET | `/exams/:id/consensus-live` 🔒 | unsaved preview for the live monitor |

**Disputes**

| Method | Route | Purpose |
| ------ | ----- | ------- |
| GET | `/exams/:id/disputes` | ranked disputed questions (`?limit=`, `?onlyFlagged=`) |
| GET | `/exams/:id/disputes/:n/thread` | the discussion |
| POST | `/exams/:id/disputes/:n/posts` | post (respondents only) |
| POST | `/exams/:id/disputes/:n/posts/:postId/vote` | one vote per respondent, votable twice to retract |

**Results, validation, integrity**

| Method | Route | Purpose |
| ------ | ----- | ------- |
| GET | `/exams/:id/results/me` | estimated score, per-question comparison, topic breakdown |
| GET | `/exams/:id/results/me/compare` | your score under every method |
| GET | `/exams/:id/results/distribution` 🔒 | the class score distribution (scores only) |
| PUT | `/exams/:id/official-key` 🔒 | upload or replace the official key |
| GET | `/exams/:id/official-key` | is a key on file |
| GET | `/exams/:id/validation` | method accuracy comparison |
| GET | `/exams/:id/validation/curve` | accuracy vs cohort size (`?step=`, `?trials=`, `?seed=`) |
| GET | `/exams/:id/validation/mismatches` | every question a method got wrong |
| GET | `/exams/:id/integrity` 🔒 | collusion clusters |

**Websocket events** (room `exam:<id>`, joined by emitting `exam:watch`)

`submission:received` · `consensus:computed` · `dispute:posted` · `exam:status` ·
`official-key:uploaded`

---

## Testing

```bash
cd server
npm test          # node --test, no database required
```

97 tests, all on the algorithm modules, including:

- **entropy** — uniform distribution → normalised entropy exactly 1.0; unanimous → 0.0;
  no input produces NaN; both dispute rules fire correctly and the threshold is
  configurable.
- **weighted EM** — converges on synthetic data; a known-unreliable respondent gets a low
  weight; **a reliable minority overturns a shared misconception**; a respondent who
  answered 3 questions cannot earn an extreme weight; unanimous questions, empty cohorts
  and respondents who answered nothing are all handled; results are deterministic.
- **surprisingly popular** — reproduces the expected answer on the canonical hand-built
  example where the minority is correct; SP scores are exactly actual − predicted.
- **union-find** — clusters known colluding pairs, does not cluster independent
  respondents, and path compression plus union by rank are verified structurally.
- **Levenshtein** — the standard distance cases, symmetry, the triangle inequality, and
  the grouping rules built on it.
- **binary heap / top-K** — heap invariant holds over 500 randomised operations, and
  top-K agrees with a full sort on random data.
- **validation on seeded data** — weighted-EM accuracy ≥ majority accuracy; both weighted
  methods beat majority on the trap questions; the learning curve is monotone in the
  right places, reproducible for a given seed, and majority voting is provably flat.

The unit suite is deliberately pure — it never opens a socket or a database, so it runs
in a second. The two things it therefore cannot cover have their own checks:

```bash
npm run dev              # in one terminal
npm run check:realtime   # in another
```

`server/tests/realtime.check.mjs` signs in, opens a websocket, joins the exam room,
registers a throwaway student, submits answers, and asserts that the
`submission:received` event arrives carrying a refreshed consensus summary and no
identity fields. That is the exact sequence the admin's live monitor depends on.

And `npm run simulate` is itself an integration test: it exits non-zero if the weighted
methods fail to beat majority voting on the trap questions.

---

## Design decisions and honest limitations

Written out because they are the interesting part, and because an examiner will ask.

**1. The E-step normalisation is a softmax, not a linear rescale.** `score(q, a)` is a
log-likelihood, so Bayes' rule gives `p ∝ exp(score)`; shifting the scores by a constant
first is just the log-sum-exp trick. The simpler alternative — shift the minimum to zero
and divide by the sum — is also implemented (`posteriorMode: 'LINEAR'`) and is *not* the
posterior of any probability model. It measurably weakens the method: normalising raw
scores caps the posterior well below 1, which compresses every weight toward the cohort
mean and squeezes out the reliability signal. On the seeded cohort, LINEAR recovers 2 of 7
trap questions and SOFTMAX recovers 6–7.

**2. Reliability is measured against chance, not against 0.5.** A respondent guessing on
a four-option MCQ agrees with the consensus about 25% of the time, so the plain logit
`log(w/(1−w))` treats an average guesser as *negative* evidence. When most weights sit
below 0.5 — normal on a scattered question — every option's score goes negative and the
least popular option wins. The Dawid–Skene likelihood fixes it: the vote weight is
`log(w/(1−w)) + log(k−1)`, i.e. log-odds relative to chance agreement `1/k`. For a
two-option question the correction is zero, so the simple formula is the binary special
case of the general one.

**3. Weighted EM cannot overturn an overwhelming plurality — and should not.** With
reliability clamped to [0.01, 0.99] the per-vote log-odds is bounded, so a wrong plurality
of roughly 2:1 or more outweighs any reliability advantage the minority can earn. The
seeded traps are graded across that boundary deliberately: the milder ones flip, the
harshest one does not. Past some point, "most people remember it differently" has to win —
and that is what the dispute flag and the surprisingly-popular criterion are for.

**4. The surprisingly-popular criterion needs an eligibility guard.** Prelec's respondents
predict the *share* each option will get; our form asks the cheaper winner-take-all
question, because that is what a student can answer about 50 items in two minutes. With
winner-take-all predictions the most popular option is over-predicted almost by
construction (everyone who picked it also predicts it), so `SP(mode) ≤ 0` nearly always
and the raw argmax hands the win to whichever near-empty distractor happens to be least
predicted. The fix keeps the criterion and constrains who may compete: an option may only
overturn the plurality if it holds at least half of the plurality's support (Prelec's own
Philadelphia minority was 35% of respondents). A 35%-vs-47% pair — the trap shape — still
flips freely. `minShareRatio: 0` recovers the unguarded criterion, and the unguarded answer
is always reported alongside for comparison.

**5. The collusion threshold is calibrated, not guessed.** On a 50-question paper two
independent students share a few rare answers by chance, and 155 respondents make 11,935
pairs for that chance to fire in — a threshold that looks safe for one pair *will* be
crossed by somebody. So the threshold is derived from the data: an innocent pair's
rare-match count is approximately Poisson, and the cut-off is the smallest value for which
fewer than 0.05 innocent pairs are expected to be flagged across the whole cohort (a
family-wise bound). A Gaussian "mean + 5 σ" rule is not enough — it understates the
Poisson tail and does produce false positives on this data.

**6. That detector's power is limited, honestly.** With 50 questions and 4 options a
respondent holds only about ten rare answers, so rare-answer matching reliably catches
near-exact copying and not much subtler than that. A group copying 85% of a shared sheet
slips through. Longer papers, more options, or a rarity-weighted score (summing `−log p`
over matches rather than counting them) would all sharpen it.

**7. Self-reported confidence is collected and never used to weight anything.** It is
noisy and trivially gameable. Reliability is inferred from agreement instead. The
confidence slider exists because students expect it and because it is interesting to
display.

**8. Computing the consensus does not close the submission window.** An admin can compute
early, watch the live monitor, and recompute as more recollections arrive. `COMPUTED` is
only recorded once the window is genuinely over, so the status stays a truthful
description of the exam rather than a side effect of pressing a button.

**9. Complexity, where it matters.** EM is O(iterations × answers) per run — about 10⁴
operations per iteration for 150 respondents on 50 questions. Collusion detection is
O(n²·m) by design and noted as such in the code. Top-K disputed questions uses a bounded
min-heap, O(n log K), rather than sorting all n. Short-answer grouping compares *distinct*
answers, not respondents.

---

## Licence and provenance

Built as a final-year CSE project. The algorithms follow:

- A. P. Dawid and A. M. Skene, *Maximum Likelihood Estimation of Observer Error-Rates
  Using the EM Algorithm*, JRSS-C 28(1), 1979 — the reliability-weighted consensus model,
  simplified here to one parameter per respondent.
- D. Prelec, H. S. Seung and J. McCoy, *A solution to the single-question crowd wisdom
  problem*, Nature 541, 2017 — the surprisingly-popular criterion.
- C. E. Shannon, *A Mathematical Theory of Communication*, 1948 — the entropy measure used
  for dispute scoring.
