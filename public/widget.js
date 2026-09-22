(() => {
  const script = document.currentScript;
  const key = script?.dataset.key;
  if (!key || !script?.isConnected) return;
  const api =
    script.dataset.api ||
    `${new URL(script.src, location.href).origin}/api/widget`;
  const storageKey = `support-widget:${key}`;
  const copy = {
    en: {
      title: "Support", minimize: "Minimize", expand: "Expand", customer: "Your name", email: "Email", subject: "Subject", language: "Language", message: "Message", send: "Send", sendMessage: "Send message", refresh: "Refresh", newConversation: "New conversation", closed: "This conversation is closed.", failed: "The message could not be sent.",
    },
    es: {
      title: "Soporte", minimize: "Minimizar", expand: "Expandir", customer: "Tu nombre", email: "Correo", subject: "Asunto", language: "Idioma", message: "Mensaje", send: "Enviar", sendMessage: "Enviar mensaje", refresh: "Actualizar", newConversation: "Nueva conversación", closed: "Esta conversación está cerrada.", failed: "No se pudo enviar el mensaje.",
    },
  };
  let locale = "en";
  let conversationToken;
  let streamController;
  let streamRetry;
  let streamAttempts = 0;
  let destroyed = false;
  try {
    conversationToken = sessionStorage.getItem(storageKey);
  } catch {
    /* session storage is optional */
  }

  const root = document.createElement("section");
  root.setAttribute("aria-label", copy.en.title);
  root.style.cssText =
    "position:fixed;right:16px;bottom:16px;width:min(360px,calc(100vw - 32px));max-height:calc(100dvh - 32px);z-index:2147483647;background:var(--surface);color:var(--ink);border:1px solid var(--line);border-radius:12px;box-shadow:0 12px 32px #0008;font:14px system-ui,sans-serif;overflow:auto";
  const shadow = root.attachShadow({ mode: "open" });
  shadow.innerHTML = `<style>:host{color-scheme:dark;--surface:#11161d;--ink:#e5e7eb;--line:#283340;--accent:#63d5b4;--accent-ink:#11161d;--muted:#c6d0d9;--error:#ffb4ab}:host([data-theme="light"]){color-scheme:light;--surface:#fff;--ink:#17221b;--line:#bfd0c4;--accent:#167657;--accent-ink:#fff;--muted:#52645a;--error:#a13e31}[hidden]{display:none!important}form{padding:12px;display:grid;gap:8px}input,select,textarea,button{box-sizing:border-box;width:100%;font:inherit;padding:8px;color:var(--ink);background:var(--surface);border:1px solid var(--line);border-radius:6px}button{width:auto;cursor:pointer;background:var(--accent);color:var(--accent-ink);border-color:var(--accent);font-weight:700}button[type="button"]{background:transparent;color:var(--ink);border-color:var(--line)}button:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible{outline:3px solid var(--accent);outline-offset:2px}label{display:grid;gap:4px;color:var(--ink)}header{display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid var(--line);font-weight:700}header button{width:auto;padding:5px 8px}p{color:var(--muted)}</style>
    <header><span data-title></span><button type="button" data-toggle aria-expanded="true" aria-controls="support-widget-content"></button></header><div id="support-widget-content" data-content><div data-status style="padding:8px 12px"></div><div data-log style="max-height:220px;overflow:auto;padding:0 12px;line-height:1.4"></div>
    <form data-create><label data-customer><span></span><input name="customer" maxlength="100" required></label><label data-email><span></span><input name="email" maxlength="254" type="email" required></label><label data-subject><span></span><input name="subject" maxlength="150" required></label><label data-language><span></span><select name="language"><option value="en">English</option><option value="es">Español</option></select></label><label data-message><span></span><textarea name="body" maxlength="4000" required></textarea></label><button type="submit" data-send></button></form>
    <form data-reply hidden><label data-message><span></span><textarea name="body" maxlength="4000" required></textarea></label><button type="submit" data-send-message></button><button type="button" data-refresh></button></form><div style="padding:0 12px 12px"><button type="button" data-new></button></div><p data-error role="alert" style="color:var(--error);padding:0 12px"></p></div>`;
  document.body.append(root);
  const log = shadow.querySelector("[data-log]");
  const status = shadow.querySelector("[data-status]");
  const create = shadow.querySelector("[data-create]");
  const reply = shadow.querySelector("[data-reply]");
  const error = shadow.querySelector("[data-error]");
  const content = shadow.querySelector("[data-content]");
  const toggle = shadow.querySelector("[data-toggle]");
  const applyPreferences = (preferences = {}) => {
    const requestedLocale = preferences.locale || preferences.language || preferences.lang || script.dataset.lang || script.dataset.locale || document.documentElement.dataset.lang || document.documentElement.lang;
    locale = String(requestedLocale).toLowerCase().startsWith("es") ? "es" : "en";
    const requestedTheme = preferences.theme || script.dataset.theme || document.documentElement.dataset.theme;
    root.dataset.theme = requestedTheme === "light" ? "light" : "dark";
    root.lang = locale;
    root.setAttribute("aria-label", copy[locale].title);
    const words = copy[locale];
    shadow.querySelector("[data-title]").textContent = words.title;
    shadow.querySelector("[data-customer] span").textContent = words.customer;
    shadow.querySelector("[data-email] span").textContent = words.email;
    shadow.querySelector("[data-subject] span").textContent = words.subject;
    shadow.querySelector("[data-language] span").textContent = words.language;
    shadow.querySelectorAll("[data-message] span").forEach((label) => { label.textContent = words.message; });
    shadow.querySelector("[data-send]").textContent = words.send;
    shadow.querySelector("[data-send-message]").textContent = words.sendMessage;
    shadow.querySelector("[data-refresh]").textContent = words.refresh;
    shadow.querySelector("[data-new]").textContent = words.newConversation;
    toggle.textContent = content.hidden ? words.expand : words.minimize;
    if (status.dataset.closed === "true") status.textContent = words.closed;
  };
  const setToken = (value) => {
    conversationToken = value;
    if (streamRetry) clearTimeout(streamRetry);
    streamRetry = undefined;
    streamController?.abort();
    streamController = undefined;
    try {
      if (value) sessionStorage.setItem(storageKey, value);
      else sessionStorage.removeItem(storageKey);
    } catch {
      /* memory-only session */
    }
  };
  const request = async (method, data) => {
    const response = await fetch(api, {
      method,
      credentials: "omit",
      headers: {
        "Content-Type": "application/json",
        "X-Widget-Key": key,
        "X-Support-Language": locale,
        ...(conversationToken
          ? { "X-Conversation-Token": conversationToken }
          : {}),
      },
      ...(data ? { body: JSON.stringify(data) } : {}),
    });
    const result = await response.json();
    if (!response.ok)
      throw new Error(result.error || copy[locale].failed);
    return result;
  };
  const submit = async (form, work) => {
    const button = form.querySelector('[type="submit"]');
    button.disabled = true;
    try {
      await work();
    } finally {
      button.disabled = false;
    }
  };
  const show = (result) => {
    log.replaceChildren(
      ...result.messages.map((message) => {
        const line = document.createElement("p");
        line.textContent = `${message.author}: ${message.body}`;
        return line;
      }),
    );
    status.dataset.closed = String(result.ticket.status === "closed");
    status.textContent = result.ticket.status === "closed" ? copy[locale].closed : "";
    create.hidden = true;
    reply.hidden = result.ticket.status === "closed";
    log.scrollTop = log.scrollHeight;
    error.textContent = "";
  };
  const refresh = async (quiet = false) => {
    if (!conversationToken) return;
    try {
      show(await request("GET"));
    } catch (cause) {
      if (!quiet) error.textContent = cause.message;
    }
  };
  const stream = async () => {
    if (!conversationToken || streamController || destroyed || content.hidden || document.hidden) return;
    const controller = new AbortController();
    streamController = controller;
    try {
      const response = await fetch(`${api}/events`, {
        credentials: "omit",
        headers: {
          "X-Widget-Key": key,
          "X-Support-Language": locale,
          Authorization: `Bearer ${conversationToken}`,
        },
        signal: controller.signal,
      });
      if (!response.ok || !response.body) throw new Error("live updates unavailable");
      streamAttempts = 0;
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() || "";
        if (parts.some((part) => part.includes("event: change"))) refresh(true);
      }
    } catch (cause) {
      if (cause.name !== "AbortError") streamAttempts += 1;
    } finally {
      if (streamController !== controller) return;
      streamController = undefined;
      if (!destroyed && conversationToken && !content.hidden && !document.hidden && streamAttempts < 5)
        streamRetry = setTimeout(stream, Math.min(1000 * 2 ** streamAttempts, 15000));
    }
  };
  create.addEventListener("submit", (event) =>
    submit(create, async () => {
      event.preventDefault();
      const result = await request("POST", {
        action: "create",
        ...Object.fromEntries(new FormData(create)),
      });
      setToken(result.conversationToken);
      show(result);
      stream();
    }).catch((cause) => {
      error.textContent = cause.message;
    }),
  );
  reply.addEventListener("submit", (event) =>
    submit(reply, async () => {
      event.preventDefault();
      show(
        await request("POST", {
          action: "message",
          body: new FormData(reply).get("body"),
        }),
      );
      reply.reset();
    }).catch((cause) => {
      error.textContent = cause.message;
    }),
  );
  shadow
    .querySelector("[data-refresh]")
    .addEventListener("click", () => refresh());
  shadow.querySelector("[data-new]").addEventListener("click", () => {
    setToken(null);
    reply.hidden = true;
    create.hidden = false;
    create.reset();
    log.replaceChildren();
    status.dataset.closed = "false";
    status.textContent = "";
    error.textContent = "";
  });
  toggle.addEventListener("click", () => {
    content.hidden = !content.hidden;
    toggle.setAttribute("aria-expanded", String(!content.hidden));
    toggle.textContent = content.hidden ? copy[locale].expand : copy[locale].minimize;
    if (content.hidden) streamController?.abort();
    else stream();
  });
  const visibility = () => {
    if (document.hidden) streamController?.abort();
    else stream();
  };
  document.addEventListener("visibilitychange", visibility);
  const preferenceChange = (event) => applyPreferences(event.detail || {});
  document.addEventListener("support-widget-preferences", preferenceChange);
  window.addEventListener("support-widget-preferences", preferenceChange);
  const preferenceObserver = new MutationObserver(() => applyPreferences());
  preferenceObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "data-lang", "lang"] });
  preferenceObserver.observe(script, { attributes: true, attributeFilter: ["data-theme", "data-lang", "data-locale"] });
  applyPreferences();
  refresh();
  stream();
  script.addEventListener(
    "support-widget-destroy",
    () => {
      destroyed = true;
      streamController?.abort();
      if (streamRetry) clearTimeout(streamRetry);
      document.removeEventListener("visibilitychange", visibility);
      document.removeEventListener("support-widget-preferences", preferenceChange);
      window.removeEventListener("support-widget-preferences", preferenceChange);
      preferenceObserver.disconnect();
      root.remove();
    },
    { once: true },
  );
})();
