// revisionScheduler.js
// Spaced-repetition scheduling math + level metadata.
//
// Levels:
//   0 = learning stage (just studied, never revised)
//   1..5 = number of successful revisions completed
//
// Intervals AFTER each successful level (so a level-0 item is due 1 day after learning):
//   0 → 1 day, 1 → 3 days, 2 → 7 days, 3 → 14 days, 4 → 30 days, 5+ → 60 days

export const LEVEL_INTERVALS = [1, 3, 7, 14, 30, 60];

export const LEVEL_FORMATS = {
  0: { name: "MCQ",          desc: "1st revision — recognise" },
  1: { name: "Hint recall",  desc: "2nd revision — reduce support" },
  2: { name: "Pure recall",  desc: "3rd revision — true recall" },
  3: { name: "Timed recall", desc: "4th revision — speed + confidence" },
  4: { name: "Applied",      desc: "5th revision — twisted question" },
  5: { name: "Mastered",     desc: "Long-term refresh" },
};

export const LEVEL_GUIDANCE = {
  0: "Revise today to retain for 3 days",
  1: "Revise to lock it for a week",
  2: "Revise to lock it for 2 weeks",
  3: "Revise to lock it for a month",
  4: "Revise to lock it for 2 months",
  5: "You've mastered this — keep refreshing",
};

export function addDaysISO(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + Number(days || 0));
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

export function todayISO() {
  return addDaysISO(new Date(), 0);
}

/** Days between two YYYY-MM-DD dates (a - b in days, can be negative). */
export function diffDays(a, b) {
  if (!a || !b) return 0;
  const da = new Date(a + "T00:00:00");
  const dbb = new Date(b + "T00:00:00");
  return Math.round((da.getTime() - dbb.getTime()) / 86400000);
}

/**
 * Compute next due date based on current state.
 * - retryPending (just got it wrong, awaiting retry) → due tomorrow (sooner spacing)
 * - weak → use the previous level's interval
 * - normal → use the standard interval for the current level
 */
export function computeNextDueDate({ level, weak, retryPending }) {
  if (retryPending) return addDaysISO(new Date(), 1);
  const lvl = Math.max(0, Math.min(5, Number(level) || 0));
  const idx = weak ? Math.max(0, lvl - 1) : lvl;
  const days = LEVEL_INTERVALS[idx] ?? LEVEL_INTERVALS[LEVEL_INTERVALS.length - 1];
  return addDaysISO(new Date(), days);
}

/**
 * Risk classification used by the Due Today banner.
 * - urgent = overdue or due today AND weak/retry
 * - weak   = marked weak (any due date)
 * - strong = level >= 3 and not weak
 * - due    = nextDueDate <= today (default category)
 */
export function classifyItem(item, today = todayISO()) {
  if (!item) return "idle";
  const due = item.nextDueDate || todayISO();
  const overdue = diffDays(today, due) >= 0; // due is today or earlier
  if (overdue && (item.weak || item.retryPending)) return "urgent";
  if (item.weak) return "weak";
  if (overdue) return "due";
  if (Number(item.level || 0) >= 3) return "strong";
  return "idle";
}

/** Memory-guidance line shown next to an item. */
export function memoryHint(item) {
  const today = todayISO();
  const due = item?.nextDueDate || today;
  const days = diffDays(due, today); // +ve = future, -ve = overdue
  if (item?.retryPending) return "Retry now to lock it in";
  if (item?.weak) return "Memory weakening — revise soon";
  if (days < 0) return `Overdue by ${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"}`;
  if (days === 0) return LEVEL_GUIDANCE[item?.level || 0] || "Revise now";
  if (days === 1) return "You'll forget this in ~1 day";
  if (days <= 3) return `You'll forget this in ~${days} days`;
  return `Locked for ${days} more days`;
}

/** All items filtered to those due on (or before) the given date. */
export function filterDueOn(items, sessionId, dateISO = todayISO()) {
  const out = [];
  Object.entries(items || {}).forEach(([slug, it]) => {
    if (sessionId && it?.sessionId !== sessionId) return;
    const due = it?.nextDueDate || dateISO;
    if (diffDays(dateISO, due) >= 0) out.push({ slug, ...it });
  });
  // Urgent first, then weak, then by oldest due date.
  out.sort((a, b) => {
    const ra = classifyItem(a, dateISO);
    const rb = classifyItem(b, dateISO);
    const score = c => (c === "urgent" ? 0 : c === "weak" ? 1 : c === "due" ? 2 : 3);
    if (score(ra) !== score(rb)) return score(ra) - score(rb);
    return (a.nextDueDate || "").localeCompare(b.nextDueDate || "");
  });
  return out;
}

/** Tally for the Due Today banner. */
export function summarize(items, dateISO = todayISO()) {
  let urgent = 0, weak = 0, strong = 0, due = 0, total = 0;
  Object.values(items || {}).forEach(it => {
    total += 1;
    const cls = classifyItem(it, dateISO);
    if (cls === "urgent") urgent += 1;
    else if (cls === "weak") weak += 1;
    else if (cls === "strong") strong += 1;
    if (cls === "urgent" || cls === "weak" || cls === "due") due += 1;
  });
  return { urgent, weak, strong, due, total };
}
