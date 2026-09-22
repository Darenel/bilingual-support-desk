import assert from "node:assert/strict";
import test from "node:test";

const base = process.env.TEST_BASE_URL;
if (process.env.TEST_MODE !== "true" || !base)
  throw new Error("Run through the isolated integration runner.");

async function page(path, cookie) {
  const response = await fetch(`${base}${path}`, { headers: cookie ? { Cookie: cookie } : {} });
  return { response, body: await response.text() };
}

test("preferences use English and dark mode by default", async () => {
  for (const path of ["/", "/login"]) {
    const result = await page(path);
    assert.equal(result.response.status, 200);
    assert.match(result.body, /<html lang="en" data-lang="en" data-theme="dark"/);
  }
});

test("preferences use validated cookie values in SSR", async () => {
  const result = await page("/login", "locale=es; theme=light");
  assert.match(result.body, /<html lang="es" data-lang="es" data-theme="light"/);
  assert.match(result.body, /Entra a tu espacio/);
});

test("invalid preference cookies fall back to defaults", async () => {
  const result = await page("/login", "locale=fr; theme=neon");
  assert.match(result.body, /<html lang="en" data-lang="en" data-theme="dark"/);
});

test("API failures follow the locale cookie", async () => {
  for (const [cookie, message] of [["locale=en", "Please sign in to continue."], ["locale=es", "Inicia sesión para continuar."]]) {
    const response = await fetch(`${base}/api/tickets`, { headers: { Cookie: cookie } });
    assert.equal(response.status, 401);
    assert.equal((await response.json()).error, message);
  }
});

test("Dark Reader lock is static and hydration suppression is limited to html", async () => {
  const { body } = await page("/login");
  assert.match(body, /<meta name="darkreader-lock" content="true"\/>/);
  // React serializes the html prop in the RSC payload, but does not emit it as DOM markup.
  assert.equal((body.match(/suppressHydrationWarning/g) ?? []).length, 1);
  assert.doesNotMatch(body, /<body[^>]*suppressHydrationWarning/);
});
