import { db } from "./db";
import { resetRecruiterFixture as reset } from "./recruiter-fixture.mjs";
import type { User } from "./types";

export const isRecruiterDemoAdmin = (user: User) =>
  user.id === "recruiter-admin" && user.org_id === "recruiter-demo" && user.role === "admin";

export function resetRecruiterFixture() { reset(db()); }
