export const METHOD_COLORS = {
  MAJORITY: '#8a97b8',
  WEIGHTED_EM: '#22e2f5',
  SURPRISINGLY_POPULAR: '#ffb020'
};

export const METHOD_LABELS = {
  MAJORITY: 'Majority vote',
  WEIGHTED_EM: 'Weighted EM',
  SURPRISINGLY_POPULAR: 'Surprisingly popular'
};

export const METHOD_SHORT = {
  MAJORITY: 'Majority',
  WEIGHTED_EM: 'Weighted EM',
  SURPRISINGLY_POPULAR: 'Surp. popular'
};

export const SERIES_DASH = {
  MAJORITY: '6 4',
  WEIGHTED_EM: '0',
  SURPRISINGLY_POPULAR: '2 3'
};

export const SERIES_SYMBOL = {
  MAJORITY: 'square',
  WEIGHTED_EM: 'circle',
  SURPRISINGLY_POPULAR: 'triangle'
};

export const CATEGORICAL = ['#22e2f5', '#ffb020', '#c084fc', '#34e7a8', '#ff5c7a', '#9c8cff', '#8a97b8', '#7cf3ff'];

export const SEMANTIC = {
  ok: '#34e7a8',
  warn: '#ffcc4d',
  danger: '#ff5c7a',
  info: '#9c8cff',
  neutral: '#8a97b8'
};

const CHROME = { axis: '#8fa0bd', grid: '#212c40', tooltipBg: '#0c111a', tooltipBorder: '#304059', text: '#eef4fb' };

export function theme() {
  return {
    mode: 'dark',
    ...CHROME,
    method: (key) => METHOD_COLORS[key] || CHROME.axis,
    semantic: (key) => SEMANTIC[key] || CHROME.axis,
    categorical: (index) => CATEGORICAL[index % CATEGORICAL.length]
  };
}

export function chartChrome(t = theme()) {
  return {
    axis: { stroke: t.axis, fontSize: 12, tick: { fill: t.axis, fontSize: 12 } },
    grid: { stroke: t.grid, strokeDasharray: '3 3' },
    tooltip: {
      contentStyle: {
        background: t.tooltipBg,
        border: `1px solid ${t.tooltipBorder}`,
        borderRadius: 10,
        color: t.text,
        fontSize: 13,
        boxShadow: '0 6px 20px rgba(0,0,0,0.4)'
      },
      labelStyle: { color: t.text, fontWeight: 600 },
      itemStyle: { color: t.text }
    }
  };
}

export const percent = (value, digits = 0) =>
  value === null || value === undefined ? '—' : `${(value * 100).toFixed(digits)}%`;

export default theme;
