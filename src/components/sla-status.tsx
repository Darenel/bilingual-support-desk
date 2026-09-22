"use client";

import { useEffect, useState } from "react";
import type { Ticket } from "@/lib/types";
import { useLocale } from "@/components/preferences";

type SlaTicket = Ticket & { first_response_due_at?: string };

export function SlaStatus({ ticket, compact = false, initialNow }: { ticket: SlaTicket; compact?: boolean; initialNow: number }) {
  const { t } = useLocale();
  const [now, setNow] = useState(initialNow);
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date().getTime()), 30000);
    return () => clearInterval(timer);
  }, []);
  const hours = ticket.first_response_sla_hours ?? (ticket.priority === "high" ? 1 : 4);
  const due = ticket.first_response_due_at ? new Date(ticket.first_response_due_at).getTime() : new Date(ticket.created_at).getTime() + hours * 3_600_000;
  const answered = ticket.first_response_at && new Date(ticket.first_response_at).getTime();
  const overdue = ticket.status !== "closed" && !answered && due < now;
  const withinTarget = answered && answered <= due;
  const remaining = Math.max(0, Math.ceil((due - now) / 60000));
  const label = ticket.status === "closed" && !answered
    ? t("sla.closedUnanswered")
    : answered
    ? t(withinTarget ? "sla.within" : "sla.late", { hours })
    : overdue
      ? t("sla.overdue", { hours })
      : t("sla.remaining", { remaining, hours });
  const compactLabel = overdue
    ? t("sla.overdueShort")
    : ticket.status === "closed" && !answered
      ? t("sla.unanswered")
      : answered
        ? withinTarget ? t("sla.met") : t("sla.lateShort")
        : t("sla.remainingShort", { remaining });
  return <span className={"sla " + (overdue ? "overdue" : "")} aria-label={label}>{compact ? compactLabel : label}</span>;
}
