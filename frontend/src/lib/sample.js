// A made-up example so people can look around before uploading anything.
// Built from a fixed seed, so it is the same every time.
function seeded(seed) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const rnd = seeded(11);
const DAYS = 60;
const dates = [];
const watch = [];
const late = [];
const start = new Date(2026, 6, 1);
for (let i = 0; i < DAYS; i += 1) {
  const d = new Date(start.getTime() + i * 86400000);
  const weekend = d.getDay() === 0 || d.getDay() === 6;
  const drift = i / DAYS;
  const minutes = Math.round(45 + rnd() * 50 + (weekend ? 45 : 0) + drift * 40);
  dates.push(d.toISOString().slice(0, 10));
  watch.push(minutes);
  late.push(rnd() < 0.55 + drift * 0.2 ? Math.round(minutes * (0.2 + rnd() * 0.3)) : 0);
}

const heatmap = Array.from({ length: 7 }, (_, day) =>
  Array.from({ length: 24 }, (_, h) => {
    const weekend = day >= 5;
    const night = h >= 22 || h <= 1 ? 70 : 0;
    const evening = h >= 19 && h < 22 ? 35 : 0;
    const lunch = h >= 12 && h <= 13 ? 18 : 0;
    const morning = h === 7 ? 12 : 0;
    const asleep = h >= 3 && h <= 6;
    return asleep ? Math.round(rnd() * 3) : Math.round((night + evening + lunch + morning) * (weekend ? 1.5 : 1) * (0.6 + rnd() * 0.6) + rnd() * 6);
  })
);

const sessionMinutes = Array.from({ length: 412 }, (_, i) => (i % 11 === 0 ? Math.round(45 + rnd() * 90) : Math.round(3 + rnd() * 30)));
sessionMinutes[40] = 184;

const totalMinutes = watch.reduce((a, b) => a + b, 0);

export const SAMPLE_DATA = {
  example: true,
  statistics: {
    total_events: 24848,
    total_watch_hours: Math.round(totalMinutes / 6) / 10,
    total_sessions: sessionMinutes.length,
    binge_sessions: sessionMinutes.filter((m) => m >= 45).length,
    binge_rate: 0.09,
    avg_session_minutes: 19,
    longest_session_minutes: 184,
    max_binge_streak: 3,
    avg_velocity: 8.2,
    avg_late_night_clips: 45,
    avg_morning_clips: 12,
    rewatched_ratio: 0.08,
    bad_days_ratio: 0.6,
    peak_hour: 23,
    peak_day: 'Sunday',
    days_tracked: DAYS,
    nights_past_midnight: late.filter((m) => m > 0).length,
    late_night_hours: Math.round(late.reduce((a, b) => a + b, 0) / 6) / 10,
    long_day_streak: 4,
    timezone: null,
  },
  forecast: { risk_level: 'high', risk_score: 0.82, trend: 'worsening' },
  charts: {
    dates,
    watch_minutes: watch,
    late_minutes: late,
    session_minutes: sessionMinutes,
    heatmap_z: heatmap,
    session_dist: { binge: sessionMinutes.filter((m) => m >= 45).length, normal: sessionMinutes.filter((m) => m < 45).length },
  },
  gemini:
    '**What we see:** You scroll fast and late. Most of your long sittings start around 11 pm and run past midnight, especially at weekends.\n**What is likely next:** If nothing changes, tomorrow night will probably be another long one. Late nights are the main reason.\n**One thing to try:** Put the phone out of reach at 11:30 pm for one week, and see how the mornings feel.',
};
