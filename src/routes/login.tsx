import { D1Database } from "@cloudflare/workers-types";
import * as bcrypt from "bcryptjs";
import { Show } from "solid-js";
import { useParams, useRouteData } from "solid-start";
import { FormError } from "solid-start/data";
import { createServerAction$, createServerData$, redirect, ServerFunctionEvent } from "solid-start/server";
import { COOKIE_NAME, parseCookie, serializeCookie } from "~/auth/cookies";
import { checkUserExists, createUser, D1_DB_NAME, getUserBySessionId, getUserByUsername, setOrUpdateUserSession, User } from "~/d1/operations";

enum LoginType {
  LOGIN = "login",
  REGISTER = "register",
}

async function loginFormServerData(_unused: unknown, {env, request}: ServerFunctionEvent) {
  const d1: D1Database = (env as any)[D1_DB_NAME];

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
  if (valid)
    throw redirect("/");
  else
    return {}
}

async function loginFormServerAction(form: FormData, { env }: ServerFunctionEvent) {
  const loginType = form.get("loginType") as string;
  const username = form.get("username") as string;
  const password = form.get("password") as string;
  const redirectTo = (form.get("redirectTo") || "/") as string;

  const d1: D1Database = (env as any)[D1_DB_NAME];

  if (loginType === LoginType.LOGIN)
    return handleLogin(d1, username, password, redirectTo);
  else if (loginType === LoginType.REGISTER)
    return handleRegister(d1, username, password, redirectTo);
  else
    throw new FormError("Invalid choice of form submission: must be 'login' or 'register'!");
}

async function handleLogin(db: D1Database, username: string, password: string, redirectTo: string) {
  // TRY TO LOOK UP USER BY USERNAME AND PASSWORD HASH
  const dbResponse = await getUserByUsername(db, username);
  if (dbResponse instanceof Error) throw new FormError(dbResponse.message);
  const user = dbResponse;
  const passwordMatches = bcrypt.compareSync(password, user.passwordHash);
  if (!passwordMatches) throw new FormError("Wrong password.");

  // CREATE NEW SESSION FOR USER
  const newSessionId =  crypto.randomUUID();
  const dbResponse2 = await setOrUpdateUserSession(db, user.userId, newSessionId);
  if (dbResponse2 instanceof Error) throw new FormError(dbResponse2.message);

  // REDIRECT TO HOMEPAGE AND SET SESSION COOKIE
  return redirect(redirectTo, {
    headers: {
      "Set-Cookie": serializeCookie(COOKIE_NAME, newSessionId)
    }
  });
}

async function handleRegister(db: D1Database, username: string, password: string, redirectTo: string) {
  // CHECK IF USERNAME ALREADY EXISTS
  const dbResponse = await checkUserExists(db, username);
  if (dbResponse instanceof Error) throw new FormError(dbResponse.message);
  const userExists = dbResponse;
  if (userExists) throw new FormError("Username already taken!");

  // HASH PASSWORD AND CREATE NEW USER
  const salt = bcrypt.genSaltSync(12);
  const hash = bcrypt.hashSync(password, salt);
  const dbResponse2 = await createUser(db, username, hash);
  if (dbResponse2 instanceof Error) throw new FormError(dbResponse2.message);
  const newUser = dbResponse2;

  // CREATE NEW SESSION FOR CREATED USER
  const newSessionId = crypto.randomUUID();
  const dbResponse3 = await setOrUpdateUserSession(db, newUser.userId, newSessionId);
  if (dbResponse3 instanceof Error) throw new FormError(dbResponse3.message);
  const session = dbResponse3;

  // REDIRECT TO HOMEPAGE AND SET SESSION COOKIE
  return redirect(redirectTo, {
    headers: {
      "Set-Cookie": serializeCookie(COOKIE_NAME, session.sessionId)
    }
  });
}

export function routeData() {
  return createServerData$(loginFormServerData);
}

export default function Login() {
  const data = useRouteData<typeof routeData>();
  const params = useParams();
  const [loggingIn, { Form }] = createServerAction$(loginFormServerAction);

  return (
    <main>
      <h1>Login</h1>
      <Form>
        <input type="hidden" name="redirectTo" value={params.redirectTo ?? "/"} />
        <fieldset>
          <legend>Login or Register?</legend>
          <label>
            <input type="radio" name="loginType" value={LoginType.LOGIN} checked={true} />
            {" "}Login
          </label>
          <label>
            <input type="radio" name="loginType" value={LoginType.REGISTER} />
            {" "}Register
          </label>
        </fieldset>
        <div>
          <label for="username-input">
            Username
          </label>
          <input name="username" placeholder="username" />
        </div>
        <div>
          <label for="password-input">Password</label>
          <input name="password" type="password" placeholder="password" />
        </div>
        <Show when={loggingIn.error}>
          <p role="alert" id="error-message">
            {`Errors: ` + JSON.stringify(loggingIn.error.message)}
          </p>
        </Show>
        <button type="submit">{data() ? "Login" : ""}</button>
      </Form>
    </main>
  );
}
