import { Database } from "@cloudflare/d1";
import { FormError, useRouteData } from "solid-start";
import { createServerAction$, createServerData$, redirect, ServerFunctionEvent } from "solid-start/server";
import { COOKIE_NAME, parseCookie, serializeCookie } from "~/auth/cookies";
import { deleteSession, getUserBySessionId } from "~/database/operations";

async function redirectIfSessionIsInvalid(_unused: any, event: ServerFunctionEvent) {
  const { env, request } = event;
  const d1_binding_from_env = (env as any).TESTDB;
  const d1 = new Database(d1_binding_from_env);

  const cookieString = request.headers.get("Cookie") || "";
  const parsedCookies = parseCookie(cookieString);
  const sessionCookie = parsedCookies[COOKIE_NAME] || "";

  const dbResponse = await getUserBySessionId(d1, sessionCookie);
  if (dbResponse instanceof Error) throw new FormError(dbResponse.message); // not the right error to throw?
  const user = dbResponse;

  const valid = user !== null;
  if (!valid) throw redirect("/login");
  return user;
}

export function routeData() {
  return createServerData$(redirectIfSessionIsInvalid);
}

async function logoutServerAction(f: FormData, event: ServerFunctionEvent) {
  const { env, request } = event;
  const d1_binding_from_env = (env as any).TESTDB;
  const d1 = new Database(d1_binding_from_env);

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

export default function Home() {
  const user = useRouteData<typeof routeData>();
  const [, { Form }] = createServerAction$(logoutServerAction);

  return (
    <main class="w-full p-4 space-y-2">
      <h1 class="font-bold text-3xl">Hello {user()?.userName}</h1>
      <h3 class="font-bold text-xl">Message board</h3>
      <Form>
        <button name="logout" type="submit">
          Logout
        </button>
      </Form>
    </main>
  );
}
