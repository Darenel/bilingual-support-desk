export const LOCALES = ["en", "es"] as const;
export type Locale = (typeof LOCALES)[number];
export type Theme = "dark" | "light";
export const DEFAULT_LOCALE: Locale = "en";
export const DEFAULT_THEME: Theme = "dark";

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

export function isTheme(value: unknown): value is Theme {
  return value === "dark" || value === "light";
}

const messages = {
  en: {
    "preferences.language": "Language",
    "preferences.theme": "Theme",
    "preferences.dark": "Dark",
    "preferences.light": "Light",
    "preferences.switchToLight": "Switch to light theme",
    "preferences.switchToDark": "Switch to dark theme",
    "nav.dashboard": "Overview",
    "nav.tickets": "Tickets",
    "nav.team": "Team",
    "nav.settings": "Settings",
    "nav.demo": "View demo",
    "nav.login": "Sign in",
    "nav.dashboardLink": "Go to dashboard",
    "nav.profile": "Personal account",
    "role.admin": "Administration",
    "role.agent": "Agent",
    "status.open": "Open",
    "status.pending": "Pending",
    "status.closed": "Closed",
    "priority.high": "High",
    "priority.normal": "Normal",
    "demo.title": "Reset the demo",
    "demo.description": "Restore the recruiter demo data.",
    "demo.confirm": "Reset the demo data?",
    "demo.failed": "Could not reset the demo.",
    "demo.complete": "Demo reset complete.",
    "demo.reset": "Reset demo",
    "demo.resetting": "Resetting…",
    "metrics.label": "Operational metrics",
    "metrics.firstResponse": "First response",
    "metrics.resolution": "Resolution",
    "metrics.awaiting": "Awaiting first response",
    "metrics.minutes": "{minutes} min",
    "metrics.noData": "No data yet",
    "metrics.responsesMeasured": "{count} responses measured",
    "metrics.ticketsResolved": "{count} tickets resolved",
    "metrics.slaDetail": "{overdue} overdue · {high}h high · {normal}h normal",
    "metrics.workload": "Workload",
    "metrics.openTickets": "{count} open tickets",
    "metrics.noAgents": "No agents yet.",
    "form.saving": "Saving…", "form.tryAgain": "Try again.", "form.yourName": "Your name", "form.companyName": "Company name", "form.workEmail": "Work email", "form.password": "Password", "form.email": "Email", "form.name": "Name",
    "auth.createWorkspace": "Create workspace", "auth.signIn": "Sign in", "ticket.subject": "Subject", "ticket.subjectPlaceholder": "How can we help?", "ticket.customerName": "Customer name", "ticket.language": "Language", "ticket.message": "Message", "ticket.create": "Create ticket", "reply.label": "Reply", "reply.placeholder": "Write a clear, friendly reply…", "reply.send": "Send reply", "ticket.conflict": "This ticket changed in another session.", "ticket.status": "Status", "ticket.priority": "Priority", "ticket.assignee": "Assignee", "ticket.unassigned": "Unassigned", "ticket.reload": "Reload ticket", "ticket.reloadFailed": "Could not reload the ticket.", "ticket.update": "Update", "analysis.analyze": "Analyze conversation", "team.created": "Agent created.", "team.create": "Create agent", "team.initialPassword": "Initial password", "settings.organizationName": "Organization name", "settings.authorizedOrigin": "Authorized origin", "settings.originHelp": "Origin only, for example https://store.com", "settings.save": "Save changes", "shell.signOut": "Sign out", "updates.live": "Live updates", "updates.paused": "Updates paused", "updates.reconnect": "Reconnect",
    "sla.closedUnanswered": "Ticket closed without a first reply", "sla.within": "First reply within the {hours}-hour SLA", "sla.late": "First reply outside the {hours}-hour SLA", "sla.overdue": "First reply overdue: {hours}-hour SLA", "sla.remaining": "First reply: {remaining} min left of {hours} hours", "sla.overdueShort": "SLA overdue", "sla.unanswered": "Unanswered", "sla.met": "SLA met", "sla.lateShort": "SLA late", "sla.remainingShort": "SLA {remaining} min",
    "analysis.category.general": "General inquiry", "analysis.category.billing": "Billing", "analysis.category.technical": "Technical issue", "analysis.category.account": "Account", "analysis.category.shipping": "Shipping", "analysis.language.en": "English", "analysis.language.es": "Spanish",
    "profile.eyebrow": "PROFILE", "profile.title": "Personal account", "profile.intro": "Manage your identity and sign-in details.", "profile.loading": "Loading your profile…", "profile.loadFailed": "Could not load your profile.", "profile.firstName": "First name", "profile.lastName": "Last name", "profile.username": "Username", "profile.usernameHelp": "Letters, numbers, and underscores only. Your login remains your email.", "profile.email": "Email", "profile.passwordSection": "Password", "profile.passwordHelp": "Leave these fields blank to keep your password.", "profile.currentPassword": "Current password", "profile.currentPasswordRequired": "Enter your current password to change your username, email, or password.", "profile.newPassword": "New password", "profile.confirmPassword": "Confirm new password", "profile.save": "Save profile", "profile.saveFailed": "Could not save your profile.", "profile.saved": "Profile saved.", "profile.locked": "Demo account details cannot be changed.",
  },
  es: {
    "preferences.language": "Idioma",
    "preferences.theme": "Tema",
    "preferences.dark": "Oscuro",
    "preferences.light": "Claro",
    "preferences.switchToLight": "Cambiar a tema claro",
    "preferences.switchToDark": "Cambiar a tema oscuro",
    "nav.dashboard": "Vista general",
    "nav.tickets": "Tickets",
    "nav.team": "Equipo",
    "nav.settings": "Ajustes",
    "nav.demo": "Ver demo",
    "nav.login": "Entrar",
    "nav.dashboardLink": "Ir al panel",
    "nav.profile": "Cuenta personal",
    "role.admin": "Administración",
    "role.agent": "Agente",
    "status.open": "Abierto",
    "status.pending": "En espera",
    "status.closed": "Cerrado",
    "priority.high": "Alta",
    "priority.normal": "Normal",
    "demo.title": "Restablecer la demo",
    "demo.description": "Restaura los datos de la demo para reclutadores.",
    "demo.confirm": "¿Restablecer los datos de la demo?",
    "demo.failed": "No se pudo restablecer la demo.",
    "demo.complete": "La demo se restableció.",
    "demo.reset": "Restablecer demo",
    "demo.resetting": "Restableciendo…",
    "metrics.label": "Métricas operativas",
    "metrics.firstResponse": "Primera respuesta",
    "metrics.resolution": "Resolución",
    "metrics.awaiting": "Esperando primera respuesta",
    "metrics.minutes": "{minutes} min",
    "metrics.noData": "Aún no hay datos",
    "metrics.responsesMeasured": "{count} respuestas medidas",
    "metrics.ticketsResolved": "{count} tickets resueltos",
    "metrics.slaDetail": "{overdue} vencidos · {high}h alta · {normal}h normal",
    "metrics.workload": "Carga de trabajo",
    "metrics.openTickets": "{count} tickets abiertos",
    "metrics.noAgents": "Aún no hay agentes.",
    "form.saving": "Guardando…", "form.tryAgain": "Inténtalo de nuevo.", "form.yourName": "Tu nombre", "form.companyName": "Nombre de la empresa", "form.workEmail": "Correo de trabajo", "form.password": "Contraseña", "form.email": "Correo", "form.name": "Nombre",
    "auth.createWorkspace": "Crear espacio", "auth.signIn": "Entrar", "ticket.subject": "Asunto", "ticket.subjectPlaceholder": "¿En qué podemos ayudar?", "ticket.customerName": "Nombre del cliente", "ticket.language": "Idioma", "ticket.message": "Mensaje", "ticket.create": "Crear ticket", "reply.label": "Respuesta", "reply.placeholder": "Escribe una respuesta clara y amable…", "reply.send": "Enviar respuesta", "ticket.conflict": "Este ticket cambió en otra sesión.", "ticket.status": "Estado", "ticket.priority": "Prioridad", "ticket.assignee": "Responsable", "ticket.unassigned": "Sin asignar", "ticket.reload": "Recargar ticket", "ticket.reloadFailed": "No se pudo recargar el ticket.", "ticket.update": "Actualizar", "analysis.analyze": "Analizar conversación", "team.created": "Agente creado.", "team.create": "Crear agente", "team.initialPassword": "Contraseña inicial", "settings.organizationName": "Nombre de la organización", "settings.authorizedOrigin": "Origen autorizado", "settings.originHelp": "Solo el origen, por ejemplo https://tienda.com", "settings.save": "Guardar cambios", "shell.signOut": "Salir", "updates.live": "Actualización en vivo", "updates.paused": "Actualización pausada", "updates.reconnect": "Reconectar",
    "sla.closedUnanswered": "Ticket cerrado sin primera respuesta", "sla.within": "Primera respuesta dentro del SLA de {hours} horas", "sla.late": "Primera respuesta fuera del SLA de {hours} horas", "sla.overdue": "Primera respuesta vencida: SLA de {hours} horas", "sla.remaining": "Primera respuesta: {remaining} min restantes de {hours} horas", "sla.overdueShort": "SLA vencido", "sla.unanswered": "Sin respuesta", "sla.met": "SLA atendido", "sla.lateShort": "SLA tardío", "sla.remainingShort": "SLA {remaining} min",
    "analysis.category.general": "Consulta general", "analysis.category.billing": "Facturación", "analysis.category.technical": "Problema técnico", "analysis.category.account": "Cuenta", "analysis.category.shipping": "Envío", "analysis.language.en": "Inglés", "analysis.language.es": "Español",
    "profile.eyebrow": "PERFIL", "profile.title": "Cuenta personal", "profile.intro": "Gestiona tu identidad y datos de acceso.", "profile.loading": "Cargando tu perfil…", "profile.loadFailed": "No se pudo cargar tu perfil.", "profile.firstName": "Nombre", "profile.lastName": "Apellido", "profile.username": "Nombre de usuario", "profile.usernameHelp": "Solo letras, números y guiones bajos. Tu acceso sigue siendo con correo.", "profile.email": "Correo", "profile.passwordSection": "Contraseña", "profile.passwordHelp": "Deja estos campos vacíos para conservar tu contraseña.", "profile.currentPassword": "Contraseña actual", "profile.currentPasswordRequired": "Ingresa tu contraseña actual para cambiar el usuario, correo o contraseña.", "profile.newPassword": "Nueva contraseña", "profile.confirmPassword": "Confirma la nueva contraseña", "profile.save": "Guardar perfil", "profile.saveFailed": "No se pudo guardar tu perfil.", "profile.saved": "Perfil guardado.", "profile.locked": "Los datos de la cuenta demo no se pueden cambiar.",
  },
} as const;

export type MessageKey = keyof (typeof messages)["en"];
export function getMessages(locale: Locale) {
  return messages[locale];
}

const errors: Record<string, { en: string; es: string }> = {
  unauthorized: { en: "Please sign in to continue.", es: "Inicia sesión para continuar." },
  invalid_username: { en: "Username must use 3–32 letters, numbers, or underscores.", es: "El usuario debe usar 3–32 letras, números o guiones bajos." },
  username_unavailable: { en: "Username is unavailable.", es: "El usuario no está disponible." },
  password_confirmation: { en: "Password confirmation does not match.", es: "La confirmación de contraseña no coincide." },
  invalid_current_password: { en: "Current password is incorrect.", es: "La contraseña actual no es correcta." },
  demo_profile_locked: { en: "The demo profile cannot be changed.", es: "El perfil de demostración no se puede modificar." },
  forbidden: { en: "You do not have permission to do that.", es: "No tienes permiso para hacer eso." },
  invalid_request: { en: "Check the information and try again.", es: "Revisa la información e inténtalo de nuevo." },
  not_found: { en: "We could not find that item.", es: "No pudimos encontrar ese elemento." },
  unexpected: { en: "Could not complete the request.", es: "No se pudo completar la operación." },
  rate_limited: { en: "Too many attempts. Try again later.", es: "Demasiados intentos. Inténtalo más tarde." }, invalid_field: { en: "Check {field} ({min}–{max} characters).", es: "Revisa el campo {field} ({min}–{max} caracteres)." }, invalid_email: { en: "Invalid email address.", es: "Correo no válido." }, json_required: { en: "Send JSON.", es: "Envía JSON." }, body_required: { en: "Missing data.", es: "Faltan datos." }, body_too_large: { en: "Message is too large.", es: "Mensaje demasiado grande." }, invalid_json: { en: "Invalid JSON.", es: "JSON no válido." }, origin_forbidden: { en: "Origin is not allowed.", es: "Origen no permitido." }, invalid_widget_key: { en: "Invalid widget key.", es: "Clave del widget no válida." }, invalid_widget_conversation: { en: "Invalid conversation.", es: "Conversación no válida." }, ticket_not_found: { en: "Ticket not found.", es: "Ticket no encontrado." }, conversation_not_found: { en: "Conversation not found.", es: "Conversación no encontrada." }, invalid_language: { en: "Invalid language.", es: "Idioma no válido." }, ticket_closed: { en: "Reopen the ticket before replying.", es: "Reabre el ticket antes de responder." }, admin_required: { en: "Only an administrator can do that.", es: "Solo un administrador puede realizar esta acción." }, email_unavailable: { en: "Email is unavailable.", es: "Correo no disponible." }, invalid_credentials: { en: "Incorrect email or password.", es: "Correo o contraseña incorrectos." }, invalid_action: { en: "Invalid action.", es: "Acción no válida." }, invalid_ticket_version: { en: "A valid ticket version is required.", es: "Falta una versión válida del ticket." }, invalid_ticket_metadata: { en: "Invalid status or priority.", es: "Estado o prioridad no válidos." }, invalid_agent: { en: "Invalid agent.", es: "Agente no válido." }, ticket_conflict: { en: "The ticket changed while you were editing it.", es: "El ticket cambió mientras lo editabas." }, analyzer_unavailable: { en: "The Python service is unavailable. You can keep working on the ticket.", es: "El servicio Python no está disponible. Puedes continuar atendiendo el ticket." }, too_many_connections: { en: "Too many active connections.", es: "Demasiadas conexiones activas." }, invalid_url: { en: "Invalid URL.", es: "URL no válida." }, invalid_origin_url: { en: "Enter only an origin, such as https://store.com, without a path or trailing slash.", es: "Introduce solo el origen, por ejemplo https://tienda.com, sin ruta ni barra final." }, unavailable: { en: "Unavailable.", es: "No disponible." }, demo_reset_forbidden: { en: "You cannot reset this demo.", es: "No tienes acceso al reinicio de demostración." },
};

export function translate(locale: Locale, key: string, values: Record<string, string | number> = {}) {
  const message = (messages[locale] as Record<string, string>)[key] ?? key;
  return message.replace(/\{(\w+)\}/g, (_, name) => String(values[name] ?? `{${name}}`));
}

export function error(locale: Locale, code: string, values?: Record<string, string | number>) {
  const message = errors[code]?.[locale] ?? errors.invalid_request[locale];
  return message.replace(/\{(\w+)\}/g, (_, name) => String(values?.[name] ?? `{${name}}`));
}

export function historyLabel(locale: Locale, action: string, agents: Record<string, string>) {
  const es = locale === "es";
  if (["Ticket creado", "Ticket created"].includes(action)) return es ? "Ticket creado" : "Ticket created";
  if (["Respuesta del equipo", "Team replied"].includes(action)) return es ? "Respuesta del equipo" : "Team replied";
  if (["Mensaje del cliente", "Customer message"].includes(action)) return es ? "Mensaje del cliente" : "Customer message";
  const match = action.match(/^(?:Estado|Status):\s*(open|pending|closed);\s*(?:prioridad|priority):\s*(high|normal);\s*(?:asignación|assignment):\s*(.*)$/i);
  if (!match) return es ? "Ticket actualizado" : "Ticket updated";
  const [, status, priority, assignment] = match;
  const assigned = assignment && assignment !== "sin asignar" && assignment !== "unassigned"
    ? agents[assignment] ?? (es ? "Agente no disponible" : "Unavailable agent")
    : (es ? "Sin asignar" : "Unassigned");
  const statusLabel = { open: es ? "abierto" : "open", pending: es ? "en espera" : "pending", closed: es ? "cerrado" : "closed" }[status];
  const priorityLabel = priority === "high" ? (es ? "alta" : "high") : (es ? "normal" : "normal");
  return es ? `Estado: ${statusLabel}; prioridad: ${priorityLabel}; asignación: ${assigned}` : `Status: ${statusLabel}; priority: ${priorityLabel}; assignment: ${assigned}`;
}

export function formatDate(locale: Locale, value: string, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat(locale, options).format(new Date(value));
}
