import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { describe, it } from "node:test";
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";

import {
  CLERK_PROTECTED_PATHS,
  CLERK_PUBLIC_RUNTIME_PATHS,
} from "../lib/auth/clerk-config";

const ENDPOINT = "https://sufeiya.cn/api/super-teacher";

type ClerkTestGlobals = typeof globalThis & {
  __sufeiyaClerkBetaAccessMode?: "approved" | "denied" | "unavailable";
  __sufeiyaClerkGetUserCount?: number;
  __sufeiyaClerkMiddlewareCount?: number;
  __sufeiyaClerkProtectCount?: number;
  __sufeiyaClerkRouteTestUserId?: string | null;
};

const clerkTestGlobals = globalThis as ClerkTestGlobals;

// Route and proxy modules are loaded only after this hook is registered. The
// mock keeps the test offline while exercising the production wiring around
// Clerk's auth(), auth.protect(), route matcher, and middleware callback.
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "@clerk/nextjs/server") {
      return { url: "mock:sufeiya-clerk-nextjs-server", shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url === "mock:sufeiya-clerk-nextjs-server") {
      return {
        format: "module",
        shortCircuit: true,
        source: `
          const betaSessionClaims = () => {
            if (!globalThis.__sufeiyaClerkRouteTestUserId) return null;
            if (globalThis.__sufeiyaClerkBetaAccessMode === "approved") {
              return {
                sufeiyaBetaAccess: {
                  protocolVersion: "sufeiya_invite_only_beta_v1",
                  status: "approved",
                },
              };
            }
            if (globalThis.__sufeiyaClerkBetaAccessMode === "denied") {
              return { sufeiyaBetaAccess: null };
            }
            return {};
          };
          export const auth = async () => ({
            userId: globalThis.__sufeiyaClerkRouteTestUserId ?? null,
            sessionClaims: betaSessionClaims(),
          });
          export const clerkClient = async () => {
            globalThis.__sufeiyaClerkGetUserCount =
              (globalThis.__sufeiyaClerkGetUserCount ?? 0) + 1;
            throw new Error("request-path Clerk Backend API use is forbidden");
          };
          export const createRouteMatcher = (matcher) => matcher;
          export const clerkMiddleware = (handler) => async (request, event) => {
            globalThis.__sufeiyaClerkMiddlewareCount =
              (globalThis.__sufeiyaClerkMiddlewareCount ?? 0) + 1;
            const authHandler = async () => ({
              userId: globalThis.__sufeiyaClerkRouteTestUserId ?? null,
              sessionClaims: betaSessionClaims(),
            });
            authHandler.protect = async () => {
              globalThis.__sufeiyaClerkProtectCount =
                (globalThis.__sufeiyaClerkProtectCount ?? 0) + 1;
              return {
                userId: globalThis.__sufeiyaClerkRouteTestUserId ?? null,
                sessionClaims: betaSessionClaims(),
              };
            };
            return handler(authHandler, request, event);
          };
        `,
      };
    }
    return nextLoad(url, context);
  },
});

async function post(request: Request) {
  const { POST } = await import("../app/api/super-teacher/route");
  return POST(request);
}

function importProxyForTest(variant: "configured" | "unconfigured") {
  const modulePath = `../proxy.ts?clerk-test=${variant}`;
  return import(modulePath);
}

function postRequest({
  body,
  contentType,
  origin,
}: {
  body?: string;
  contentType?: string;
  origin?: string;
}) {
  const headers = new Headers();
  if (origin !== undefined) headers.set("origin", origin);
  if (contentType !== undefined) headers.set("content-type", contentType);
  return new Request(ENDPOINT, {
    method: "POST",
    headers,
    body: body ?? (contentType === undefined ? undefined : "{}"),
  });
}

async function assertJsonError(response: Response, status: number, error: string) {
  assert.equal(response.status, status);
  assert.equal(response.headers.get("cache-control"), "private, no-store, max-age=0");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.headers.get("x-sufeiya-account-mode"), "mainland-migration-hold");

  const body = await response.json() as { error?: string; requestId?: string };
  assert.equal(body.error, error);
  assert.match(
    body.requestId ?? "",
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  );
}

async function withClerkEnvironment<T>({
  betaAccess = "approved",
  configured,
  userId = null,
}: {
  betaAccess?: "approved" | "denied" | "unavailable";
  configured: boolean;
  userId?: string | null;
}, callback: () => Promise<T>) {
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  const secretKey = process.env.CLERK_SECRET_KEY;
  const vercelEnvironment = process.env.VERCEL_ENV;
  const previousUserId = clerkTestGlobals.__sufeiyaClerkRouteTestUserId;
  const previousBetaAccessMode = clerkTestGlobals.__sufeiyaClerkBetaAccessMode;

  if (configured) {
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY =
      `pk_test_${Buffer.from("test.clerk.accounts.dev$").toString("base64url")}`;
    process.env.CLERK_SECRET_KEY = "sk_test_abcdefghijklmnop";
  } else {
    delete process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
    delete process.env.CLERK_SECRET_KEY;
  }
  delete process.env.VERCEL_ENV;
  clerkTestGlobals.__sufeiyaClerkRouteTestUserId = userId;
  clerkTestGlobals.__sufeiyaClerkBetaAccessMode = betaAccess;

  try {
    return await callback();
  } finally {
    if (publishableKey === undefined) delete process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
    else process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = publishableKey;
    if (secretKey === undefined) delete process.env.CLERK_SECRET_KEY;
    else process.env.CLERK_SECRET_KEY = secretKey;
    if (vercelEnvironment === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = vercelEnvironment;
    clerkTestGlobals.__sufeiyaClerkRouteTestUserId = previousUserId;
    clerkTestGlobals.__sufeiyaClerkBetaAccessMode = previousBetaAccessMode;
  }
}

describe("Clerk proxy integration", () => {
  it("holds account processing before Clerk regardless of configuration", async () => {
    await withClerkEnvironment({ configured: false }, async () => {
      const [{ default: proxy }, { NextRequest }] = await Promise.all([
        importProxyForTest("unconfigured"),
        import("next/server"),
      ]);

      const protectedResponse = await proxy(
        new NextRequest("https://sufeiya.cn/workspace"),
        {} as never,
      );
      assert.equal(protectedResponse.status, 503);
      assert.equal(protectedResponse.headers.get("cache-control"), "private, no-store, max-age=0");
      assert.equal(protectedResponse.headers.get("x-sufeiya-account-mode"), "mainland-migration-hold");
      assert.match(await protectedResponse.text(), /账户与邀请服务迁移中/);

      const publicResponse = await proxy(
        new NextRequest("https://sufeiya.cn/super-teacher"),
        {} as never,
      );
      assert.equal(publicResponse.status, 200);

      const apiResponse = await proxy(
        new NextRequest(ENDPOINT),
        {} as never,
      );
      assert.equal(apiResponse.status, 503);
      assert.equal(apiResponse.headers.get("x-sufeiya-account-mode"), "mainland-migration-hold");
    });
  });

  it("matches every account path but invokes neither Clerk middleware nor auth.protect", async () => {
    await withClerkEnvironment({ configured: true }, async () => {
      clerkTestGlobals.__sufeiyaClerkMiddlewareCount = 0;
      clerkTestGlobals.__sufeiyaClerkProtectCount = 0;
      const [{ config, default: proxy }, { NextRequest }] = await Promise.all([
        importProxyForTest("configured"),
        import("next/server"),
      ]);

      for (const path of [
        ...CLERK_PROTECTED_PATHS,
        "/sign-in/factor.js",
        "/sign-up/verify.csv",
      ]) {
        assert.equal(unstable_doesMiddlewareMatch({
          config,
          url: `https://sufeiya.cn${path}`,
        }), true, path);
      }
      assert.equal(unstable_doesMiddlewareMatch({
        config,
        url: "https://sufeiya.cn/__clerk/npm/@clerk/clerk-js.js",
      }), true);
      assert.equal(unstable_doesMiddlewareMatch({
        config,
        url: "https://sufeiya.cn/missing-asset.js",
      }), false);

      for (const path of CLERK_PROTECTED_PATHS) {
        const response = await proxy(
          new NextRequest(`https://sufeiya.cn${path}`),
          {} as never,
        );
        assert.equal(response.status, 503, path);
        assert.equal(response.headers.get("x-sufeiya-account-mode"), "mainland-migration-hold", path);
      }
      assert.equal(clerkTestGlobals.__sufeiyaClerkProtectCount, 0);

      for (const path of [
        ...CLERK_PUBLIC_RUNTIME_PATHS,
        "/sign-in/factor-one",
        "/sign-up/verify-email-address",
      ]) {
        const response = await proxy(
          new NextRequest(`https://sufeiya.cn${path}`),
          {} as never,
        );
        assert.equal(response.status, 503, path);
        assert.equal(response.headers.get("x-sufeiya-account-mode"), "mainland-migration-hold", path);
      }

      const invitationTicketResponse = await proxy(
        new NextRequest("https://sufeiya.cn/sign-up?__clerk_ticket=must-not-be-reflected"),
        {} as never,
      );
      assert.equal(invitationTicketResponse.status, 503);
      assert.doesNotMatch(await invitationTicketResponse.text(), /must-not-be-reflected|__clerk_ticket/);

      const beforeApiRequest = clerkTestGlobals.__sufeiyaClerkProtectCount;
      const apiResponse = await proxy(
        new NextRequest(ENDPOINT),
        {} as never,
      );
      assert.equal(apiResponse.status, 503);
      assert.equal(apiResponse.headers.get("x-sufeiya-account-mode"), "mainland-migration-hold");
      assert.equal(clerkTestGlobals.__sufeiyaClerkProtectCount, beforeApiRequest);

      const clerkProxyResponse = await proxy(
        new NextRequest("https://sufeiya.cn/__clerk/handshake"),
        {} as never,
      );
      assert.equal(clerkProxyResponse.status, 503);
      assert.equal(clerkProxyResponse.headers.get("x-sufeiya-account-mode"), "mainland-migration-hold");
      const middlewareCountBeforeAnonymous = clerkTestGlobals.__sufeiyaClerkMiddlewareCount;

      for (const pathname of [
        "/definitely-missing-route",
        "/definitely/missing-route",
      ]) {
        const anonymousResponse = await proxy(
          new NextRequest(`https://sufeiya.cn${pathname}`),
          {} as never,
        );
        assert.equal(anonymousResponse.status, 200, pathname);
        assert.equal(
          anonymousResponse.headers.get("x-sufeiya-account-mode"),
          "anonymous-no-clerk",
          pathname,
        );
        const contentSecurityPolicy = anonymousResponse.headers.get("content-security-policy");
        assert.match(contentSecurityPolicy ?? "", /script-src 'self' 'unsafe-inline'/);
        assert.doesNotMatch(contentSecurityPolicy ?? "", /nonce-|strict-dynamic|clerk/i);
      }
      assert.equal(clerkTestGlobals.__sufeiyaClerkProtectCount, beforeApiRequest);
      assert.equal(
        clerkTestGlobals.__sufeiyaClerkMiddlewareCount,
        middlewareCountBeforeAnonymous,
      );
      assert.equal(clerkTestGlobals.__sufeiyaClerkMiddlewareCount, 0);
    });
  });

  it("ignores spoofed or previously approved beta state while migration hold is active", async () => {
    const [{ default: proxy }, { NextRequest }] = await Promise.all([
      importProxyForTest("configured"),
      import("next/server"),
    ]);

    await withClerkEnvironment({
      configured: true,
      userId: "user_test",
      betaAccess: "denied",
    }, async () => {
      clerkTestGlobals.__sufeiyaClerkGetUserCount = 0;
      const denied = await proxy(
        new NextRequest("https://sufeiya.cn/workspace/private.js", {
          headers: { "x-sufeiya-beta-access-context": "approved" },
        }),
        {} as never,
      );
      assert.equal(denied.status, 503);
      assert.equal(denied.headers.get("location"), null);
      assert.equal(denied.headers.get("x-sufeiya-beta-access"), null);
      assert.equal(denied.headers.get("x-sufeiya-account-mode"), "mainland-migration-hold");
      assert.equal(clerkTestGlobals.__sufeiyaClerkGetUserCount, 0);

      const account = await proxy(
        new NextRequest("https://sufeiya.cn/account"),
        {} as never,
      );
      assert.equal(account.status, 503);
      assert.equal(account.headers.get("x-sufeiya-beta-access"), null);
      assert.equal(account.headers.get("x-sufeiya-account-mode"), "mainland-migration-hold");
      assert.equal(clerkTestGlobals.__sufeiyaClerkGetUserCount, 0);
    });

    await withClerkEnvironment({
      configured: true,
      userId: "user_test",
      betaAccess: "approved",
    }, async () => {
      const approved = await proxy(
        new NextRequest("https://sufeiya.cn/workspace"),
        {} as never,
      );
      assert.equal(approved.status, 503);
      assert.equal(approved.headers.get("x-sufeiya-beta-access"), null);
      assert.equal(approved.headers.get("x-middleware-request-x-sufeiya-beta-access-context"), null);
      assert.equal(approved.headers.get("x-sufeiya-account-mode"), "mainland-migration-hold");
      assert.equal(clerkTestGlobals.__sufeiyaClerkGetUserCount, 0);
    });
  });

  it("keeps public pages outside the Clerk graph for signed-out and signed-in browsers", async () => {
    const [{ default: proxy }, { NextRequest }] = await Promise.all([
      importProxyForTest("configured"),
      import("next/server"),
    ]);
    const publicPaths = [
      "/",
      "/learning-path",
      "/platform",
      "/resources",
      "/about",
      "/super-teacher",
      "/privacy",
      "/terms",
      "/support",
      "/my-data",
      "/learn/reading",
    ];

    await withClerkEnvironment({ configured: true, userId: null }, async () => {
      for (const path of publicPaths) {
        const response = await proxy(new NextRequest(`https://sufeiya.cn${path}`), {} as never);
        assert.equal(response.headers.get("x-sufeiya-beta-access"), null, path);
        assert.equal(response.headers.get("x-sufeiya-account-mode"), "anonymous-no-clerk", path);
        assert.equal(response.headers.get("x-robots-tag"), null, path);
        assert.equal(response.headers.get("cache-control"), null, path);
      }
    });

    for (const betaAccess of ["approved", "denied"] as const) {
      await withClerkEnvironment({ configured: true, userId: "user_test", betaAccess }, async () => {
        clerkTestGlobals.__sufeiyaClerkGetUserCount = 0;
        for (const path of publicPaths) {
          const response = await proxy(new NextRequest(`https://sufeiya.cn${path}`, {
            headers: { "x-sufeiya-beta-access-context": betaAccess === "denied" ? "approved" : "invitation_required" },
          }), {} as never);
          assert.equal(response.headers.get("x-sufeiya-beta-access"), null, path);
          assert.equal(response.headers.get("x-sufeiya-account-mode"), "anonymous-no-clerk", path);
          assert.equal(response.headers.get("x-robots-tag"), null, path);
          assert.equal(response.headers.get("cache-control"), null, path);
        }
        assert.equal(clerkTestGlobals.__sufeiyaClerkGetUserCount, 0);
      });
    }

    await withClerkEnvironment({ configured: true, userId: null }, async () => {
      const signIn = await proxy(new NextRequest("https://sufeiya.cn/sign-in"), {} as never);
      assert.equal(signIn.status, 503);
      assert.equal(signIn.headers.get("x-robots-tag"), "noindex, nofollow");
      assert.equal(signIn.headers.get("cache-control"), "private, no-store, max-age=0");
      assert.equal(signIn.headers.get("x-sufeiya-account-mode"), "mainland-migration-hold");
    });
  });

  it("returns the same no-store migration hold without consulting beta qualification", async () => {
    await withClerkEnvironment({
      configured: true,
      userId: "user_test",
      betaAccess: "unavailable",
    }, async () => {
      const [{ default: proxy }, { NextRequest }] = await Promise.all([
        importProxyForTest("configured"),
        import("next/server"),
      ]);
      const response = await proxy(
        new NextRequest("https://sufeiya.cn/workspace"),
        {} as never,
      );
      assert.equal(response.status, 503);
      assert.equal(response.headers.get("cache-control"), "private, no-store, max-age=0");
      assert.equal(response.headers.get("retry-after"), null);
      assert.equal(response.headers.get("x-sufeiya-beta-access"), null);
      assert.equal(response.headers.get("x-sufeiya-account-mode"), "mainland-migration-hold");
      assert.match(response.headers.get("content-type") ?? "", /text\/html/);
      assert.match(await response.text(), /账户与邀请服务迁移中/);
      assert.equal(clerkTestGlobals.__sufeiyaClerkGetUserCount ?? 0, 0);
      assert.equal(clerkTestGlobals.__sufeiyaClerkMiddlewareCount ?? 0, 0);
    });
  });
});

describe("Sofia API browser request boundary", () => {
  it("rejects missing, cross-site, and scheme-downgraded origins before authentication", async () => {
    for (const origin of [undefined, "https://evil.example", "http://sufeiya.cn"]) {
      const response = await post(postRequest({
        origin,
        contentType: "application/json",
      }));
      await assertJsonError(response, 403, "origin_not_allowed");
    }
  });

  it("rejects missing or non-JSON content types before authentication", async () => {
    for (const contentType of [undefined, "text/plain", "application/ld+json"]) {
      const response = await post(postRequest({
        origin: "https://sufeiya.cn",
        contentType,
      }));
      await assertJsonError(response, 415, "unsupported_media_type");
    }
  });

  it("returns the migration hold after the same-origin JSON request gate", async () => {
    await withClerkEnvironment({ configured: false }, async () => {
      const response = await post(postRequest({
        origin: "https://sufeiya.cn",
        contentType: "application/json; charset=utf-8",
      }));
      await assertJsonError(response, 503, "account_service_migration_hold");
    });
  });

  it("holds before a configured signed-out request can authenticate", async () => {
    await withClerkEnvironment({ configured: true, userId: null }, async () => {
      const response = await post(postRequest({
        origin: "https://sufeiya.cn",
        contentType: "application/json",
      }));
      await assertJsonError(response, 503, "account_service_migration_hold");
    });
  });

  it("holds before student-data release evaluation or request-body reading", async () => {
    await withClerkEnvironment({ configured: true, userId: "user_test" }, async () => {
      const request = postRequest({
        origin: "https://sufeiya.cn",
        contentType: "application/json",
        body: "not-json",
      });
      const response = await post(request);
      await assertJsonError(response, 503, "account_service_migration_hold");
      assert.equal(request.bodyUsed, false);
    });
  });

  it("holds before invitation state or request-body reading", async () => {
    await withClerkEnvironment({
      configured: true,
      userId: "user_test",
      betaAccess: "denied",
    }, async () => {
      const request = postRequest({
        origin: "https://sufeiya.cn",
        contentType: "application/json",
        body: "not-json",
      });
      const response = await post(request);
      await assertJsonError(response, 503, "account_service_migration_hold");
      assert.equal(response.headers.get("x-sufeiya-beta-access"), null);
      assert.equal(request.bodyUsed, false);
      assert.equal(clerkTestGlobals.__sufeiyaClerkGetUserCount ?? 0, 0);
    });
  });

  it("returns the same hold without consulting unavailable beta qualification", async () => {
    await withClerkEnvironment({
      configured: true,
      userId: "user_test",
      betaAccess: "unavailable",
    }, async () => {
      const request = postRequest({
        origin: "https://sufeiya.cn",
        contentType: "application/json",
        body: "not-json",
      });
      const response = await post(request);
      await assertJsonError(response, 503, "account_service_migration_hold");
      assert.equal(response.headers.get("retry-after"), null);
      assert.equal(request.bodyUsed, false);
      assert.equal(clerkTestGlobals.__sufeiyaClerkGetUserCount ?? 0, 0);
    });
  });
});
