// Turns the analysis response into the plain-language numbers and sentences the screens show.
// Nothing here is technical vocabulary: a "sitting" is one stretch of watching, and a "long sitting"
// is one that lasted 45 minutes or more.

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const LATE_HOURS = [0, 1, 2, 3, 4, 5, 6]; // matches the backend: midnight to 7 am

export const round = (n, d = 0) => {
  const k = 10 ** d;
  return Math.round(n * k) / k;
};

export function hourLabel(h) {
  if (h === 0) return 'midnight';
  if (h === 12) return 'noon';
  return `${h % 12} ${h < 12 ? 'am' : 'pm'}`;
}

/** 92 -> "1 h 32", 45 -> "45 min" */
export function minutesLabel(min) {
  const m = Math.round(min);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest ? `${h} h ${String(rest).padStart(2, '0')}` : `${h} h`;
}

export function durationWords(min) {
  const m = Math.round(min);
  const h = Math.floor(m / 60);
  const rest = m % 60;
  if (!h) return `${rest} minutes`;
  if (!rest) return `${h} hour${h > 1 ? 's' : ''}`;
  return `${h} hour${h > 1 ? 's' : ''} ${rest} minutes`;
}

const oneIn = (share) => (share > 0 ? Math.max(2, Math.round(1 / share)) : null);
const sum = (arr) => arr.reduce((a, b) => a + b, 0);

const LEVELS = {
  low: { word: 'Light', line: 'TikTok is a small part of your day.' },
  medium: { word: 'Moderate', line: 'TikTok takes a regular slice of your day.' },
  high: { word: 'High', line: 'TikTok takes a large part of your day, often late.' },
};

export function buildInsights(data) {
  const s = data.statistics || {};
  const c = data.charts || {};
  const f = data.forecast || {};

  const daily = c.watch_minutes || [];
  const days = s.days_tracked || daily.length || 1;
  const hours = s.total_watch_hours || sum(daily) / 60;
  const perDayMin = (hours * 60) / days;

  // when: hour-by-hour picture and the share that happens late
  const heat = c.heatmap_z || [];
  const heatMax = Math.max(1, ...heat.flat());
  const totalClips = sum(heat.flat()) || 1;
  const lateClips = sum(heat.map((row) => sum(LATE_HOURS.map((h) => row[h] || 0))));
  const lateShare = lateClips / totalClips;
  const lateHours = s.late_night_hours ?? round(hours * lateShare, 1);
  const nightsPastMidnight = s.nights_past_midnight ?? null;

  // how: sittings
  const sittings = s.total_sessions || 0;
  const longSittings = s.binge_sessions || 0;
  const longShare = sittings ? longSittings / sittings : 0;
  const speed = s.avg_velocity || 0;

  const level = LEVELS[f.risk_level] || LEVELS.medium;
  const direction =
    f.trend === 'worsening'
      ? { word: 'Getting stronger over the last two weeks', good: false }
      : f.trend === 'improving'
        ? { word: 'Easing off over the last two weeks', good: true }
        : { word: 'Not enough days yet to see a direction', good: null };

  const standsOut = [];
  if (lateShare >= 0.15) {
    standsOut.push({
      title: 'Late nights',
      text: `About ${Math.round(lateShare * 100)}% of your watching happens between midnight and 7 am.`,
    });
  }
  if (s.peak_day) {
    standsOut.push({
      title: `${s.peak_day}s`,
      text: `Your heaviest day. Your busiest hour of all is ${hourLabel(s.peak_hour ?? 0)}.`,
    });
  }
  if (s.longest_session_minutes) {
    standsOut.push({ title: 'Your longest sitting', text: `${durationWords(s.longest_session_minutes)} without a break.` });
  }
  if (standsOut.length < 3 && speed) {
    standsOut.push({ title: 'Fast scrolling', text: `A new video about every ${Math.max(1, Math.round(60 / speed))} seconds.` });
  }

  return {
    days,
    hours: round(hours),
    perDayMin,
    endDate: (c.dates || []).slice(-1)[0] || null,
    level: level.word,
    levelLine: level.line,
    levelValue: Math.min(1, Math.max(0.04, f.risk_score ?? 0.5)),
    direction,
    equivalents: {
      workDays: round(hours / 8),
      films: round(hours / 2),
      nightsPastMidnight,
      lateHours: round(lateHours),
    },
    standsOut: standsOut.slice(0, 3),
    when: {
      heat,
      heatMax,
      dayNames: DAY_NAMES,
      busiestHour: s.peak_hour ?? 0,
      busiestDay: s.peak_day || '',
      lateShare,
      latePerNight: round(s.avg_late_night_clips || 0),
      morningPerDay: round(s.avg_morning_clips || 0),
      timezone: s.timezone || null,
    },
    how: {
      sittings,
      typicalMin: round(s.avg_session_minutes || 0),
      longSittings,
      longOneIn: oneIn(longShare),
      longestMin: s.longest_session_minutes || 0,
      streak: s.long_day_streak ?? null,
      repeatShare: s.rewatched_ratio || 0,
      repeatOneIn: oneIn(s.rewatched_ratio || 0),
      speed: round(speed, 1),
      secondsPerVideo: speed ? Math.max(1, Math.round(60 / speed)) : null,
      daily,
      dates: c.dates || [],
      dailyAverage: daily.length ? sum(daily) / daily.length : 0,
    },
    plans: buildPlans({ s, c, days, hours, daily, lateHours }),
    summary: parseSummary(data.gemini) || fallbackSummary({ s, level: level.word, lateShare, perDayMin }),
  };
}

/* Three realistic changes, each with the hours it would have given back, per month,
   worked out from this person's own days. */
function buildPlans({ s, c, days, daily, lateHours }) {
  const perMonth = (totalMin) => round(((totalMin / 60) / days) * 30);

  const lateMinutes = c.late_minutes ? sum(c.late_minutes) : lateHours * 60;
  const sittingsList = c.session_minutes;
  const overSitting = sittingsList
    ? sum(sittingsList.map((m) => Math.max(0, m - 30)))
    : (s.binge_sessions || 0) * 15; // without the list: each long sitting is at least 15 min over
  const overDay = sum(daily.map((m) => Math.max(0, m - 60)));

  const reminderHour = 23;
  const plans = [
    {
      id: 'midnight',
      title: 'Stop at midnight',
      back: perMonth(lateMinutes),
      note: 'mostly sleep',
      how: 'Phone down before midnight, every night.',
      reminder: { hour: reminderHour, minute: 30, text: 'Phone down: midnight is close' },
      limitTip: 'Turn on Sleep hours and set them from midnight to 7 am.',
    },
    {
      id: 'sitting',
      title: '30 minutes a sitting',
      back: perMonth(overSitting),
      note: sittingsList ? 'from your longer sittings' : 'at least',
      how: 'When a sitting reaches 30 minutes, stop and do something else.',
      reminder: { hour: s.peak_hour ?? 21, minute: 0, text: 'TikTok check: 30 minutes, then stop' },
      limitTip: 'Turn on Screen time breaks and set them to 30 minutes.',
    },
    {
      id: 'hour',
      title: 'One hour a day',
      back: perMonth(overDay),
      note: 'from your heavier days',
      how: 'Keep each day to one hour in total.',
      reminder: { hour: 20, minute: 0, text: 'TikTok check: one hour today?' },
      limitTip: 'Set Daily screen time to 1 hour.',
    },
  ].filter((p) => p.back > 0);

  const best = plans.reduce((a, b) => (b.back > (a?.back ?? -1) ? b : a), null);
  return plans.map((p) => ({ ...p, best: p === best }));
}

/* The written summary comes back as three labelled parts. Older responses use clinical labels. */
const PART_LABELS = [
  ['see', /what we see|behaviou?ral diagnosis|clinical assessment/i],
  ['next', /what is likely next|what'?s likely next|risk forecast/i],
  ['try', /one thing to try|intervention protocol|recommendation/i],
];

export function parseSummary(text) {
  if (!text || /unavailable|analysis error/i.test(text)) return null;
  const chunks = text.split(/\*\*(.+?)\*\*:?/).map((t) => t.trim());
  const out = {};
  for (let i = 1; i < chunks.length; i += 2) {
    const label = chunks[i].replace(/:$/, '');
    const body = (chunks[i + 1] || '').replace(/^[:\s]+/, '').trim();
    const hit = PART_LABELS.find(([, re]) => re.test(label));
    if (hit && body) out[hit[0]] = body;
  }
  return out.see && out.try ? { see: out.see, next: out.next || '', try: out.try } : null;
}

function fallbackSummary({ s, level, lateShare, perDayMin }) {
  const late = lateShare >= 0.2;
  return {
    see: late
      ? `You watch about ${minutesLabel(perDayMin)} a day, and a lot of it happens after midnight.`
      : `You watch about ${minutesLabel(perDayMin)} a day, mostly around ${hourLabel(s.peak_hour ?? 20)}.`,
    next:
      level === 'Light'
        ? 'If nothing changes, the coming week will probably look much the same: short, occasional sittings.'
        : `If nothing changes, expect more long sittings, especially on ${s.peak_day || 'your busiest day'}s.`,
    try: late
      ? 'Put the phone out of reach at 11:30 pm for one week and see how the mornings feel.'
      : 'Decide how long you want to watch before you open the app, and stop when that time is up.',
  };
}

/* ── Since last time: a few totals kept in this browser, never the file ── */
const HISTORY_KEY = 'neuralvoid.history.v1';

export function readHistory() {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
  } catch {
    return [];
  }
}

export function forgetHistory() {
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch {
    /* storage unavailable */
  }
}

/** Saves this summary and returns the comparison with the previous, different upload (or null). */
export function compareAndSave(ins) {
  const entry = {
    savedAt: new Date().toISOString(),
    endDate: ins.endDate,
    days: ins.days,
    perDayMin: round(ins.perDayMin),
    longPerWeek: round((ins.how.longSittings / ins.days) * 7, 1),
    lateShare: round(ins.when.lateShare, 3),
    level: ins.level,
  };
  const history = readHistory();
  const previous = [...history].reverse().find((h) => h.endDate !== entry.endDate) || null;
  try {
    const kept = history.filter((h) => h.endDate !== entry.endDate).slice(-5);
    localStorage.setItem(HISTORY_KEY, JSON.stringify([...kept, entry]));
  } catch {
    /* storage unavailable: the comparison simply will not appear next time */
  }
  if (!previous) return null;
  const change = previous.perDayMin ? (entry.perDayMin - previous.perDayMin) / previous.perDayMin : 0;
  const daysAgo = Math.max(1, Math.round((Date.now() - new Date(previous.savedAt).getTime()) / 86400000));
  return { previous, current: entry, change, daysAgo };
}

/* ── A nightly reminder as a calendar file any phone or computer can open ── */
export function reminderFile(plan) {
  const pad = (n) => String(n).padStart(2, '0');
  const now = new Date();
  const start = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}T${pad(plan.reminder.hour)}${pad(plan.reminder.minute)}00`;
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//NeuralVoid//Plan//EN',
    'BEGIN:VEVENT',
    `UID:neuralvoid-${plan.id}-${now.getTime()}@neuralvoid`,
    `DTSTAMP:${start}`,
    `DTSTART:${start}`,
    'DURATION:PT5M',
    'RRULE:FREQ=DAILY;COUNT=30',
    `SUMMARY:${plan.reminder.text}`,
    `DESCRIPTION:${plan.how} Set with NeuralVoid.`,
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${plan.reminder.text}`,
    'TRIGGER:PT0M',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return new Blob([lines.join('\r\n')], { type: 'text/calendar' });
}

export function download(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/* ── The summary as one picture, drawn on a canvas ── */
export function summaryPicture(ins, plan) {
  const W = 1080;
  const H = 1350;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext('2d');
  g.fillStyle = '#07080d';
  g.fillRect(0, 0, W, H);
  const glow = g.createRadialGradient(W / 2, 0, 0, W / 2, 0, 900);
  glow.addColorStop(0, 'rgba(255,90,54,0.30)');
  glow.addColorStop(1, 'rgba(255,90,54,0)');
  g.fillStyle = glow;
  g.fillRect(0, 0, W, H);

  const font = (size, weight = 400) => `${weight} ${size}px Inter, system-ui, sans-serif`;
  g.textBaseline = 'top';
  g.fillStyle = '#f3f3f6';
  g.font = font(44, 800);
  g.fillText('neural', 80, 80);
  g.fillStyle = '#FF5A36';
  g.fillText('void', 80 + g.measureText('neural').width, 80);

  g.fillStyle = 'rgba(243,243,246,0.6)';
  g.font = font(40, 500);
  g.fillText(`My TikTok, last ${ins.days} days`, 80, 260);
  g.fillStyle = '#FF5A36';
  g.font = font(200, 800);
  g.fillText(`${ins.hours}`, 72, 320);
  const numberWidth = g.measureText(`${ins.hours}`).width;
  g.font = font(72, 800);
  g.fillText('hours', 100 + numberWidth, 430);

  const rows = [
    ['Each day', `about ${minutesLabel(ins.perDayMin)}`],
    ['Long sittings (45 min or more)', `${ins.how.longSittings}`],
    ['Busiest time', `${hourLabel(ins.when.busiestHour)}${ins.when.busiestDay ? `, ${ins.when.busiestDay}s` : ''}`],
    ['Habit level', ins.level],
  ];
  let y = 620;
  rows.forEach(([label, value]) => {
    g.strokeStyle = 'rgba(255,255,255,0.12)';
    g.beginPath();
    g.moveTo(80, y);
    g.lineTo(W - 80, y);
    g.stroke();
    g.fillStyle = 'rgba(243,243,246,0.6)';
    g.font = font(36, 400);
    g.fillText(label, 80, y + 34);
    g.fillStyle = '#f3f3f6';
    g.font = font(40, 700);
    g.fillText(value, W - 80 - g.measureText(value).width, y + 32);
    y += 112;
  });

  if (plan) {
    g.fillStyle = 'rgba(255,90,54,0.12)';
    g.fillRect(80, y + 30, W - 160, 150);
    g.fillStyle = '#FF5A36';
    g.font = font(30, 700);
    g.fillText('MY ONE CHANGE', 112, y + 58);
    g.fillStyle = '#f3f3f6';
    g.font = font(44, 700);
    g.fillText(`${plan.title}: about ${plan.back} hours back a month`, 112, y + 104);
  }
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}
