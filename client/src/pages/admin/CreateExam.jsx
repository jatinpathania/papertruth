import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client.js';
import { Card, ErrorNote, Page } from '../../components/ui.jsx';

const DEFAULT_TOPICS = 'Arrays & Strings, Linked Lists, Trees & Graphs, Sorting & Searching, Dynamic Programming, Complexity Analysis, Hashing';

const isoLocal = (date) => new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

export default function CreateExam() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    title: '',
    subject: '',
    courseCode: '',
    questionCount: 50,
    optionCount: 4,
    opensAt: isoLocal(new Date()),
    closesAt: isoLocal(new Date(Date.now() + 7 * 24 * 3600 * 1000)),
    correctMarks: 1,
    negativeMarks: 0,
    disputeThreshold: 0.85,
    collectPredictions: true,
    topics: DEFAULT_TOPICS
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const set = (key) => (event) => {
    const value =
      event.target.type === 'checkbox' ? event.target.checked : event.target.value;
    setForm((previous) => ({ ...previous, [key]: value }));
  };

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const count = Number(form.questionCount);
      const options = ['A', 'B', 'C', 'D', 'E'].slice(0, Math.max(2, Math.min(5, Number(form.optionCount))));
      const topics = form.topics
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      const questions = Array.from({ length: count }, (_, index) => ({
        number: index + 1,
        type: 'MCQ',
        options,
        topic: topics.length ? topics[index % topics.length] : 'General'
      }));

      const { exam } = await api.createExam({
        title: form.title,
        subject: form.subject,
        courseCode: form.courseCode,
        questionCount: count,
        opensAt: new Date(form.opensAt).toISOString(),
        closesAt: new Date(form.closesAt).toISOString(),
        markingScheme: {
          correctMarks: Number(form.correctMarks),
          negativeMarks: Number(form.negativeMarks)
        },
        disputeThreshold: Number(form.disputeThreshold),
        collectPredictions: form.collectPredictions,
        questions
      });
      navigate(`/admin/exams/${exam.id}/monitor`, { replace: true });
    } catch (caught) {
      setError(caught);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Page>
      <div className="page-head">
        <div>
          <span className="eyebrow">🛰️ Exam cell</span>
          <h1>Create an exam</h1>
          <p className="lede">
            You do not need the question paper. Set the number of questions and the option
            labels, and students fill in what they remember answering.
          </p>
        </div>
      </div>

      <form onSubmit={submit}>
        <div className="grid cols-2">
          <Card title="The paper">
            <div className="field">
              <label htmlFor="title">Title</label>
              <input id="title" required value={form.title} onChange={set('title')} placeholder="Data Structures — Sessional II" />
            </div>
            <div className="field">
              <label htmlFor="subject">Subject</label>
              <input id="subject" required value={form.subject} onChange={set('subject')} placeholder="Data Structures & Algorithms" />
            </div>
            <div className="field">
              <label htmlFor="courseCode">Course code</label>
              <input id="courseCode" required value={form.courseCode} onChange={set('courseCode')} placeholder="CS304" />
            </div>
            <div className="row" style={{ gap: 12 }}>
              <div className="field" style={{ flex: 1 }}>
                <label htmlFor="questionCount">Questions</label>
                <input
                  id="questionCount"
                  type="number"
                  min="1"
                  max="300"
                  required
                  value={form.questionCount}
                  onChange={set('questionCount')}
                />
              </div>
              <div className="field" style={{ flex: 1 }}>
                <label htmlFor="optionCount">Options per question</label>
                <select id="optionCount" value={form.optionCount} onChange={set('optionCount')}>
                  <option value={2}>2 (A–B)</option>
                  <option value={3}>3 (A–C)</option>
                  <option value={4}>4 (A–D)</option>
                  <option value={5}>5 (A–E)</option>
                </select>
                <p className="help">This is the k in the normalised-entropy denominator.</p>
              </div>
            </div>
            <div className="field">
              <label htmlFor="topics">Topics, comma separated</label>
              <textarea id="topics" value={form.topics} onChange={set('topics')} />
              <p className="help">
                Assigned to questions in rotation. Used for the per-student topic
                diagnosis; edit individual questions later if you need exact mapping.
              </p>
            </div>
          </Card>

          <Card title="Window, marking and consensus">
            <div className="row" style={{ gap: 12 }}>
              <div className="field" style={{ flex: 1 }}>
                <label htmlFor="opensAt">Opens</label>
                <input id="opensAt" type="datetime-local" value={form.opensAt} onChange={set('opensAt')} />
              </div>
              <div className="field" style={{ flex: 1 }}>
                <label htmlFor="closesAt">Closes</label>
                <input id="closesAt" type="datetime-local" value={form.closesAt} onChange={set('closesAt')} />
              </div>
            </div>

            <div className="row" style={{ gap: 12 }}>
              <div className="field" style={{ flex: 1 }}>
                <label htmlFor="correctMarks">Marks per correct answer</label>
                <input id="correctMarks" type="number" step="0.5" min="0" value={form.correctMarks} onChange={set('correctMarks')} />
              </div>
              <div className="field" style={{ flex: 1 }}>
                <label htmlFor="negativeMarks">Negative marking</label>
                <input id="negativeMarks" type="number" step="0.25" min="0" value={form.negativeMarks} onChange={set('negativeMarks')} />
                <p className="help">Deducted per wrong answer. 0 to disable.</p>
              </div>
            </div>

            <div className="field">
              <label htmlFor="disputeThreshold">
                Dispute threshold — normalised entropy above which a question is flagged
              </label>
              <div className="slider-row">
                <input
                  id="disputeThreshold"
                  type="range"
                  min="0.5"
                  max="1"
                  step="0.01"
                  value={form.disputeThreshold}
                  onChange={set('disputeThreshold')}
                  style={{ '--fill': `${((Number(form.disputeThreshold) - 0.5) / 0.5) * 100}%` }}
                />
                <span className="slider-value">{Number(form.disputeThreshold).toFixed(2)}</span>
              </div>
              <p className="help">
                0.85 is a sensible default. A question is also flagged whenever the top two
                options are within 10 points of each other, whatever this is set to.
              </p>
            </div>

            <div className="field">
              <label htmlFor="collectPredictions" style={{ display: 'flex', gap: 9, alignItems: 'center' }}>
                <input
                  id="collectPredictions"
                  type="checkbox"
                  checked={form.collectPredictions}
                  onChange={set('collectPredictions')}
                  style={{ width: 'auto' }}
                />
                Also ask "which option do you think most people chose?"
              </label>
              <p className="help">
                Required for the surprisingly-popular criterion. Without it only majority
                voting and weighted EM can run.
              </p>
            </div>
          </Card>
        </div>

        {error && (
          <div className="mt-2">
            <ErrorNote error={error} />
          </div>
        )}

        <div className="sticky-actions">
          <span className="muted small">
            {form.questionCount} questions · {form.optionCount} options ·{' '}
            {form.collectPredictions ? 'predictions collected' : 'no predictions'}
          </span>
          <span className="spacer" />
          <button className="primary" type="submit" disabled={busy}>
            {busy ? 'Creating…' : 'Create exam'}
          </button>
        </div>
      </form>
    </Page>
  );
}
