import { Database } from "@cloudflare/d1";
import { COOKIE_MAX_AGE_SECONDS } from "~/auth/cookies";

const SQL_TEMPLATE_STRINGS = {
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
    CHECK_USER:
        `SELECT
            COUNT(*) > 0
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
        RETURNING *;`,
    GET_USER:
        `SELECT
            user_id, user_name, password_hash, password_salt
        FROM
            users
        WHERE
            user_name = ?;`,
    SET_OR_UPDATE_USER_SESSION:
        `INSERT INTO
            sessions (user_id, session_id)
        VALUES (?, ?)
        ON CONFLICT (user_id) DO UPDATE
            /* excluded is the SQLite term for the conflicting new values */
            SET session_id = excluded.session_id, created_at = CURRENT_TIMESTAMP
        RETURNING *;`,
}

type UserDbRow = [number, string, string];

function validateUserDbRow(input: any[]): input is UserDbRow {
    return input.length === 4 &&
           typeof input[0] === "number" &&
           typeof input[1] === "string" &&
           typeof input[2] === "string";
}

export type User = {
    userId: number,
    userName: string,
    passwordHash: string,
};

type SessionDbRow = [string, number, number];

function validateSessionDbRow(input: any[]): input is SessionDbRow {
    return input.length === 3 &&
           typeof input[0] === "string" &&
           typeof input[1] === "number" &&
           typeof input[2] === "number";
}

export type Session = {
    sessionId: string,
    userId: number,
    createdAt: number,
};

function toUser(row: UserDbRow): User {
    return { userId: row[0], userName: row[1], passwordHash: row[2] };
}

function toSession(row: SessionDbRow): Session {
    return { sessionId: row[0], userId: row[1], createdAt: row[2] };
}

export async function checkUserExists(db: Database, username: string) {
    const stmt = db.prepare(SQL_TEMPLATE_STRINGS.CHECK_USER).bind(username);
    return stmt.all().then(res => {
        if (res.results !== undefined && (res.results[0][0] as any) === 1)
            return true;
        else if (res.results !== undefined)
            return false;
        return Error("Unknown DB error!");
    }).catch(err => Error(err) /* do Cloudflare Functions do error logging? */);
}

export async function createUser(db: Database, username: string, passwordHash: string) {
    const stmt = db.prepare(SQL_TEMPLATE_STRINGS.CREATE_USER).bind(username, passwordHash);
    return stmt.all().then(res => {
        if (res.results !== undefined && res.results.length === 1 && validateUserDbRow(res.results[0]))
            return toUser(res.results[0]);
        else
            return Error("Unknown DB error!");
    }).catch(err => Error(err));
}

export async function deleteSession(db: Database, sessionId: string) {
    const stmt = db.prepare(SQL_TEMPLATE_STRINGS.DELETE_SESSION).bind(sessionId);
    return stmt.all().then(res => {
        if (res.results !== undefined && res.results.length === 1 && validateSessionDbRow(res.results[0]))
            return toSession(res.results[0]);
        else if (res.results !== undefined && res.results.length === 0)
            return null;
        else
            return Error("Unknown DB error!");
    });
}

export async function getUserBySessionId(db: Database, sessionId: string) {
    const stmt = db.prepare(SQL_TEMPLATE_STRINGS.GET_USER_IF_SESSION_IS_VALID).bind(sessionId);
    return stmt.all().then(res => {
        if (res.results !== undefined && res.results.length === 0)
            return null;
        else if (res.results !== undefined && validateUserDbRow(res.results[0]))
            return toUser(res.results[0]);
        else
            return Error("Unknown DB error!");
    }).catch(err => Error(err));
}

export async function getUserByUsername(db: Database, username: string) {
    const stmt = db.prepare(SQL_TEMPLATE_STRINGS.GET_USER).bind(username);
    return stmt.all().then(res => {
        if (res.results !== undefined && res.results.length === 0)
            return Error("No such user!");
        else if (res.results !== undefined && validateUserDbRow(res.results[0]))
            return toUser(res.results[0]);
        else
            return Error("Unknown DB error!");
    }).catch(err => Error(err));
}

export async function setOrUpdateUserSession(db: Database, userId: number, sessionId: string) {
    const stmt = db.prepare(SQL_TEMPLATE_STRINGS.SET_OR_UPDATE_USER_SESSION).bind(userId, sessionId);
    return stmt.all().then(res => {
        if (res.results !== undefined && res.results.length === 1 && validateSessionDbRow(res.results[0]))
            return toSession(res.results[0]);
        else
            return Error("Unknown DB error!");
    }).catch(err => Error(err));
}