"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { PresentedItem, ReadModel, ViewFilters, ViewSort } from "@/lib/types";
import { applyView, compareAttention } from "@/lib/view";

const EMPTY_FILTERS: ViewFilters = {
  query: "",
  bot: "",
  state: "",
  attention: "",
  confidence: "",
  sort: "attention",
};

export function Dashboard({ model }: { model: ReadModel }) {
  const router = useRouter();
  const [view, setView] = useState<"attention" | "roster">("attention");
  const [filters, setFilters] = useState<ViewFilters>(EMPTY_FILTERS);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, 60_000);
    return () => window.clearInterval(id);
  }, [router]);

  const bots = useMemo(
    () => [...new Set(model.items.map((item) => item.ownerBot))].sort((a, b) => a.localeCompare(b)),
    [model.items],
  );
  const visible = useMemo(() => applyView(model.items, filters), [model.items, filters]);
  const showLists = model.mode === "ready" || model.mode === "synthetic" || model.mode === "empty";

  function update<K extends keyof ViewFilters>(key: K, value: ViewFilters[K]) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  return (
    <>
      <h1>What needs you.</h1>
      <p className="lead">
        Work that started and then stopped. Decisions only you can make. Blockers another bot can clear.
      </p>
      <dl className="meta">
        <div>
          <dt>Snapshot collected</dt>
          <dd>
            {model.collectedLabel ?? "None"}
            <span className="zone">{model.displayTimeZone}</span>
          </dd>
        </div>
        <div>
          <dt>Stored</dt>
          <dd>{model.storedLabel ?? "None"}</dd>
        </div>
        <div>
          <dt>Page rendered</dt>
          <dd>{model.renderedLabel}</dd>
        </div>
      </dl>
      <p className="note">
        Collected and activity times come from the stored snapshot. This tab reloads that snapshot every 60 seconds.
        It does not watch bots live.
        {model.collector ? ` Source label: ${model.collector}.` : ""}
      </p>
      {model.timeZoneNote ? <p className="notice">{model.timeZoneNote}</p> : null}
      {model.synthetic ? (
        <p className="banner">
          <strong>SYNTHETIC</strong>
          <br />
          {model.notice}
        </p>
      ) : model.notice ? (
        <p className="notice">{model.notice}</p>
      ) : null}

      {showLists ? (
        <>
          <div className="views" role="tablist" aria-label="Board">
            <button className="tab" type="button" role="tab" aria-selected={view === "attention"} onClick={() => setView("attention")}>
              Attention
            </button>
            <button className="tab" type="button" role="tab" aria-selected={view === "roster"} onClick={() => setView("roster")}>
              All bots
            </button>
          </div>
          <Filters bots={bots} filters={filters} onChange={update} />
          {view === "attention" ? (
            <AttentionView items={visible} counts={model.counts} />
          ) : (
            <RosterView items={visible} sort={filters.sort} />
          )}
        </>
      ) : null}
      <p className="footer">Done work stays quiet. A gap in time is not a stall unless the snapshot says the work stopped, or an active commitment is overdue.</p>
    </>
  );
}

function Filters({
  bots,
  filters,
  onChange,
}: {
  bots: string[];
  filters: ViewFilters;
  onChange: <K extends keyof ViewFilters>(key: K, value: ViewFilters[K]) => void;
}) {
  return (
    <div className="filters">
      <label>
        <span>Search</span>
        <input
          type="search"
          value={filters.query}
          onChange={(event) => onChange("query", event.target.value)}
          autoComplete="off"
        />
      </label>
      <label>
        <span>Bot</span>
        <select value={filters.bot} onChange={(event) => onChange("bot", event.target.value)}>
          <option value="">All</option>
          {bots.map((bot) => (
            <option key={bot} value={bot}>
              {bot}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>State</span>
        <select value={filters.state} onChange={(event) => onChange("state", event.target.value)}>
          <option value="">All</option>
          <option value="planned">Planned</option>
          <option value="idle">Idle</option>
          <option value="stale-evidence">Stale evidence</option>
          <option value="blocked">Blocked</option>
          <option value="in-progress">In progress</option>
          <option value="done">Done</option>
        </select>
      </label>
      <label>
        <span>Attention</span>
        <select value={filters.attention} onChange={(event) => onChange("attention", event.target.value)}>
          <option value="">All</option>
          <option value="needs-decision">Needs a decision</option>
          <option value="stopped">Started, then stopped</option>
          <option value="clearable-blocker">Another bot can clear</option>
          <option value="none">No attention flag</option>
        </select>
      </label>
      <label>
        <span>Confidence</span>
        <select value={filters.confidence} onChange={(event) => onChange("confidence", event.target.value)}>
          <option value="">All</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
      </label>
      <label>
        <span>Sort</span>
        <select value={filters.sort} onChange={(event) => onChange("sort", event.target.value as ViewSort)}>
          <option value="attention">Attention</option>
          <option value="oldest">Oldest activity</option>
          <option value="newest">Newest activity</option>
          <option value="owner">Bot name</option>
        </select>
      </label>
    </div>
  );
}

function AttentionView({
  items,
  counts,
}: {
  items: PresentedItem[];
  counts: ReadModel["counts"];
}) {
  return (
    <>
      <Section
        title="Needs a decision"
        note="The exact decision is on the card."
        count={counts.needsDecision}
        accent
        items={items.filter((item) => item.displayAttention === "needs-decision")}
      />
      <Section
        title="Started, then stopped"
        note="A reported stop, or an active commitment that is past due."
        count={counts.stopped}
        items={items.filter((item) => item.displayAttention === "stopped")}
      />
      <Section
        title="Another bot can clear"
        note="The blocker names the bot that can clear it."
        count={counts.clearable}
        items={items.filter((item) => item.displayAttention === "clearable-blocker")}
      />
    </>
  );
}

function Section({
  title,
  note,
  count,
  items,
  accent = false,
}: {
  title: string;
  note: string;
  count: number;
  items: PresentedItem[];
  accent?: boolean;
}) {
  return (
    <section className="section">
      <div className="section-head">
        <div>
          <h2>{title}</h2>
          <p className="note">{note}</p>
        </div>
        {accent ? <p className="accent-num">{count}</p> : <p className="count">{count}</p>}
      </div>
      {items.length !== count ? <p className="note">Showing {items.length} of {count} after filters.</p> : null}
      {items.length === 0 ? <p className="empty">Nothing in this list.</p> : (
        <div className="cards">
          {items.map((item) => (
            <Card key={item.id} item={item} />
          ))}
        </div>
      )}
    </section>
  );
}

function Card({ item }: { item: PresentedItem }) {
  return (
    <article className="card">
      <div className="card-top">
        <p className="bot">{item.ownerBot}</p>
        <p className="pill">{item.stateLabel}</p>
      </div>
      <p className="task">{item.task}</p>
      <dl className="fields">
        <Field label="Last activity" value={activityValue(item)} />
        <Field label="Next step" value={item.nextStep} />
        {item.decision ? <Field label="Decision" value={item.decision} emphasis /> : null}
        {item.blocker ? <Field label="Blocker" value={item.blocker} /> : null}
        {item.clearableBy ? <Field label="Can clear" value={item.clearableBy} /> : null}
        {item.stoppedEvidence ? <Field label="Stop evidence" value={item.stoppedEvidence} /> : null}
        {item.reasonLabel ? <Field label="Why it is here" value={item.reasonLabel} /> : null}
        {item.commitment?.evidence ? <Field label="Commitment" value={commitmentValue(item)} /> : null}
        {item.statusNote ? <Field label="Reading" value={item.statusNote} /> : null}
        <Field label="Confidence" value={item.confidence} />
        <Field label="Freshness" value={item.freshnessLabel} />
        {item.evidenceUrl ? (
          <div className="field">
            <dt>Evidence</dt>
            <dd>
              <a href={item.evidenceUrl} rel="noreferrer noopener" target="_blank">
                {item.evidenceLabel ?? item.evidenceUrl}
              </a>
            </dd>
          </div>
        ) : null}
      </dl>
    </article>
  );
}

function activityValue(item: PresentedItem): string {
  if (!item.lastActivityAt) return `No activity time reported. ${item.lastActivitySummary}`;
  const zone = item.lastActivityLabel
    ? `${item.lastActivityLabel} (${item.lastActivityTimeZone})`
    : `${item.lastActivityAt} (${item.lastActivityTimeZone})`;
  return `${zone}. ${item.lastActivitySummary}`;
}

function commitmentValue(item: PresentedItem): string {
  const due = item.dueLabel ? `Due ${item.dueLabel}. ` : "";
  return `${due}${item.commitment?.evidence ?? ""}`;
}

function Field({ label, value, emphasis = false }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div className="field">
      <dt>{label}</dt>
      <dd className={emphasis ? "decision" : undefined}>{value}</dd>
    </div>
  );
}

function RosterView({ items, sort }: { items: PresentedItem[]; sort: ViewSort }) {
  const groups = new Map<string, PresentedItem[]>();
  for (const item of items) {
    const list = groups.get(item.ownerBot) ?? [];
    list.push(item);
    groups.set(item.ownerBot, list);
  }
  const names = [...groups.keys()].sort((a, b) => {
    if (sort === "owner") return a.localeCompare(b);
    const aTop = [...(groups.get(a) ?? [])].sort(compareAttention)[0];
    const bTop = [...(groups.get(b) ?? [])].sort(compareAttention)[0];
    if (!aTop || !bTop) return a.localeCompare(b);
    const ranked = compareAttention(aTop, bTop);
    return ranked !== 0 ? ranked : a.localeCompare(b);
  });
  return (
    <section className="section">
      <h2>All bots</h2>
      <p className="note">Done, idle, and planned work stay here. Quiet does not mean stalled.</p>
      {names.length === 0 ? <p className="empty">No items match.</p> : null}
      {names.map((name) => (
        <div key={name}>
          <h3 className="group-title">{name}</h3>
          <div className="rows">
            {(groups.get(name) ?? []).map((item) => (
              <article className={item.quietBecauseComplete ? "row quiet" : "row"} key={item.id}>
                <div className="row-top">
                  <p className="task">{item.task}</p>
                  <p className="pill">{item.stateLabel}</p>
                </div>
                <p>{activityValue(item)}</p>
                <p>Next step: {item.nextStep}</p>
                {item.decision ? <p>Decision: {item.decision}</p> : null}
                {item.blocker ? <p>Blocker: {item.blocker}</p> : null}
                {item.statusNote ? <p>{item.statusNote}</p> : null}
                <p>
                  {item.attentionLabel}. Confidence {item.confidence}. {item.freshnessLabel}
                </p>
              </article>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
