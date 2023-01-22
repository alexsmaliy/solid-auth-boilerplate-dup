import { Database } from "@cloudflare/d1";

import { Show } from "solid-js";
import { useParams, useRouteData } from "solid-start";
import { FormError } from "solid-start/data";
import { createServerAction$, createServerData$, redirect, ServerFunctionEvent } from "solid-start/server";

import { checkUserExists, createUser, getUserByPassword, getUserBySessionId, setOrUpdateUserSession, User } from "~/database/operations";
// import * as bcrypt from "bcrypt";
import { COOKIE_NAME, parseCookie, serializeCookie } from "~/auth/cookies";

enum LoginType {
  LOGIN = "login",
  REGISTER = "register",
}

async function handleLogin(db: Database, username: string, password: string, redirectTo: string) {
  // TRY TO LOOK UP USER BY USERNAME AND PASSWORD HASH
  const dbResponse = await getUserByPassword(db, username, password);
  if (dbResponse instanceof Error) throw new FormError(dbResponse.message);
  const user = dbResponse;
  const passwordMatches = true // await bcrypt.compare(password, user.passwordHash);
  if (!passwordMatches) throw new FormError("Wrong password.");

  // CREATE NEW SESSION FOR USER
  const newSessionId =  "123uuid" // crypto.randomUUID();
  const dbResponse2 = await setOrUpdateUserSession(db, user.userId, newSessionId);
  if (dbResponse2 instanceof Error) throw new FormError(dbResponse2.message);
  const session = dbResponse2;

  // REDIRECT TO HOMEPAGE AND SET SESSION COOKIE
  return redirect(redirectTo, {
    headers: {
      "Set-Cookie": serializeCookie(COOKIE_NAME, session.sessionId)
    }
  })
}

async function handleRegister(db: Database, username: string, password: string, redirectTo: string) {
  // CHECK IF USERNAME ALREADY EXISTS
  const dbResponse = await checkUserExists(db, username);
  if (dbResponse instanceof Error) throw new FormError(dbResponse.message);
  const userExists = dbResponse;
  if (userExists) throw new FormError("Username already taken!");

  // HASH PASSWORD AND CREATE NEW USER
  const hash = "abc123hash" // await bcrypt.genSalt(12).then(salt => bcrypt.hash(salt, password));
  const dbResponse2 = await createUser(db, username, hash);
  if (dbResponse2 instanceof Error) throw new FormError(dbResponse2.message);
  const newUser = dbResponse2;

  // CREATE NEW SESSION FOR CREATED USER
  const newSessionId = "123uuid" // crypto.randomUUID();
  const dbResponse3 = await setOrUpdateUserSession(db, newUser.userId, newSessionId);
  if (dbResponse3 instanceof Error) throw new FormError(dbResponse3.message);
  const session = dbResponse3;

  // REDIRECT TO HOMEPAGE AND SET SESSION COOKIE
  return redirect(redirectTo, {
    headers: {
      "Set-Cookie": serializeCookie(COOKIE_NAME, session.sessionId)
    }
  })
}

export function routeData() {
  return createServerData$(async (_unused, { env, request }) => {
    const d1_binding_from_env = (env as any).TESTDB;
    const d1 = new Database(d1_binding_from_env);
  
    const cookieString = request.headers.get("Cookie") || "";
    const parsedCookies = parseCookie(cookieString);
    const sessionCookie = parsedCookies[COOKIE_NAME] || "";
  
    let user: User | null = null;
    if (sessionCookie !== "") {
      const dbResponse = await getUserBySessionId(d1, sessionCookie);
      if (dbResponse instanceof Error) throw new FormError(dbResponse.message);
      user = dbResponse;
    }
  
    const valid = user !== null;
    // const valid = false;
    if (valid) throw redirect("/");
    return {}
  });
}

export default function Login() {
  const data = useRouteData<typeof routeData>();
  const params = useParams();
  const [loggingIn, { Form }] = createServerAction$(async (form: FormData, { env }) => {
    // INITIALIZE D1 DB BINDING
    // const { env } = event;
    const d1_binding_from_env = (env as any).TESTDB;
    const d1 = new Database(d1_binding_from_env);
  
    // READ THE STATE OF THE FORM
    const loginType = form.get("loginType") as string;
    const username= form.get("username") as string;
    const password = form.get("password") as string;
    const redirectTo = (form.get("redirectTo") || "/") as string;
  
    // HANDLE REGISTRATION/LOGIN/REDIRECTION
    if (loginType === LoginType.LOGIN)
      return handleLogin(d1, username, password, redirectTo);
    else if (loginType === LoginType.REGISTER)
      return handleRegister(d1, username, password, redirectTo);
    else
      throw new FormError("Invalid choice of form submission: must be 'login' or 'register'!");
  });

  return (
    <main>
      <h1>Login</h1>
      <Form>
        <input type="hidden" name="redirectTo" value={params.redirectTo ?? "/"} />
        <fieldset>
          <legend>Login or Register?</legend>
          <label>
            <input type="radio" name="loginType" value={LoginType.LOGIN} checked={true} />
            Login
          </label>
          <label>
            <input type="radio" name="loginType" value={LoginType.REGISTER} />
            Register
          </label>
        </fieldset>
        <div>
          <label for="username-input">
            Username
          </label>
          <input name="username" placeholder="kody" />
        </div>
        <div>
          <label for="password-input">Password</label>
          <input name="password" type="password" placeholder="twixrox" />
        </div>
        <Show when={true}>
          <p role="alert" id="error-message">
            {"Messages from login page: " + JSON.stringify(loggingIn.error)}
          </p>
        </Show>
        <button type="submit">{data() ? "Login" : ""}</button>
      </Form>
    </main>
  );
}
