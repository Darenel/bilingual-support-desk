import { currentUser, requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { TeamForm } from "@/components/forms";
import { getLocale } from "@/lib/i18n-server";
export default async function Team() {
  const user = await currentUser();
  if (!user) return null;
  requireAdmin(user);
  const es = (await getLocale()) === "es";
  const people = db()
    .prepare(
      "SELECT id,name,email,role FROM users WHERE org_id=? ORDER BY role DESC,name",
    )
    .all(user.org_id) as {
    id: string;
    name: string;
    email: string;
    role: string;
  }[];
  return (
    <>
      <header className="page-head">
        <div>
          <p className="eyebrow">{es ? "PERSONAS" : "PEOPLE"}</p>
          <h1>{es ? "Equipo" : "Team"}</h1>
          <p>{es ? `Quienes pueden atender las conversaciones de ${user.org_name}.` : `The people who can handle ${user.org_name} conversations.`}</p>
        </div>
      </header>
      <div className="split">
        <TeamForm />
        <section className="card">
          <h2>{es ? "Miembros" : "Members"}</h2>
          <div className="people">
            {people.map((person) => (
              <div key={person.id}>
                <span className="avatar">
                  {person.name.slice(0, 1).toUpperCase()}
                </span>
                <p>
                  <b>{person.name}</b>
                  <small>{person.email}</small>
                </p>
                <span className="role">
                  {person.role === "admin" ? "Admin" : (es ? "Agente" : "Agent")}
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
