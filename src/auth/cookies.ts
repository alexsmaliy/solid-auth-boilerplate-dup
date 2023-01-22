import * as cookie from "cookie";

export const COOKIE_NAME = "__session";
export const COOKIE_MAX_AGE_SECONDS = 5 * 60;

const COOKIE_SERIALIZE_OPTIONS: cookie.CookieSerializeOptions = {
  encode: encodeURIComponent,
  httpOnly: true,
  maxAge: COOKIE_MAX_AGE_SECONDS,
  path: "/",
  sameSite: "lax",
  secure: true,
};

const COOKIE_PARSE_OPTIONS: cookie.CookieParseOptions = {
  decode: decodeURIComponent,
}

export function serializeCookie(name: string, value: string) {
  return cookie.serialize(name, value, COOKIE_SERIALIZE_OPTIONS);
}

export function parseCookie(cookieHeader: string) {
  return cookie.parse(cookieHeader, COOKIE_PARSE_OPTIONS);
}
