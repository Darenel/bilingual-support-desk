"use client";
import { useLocale } from "@/components/preferences";

type Metrics = {
  sla: { target: string; highHours: number; normalHours: number; awaitingFirstResponse: number; overdueFirstResponse: number };
  metrics: {
    firstResponse: { count: number; averageMinutes: number | null };
    resolution: { count: number; averageMinutes: number | null };
    workload: { id: string | null; name: string; openTickets: number }[];
  };
};

export function OperationalMetrics({ data }: { data: Metrics }) {
  const { t } = useLocale();
  const duration = (minutes: number | null) => minutes == null ? t("metrics.noData") : t("metrics.minutes", { minutes: Math.round(minutes) });
  const busiest = Math.max(0, ...data.metrics.workload.map((agent) => agent.openTickets));
  return (
    <section className="operational" aria-label={t("metrics.label")}>
      <div className="stats">
        <article>
          <span>{t("metrics.firstResponse")}</span>
          <b>{duration(data.metrics.firstResponse.averageMinutes)}</b>
          <small>{t("metrics.responsesMeasured", { count: data.metrics.firstResponse.count })}</small>
        </article>
        <article>
          <span>{t("metrics.resolution")}</span>
          <b>{duration(data.metrics.resolution.averageMinutes)}</b>
          <small>{t("metrics.ticketsResolved", { count: data.metrics.resolution.count })}</small>
        </article>
        <article className={data.sla.overdueFirstResponse ? "overdue-card" : ""}>
          <span>{t("metrics.awaiting")}</span>
          <b>{data.sla.awaitingFirstResponse}</b>
          <small>{t("metrics.slaDetail", { overdue: data.sla.overdueFirstResponse, high: data.sla.highHours, normal: data.sla.normalHours })}</small>
        </article>
      </div>
      <section className="workload" aria-label={t("metrics.workload")}>
        <h2>{t("metrics.workload")}</h2>
        {data.metrics.workload.length ? data.metrics.workload.map((agent) => (
          <div className="workload-row" key={agent.id || "unassigned"}>
            <div><b>{agent.id ? agent.name : t("ticket.unassigned")}</b><span>{t("metrics.openTickets", { count: agent.openTickets })}</span></div>
            <div className="workload-bar" role="progressbar" aria-label={`${agent.id ? agent.name : t("ticket.unassigned")}: ${t("metrics.openTickets", { count: agent.openTickets })}`} aria-valuemin={0} aria-valuemax={busiest || 1} aria-valuenow={agent.openTickets}><i style={{ width: `${busiest ? (agent.openTickets / busiest) * 100 : 0}%` }} /></div>
          </div>
        )) : <p className="muted">{t("metrics.noAgents")}</p>}
      </section>
    </section>
  );
}
