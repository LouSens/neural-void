import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, BellRing, Check, ChevronDown, Download, Printer, Upload } from 'lucide-react';
import {
  buildInsights,
  compareAndSave,
  download,
  durationWords,
  forgetHistory,
  hourLabel,
  minutesLabel,
  reminderFile,
  summaryPicture,
} from './lib/insights';
import { SAMPLE_DATA } from './lib/sample';

// The deployed backend. VITE_API_URL overrides it, e.g. http://localhost:8000 for local work.
const API = import.meta.env.VITE_API_URL || 'https://neural-void-3166c6bc.fastapicloud.dev';

/* ───────────────────────── shared pieces ───────────────────────── */

function Logo() {
  return (
    <span className="text-lg font-extrabold tracking-tight">
      neural<span className="text-[var(--accent)]">void</span>
    </span>
  );
}

function Shell({ children, right }) {
  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <div
        className="pointer-events-none fixed inset-x-0 top-0 h-[420px] no-print"
        style={{ background: 'radial-gradient(900px 380px at 50% -10%, rgba(255,90,54,0.18), transparent 70%)' }}
        aria-hidden="true"
      />
      <header className="relative z-10 border-b border-[var(--line)]">
        <div className="mx-auto flex h-14 max-w-[1100px] items-center justify-between gap-4 px-4 sm:px-6">
          <Logo />
          {right}
        </div>
      </header>
      <main className="relative z-10 mx-auto max-w-[1100px] px-4 py-8 sm:px-6 sm:py-12">{children}</main>
    </div>
  );
}

function Kicker({ children }) {
  return <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--accent)]">{children}</p>;
}

function Stat({ label, value, unit, note, accent }) {
  return (
    <div className="card p-5">
      <p className="text-sm text-[var(--dim)]">{label}</p>
      <p className={`mt-2 text-4xl font-extrabold leading-none tracking-tight ${accent ? 'text-[var(--accent)]' : ''}`}>
        {value}
        {unit && <span className="ml-1.5 text-base font-bold">{unit}</span>}
      </p>
      {note && <p className="mt-2 text-sm text-[var(--mute)]">{note}</p>}
    </div>
  );
}

/* ───────────────────────── 01 welcome ───────────────────────── */

function Welcome({ onStart, onExample }) {
  const steps = [
    'In TikTok, open Settings and privacy, then Account',
    'Choose "Download your data" and request it as TXT',
    'Open the download and find "Watch History.txt"',
  ];
  return (
    <Shell>
      <div className="grid items-center gap-8 lg:grid-cols-12 lg:gap-12 lg:pt-10">
        <div className="rise lg:col-span-7">
          <Kicker>Your TikTok habits, in plain numbers</Kicker>
          <h1 className="mt-3 text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-5xl">
            See what your scrolling really looks like.
          </h1>
          <p className="mt-4 max-w-xl text-lg leading-relaxed text-[var(--mute)]">
            Upload your TikTok watch history and get a clear picture: how much you watch, when you watch, and one change
            that would give you hours back.
          </p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <button type="button" className="btn" onClick={onStart}>
              <Upload size={17} /> Upload my watch history
            </button>
            <button type="button" className="btn btn-ghost" onClick={onExample}>
              See an example first
            </button>
          </div>
          <p className="mt-4 text-sm text-[var(--dim)]">Your file is read once to make your summary. It is not saved.</p>
        </div>

        <div className="card rise p-6 lg:col-span-5" style={{ animationDelay: '0.1s' }}>
          <h2 className="text-lg font-bold">How to get your file</h2>
          <ol className="mt-4 space-y-4">
            {steps.map((text, i) => (
              <li key={text} className="flex items-start gap-3.5">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-sm font-extrabold text-white">
                  {i + 1}
                </span>
                <span className="pt-0.5 text-[var(--mute)]">{text}</span>
              </li>
            ))}
          </ol>
          <p className="mt-5 text-sm text-[var(--dim)]">TikTok usually takes a day or two to prepare the download.</p>
        </div>
      </div>
    </Shell>
  );
}

/* ───────────────────────── 02 add your file ───────────────────────── */

async function peek(file) {
  const text = await file.text();
  const dates = text.match(/Date:\s*\d{4}-\d{2}-\d{2}/g) || [];
  if (!dates.length) return null;
  const days = new Set(dates.map((d) => d.slice(-10)));
  return { videos: dates.length, days: days.size };
}

function AddFile({ onBack, onRun }) {
  const [file, setFile] = useState(null);
  const [found, setFound] = useState(null);
  const [error, setError] = useState('');
  const [over, setOver] = useState(false);
  const input = useRef(null);

  const choose = async (f) => {
    if (!f) return;
    setError('');
    setFound(null);
    setFile(null);
    const info = await peek(f).catch(() => null);
    if (!info) {
      setError('That does not look like a TikTok watch history. Look for the file called "Watch History.txt" in your download.');
      return;
    }
    setFile(f);
    setFound(info);
  };

  return (
    <Shell
      right={
        <button type="button" onClick={onBack} className="flex min-h-11 items-center gap-1.5 text-sm text-[var(--mute)] hover:text-[var(--text)]">
          <ArrowLeft size={16} /> Back
        </button>
      }
    >
      <div className="rise mx-auto max-w-xl lg:pt-8">
        <h1 className="text-3xl font-extrabold tracking-tight">Add your watch history</h1>
        <p className="mt-2 text-[var(--mute)]">The file called "Watch History.txt" from your TikTok download.</p>

        <button
          type="button"
          onClick={() => input.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setOver(false);
            choose(e.dataTransfer.files?.[0]);
          }}
          className={`mt-6 block w-full rounded-2xl border-2 border-dashed p-6 text-left transition-colors ${
            file || over ? 'border-[var(--accent)] bg-[var(--accent-soft)]' : 'border-[var(--line)] hover:border-[var(--dim)]'
          }`}
        >
          <span className="flex items-center gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-[var(--accent)]/40 bg-[var(--accent-soft)] text-[var(--accent)]">
              <Upload size={20} />
            </span>
            {file ? (
              <span className="min-w-0 flex-1">
                <span className="block truncate font-bold">{file.name}</span>
                <span className="block text-sm text-[var(--mute)]">
                  about {found.videos.toLocaleString()} videos · {found.days} days
                </span>
              </span>
            ) : (
              <span className="flex-1">
                <span className="block font-bold">Choose the file, or drop it here</span>
                <span className="block text-sm text-[var(--mute)]">A .txt file</span>
              </span>
            )}
            {file && <span className="text-sm font-bold text-[var(--good)]">Ready</span>}
          </span>
        </button>
        <input ref={input} id="fu" type="file" accept=".txt,text/plain" className="hidden" onChange={(e) => choose(e.target.files?.[0])} />

        {error && (
          <p role="alert" className="mt-4 rounded-xl border border-red-400/40 bg-red-400/10 p-4 text-sm text-red-200">
            {error}
          </p>
        )}

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          <button type="button" className="btn" disabled={!file} onClick={() => onRun(file)}>
            Show me my summary <ArrowRight size={17} />
          </button>
          <span className="text-sm text-[var(--dim)]">Takes a few seconds</span>
        </div>
      </div>
    </Shell>
  );
}

/* ───────────────────────── 03 reading your history ───────────────────────── */

const READING_STEPS = 5;

function Reading({ data, error, onDone, onBack }) {
  const [step, setStep] = useState(0);
  const s = data?.statistics;
  const steps = [
    ['Reading your videos', s ? `${s.total_events.toLocaleString()} found` : 'counting'],
    ['Grouping them into sittings', s ? `${s.total_sessions.toLocaleString()} times you sat down to watch` : 'a break of 10 minutes ends a sitting'],
    ['Finding the long ones', s ? `${s.binge_sessions.toLocaleString()} lasted 45 minutes or more` : '45 minutes or more'],
    ['Spotting your patterns', 'when, how often, how fast'],
    ['Writing your summary', ''],
  ];

  // The steps tick along while the answer is on its way, and finish once it has arrived.
  useEffect(() => {
    if (error) return undefined;
    if (step >= READING_STEPS) {
      const t = setTimeout(onDone, 500);
      return () => clearTimeout(t);
    }
    if (step >= 3 && !data) return undefined;
    const t = setTimeout(() => setStep((n) => n + 1), 750);
    return () => clearTimeout(t);
  }, [step, data, error, onDone]);

  return (
    <Shell>
      <div className="mx-auto max-w-lg lg:pt-8" aria-live="polite">
        <h1 className="text-3xl font-extrabold tracking-tight">{error ? 'That did not work' : 'Reading your history…'}</h1>
        {error ? (
          <>
            <p className="mt-3 text-[var(--mute)]">{error}</p>
            <button type="button" className="btn mt-6" onClick={onBack}>
              Try again
            </button>
          </>
        ) : (
          <>
            <ol className="mt-7 space-y-5">
              {steps.map(([title, detail], i) => {
                const done = i < step;
                const now = i === step;
                return (
                  <li key={title} className="flex items-start gap-4">
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-extrabold ${
                        done ? 'bg-[var(--accent)] text-white' : now ? 'border-2 border-[var(--accent)] text-[var(--accent)]' : 'border-2 border-[var(--line)] text-[var(--dim)]'
                      }`}
                    >
                      {done ? <Check size={16} strokeWidth={3} /> : i + 1}
                    </span>
                    <span>
                      <span className={`block font-bold ${now ? 'text-[var(--accent)]' : done ? '' : 'text-[var(--dim)]'}`}>{title}</span>
                      {detail && (done || now) && <span className="block text-sm text-[var(--mute)]">{detail}</span>}
                    </span>
                  </li>
                );
              })}
            </ol>
            <div className="mt-8 h-2 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-[var(--accent)] transition-all duration-500" style={{ width: `${(step / READING_STEPS) * 100}%` }} />
            </div>
          </>
        )}
      </div>
    </Shell>
  );
}

/* ───────────────────────── 04 summary ───────────────────────── */

function LevelMeter({ ins }) {
  return (
    <div className="card p-5 sm:col-span-2">
      <p className="text-sm text-[var(--dim)]">Your habit level</p>
      <p className="mt-2 text-4xl font-extrabold leading-none tracking-tight text-[var(--accent)]">{ins.level}</p>
      <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${ins.levelValue * 100}%` }} />
      </div>
      <div className="mt-1.5 flex justify-between text-xs text-[var(--dim)]">
        <span>Light</span>
        <span>Moderate</span>
        <span>High</span>
      </div>
      <p className="mt-3 text-sm text-[var(--mute)]">{ins.levelLine}</p>
      <p className={`mt-1 text-sm ${ins.direction.good ? 'text-[var(--good)]' : 'text-[var(--mute)]'}`}>{ins.direction.word}</p>
    </div>
  );
}

/* 09: what changed since the last upload. A first visit explains that it will appear next time. */
function SinceLastTime({ compare, hidden, onForget }) {
  if (hidden) return null;
  if (!compare) {
    return (
      <div className="card flex flex-col gap-2 p-5 sm:flex-row sm:items-center sm:justify-between no-print">
        <p className="text-sm text-[var(--mute)]">
          <span className="font-bold text-[var(--text)]">Come back in two weeks.</span> Upload a fresh watch history and this spot will show what changed. Only a
          few totals are kept, on this device. Your file never is.
        </p>
        <button type="button" onClick={onForget} className="min-h-11 shrink-0 text-sm text-[var(--dim)] underline hover:text-[var(--text)]">
          Do not keep anything
        </button>
      </div>
    );
  }
  const pct = Math.round(Math.abs(compare.change) * 100);
  const less = compare.change < -0.03;
  const more = compare.change > 0.03;
  const tone = less ? 'text-[var(--good)]' : more ? 'text-[var(--accent)]' : '';
  const row = (label, now, before) => (
    <div className="card p-4">
      <p className="text-sm text-[var(--dim)]">{label}</p>
      <p className="mt-1 text-2xl font-extrabold tracking-tight">{now}</p>
      <p className="text-sm text-[var(--mute)]">was {before}</p>
    </div>
  );
  return (
    <div className="card border-[var(--accent)]/40 p-5">
      <Kicker>
        Since last time · {compare.daysAgo} day{compare.daysAgo > 1 ? 's' : ''} ago
      </Kicker>
      <h2 className="mt-2 text-2xl font-extrabold tracking-tight">
        You are watching <span className={tone}>{less ? `${pct}% less` : more ? `${pct}% more` : 'about the same'}</span> each day.
      </h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {row('Each day', minutesLabel(compare.current.perDayMin), minutesLabel(compare.previous.perDayMin))}
        {row('Long sittings a week', compare.current.longPerWeek, compare.previous.longPerWeek)}
        {row('Share after midnight', `${Math.round(compare.current.lateShare * 100)}%`, `${Math.round(compare.previous.lateShare * 100)}%`)}
      </div>
      <button type="button" onClick={onForget} className="mt-3 min-h-11 text-sm text-[var(--dim)] underline hover:text-[var(--text)] no-print">
        Forget my history
      </button>
    </div>
  );
}

function Summary({ ins, compare, hideHistory, onForget }) {
  const eq = ins.equivalents;
  const adds = [
    [`${eq.workDays} working days`, 'of eight hours each'],
    [`${eq.films} films`, 'back to back'],
    eq.nightsPastMidnight != null
      ? [`${eq.nightsPastMidnight} of ${ins.days} nights`, 'you were still watching after midnight']
      : [`${eq.lateHours} hours`, 'watched between midnight and 7 am'],
  ];
  return (
    <div className="space-y-5">
      <SinceLastTime compare={compare} hidden={hideHistory} onForget={onForget} />
      <div>
        <h1 className="text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
          You watched about <span className="text-[var(--accent)]">{ins.hours} hours</span> of TikTok in {ins.days} days.
        </h1>
        <p className="mt-2 text-lg text-[var(--mute)]">That is roughly {durationWords(ins.perDayMin)} a day.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <LevelMeter ins={ins} />
        <Stat
          label="Long sittings"
          value={ins.how.longSittings}
          note={ins.how.longOneIn ? `about 1 in ${ins.how.longOneIn}, each 45 minutes or more` : 'each 45 minutes or more'}
        />
        <Stat
          label="Scrolling speed"
          value={ins.how.speed}
          unit="a minute"
          note={ins.how.secondsPerVideo ? `a new video every ${ins.how.secondsPerVideo} seconds` : ''}
        />
      </div>

      <div className="card border-[var(--accent)]/40 p-5">
        <p className="text-sm text-[var(--dim)]">What it adds up to</p>
        <div className="mt-3 grid gap-4 sm:grid-cols-3">
          {adds.map(([big, small]) => (
            <div key={small}>
              <p className="text-2xl font-extrabold tracking-tight text-[var(--accent)]">{big}</p>
              <p className="text-sm text-[var(--mute)]">{small}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="card p-5">
        <p className="text-sm text-[var(--dim)]">What stands out</p>
        <div className="mt-3 grid gap-5 sm:grid-cols-3">
          {ins.standsOut.map((item) => (
            <div key={item.title}>
              <p className="font-bold">{item.title}</p>
              <p className="mt-1 text-sm leading-relaxed text-[var(--mute)]">{item.text}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── 05 when you watch ───────────────────────── */

function WeekPicture({ when }) {
  return (
    <div className="card p-5 lg:col-span-2 lg:row-span-2">
      <h2 className="text-lg font-bold">Your week, hour by hour</h2>
      <p className="text-sm text-[var(--mute)]">Brighter means more videos</p>
      <div className="no-scrollbar mt-4 overflow-x-auto">
        <div className="min-w-[520px] space-y-1">
          {when.heat.map((row, d) => (
            <div key={when.dayNames[d]} className="flex items-center gap-2">
              <span className="w-9 shrink-0 text-xs text-[var(--dim)]">{when.dayNames[d].slice(0, 3)}</span>
              <div className="grid flex-1 gap-[3px]" style={{ gridTemplateColumns: 'repeat(24, 1fr)' }}>
                {row.map((v, h) => (
                  <span
                    key={h}
                    title={`${when.dayNames[d]}, ${hourLabel(h)}: ${v} videos`}
                    className="h-5 rounded-[3px]"
                    style={{ background: `rgba(255,90,54,${0.07 + (v / when.heatMax) * 0.9})` }}
                  />
                ))}
              </div>
            </div>
          ))}
          <div className="flex justify-between pl-11 pt-1 text-xs text-[var(--dim)]">
            <span>midnight</span>
            <span>6 am</span>
            <span>noon</span>
            <span>6 pm</span>
            <span>11 pm</span>
          </div>
        </div>
      </div>
      {when.timezone && <p className="mt-3 text-xs text-[var(--dim)]">Times are in your own time zone.</p>}
    </div>
  );
}

function When({ ins }) {
  const w = ins.when;
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <WeekPicture when={w} />
      <Stat label="Busiest time" value={hourLabel(w.busiestHour)} note={w.busiestDay ? `and your heaviest day is ${w.busiestDay}` : ''} />
      <div className="card p-5">
        <p className="text-sm text-[var(--dim)]">After midnight</p>
        <p className="mt-2 text-4xl font-extrabold leading-none tracking-tight">{Math.round(w.lateShare * 100)}%</p>
        <p className="mt-2 text-sm text-[var(--mute)]">of your watching, about {w.latePerNight} videos a night</p>
        <p className="mt-3 border-t border-[var(--line)] pt-3 text-sm text-[var(--mute)]">
          First thing in the morning: about {w.morningPerDay} videos a day
        </p>
      </div>
    </div>
  );
}

/* ───────────────────────── 06 how you watch ───────────────────────── */

function DailyLine({ how }) {
  const W = 600;
  const H = 160;
  const max = Math.max(...how.daily, 1) * 1.1;
  const x = (i) => (how.daily.length > 1 ? (i / (how.daily.length - 1)) * W : W / 2);
  const y = (v) => H - (v / max) * H;
  const path = how.daily.map((v, i) => `${i ? 'L' : 'M'} ${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
  const heavy = how.dailyAverage * 1.4;
  return (
    <div className="card p-5 lg:col-span-2">
      <h2 className="text-lg font-bold">Minutes watched each day</h2>
      <p className="text-sm text-[var(--mute)]">Dots mark days that were much heavier than usual for you</p>
      <svg viewBox={`0 0 ${W} ${H + 8}`} className="mt-4 w-full" role="img" aria-label="Minutes watched each day">
        <line x1="0" x2={W} y1={y(how.dailyAverage)} y2={y(how.dailyAverage)} stroke="currentColor" strokeOpacity="0.25" strokeDasharray="5 5" />
        <path d={path} fill="none" stroke="#FF5A36" strokeWidth="2.5" strokeLinejoin="round" />
        {how.daily.map((v, i) => (v >= heavy ? <circle key={i} cx={x(i)} cy={y(v)} r="4" fill="#FF5A36" /> : null))}
      </svg>
      <p className="mt-1 text-xs text-[var(--dim)]">Dotted line: your average, {minutesLabel(how.dailyAverage)} a day</p>
    </div>
  );
}

function ShortOrLong({ how }) {
  const r = 38;
  const c = 2 * Math.PI * r;
  const share = how.sittings ? how.longSittings / how.sittings : 0;
  return (
    <div className="card p-5">
      <h2 className="text-lg font-bold">Short or long?</h2>
      <svg viewBox="0 0 100 100" className="mx-auto mt-3 w-36" role="img" aria-label="Share of long sittings">
        <circle cx="50" cy="50" r={r} fill="none" stroke="currentColor" strokeOpacity="0.14" strokeWidth="13" />
        <circle cx="50" cy="50" r={r} fill="none" stroke="#FF5A36" strokeWidth="13" strokeDasharray={`${c * share} ${c}`} transform="rotate(-90 50 50)" />
      </svg>
      <p className="mt-3 text-center text-sm text-[var(--mute)]">
        {how.sittings - how.longSittings} shorter · <span className="font-bold text-[var(--accent)]">{how.longSittings} long</span>
      </p>
    </div>
  );
}

function How({ ins }) {
  const h = ins.how;
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Stat label="A typical sitting" value={h.typicalMin} unit="min" note={`${h.sittings.toLocaleString()} sittings in ${ins.days} days`} />
      {h.streak != null ? (
        <Stat
          label="Most long-sitting days in a row"
          value={h.streak}
          unit={h.streak === 1 ? 'day' : 'days'}
          note={h.streak > 1 ? 'a long sitting every day, that many days running' : 'long sittings did not run day after day'}
        />
      ) : (
        <Stat label="Your longest sitting" value={minutesLabel(h.longestMin)} note="without a break of 10 minutes" />
      )}
      <Stat
        label="Videos you watched again"
        value={`${Math.round(h.repeatShare * 100)}%`}
        note={h.repeatOneIn ? `about 1 in ${h.repeatOneIn} was a repeat` : 'hardly any repeats'}
      />
      <DailyLine how={h} />
      <ShortOrLong how={h} />
    </div>
  );
}

/* ───────────────────────── 07 and 08 your plan ───────────────────────── */

function HowThisWorks() {
  return (
    <details className="card group p-5">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
        <span>
          <span className="block font-bold">How this works</span>
          <span className="block text-sm text-[var(--mute)]">For the curious: what the app measures and how sure it is</span>
        </span>
        <ChevronDown size={18} className="shrink-0 text-[var(--dim)] transition-transform group-open:rotate-180" />
      </summary>
      <div className="mt-4 space-y-3 border-t border-[var(--line)] pt-4 text-sm leading-relaxed text-[var(--mute)]">
        <p>Your file lists the time of every video you opened. A gap of 10 minutes ends a sitting, and 45 minutes or more counts as a long one.</p>
        <p>
          From those times the app works out 25 measurements for each day, such as how fast you scroll, how much happens late at night, and how the last few days
          compare with the week before.
        </p>
        <p>
          Three separate statistical models each read those measurements and vote on your habit level. On test histories they agreed with the correct answer
          about 96% of the time. It describes a pattern. It is not a medical diagnosis.
        </p>
      </div>
    </details>
  );
}

const clock = (r) => `${r.hour % 12 || 12}${r.minute ? `:${String(r.minute).padStart(2, '0')}` : ''} ${r.hour < 12 ? 'am' : 'pm'}`;

function Plan({ ins, plan, onChoose, onSave }) {
  const [showTaps, setShowTaps] = useState(false);
  const parts = [
    ['What we see', ins.summary.see],
    ['What is likely next', ins.summary.next],
    ['One thing to try', ins.summary.try],
  ].filter(([, text]) => text);

  return (
    <div className="space-y-5">
      <div className="grid gap-4 lg:grid-cols-3">
        {parts.map(([title, text], i) => (
          <div key={title} className={`card p-5 ${i === parts.length - 1 ? 'border-[var(--accent)]/50 bg-[var(--accent-soft)]' : ''}`}>
            <Kicker>{title}</Kicker>
            <p className="mt-2 leading-relaxed">{text}</p>
          </div>
        ))}
      </div>

      {ins.plans.length > 0 && (
        <section>
          <h2 className="text-2xl font-extrabold tracking-tight">Pick one change. See what you get back.</h2>
          <p className="mt-1 text-[var(--mute)]">Worked out from your own history, not a guess.</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            {ins.plans.map((p) => {
              const on = plan?.id === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => onChoose(p.id)}
                  className={`card p-5 text-left transition-colors ${on ? 'border-[var(--accent)] bg-[var(--accent-soft)]' : 'hover:border-[var(--dim)]'}`}
                >
                  <span className="block h-4 text-xs font-bold uppercase tracking-[0.14em] text-[var(--accent)]">{p.best ? 'Best for you' : ''}</span>
                  <span className="mt-1 block font-bold">{p.title}</span>
                  <span className={`mt-2 block text-4xl font-extrabold leading-none tracking-tight ${on ? 'text-[var(--accent)]' : ''}`}>
                    {p.back} <span className="text-base font-bold">hrs</span>
                  </span>
                  <span className="mt-2 block text-sm text-[var(--mute)]">back every month, {p.note}</span>
                </button>
              );
            })}
          </div>

          {plan && (
            <div className="card mt-4 p-5 no-print">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="font-bold">Make it stick</p>
                  <p className="text-sm text-[var(--mute)]">
                    {plan.how} Add a reminder at {clock(plan.reminder)} every day for 30 days, and set TikTok's own limit in three taps.
                  </p>
                </div>
                <div className="flex shrink-0 flex-col gap-3 sm:flex-row">
                  <button type="button" className="btn btn-ghost" onClick={() => setShowTaps((v) => !v)} aria-expanded={showTaps}>
                    Show me the taps
                  </button>
                  <button type="button" className="btn" onClick={() => download(reminderFile(plan), 'neuralvoid-reminder.ics')}>
                    <BellRing size={17} /> Add the reminder
                  </button>
                </div>
              </div>
              {showTaps && (
                <ol className="mt-4 space-y-2 border-t border-[var(--line)] pt-4 text-sm text-[var(--mute)]">
                  <li>1. In TikTok, open your profile and tap the menu in the top corner.</li>
                  <li>2. Tap Settings and privacy, then Screen time.</li>
                  <li>3. {plan.limitTip}</li>
                </ol>
              )}
            </div>
          )}
        </section>
      )}

      <HowThisWorks />

      <div className="flex flex-col gap-3 sm:flex-row no-print">
        <button type="button" className="btn" onClick={onSave}>
          <Download size={17} /> Save my summary
        </button>
      </div>
    </div>
  );
}

/* ───────────────────────── 10 save or share ───────────────────────── */

function SavePanel({ ins, plan, onClose, onPrint }) {
  const [busy, setBusy] = useState(false);
  const savePicture = async () => {
    setBusy(true);
    const blob = await summaryPicture(ins, plan);
    if (blob) download(blob, 'my-tiktok-summary.png');
    setBusy(false);
  };
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 no-print" onClick={onClose} role="dialog" aria-modal="true" aria-label="Save or share">
      <div className="card grid w-full max-w-3xl gap-6 !bg-[var(--panel)] p-6 sm:grid-cols-2 sm:p-8" onClick={(e) => e.stopPropagation()}>
        <div className="rounded-2xl border border-[var(--accent)]/50 bg-[#0b0c12] p-6">
          <Logo />
          <p className="mt-5 text-sm text-[var(--dim)]">My TikTok, last {ins.days} days</p>
          <p className="mt-1 text-6xl font-extrabold leading-none tracking-tight text-[var(--accent)]">
            {ins.hours} <span className="text-2xl">hours</span>
          </p>
          <p className="mt-4 text-sm leading-relaxed">
            About {minutesLabel(ins.perDayMin)} a day · {ins.how.longSittings} long sittings · busiest at {hourLabel(ins.when.busiestHour)}
          </p>
          {plan && <p className="mt-3 text-sm text-[var(--mute)]">My one change: {plan.title.toLowerCase()}.</p>}
        </div>
        <div className="flex flex-col">
          <h2 className="text-2xl font-extrabold tracking-tight">Keep it, or show someone.</h2>
          <p className="mt-2 text-sm leading-relaxed text-[var(--mute)]">
            One picture with the headline numbers and the change you picked. No list of videos, nothing personal beyond these totals.
          </p>
          <div className="mt-auto flex flex-col gap-3 pt-6">
            <button type="button" className="btn" onClick={savePicture} disabled={busy}>
              <Download size={17} /> {busy ? 'Making the picture…' : 'Save as a picture'}
            </button>
            <button type="button" className="btn btn-ghost" onClick={onPrint}>
              <Printer size={17} /> Print the full summary
            </button>
            <button type="button" className="min-h-11 text-sm text-[var(--dim)] hover:text-[var(--text)]" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── results: the four tabs ───────────────────────── */

const TABS = [
  ['summary', 'Summary'],
  ['when', 'When you watch'],
  ['how', 'How you watch'],
  ['plan', 'Your plan'],
];

function Results({ data, onReset }) {
  const ins = useMemo(() => buildInsights(data), [data]);
  const example = !!data.example;
  const [tab, setTab] = useState('summary');
  const [chosen, setChosen] = useState(null);
  const [saving, setSaving] = useState(false);
  const [printing, setPrinting] = useState(false);
  // Keep a few totals on this device so the next upload can be compared. Never for the example.
  // Saving the same upload twice is harmless: an entry is replaced by its end date.
  const [compare, setCompare] = useState(() => (example ? null : compareAndSave(ins)));
  const [kept, setKept] = useState(true);

  const forget = () => {
    forgetHistory();
    setCompare(null);
    setKept(false);
  };

  // Printing shows every section on one page, then returns to the tabs.
  const print = () => {
    setSaving(false);
    setPrinting(true);
  };
  useEffect(() => {
    if (!printing) return undefined;
    const done = () => setPrinting(false);
    window.addEventListener('afterprint', done);
    const t = setTimeout(() => window.print(), 150);
    return () => {
      clearTimeout(t);
      window.removeEventListener('afterprint', done);
    };
  }, [printing]);

  const plan = ins.plans.find((p) => p.id === chosen) || ins.plans.find((p) => p.best) || ins.plans[0] || null;
  const sections = {
    summary: <Summary ins={ins} compare={compare} hideHistory={example || !kept} onForget={forget} />,
    when: <When ins={ins} />,
    how: <How ins={ins} />,
    plan: <Plan ins={ins} plan={plan} onChoose={setChosen} onSave={() => setSaving(true)} />,
  };

  return (
    <Shell
      right={
        <button type="button" onClick={onReset} className="min-h-11 text-sm text-[var(--mute)] hover:text-[var(--text)] no-print">
          Check another file
        </button>
      }
    >
      {example && (
        <p className="mb-5 rounded-xl border border-[var(--line)] bg-[var(--card)] px-4 py-3 text-sm text-[var(--mute)]">
          This is an example with made-up numbers. Upload your own watch history to see yours.
        </p>
      )}

      <nav className="no-scrollbar -mx-4 mb-6 overflow-x-auto px-4 no-print sm:mx-0 sm:px-0" aria-label="Sections">
        <div className="inline-flex gap-1 rounded-full border border-[var(--line)] bg-[var(--card)] p-1">
          {TABS.map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              aria-current={tab === id ? 'page' : undefined}
              className={`min-h-10 whitespace-nowrap rounded-full px-4 text-sm font-semibold transition-colors ${
                tab === id ? 'bg-[var(--accent)] text-white' : 'text-[var(--mute)] hover:text-[var(--text)]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </nav>

      {printing ? (
        <div className="space-y-10">
          {TABS.map(([id, label]) => (
            <section key={id}>
              <h2 className="mb-4 text-xl font-extrabold">{label}</h2>
              {sections[id]}
            </section>
          ))}
        </div>
      ) : (
        <div key={tab} className="rise">
          {sections[tab]}
        </div>
      )}

      {saving && <SavePanel ins={ins} plan={plan} onClose={() => setSaving(false)} onPrint={print} />}
    </Shell>
  );
}

/* ───────────────────────── the flow ───────────────────────── */

export default function App() {
  const [screen, setScreen] = useState('welcome'); // welcome | add | reading | results
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const run = useCallback(async (file) => {
    setData(null);
    setError('');
    setScreen('reading');
    const body = new FormData();
    body.append('file', file);
    // so "11 pm" means the visitor's own 11 pm
    body.append('tz', Intl.DateTimeFormat().resolvedOptions().timeZone || '');
    try {
      const res = await fetch(`${API}/analyze`, { method: 'POST', body });
      if (!res.ok) throw new Error(String(res.status));
      setData(await res.json());
    } catch {
      setError('We could not read that file just now. Check your connection and try again in a moment.');
    }
  }, []);

  const showResults = useCallback(() => setScreen('results'), []);
  const reset = () => {
    setData(null);
    setError('');
    setScreen('welcome');
  };

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [screen]);

  // A free host puts the backend to sleep when nobody is using it, and the first request after that
  // takes about a minute. Knock on its door as soon as the page opens, so it is awake by upload time.
  useEffect(() => {
    fetch(`${API}/health`).catch(() => {});
  }, []);

  if (screen === 'add') return <AddFile onBack={reset} onRun={run} />;
  if (screen === 'reading') return <Reading data={data} error={error} onDone={showResults} onBack={() => setScreen('add')} />;
  if (screen === 'results' && data) return <Results data={data} onReset={reset} />;
  return (
    <Welcome
      onStart={() => setScreen('add')}
      onExample={() => {
        setData(SAMPLE_DATA);
        setScreen('results');
      }}
    />
  );
}
