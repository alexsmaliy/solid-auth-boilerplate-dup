import { D1Database } from "@cloudflare/workers-types";
import { COOKIE_MAX_AGE_SECONDS } from "~/auth/cookies";

const SQL_TEMPLATE_STRINGS = {
    CHECK_USER_EXISTS:
        `SELECT
            COUNT(*) > 0 AS present
        FROM
            users
        WHERE
            user_name = ?;`,
    CREATE_USER:
        `INSERT INTO
            users (user_name, password_hash)
        VALUES (?, ?)
        RETURNING *;`,
    DELETE_SESSION:
        `DELETE FROM
            sessions
        WHERE
            session_id = ?
        RETURNING user_id, session_id, UNIXEPOCH(created_at) AS created_at;`,
    GET_USER_BY_USERNAME:
        `SELECT
            user_id, user_name, password_hash
        FROM
            users
        WHERE
            user_name = ?;`,
    GET_USER_IF_SESSION_IS_VALID:
        `WITH subquery1 AS (
            SELECT
                user_id
            FROM
                sessions
            WHERE
                session_id = ?
                AND
                CURRENT_TIMESTAMP < DATETIME(created_at, '+${COOKIE_MAX_AGE_SECONDS} seconds')
        )
        SELECT
            users.user_id, user_name, password_hash
        FROM
            subquery1 JOIN users ON subquery1.user_id = users.user_id;`,
    SET_OR_UPDATE_USER_SESSION:
        `INSERT INTO
            sessions (user_id, session_id)
        VALUES (?, ?)
        ON CONFLICT (user_id) DO UPDATE
            /* excluded is the SQLite term for the conflicting new values */
            SET session_id = excluded.session_id, created_at = CURRENT_TIMESTAMP
        RETURNING user_id, session_id, UNIXEPOCH(created_at) AS created_at;`,
};

type UserDbRow = {
    user_id: number,
    user_name: string,
    password_hash: string,
};

type SessionDbRow = {
    user_id: number,
    session_id: string, // UUID
    created_at: number, // UNIX timestamp
};

export type User = {
    userId: number,
    userName: string,
    passwordHash: string,
};

export type Session = {
    userId: number,
    sessionId: string,
    createdAt: number,
}

function toUser({user_id, user_name, password_hash}: UserDbRow): User {
    return { userId: user_id, userName: user_name, passwordHash: password_hash };
}

function toSession({user_id, session_id, created_at}: SessionDbRow): Session {
    return {userId: user_id, sessionId: session_id, createdAt: created_at};
}

export async function checkUserExists(db: D1Database, username: string) {
    const stmt = db.prepare(SQL_TEMPLATE_STRINGS.CHECK_USER_EXISTS).bind(username);
    return stmt.all<{present: number}>().then(res => {
        if (res.results !== undefined && res.results[0].present === 1)
            return true;
        else if (res.results !== undefined && res.results[0].present === 0)
            return false;
        return Error(`Some other problem: ${JSON.stringify(res)}`);
    }).catch(err => Error(err));
}

export async function createUser(db: D1Database, username: string, passwordHash: string) {
    const stmt = db.prepare(SQL_TEMPLATE_STRINGS.CREATE_USER).bind(username, passwordHash);
    return stmt.all<UserDbRow>().then(res => {
        if (res.results !== undefined && res.results.length === 1)
            return toUser(res.results[0]);
        else
            return Error(`Some other problem: ${JSON.stringify(res)}`);
    }).catch(err => Error(err));
}

export async function deleteSession(db: D1Database, sessionId: string) {
    const stmt = db.prepare(SQL_TEMPLATE_STRINGS.DELETE_SESSION).bind(sessionId);
    return stmt.all<SessionDbRow>().then(res => {
        if (res.results !== undefined && res.results.length === 1)
            return toSession(res.results[0]);
        else if (res.results !== undefined && res.results.length === 0)
            return null;
        else
            return Error(`Some other problem: ${JSON.stringify(res)}`);
    });
}

export async function getUserBySessionId(db: D1Database, sessionId: string) {
    const stmt = db.prepare(SQL_TEMPLATE_STRINGS.GET_USER_IF_SESSION_IS_VALID).bind(sessionId);
    return stmt.all<UserDbRow>().then(res => {
        if (res.results !== undefined && res.results.length === 0)
            return null;
        else if (res.results !== undefined)
            return toUser(res.results[0]);
        else
            return Error(`Some other problem: ${JSON.stringify(res)}`);
    }).catch(err => Error(err));
}

export async function getUserByUsername(db: D1Database, username: string) {
    const stmt = db.prepare(SQL_TEMPLATE_STRINGS.GET_USER_BY_USERNAME).bind(username);
    return stmt.all<UserDbRow>().then(res => {
        if (res.results !== undefined && res.results.length === 0)
            return Error("No such user!");
        else if (res.results !== undefined)
            return toUser(res.results[0]);
        else
            return Error(`Some other problem: ${JSON.stringify(res)}`);
    }).catch(err => Error(err.message));
}

export async function setOrUpdateUserSession(db: D1Database, userId: number, sessionId: string) {
    const stmt = db.prepare(SQL_TEMPLATE_STRINGS.SET_OR_UPDATE_USER_SESSION).bind(userId, sessionId);
    return stmt.all<SessionDbRow>().then(res => {
        if (res.results !== undefined && res.results.length === 1)
            return toSession(res.results[0]);
        else
            return Error(`Some other problem: ${JSON.stringify(res)}`);
    }).catch(err => Error(err));
}
