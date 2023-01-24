DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS sessions;

DROP INDEX IF EXISTS idx_users_user_name;
DROP INDEX IF EXISTS idx_sessions_user_id;
DROP INDEX IF EXISTS idx_sessions_session_id;

CREATE TABLE users (
    user_id         INTEGER PRIMARY KEY, -- automatically assigned if not specified
    user_name       TEXT UNIQUE NOT NULL,
    password_hash   TEXT NOT NULL
);

CREATE INDEX idx_users_user_name ON users (user_name);

CREATE TABLE sessions (
    user_id         INTEGER NOT NULL,
    session_id      TEXT UNIQUE NOT NULL,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,

    FOREIGN KEY (user_id) REFERENCES users(user_id)
);

CREATE UNIQUE INDEX idx_sessions_user_id ON sessions (user_id);
CREATE INDEX idx_sessions_session_id ON sessions (session_id);
