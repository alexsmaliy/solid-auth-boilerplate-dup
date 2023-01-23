import { D1Database } from "@cloudflare/workers-types";

const SQL_TEMPLATE_STRINGS = {
    CHECK_USER:
        `SELECT
            COUNT(*) > 0
        FROM
            users
        WHERE
            user_name = ?;`,
    GET_USER_BY_USERNAME:
        `SELECT
            user_id, user_name, password_hash
        FROM
            users
        WHERE
            user_name = ?;`,
};

type UserDbRow = {
    user_id: number,
    user_name: string,
    password_hash: string,
}

export type User = {
    userId: number,
    userName: string,
    passwordHash: string,
};

function toUser({user_id, user_name, password_hash}: UserDbRow): User {
    return { userId: user_id, userName: user_name, passwordHash: password_hash };
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
