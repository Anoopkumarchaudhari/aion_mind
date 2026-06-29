"use client";

import { useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { BarChart3, LineChart as LineChartIcon, PieChart as PieChartIcon } from "lucide-react";
import type { AdminUserDetail } from "@/services/adminUserDetail";

/* ------------------------------------------------------------------ *
 * Shared helpers
 * ------------------------------------------------------------------ */

const PALETTE = ["#3b6df5", "#a78bfa", "#f472b6", "#fbbf24", "#34d399", "#4f8cff", "#fb7185", "#818cf8"];

const dayKey = (ts: number) => {
  const d = new Date(ts);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
};

const shortDay = (ts: number) =>
  new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short" }).format(ts);

const shortDateTime = (ts: number) =>
  new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(ts);

const compact = (n: number) =>
  Math.abs(n) >= 1000 ? `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k` : `${Math.round(n)}`;

/* ================================================================== *
 * Top-level grid
 * ================================================================== */

export function DashboardCharts({ detail }: { detail: AdminUserDetail }) {
  return (
    <div className="dash-charts-grid" id="dashboard-charts">
      <BalanceLineChart detail={detail} />
      <UsageDonutChart detail={detail} />
      <ActivityBarChart detail={detail} />
    </div>
  );
}

function ChartCard({
  icon,
  title,
  subtitle,
  controls,
  children,
  wide
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  controls?: React.ReactNode;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <motion.section
      className={`dash-chart-card ${wide ? "is-wide" : ""}`}
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.25 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
    >
      <header className="dash-chart-head">
        <div className="dash-chart-title">
          <span className="dash-chart-icon">{icon}</span>
          <div>
            <h4>{title}</h4>
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
        </div>
        {controls ? <div className="dash-chart-controls">{controls}</div> : null}
      </header>
      <div className="dash-chart-body">{children}</div>
    </motion.section>
  );
}

function Seg<T extends string | number>({
  options,
  value,
  onChange
}: {
  options: ReadonlyArray<{ value: T; label: string }>;
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="dash-seg" role="tablist">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          role="tab"
          aria-selected={value === opt.value}
          className={`dash-seg-btn ${value === opt.value ? "is-active" : ""}`}
          onClick={() => onChange(opt.value)}
        >
          {value === opt.value ? (
            <motion.span layoutId={`seg-${options.map((o) => o.value).join("")}`} className="dash-seg-pill" />
          ) : null}
          <span className="dash-seg-label">{opt.label}</span>
        </button>
      ))}
    </div>
  );
}

/* ================================================================== *
 * 1) LINE CHART — credit balance / cumulative flow over time
 * ================================================================== */

type LineMetric = "balance" | "spent" | "earned";

function BalanceLineChart({ detail }: { detail: AdminUserDetail }) {
  const [metric, setMetric] = useState<LineMetric>("spent");
  const [hover, setHover] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const series = useMemo(() => {
    const asc = [...detail.ledger].sort((a, b) => a.createdAt - b.createdAt);
    let cumSpent = 0;
    let cumEarned = 0;
    return asc.map((e) => {
      if (e.credits < 0) cumSpent += -e.credits;
      else cumEarned += e.credits;
      return {
        t: e.createdAt,
        balance: e.balanceAfter,
        spent: cumSpent,
        earned: cumEarned,
        label: e.label
      };
    });
  }, [detail.ledger]);

  const W = 620;
  const H = 260;
  const padL = 44;
  const padR = 16;
  const padT = 18;
  const padB = 30;

  const points = series.map((s) => s[metric]);
  const maxV = Math.max(1, ...points);
  const minV = Math.min(0, ...points);
  const n = series.length;

  const x = (i: number) => (n <= 1 ? padL : padL + (i / (n - 1)) * (W - padL - padR));
  const y = (v: number) => padT + (1 - (v - minV) / (maxV - minV || 1)) * (H - padT - padB);

  const linePath = series.map((s, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(s[metric]).toFixed(1)}`).join(" ");

  const gridLines = 4;
  const accent = metric === "spent" ? "#fb7185" : metric === "earned" ? "#34d399" : "#3b6df5";

  const handleMove = (clientX: number) => {
    const svg = svgRef.current;
    if (!svg || n === 0) return;
    const rect = svg.getBoundingClientRect();
    const px = ((clientX - rect.left) / rect.width) * W;
    let nearest = 0;
    let best = Infinity;
    for (let i = 0; i < n; i += 1) {
      const d = Math.abs(x(i) - px);
      if (d < best) {
        best = d;
        nearest = i;
      }
    }
    setHover(nearest);
  };

  const hv = hover != null ? series[hover] : null;

  return (
    <ChartCard
      wide
      icon={<LineChartIcon size={15} />}
      title="Credit trend"
      subtitle={`${n} ledger event${n === 1 ? "" : "s"}`}
      controls={
        <Seg<LineMetric>
          value={metric}
          onChange={setMetric}
          options={[
            { value: "spent", label: "Spent" },
            { value: "balance", label: "Balance" },
            { value: "earned", label: "Earned" }
          ]}
        />
      }
    >
      {n === 0 ? (
        <p className="dash-chart-empty">No credit activity yet.</p>
      ) : (
        <div className="dash-line-wrap">
          <svg
            ref={svgRef}
            className="dash-line-svg"
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="none"
            onMouseMove={(e) => handleMove(e.clientX)}
            onMouseLeave={() => setHover(null)}
            onTouchMove={(e) => handleMove(e.touches[0].clientX)}
            onTouchEnd={() => setHover(null)}
          >
            {/* grid + axis labels */}
            {Array.from({ length: gridLines + 1 }).map((_, i) => {
              const gy = padT + (i / gridLines) * (H - padT - padB);
              const val = maxV - (i / gridLines) * (maxV - minV);
              return (
                <g key={i}>
                  <line x1={padL} y1={gy} x2={W - padR} y2={gy} className="dash-line-grid" />
                  <text x={padL - 8} y={gy + 3} className="dash-axis-label" textAnchor="end">
                    {compact(val)}
                  </text>
                </g>
              );
            })}

            {/* animated line */}
            <motion.path
              key={`line-${metric}`}
              d={linePath}
              fill="none"
              stroke={accent}
              strokeWidth={2.4}
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.9, ease: "easeInOut" }}
            />

            {/* hover crosshair rays + axis readout labels + marker */}
            {hv ? (
              <g>
                {/* vertical ray → x axis */}
                <line x1={x(hover!)} y1={padT} x2={x(hover!)} y2={H - padB} className="dash-line-cross" />
                {/* horizontal ray → y axis */}
                <line x1={padL} y1={y(hv[metric])} x2={W - padR} y2={y(hv[metric])} className="dash-line-cross" />

                {/* y-axis value label */}
                <rect x={2} y={y(hv[metric]) - 9} width={padL - 6} height={18} rx={4} className="dash-ray-label-bg" />
                <text x={padL - 6} y={y(hv[metric]) + 4} className="dash-ray-label" textAnchor="end">
                  {compact(hv[metric])}
                </text>

                {/* x-axis date label */}
                <rect x={x(hover!) - 28} y={H - padB + 3} width={56} height={16} rx={4} className="dash-ray-label-bg" />
                <text x={x(hover!)} y={H - padB + 14} className="dash-ray-label" textAnchor="middle">
                  {shortDay(hv.t)}
                </text>

                <motion.circle
                  cx={x(hover!)}
                  cy={y(hv[metric])}
                  r={5}
                  fill={accent}
                  stroke="var(--bg-elevated, #0b0f14)"
                  strokeWidth={2}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 400, damping: 22 }}
                />
              </g>
            ) : null}

            {/* x labels (first / mid / last) — hidden while hovering to avoid clash with the readout */}
            {hv
              ? null
              : [0, Math.floor((n - 1) / 2), n - 1]
                  .filter((v, i, arr) => arr.indexOf(v) === i)
                  .map((i) => (
                    <text key={i} x={x(i)} y={H - 8} className="dash-axis-label" textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"}>
                      {shortDay(series[i].t)}
                    </text>
                  ))}
          </svg>

          <AnimatePresence>
            {hv ? (
              <motion.div
                className="dash-tip"
                style={{ left: `${(x(hover!) / W) * 100}%` }}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                transition={{ duration: 0.15 }}
              >
                <strong style={{ color: accent }}>{compact(hv[metric])} cr</strong>
                <span>{shortDateTime(hv.t)}</span>
                <em>{hv.label}</em>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      )}
    </ChartCard>
  );
}

/* ================================================================== *
 * 2) DONUT / PIE — usage distribution by feature
 * ================================================================== */

type PieMetric = "credits" | "count";

function UsageDonutChart({ detail }: { detail: AdminUserDetail }) {
  const [metric, setMetric] = useState<PieMetric>("credits");
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [hover, setHover] = useState<string | null>(null);

  const slices = useMemo(() => {
    return detail.usageByFeature
      .map((f, i) => ({
        id: f.featureId,
        label: f.label,
        value: metric === "credits" ? f.credits : f.count,
        color: PALETTE[i % PALETTE.length]
      }))
      .filter((s) => s.value > 0);
  }, [detail.usageByFeature, metric]);

  const active = slices.filter((s) => !hidden.has(s.id));
  const total = active.reduce((sum, s) => sum + s.value, 0);

  const size = 220;
  const cx = size / 2;
  const cy = size / 2;
  const radius = 78;
  const circ = 2 * Math.PI * radius;

  const toggle = (id: string) => {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const hoveredSlice = hover ? active.find((s) => s.id === hover) : null;

  let acc = 0;
  const arcs = active.map((s) => {
    const frac = total ? s.value / total : 0;
    const dash = frac * circ;
    const rotation = (acc / (total || 1)) * 360 - 90;
    acc += s.value;
    return { ...s, frac, dash, rotation };
  });

  return (
    <ChartCard
      icon={<PieChartIcon size={15} />}
      title="Usage mix"
      subtitle="By feature"
      controls={
        <Seg<PieMetric>
          value={metric}
          onChange={setMetric}
          options={[
            { value: "credits", label: "Credits" },
            { value: "count", label: "Calls" }
          ]}
        />
      }
    >
      {slices.length === 0 ? (
        <p className="dash-chart-empty">No usage recorded yet.</p>
      ) : (
        <div className="dash-donut-wrap">
          <div className="dash-donut">
            <svg viewBox={`0 0 ${size} ${size}`} className="dash-donut-svg">
              <circle cx={cx} cy={cy} r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={22} />
              {arcs.map((a) => {
                const dim = hover && hover !== a.id;
                return (
                  <motion.circle
                    key={a.id}
                    cx={cx}
                    cy={cy}
                    r={radius}
                    fill="none"
                    stroke={a.color}
                    strokeLinecap="butt"
                    transform={`rotate(${a.rotation} ${cx} ${cy})`}
                    strokeDasharray={`${a.dash} ${circ - a.dash}`}
                    initial={{ strokeDasharray: `0 ${circ}`, opacity: 0 }}
                    animate={{
                      strokeDasharray: `${a.dash} ${circ - a.dash}`,
                      opacity: dim ? 0.3 : 1,
                      strokeWidth: hover === a.id ? 30 : 22
                    }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    style={{ cursor: "pointer" }}
                    onMouseEnter={() => setHover(a.id)}
                    onMouseLeave={() => setHover(null)}
                  />
                );
              })}
            </svg>
            <div className="dash-donut-center">
              <AnimatePresence mode="wait">
                {active.length === 0 ? (
                  <motion.div
                    key="all-hidden"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.18 }}
                  >
                    <strong>—</strong>
                    <span>all hidden</span>
                  </motion.div>
                ) : (
                  <motion.div
                    key={hoveredSlice ? hoveredSlice.id : "total"}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.18 }}
                  >
                    <strong>{compact(hoveredSlice ? hoveredSlice.value : total)}</strong>
                    <span>
                      {hoveredSlice
                        ? `${Math.round((hoveredSlice.value / (total || 1)) * 100)}% · ${hoveredSlice.label}`
                        : metric === "credits"
                          ? "total credits"
                          : "total calls"}
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          <ul className="dash-legend">
            {slices.map((s) => {
              const off = hidden.has(s.id);
              const pct = total ? Math.round((s.value / total) * 100) : 0;
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    className={`dash-legend-btn ${off ? "is-off" : ""}`}
                    onClick={() => toggle(s.id)}
                    onMouseEnter={() => !off && setHover(s.id)}
                    onMouseLeave={() => setHover(null)}
                  >
                    <span className="dash-legend-dot" style={{ background: s.color }} />
                    <span className="dash-legend-label">{s.label}</span>
                    <span className="dash-legend-val">{off ? "—" : `${pct}%`}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </ChartCard>
  );
}

/* ================================================================== *
 * 3) BAR CHART — earned vs spent per day
 * ================================================================== */

type BarRange = 7 | 14 | 30;
type BarMode = "grouped" | "stacked";

function ActivityBarChart({ detail }: { detail: AdminUserDetail }) {
  const [range, setRange] = useState<BarRange>(14);
  const [mode, setMode] = useState<BarMode>("grouped");
  const [hover, setHover] = useState<number | null>(null);

  const days = useMemo(() => {
    const map = new Map<string, { t: number; earned: number; spent: number }>();
    for (const e of detail.ledger) {
      const key = dayKey(e.createdAt);
      const day = new Date(e.createdAt);
      day.setHours(0, 0, 0, 0);
      const cur = map.get(key) ?? { t: day.getTime(), earned: 0, spent: 0 };
      if (e.credits < 0) cur.spent += -e.credits;
      else cur.earned += e.credits;
      map.set(key, cur);
    }
    return Array.from(map.values())
      .sort((a, b) => a.t - b.t)
      .slice(-range);
  }, [detail.ledger, range]);

  const maxV = Math.max(
    1,
    ...days.map((d) => (mode === "stacked" ? d.earned + d.spent : Math.max(d.earned, d.spent)))
  );

  const gridRows = 4;
  const hv = hover != null ? days[hover] : null;

  return (
    <ChartCard
      icon={<BarChart3 size={15} />}
      title="Daily flow"
      subtitle="Earned vs spent"
      controls={
        <>
          <Seg<BarMode>
            value={mode}
            onChange={setMode}
            options={[
              { value: "grouped", label: "Grouped" },
              { value: "stacked", label: "Stacked" }
            ]}
          />
          <Seg<BarRange>
            value={range}
            onChange={setRange}
            options={[
              { value: 7, label: "7d" },
              { value: 14, label: "14d" },
              { value: 30, label: "30d" }
            ]}
          />
        </>
      }
    >
      {days.length === 0 ? (
        <p className="dash-chart-empty">No activity in this range.</p>
      ) : (
        <>
          <div className="dash-bar-legend">
            <span>
              <i style={{ background: "#34d399" }} /> Earned
            </span>
            <span>
              <i style={{ background: "#fb7185" }} /> Spent
            </span>
          </div>
          <div className="dash-bars" role="img" aria-label="Daily credit flow">
            <div className="dash-bar-grid" aria-hidden="true">
              {Array.from({ length: gridRows + 1 }).map((_, i) => (
                <div className="dash-bar-grid-line" key={i}>
                  <span>{compact(maxV - (i / gridRows) * maxV)}</span>
                </div>
              ))}
            </div>
            {days.map((d, i) => {
              const earnedH = (d.earned / maxV) * 100;
              const spentH = (d.spent / maxV) * 100;
              return (
                <div
                  key={d.t}
                  className={`dash-bar-col ${hover === i ? "is-hover" : ""} ${mode}`}
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                >
                  <div className="dash-bar-stack">
                    <motion.span
                      className="dash-bar earned"
                      initial={{ height: 0 }}
                      whileInView={{ height: `${earnedH}%` }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.6, delay: i * 0.02, ease: "easeOut" }}
                    />
                    <motion.span
                      className="dash-bar spent"
                      initial={{ height: 0 }}
                      whileInView={{ height: `${spentH}%` }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.6, delay: i * 0.02 + 0.05, ease: "easeOut" }}
                    />
                  </div>
                  <span className="dash-bar-x">{shortDay(d.t)}</span>

                  <AnimatePresence>
                    {hover === i && hv ? (
                      <motion.div
                        className="dash-tip dash-bar-tip"
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 6 }}
                        transition={{ duration: 0.15 }}
                      >
                        <span>{shortDay(hv.t)}</span>
                        <em style={{ color: "#34d399" }}>+{compact(hv.earned)} earned</em>
                        <em style={{ color: "#fb7185" }}>-{compact(hv.spent)} spent</em>
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </>
      )}
    </ChartCard>
  );
}
