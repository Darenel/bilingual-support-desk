import { TicketForm } from "@/components/forms";
import { getLocale } from "@/lib/i18n-server";
export default async function NewTicket() {
  const es = (await getLocale()) === "es";
  return (
    <>
      <header className="page-head">
        <div>
          <p className="eyebrow">{es ? "NUEVA CONVERSACIÓN" : "NEW CONVERSATION"}</p>
          <h1>{es ? "Crear ticket" : "Create ticket"}</h1>
          <p>{es ? "Registra una solicitud y deja todo listo para atenderla." : "Record a request and leave everything ready to handle it."}</p>
        </div>
      </header>
      <TicketForm />
    </>
  );
}
