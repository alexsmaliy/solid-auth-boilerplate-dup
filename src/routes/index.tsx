import { D1Database } from "@cloudflare/workers-types";
import { FormError, parseCookie, useRouteData } from "solid-start";
import { createServerAction$, createServerData$, redirect, ServerFunctionEvent } from "solid-start/server";
import { COOKIE_NAME, serializeCookie } from "~/auth/cookies";
import { deleteSession, getUserBySessionId, User } from "~/d1/operations";

async function indexRouteData(_unused: unknown, {env, request}: ServerFunctionEvent) {
  const d1: D1Database = (env as any).TESTDB;

  const cookieString = request.headers.get("Cookie") || "";
  const parsedCookies = parseCookie(cookieString);
  const sessionCookie = parsedCookies[COOKIE_NAME] || "";

  let user: User | null = null;
  if (sessionCookie !== "") {
    const dbResponse = await getUserBySessionId(d1, sessionCookie);
    if (dbResponse instanceof Error) throw new FormError(dbResponse.message);
    user = dbResponse;
  }

  const invalid = user === null;
  if (invalid)
    throw redirect("/login");
  else
    return {user, sessionCookie};
}

async function logoutFormServerAction(_unused: FormData, { env, request }: ServerFunctionEvent) {
  const d1: D1Database = (env as any).TESTDB;

  const cookieString = request.headers.get("Cookie") || "";
  const parsedCookies = parseCookie(cookieString);
  const sessionCookie = parsedCookies[COOKIE_NAME] || "";

  const dbResponse = await deleteSession(d1, sessionCookie);
  if (dbResponse instanceof Error) throw new FormError(dbResponse.message);
  const session = dbResponse;

  return redirect("/login", {
    headers: {
      "Set-Cookie": serializeCookie(COOKIE_NAME, "")
    }
  });
}

export function routeData() {
  return createServerData$(indexRouteData);
}

export default function Home() {
  const user = useRouteData<typeof routeData>();
  const [, { Form }] = createServerAction$(logoutFormServerAction);

  return (
    <main class="w-full p-4 space-y-2">
      <h1 class="font-bold text-3xl">Hello {JSON.stringify(user())}</h1>
      <h3 class="font-bold text-xl">Message board</h3>
      <Form>
        <button name="logout" type="submit">
          Logout
        </button>
      </Form>
    </main>
  );
}
