"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import type { AdminUserDetail } from "@/services/adminUserDetail";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const pad = (n: number) => String(n).padStart(2, "0");
const dkey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fmtDate = (d: Date) =>
  new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(d);

type Day = { date: Date; count: number; future: boolean; col: number; row: number };
type Month = { name: string; startCol: number; weeks: number; days: Day[] };

export function ContributionGraph({ detail }: { detail: AdminUserDetail }) {
  // One "action" = one credit-ledger event (chat, research, analyzer, plan, signup…).
  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const entry of detail.ledger) {
      const key = dkey(new Date(entry.createdAt));
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return map;
  }, [detail.ledger]);

  const now = useMemo(() => new Date(), []);
  const currentYear = now.getFullYear();

  // Selectable years: every year with data, plus a comfortable trailing range.
  const years = useMemo(() => {
    let min = currentYear;
    for (const entry of detail.ledger) {
      const y = new Date(entry.createdAt).getFullYear();
      if (y < min) min = y;
    }
    const start = Math.min(min, currentYear - 6);
    const list: number[] = [];
    for (let y = currentYear; y >= start; y -= 1) list.push(y);
    return list;
  }, [detail.ledger, currentYear]);

  const [year, setYear] = useState(currentYear);

  const { months, total, maxCount, gridTemplateColumns } = useMemo(() => {
    // Each month is its own block of week-columns — days never share a column
    // across months. Column 1 holds the weekday labels; a spacer column sits
    // between consecutive month blocks.
    const template = ["auto"];
    const monthsAcc: Month[] = [];
    let totalAcc = 0;
    let maxAcc = 0;
    let col = 2; // first month starts after the weekday-label column

    for (let m = 0; m < 12; m += 1) {
      const firstWeekday = new Date(year, m, 1).getDay();
      const daysInMonth = new Date(year, m + 1, 0).getDate();
      const weeks = Math.floor((firstWeekday + daysInMonth - 1) / 7) + 1;
      const startCol = col;
      const days: Day[] = [];

      for (let d = 1; d <= daysInMonth; d += 1) {
        const date = new Date(year, m, d);
        const slot = firstWeekday + d - 1;
        const future = date > now;
        const count = future ? 0 : counts.get(dkey(date)) ?? 0;
        if (!future) {
          totalAcc += count;
          if (count > maxAcc) maxAcc = count;
        }
        days.push({
          date,
          count,
          future,
          col: startCol + Math.floor(slot / 7),
          row: (slot % 7) + 2
        });
      }

      monthsAcc.push({ name: MONTHS[m], startCol, weeks, days });

      for (let w = 0; w < weeks; w += 1) template.push("minmax(0, 1fr)");
      col += weeks;
      if (m < 11) {
        template.push("var(--mgap)");
        col += 1;
      }
    }

    return { months: monthsAcc, total: totalAcc, maxCount: maxAcc, gridTemplateColumns: template.join(" ") };
  }, [counts, year, now]);

  const level = (count: number) => {
    if (count <= 0) return 0;
    const ratio = maxCount > 0 ? count / maxCount : 0;
    if (ratio > 0.75) return 4;
    if (ratio > 0.5) return 3;
    if (ratio > 0.25) return 2;
    return 1;
  };

  return (
    <motion.section
      className="contrib"
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
    >
      <header className="contrib-head">
        <div>
          <h4>
            {total.toLocaleString("en-IN")} action{total === 1 ? "" : "s"} in{" "}
            {year === currentYear ? "the last year" : year}
          </h4>
          <p>Daily app activity</p>
        </div>
        <label className="contrib-select">
          <select value={year} onChange={(e) => setYear(Number(e.target.value))} aria-label="Select year">
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
          <ChevronDown size={15} aria-hidden="true" />
        </label>
      </header>

      <div className="contrib-scroll">
        <div className="contrib-grid" style={{ gridTemplateColumns }}>
          {months.map((mo) => (
            <span className="contrib-month" key={`label-${mo.name}`} style={{ gridColumn: mo.startCol, gridRow: 1 }}>
              {mo.name}
            </span>
          ))}

          {WEEKDAYS.map((d, i) => (
            <span className="contrib-weekday" key={`wd-${i}`} style={{ gridColumn: 1, gridRow: i + 2 }}>
              {d}
            </span>
          ))}

          {months.map((mo) =>
            mo.days.map((day) => (
              <i
                key={dkey(day.date)}
                className={`contrib-cell lvl-${day.future ? 0 : level(day.count)}${day.future ? " is-future" : ""}`}
                style={{ gridColumn: day.col, gridRow: day.row, animationDelay: `${day.col * 7}ms` }}
                title={
                  day.future ? undefined : `${day.count} action${day.count === 1 ? "" : "s"} on ${fmtDate(day.date)}`
                }
              />
            ))
          )}
        </div>
      </div>

      <div className="contrib-legend">
        <span>Less</span>
        <i className="contrib-cell lvl-0" />
        <i className="contrib-cell lvl-1" />
        <i className="contrib-cell lvl-2" />
        <i className="contrib-cell lvl-3" />
        <i className="contrib-cell lvl-4" />
        <span>More</span>
      </div>
    </motion.section>
  );
}
