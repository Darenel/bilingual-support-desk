export type Role = "admin" | "agent";
export type Status = "open" | "pending" | "closed";
export type Language = "es" | "en";
export type User = {
  id: string;
  org_id: string;
  name: string;
  first_name: string;
  last_name: string;
  username: string | null;
  email: string;
  role: Role;
  org_name: string;
};
export type Ticket = {
  id: string;
  org_id: string;
  subject: string;
  customer: string;
  email: string;
  language: Language;
  status: Status;
  priority: "normal" | "high";
  assigned_to: string | null;
  version: number;
  first_response_at: string | null;
  first_response_sla_hours: number | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
};
export type Message = {
  id: string;
  ticket_id: string;
  author: string;
  kind: "customer" | "agent";
  body: string;
  created_at: string;
};
export type Event = {
  id: number;
  action: string;
  actor: string;
  created_at: string;
};
export type Analysis = {
  category: string;
  language: string;
  summary: string;
  method: string;
};
