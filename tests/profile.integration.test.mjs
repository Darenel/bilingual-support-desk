import assert from "node:assert/strict";
import test from "node:test";

const base = process.env.TEST_BASE_URL;
if (process.env.TEST_MODE !== "true" || !base) throw new Error("Run through the isolated integration runner.");
const password = "correct-horse-1";
const unique = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;

async function request(path, { cookie, body, origin = base, method = "PATCH" } = {}) {
  const response = await fetch(`${base}${path}`, { method, headers: { ...(cookie ? { Cookie: cookie } : {}), ...(origin ? { Origin: origin } : {}), ...(body ? { "Content-Type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { response, json: await response.json(), cookie: response.headers.get("set-cookie")?.split(";", 1)[0] };
}
async function register(label) {
  const email = `${unique(label)}@example.test`;
  const result = await request("/api/auth", { method: "POST", body: { action: "register", name: label, company: `${label} Co`, email, password } });
  assert.equal(result.response.status, 200);
  return { email, cookie: result.cookie };
}
async function profile(cookie) {
  return request("/api/profile", { cookie, method: "GET", origin: null });
}

test("profile is self-only, guarded, validated, and revokes other sessions", { concurrency: false }, async () => {
  assert.equal((await profile()).response.status, 401);
  const a = await register("profile-a");
  const b = await register("profile-b");
  const before = await profile(a.cookie);
  assert.equal(before.response.status, 200);
  assert.equal(before.json.profile.first_name, "profile-a");
  const basePatch = { first_name: "Profile", last_name: "Owner", username: "profile_owner", email: a.email, current_password: password };
  const saved = await request("/api/profile", { cookie: a.cookie, body: { ...basePatch, user_id: "ignored" } });
  assert.equal(saved.response.status, 200);
  assert.equal(saved.json.profile.first_name, "Profile");
  assert.equal(saved.json.profile.username, "profile_owner");
  const duplicate = await request("/api/profile", { cookie: b.cookie, body: { first_name: "Other", last_name: "", username: "profile_owner", email: b.email, current_password: password } });
  assert.equal(duplicate.response.status, 409);
  const unchanged = await profile(b.cookie);
  assert.equal(unchanged.json.profile.username, null);
  const badPassword = await request("/api/profile", { cookie: a.cookie, body: { ...basePatch, email: `changed-${unique("mail")}@example.test`, current_password: "wrong-password" } });
  assert.equal(badPassword.response.status, 401);
  assert.equal((await profile(a.cookie)).json.profile.email, a.email);
  const malformed = await request("/api/profile", { cookie: a.cookie, body: { ...basePatch, first_name: "Changed", password: 42, current_password: password } });
  assert.equal(malformed.response.status, 400);
  assert.equal((await profile(a.cookie)).json.profile.first_name, "Profile");
  const mismatch = await request("/api/profile", { cookie: a.cookie, body: { ...basePatch, first_name: "Changed", password: "a-new-password", confirm_password: "different-password", current_password: password } });
  assert.equal(mismatch.response.status, 400);
  assert.equal((await profile(a.cookie)).json.profile.first_name, "Profile");
  const duplicateEmail = await request("/api/profile", { cookie: b.cookie, body: { first_name: "Other", last_name: "", username: "other_owner", email: a.email, current_password: password } });
  assert.equal(duplicateEmail.response.status, 409);
  const secondLogin = await request("/api/auth", { method: "POST", body: { action: "login", email: a.email, password } });
  const updatedEmail = `updated-${unique("profile")}@example.test`;
  const changed = await request("/api/profile", { cookie: a.cookie, body: { ...basePatch, email: updatedEmail } });
  assert.equal(changed.response.status, 200);
  assert.equal((await profile(a.cookie)).json.profile.email, updatedEmail);
  assert.equal((await profile(secondLogin.cookie)).response.status, 401);
  const newPassword = "a-new-password";
  const passwordChanged = await request("/api/profile", { cookie: a.cookie, body: { ...basePatch, email: updatedEmail, password: newPassword, confirm_password: newPassword, current_password: password } });
  assert.equal(passwordChanged.response.status, 200);
  assert.equal((await request("/api/auth", { method: "POST", body: { action: "login", email: updatedEmail, password } })).response.status, 401);
  assert.equal((await request("/api/auth", { method: "POST", body: { action: "login", email: updatedEmail, password: newPassword } })).response.status, 200);
  const csrf = await request("/api/profile", { cookie: a.cookie, origin: "https://unsafe.example.test", body: { ...basePatch, email: updatedEmail } });
  assert.equal(csrf.response.status, 403);
  const demoLogin = await request("/api/auth", { method: "POST", body: { action: "login", email: "recruiter@example.test", password: "SupportDeskDemo2026!" } });
  assert.equal(demoLogin.response.status, 200);
  assert.equal((await profile(demoLogin.cookie)).json.profile.locked, true);
  const blockedDemo = await request("/api/profile", { cookie: demoLogin.cookie, body: { first_name: "Changed", last_name: "", username: "", email: "recruiter@example.test" } });
  assert.equal(blockedDemo.response.status, 403);
  assert.equal((await profile(demoLogin.cookie)).json.profile.first_name, "Recruiter Demo Admin");
});
