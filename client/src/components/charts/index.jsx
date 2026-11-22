import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import { METHOD_LABELS, SERIES_DASH, SERIES_SYMBOL, chartChrome, percent, theme } from './palette.js';

const EMPTY = (
  <div className="empty">
    Nothing to plot yet — compute the consensus for this exam and the chart will fill in.
  </div>
);

function GradientDefs({ t }) {
  const stops = {
    brand: t.method('WEIGHTED_EM'),
    sp: t.method('SURPRISINGLY_POPULAR'),
    ok: t.semantic('ok'),
    warn: t.semantic('warn'),
    danger: t.semantic('danger'),
    neutral: t.method('MAJORITY')
  };
  return (
    <defs>
      {Object.entries(stops).map(([key, color]) => (
        <linearGradient key={key} id={`grad-${key}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={1} />
          <stop offset="100%" stopColor={color} stopOpacity={0.72} />
        </linearGradient>
      ))}
      {Object.entries(stops).map(([key, color]) => (
        <linearGradient key={`h-${key}`} id={`grad-h-${key}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={color} stopOpacity={0.75} />
          <stop offset="100%" stopColor={color} stopOpacity={1} />
        </linearGradient>
      ))}
    </defs>
  );
}

export function ConfidenceHistogram({ histogram = [], height = 260 }) {
  const t = theme();
  const chrome = chartChrome(t);
  if (!histogram.length) return EMPTY;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={histogram} margin={{ top: 16, right: 12, bottom: 4, left: -18 }}>
        <CartesianGrid {...chrome.grid} vertical={false} />
        <XAxis dataKey="bin" {...chrome.axis} interval={0} angle={-32} textAnchor="end" height={54} />
        <YAxis {...chrome.axis} allowDecimals={false} />
        <Tooltip {...chrome.tooltip} formatter={(value) => [`${value} question(s)`, 'Count']} />
        <Bar dataKey="count" name="Questions" radius={[5, 5, 0, 0]}>
          {}
          {histogram.map((bin) => (
            <Cell
              key={bin.bin}
              fill={bin.to <= 0.4 ? t.semantic('warn') : bin.to <= 0.7 ? t.semantic('info') : t.method('WEIGHTED_EM')}
            />
          ))}
          <LabelList dataKey="count" position="top" fill={t.axis} fontSize={11} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function DisputedQuestionsChart({ questions = [], height, onSelect, threshold = 0.85 }) {
  const t = theme();
  const chrome = chartChrome(t);
  if (!questions.length) return EMPTY;

  const data = questions.map((q) => ({
    name: `Q${q.questionNumber}`,
    questionNumber: q.questionNumber,
    entropy: Number((q.normalisedEntropy || 0).toFixed(3)),
    disputed: Boolean(q.disputed),
    margin: q.margin
  }));

  return (
    <ResponsiveContainer width="100%" height={height || Math.max(220, data.length * 30 + 40)}>
      <BarChart data={data} layout="vertical" margin={{ top: 8, right: 44, bottom: 4, left: 4 }}>
        {GradientDefs({ t })}
        <CartesianGrid {...chrome.grid} horizontal={false} />
        <XAxis type="number" domain={[0, 1]} tickFormatter={(v) => v.toFixed(1)} {...chrome.axis} />
        <YAxis type="category" dataKey="name" width={46} {...chrome.axis} />
        <Tooltip
          {...chrome.tooltip}
          formatter={(value, _name, entry) => [
            `${value} disagreement score${entry.payload.disputed ? ' — flagged as disputed' : ''}`,
            'Disagreement'
          ]}
        />
        {}
        <ReferenceLine
          x={threshold}
          stroke={t.semantic('danger')}
          strokeDasharray="4 3"
          label={{ value: 'too split', position: 'top', fill: t.semantic('danger'), fontSize: 11 }}
        />
        <Bar
          dataKey="entropy"
          name="Disagreement"
          radius={[0, 6, 6, 0]}
          animationDuration={700}
          animationEasing="ease-out"
          onClick={(bar) => onSelect?.(bar.payload.questionNumber)}
          cursor={onSelect ? 'pointer' : 'default'}
        >
          {data.map((row) => (
            <Cell key={row.name} fill={row.disputed ? 'url(#grad-h-warn)' : 'url(#grad-h-neutral)'} />
          ))}
          <LabelList dataKey="entropy" position="right" fill={t.axis} fontSize={11} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function MethodAccuracyChart({ methods = [], height = 290 }) {
  const t = theme();
  const chrome = chartChrome(t);
  if (!methods.length) return EMPTY;

  const data = methods.map((m) => ({
    method: METHOD_LABELS[m.method] || m.method,
    key: m.method,
    overall: round(m.accuracy),
    undisputed: round(m.undisputedAccuracy),
    disputed: round(m.disputedAccuracy)
  }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 18, right: 12, bottom: 4, left: -18 }} barGap={4}>
        <CartesianGrid {...chrome.grid} vertical={false} />
        <XAxis dataKey="method" {...chrome.axis} />
        <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} {...chrome.axis} />
        <Tooltip {...chrome.tooltip} formatter={(value) => (value === null ? '—' : `${value}%`)} />
        <Legend wrapperStyle={{ fontSize: 12, color: t.text }} />
        <Bar dataKey="overall" name="All questions" fill={t.method('WEIGHTED_EM')} radius={[5, 5, 0, 0]}>
          <LabelList dataKey="overall" position="top" fill={t.axis} fontSize={11} formatter={(v) => `${v}%`} />
        </Bar>
        <Bar dataKey="undisputed" name="Questions with a clear consensus" fill={t.method('SURPRISINGLY_POPULAR')} radius={[5, 5, 0, 0]} />
        <Bar dataKey="disputed" name="Questions flagged as disputed" fill={t.semantic('warn')} radius={[5, 5, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function CohortSizeCurve({ curve = [], methods = [], height = 320 }) {
  const t = theme();
  const chrome = chartChrome(t);
  if (!curve.length) return EMPTY;

  const data = curve.map((row) => {
    const point = { cohortSize: row.cohortSize };
    for (const method of methods) point[method] = round(row[method]);
    return point;
  });

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 18, bottom: 18, left: -14 }}>
        <CartesianGrid {...chrome.grid} />
        <XAxis
          dataKey="cohortSize"
          {...chrome.axis}
          label={{ value: 'Respondents in the sample', position: 'insideBottom', offset: -12, fill: t.axis, fontSize: 12 }}
        />
        <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} {...chrome.axis} />
        <Tooltip
          {...chrome.tooltip}
          formatter={(value, name) => [`${value}%`, METHOD_LABELS[name] || name]}
          labelFormatter={(value) => `${value} respondents`}
        />
        <Legend
          verticalAlign="top"
          wrapperStyle={{ fontSize: 12, color: t.text, paddingBottom: 10 }}
          formatter={(value) => METHOD_LABELS[value] || value}
        />
        {methods.map((method) => (
          <Line
            key={method}
            type="monotone"
            dataKey={method}
            stroke={t.method(method)}
            strokeWidth={2.4}
            strokeDasharray={SERIES_DASH[method]}
            dot={{ r: 3, fill: t.method(method), strokeWidth: 0 }}
            activeDot={{ r: 5 }}
            legendType={SERIES_SYMBOL[method]}
            connectNulls
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

export function AnswerDistributionChart({
  distribution = {},
  consensusAnswer,
  officialAnswer,
  weighted,
  height = 240
}) {
  const t = theme();
  const chrome = chartChrome(t);
  const options = Object.keys(distribution).sort();
  if (!options.length) return EMPTY;

  const total = options.reduce((sum, o) => sum + (distribution[o] || 0), 0) || 1;
  const data = options.map((option) => ({
    option,
    count: distribution[option] || 0,
    share: round((distribution[option] || 0) / total),
    weighted: weighted?.[option] === undefined ? null : round(weighted[option]),
    isConsensus: option === consensusAnswer,
    isOfficial: officialAnswer !== undefined && option === officialAnswer
  }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 18, right: 12, bottom: 4, left: -20 }}>
        {GradientDefs({ t })}
        <CartesianGrid {...chrome.grid} vertical={false} />
        <XAxis dataKey="option" {...chrome.axis} />
        <YAxis {...chrome.axis} tickFormatter={(v) => `${v}%`} domain={[0, 100]} />
        <Tooltip
          {...chrome.tooltip}
          formatter={(value, name, entry) =>
            name === 'share'
              ? [`${value}% (${entry.payload.count} respondents)`, 'Raw share']
              : [`${value}%`, 'Reliability-weighted share']
          }
        />
        <Legend wrapperStyle={{ fontSize: 12, color: t.text }} formatter={(v) => (v === 'share' ? 'Raw share of answers' : 'Reliability-weighted share')} />
        <Bar dataKey="share" name="share" radius={[6, 6, 0, 0]} animationDuration={700} animationEasing="ease-out">
          {data.map((row) => (
            <Cell
              key={row.option}
              fill={row.isConsensus ? 'url(#grad-brand)' : 'url(#grad-neutral)'}
              stroke={row.isOfficial ? t.semantic('ok') : 'transparent'}
              strokeWidth={row.isOfficial ? 3 : 0}
            />
          ))}
          <LabelList
            dataKey="option"
            position="top"
            fontSize={11}
            fill={t.axis}
            formatter={(option) => {
              const row = data.find((d) => d.option === option);
              return [row?.isConsensus ? '✓ consensus' : '', row?.isOfficial ? '★ official' : '']
                .filter(Boolean)
                .join(' ');
            }}
          />
        </Bar>
        {data.some((row) => row.weighted !== null) && (
          <Bar dataKey="weighted" name="weighted" fill="url(#grad-sp)" radius={[6, 6, 0, 0]} animationDuration={700} animationEasing="ease-out" />
        )}
      </BarChart>
    </ResponsiveContainer>
  );
}

export function TopicPerformanceChart({ topics = [], height = 280 }) {
  const t = theme();
  const chrome = chartChrome(t);
  const data = topics
    .filter((row) => row.correct + row.incorrect > 0)
    .map((row) => ({
      topic: row.topic,
      correct: row.correct,
      incorrect: row.incorrect,
      accuracy: round(row.accuracy)
    }));
  if (!data.length) return EMPTY;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 8, right: 44, bottom: 4, left: 8 }}>
        {GradientDefs({ t })}
        <CartesianGrid {...chrome.grid} horizontal={false} />
        <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} {...chrome.axis} />
        <YAxis type="category" dataKey="topic" width={132} {...chrome.axis} />
        <Tooltip
          {...chrome.tooltip}
          formatter={(value, _name, entry) => [
            `${value}% (${entry.payload.correct} right, ${entry.payload.incorrect} wrong)`,
            'Accuracy'
          ]}
        />
        <Bar dataKey="accuracy" name="Accuracy" radius={[0, 6, 6, 0]} animationDuration={700} animationEasing="ease-out">
          {data.map((row) => (
            <Cell
              key={row.topic}
              fill={
                row.accuracy >= 70 ? 'url(#grad-h-ok)' : row.accuracy >= 40 ? 'url(#grad-h-warn)' : 'url(#grad-h-danger)'
              }
            />
          ))}
          <LabelList dataKey="accuracy" position="right" fill={t.axis} fontSize={11} formatter={(v) => `${v}%`} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function SubmissionTimelineChart({ points = [], height = 240 }) {
  const t = theme();
  const chrome = chartChrome(t);
  if (!points.length) return EMPTY;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={points} margin={{ top: 12, right: 16, bottom: 8, left: -16 }}>
        <CartesianGrid {...chrome.grid} />
        <XAxis dataKey="label" {...chrome.axis} minTickGap={24} />
        <YAxis {...chrome.axis} allowDecimals={false} yAxisId="left" />
        <YAxis
          {...chrome.axis}
          yAxisId="right"
          orientation="right"
          domain={[0, 100]}
          tickFormatter={(v) => `${v}%`}
        />
        <Tooltip {...chrome.tooltip} />
        <Legend wrapperStyle={{ fontSize: 12, color: t.text }} />
        <Line
          yAxisId="left"
          type="monotone"
          dataKey="submissions"
          name="Submissions"
          stroke={t.method('WEIGHTED_EM')}
          strokeWidth={2.4}
          dot={false}
        />
        <Line
          yAxisId="right"
          type="monotone"
          dataKey="confidence"
          name="Mean confidence"
          stroke={t.method('SURPRISINGLY_POPULAR')}
          strokeWidth={2.4}
          strokeDasharray="4 3"
          dot={false}
          connectNulls
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

function round(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return null;
  return Number((value * 100).toFixed(1));
}

export { percent };
