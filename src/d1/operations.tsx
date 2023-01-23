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
            user_id, user_name, password_hash, password_salt
        FROM
            users
        WHERE
            user_name = ?;`,
};

export async function getUserByUsername(db: any, username: string) {
    const stmt = db.prepare(SQL_TEMPLATE_STRINGS.GET_USER_BY_USERNAME).bind(username);
    return stmt.all().then(res => {
        if (res.results !== undefined && res.results.length === 0)
            return Error("No such user!");
        else if (res.results !== undefined)
            return res.results[0];
        else
            return JSON.stringify(res);
    }).catch(err => Error(err.message));
}
