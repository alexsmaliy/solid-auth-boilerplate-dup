import { Show } from "solid-js";
import { useParams, useRouteData } from "solid-start";
import { FormError } from "solid-start/data";
import {
  createServerAction$,
  createServerData$,
  redirect,
  ServerFunctionEvent,
} from "solid-start/server";
import { getUserByUsername } from "~/d1/operations";
import { db } from "~/db";
import { createUserSession, getUser, login, register } from "~/db/session";

function validateUsername(username: unknown) {
  if (typeof username !== "string" || username.length < 3) {
    return `Usernames must be at least 3 characters long`;
  }
}

function validatePassword(password: unknown) {
  if (typeof password !== "string" || password.length < 6) {
    return `Passwords must be at least 6 characters long`;
  }
}

export function routeData() {
  return createServerData$(async (_, { request }) => {
    if (await getUser(request)) {
      throw redirect("/");
    }
    return {};
  });
}

enum LoginType {
  LOGIN = "login",
  REGISTER = "register",
}

export default function Login() {
  const data = useRouteData<typeof routeData>();
  const params = useParams();

  const [loggingIn, { Form }] = createServerAction$(async (form: FormData, e: ServerFunctionEvent) => {
    const loginType = form.get("loginType");
    const username = form.get("username") as string;
    const password = form.get("password");
    const redirectTo = form.get("redirectTo") || "/";
    
    const d1 = (e.env as any).TESTDB;
    const d1Response = await getUserByUsername(d1, username);
    if (d1Response instanceof Error) throw new FormError(d1Response.message);
    const d1User = d1Response;
    
    if (
      typeof loginType !== "string" ||
      typeof username !== "string" ||
      typeof password !== "string" ||
      typeof redirectTo !== "string"
    ) {
      throw new FormError(`Form not submitted correctly.`);
    }

    const fields = { loginType, username, password };
    const fieldErrors = {
      username: validateUsername(username),
      password: validatePassword(password),
    };
    if (Object.values(fieldErrors).some(Boolean)) {
      throw new FormError("Fields invalid", { fieldErrors, fields });
    }

    switch (loginType) {
      case "login": {
        const user = await login({ username, password });
        if (!user) {
          throw new FormError(`Username/Password combination is incorrect\nDB: ${JSON.stringify(d1User)}`, {
            fields,
          });
        }
        return createUserSession(`${user.id}`, redirectTo);
      }
      case "register": {
        const userExists = await db.user.findUnique({ where: { username } });
        if (userExists) {
          throw new FormError(`User with username ${username} already exists`, {
            fields,
          });
        }
        const user = await register({ username, password });
        if (!user) {
          throw new FormError(
            `Something went wrong trying to create a new user.`,
            {
              fields,
            }
          );
        }
        return createUserSession(`${user.id}`, redirectTo);
      }
      default: {
        throw new FormError(`Login type invalid`, { fields });
      }
    }
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
          <input name="username" placeholder="kody" />
        </div>
        <div>
          <label for="password-input">Password</label>
          <input name="password" type="password" placeholder="twixrox" />
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
