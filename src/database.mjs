import process from "process";

import pg from "pg";

const INIT = `
        CREATE SCHEMA IF NOT EXISTS logging;

        CREATE TABLE IF NOT EXISTS logging.secrets(
            secret TEXT UNIQUE NOT NULL PRIMARY KEY,
            added BIGINT NOT NULL,
            webhook TEXT
        );

        CREATE TABLE IF NOT EXISTS logging.players(
            id SERIAL UNIQUE PRIMARY KEY,
            identifier VARCHAR(20) UNIQUE NOT NULL
        );

        CREATE TABLE IF NOT EXISTS logging.logs(
            id SERIAL UNIQUE PRIMARY KEY,
            secret TEXT REFERENCES logging.secrets(secret),
            player VARCHAR(20) REFERENCES logging.players(identifier),
            content VARCHAR(50) NOT NULL,
            format VARCHAR(100),
            time BIGINT NOT NULL
        );
    `,
    POOL = new pg.Pool({
        application_name: "logging",
        connectTimeoutMillis: 10000,
        max: 20,
        password: process.env.DB_PASS,
        user: process.env.DB_USER
    });


function maybeRelease(client, reusingClient) {
    if (!reusingClient) {
        client.release();
    }
}


async function connect() {
    return await POOL.connect();
}


async function query(statement, params, client) {
    let reusingClient = !!client;
    client ??= await connect();
    let { rows } = await client.query(statement, params);

    maybeRelease(client, reusingClient);

    return rows;
}


async function multi(statements, arrayOfParams=[], client) {
    let reusingClient = !!client;
    client ??= await connect();
    let results = [],
        highest = Math.max(statements.length, arrayOfParams.length);

    for (let i = 0; i < highest; i++) {
        let statement = statements[i],
            params = arrayOfParams[i];
        let result = await query(statement, params, client);

        if (result.length === 0) {
            result = null;
        }

        results.push(result);
    }

    maybeRelease(client, reusingClient);

    return results;
}


async function log(secret, messages, client) {
    for (let { content, format, player, time } of messages) {
        let statements = [
                "INSERT INTO logging.players (identifier) VALUES ($1) ON CONFLICT DO NOTHING;",
                "INSERT INTO logging.logs (secret, player, content, format, time) VALUES ($1, $2, $3, $4, $5);"
            ],
            arrayOfParams = [
                [player],
                [secret, player, content, format, time]
            ]

        await multi(statements, arrayOfParams, client);
    }
}


async function dump(secret, client) {
    let reusingClient = !!client;
    client ??= await connect();
    let params = [secret],
        rows = await query("SELECT webhook FROM logging.secrets WHERE secret=$1;", params, client);

    if (rows.length === 0) {
        maybeRelease(client, reusingClient);

        throw new Error("No webhook bound to secret");
    };

    let statement = `
        SELECT secret, player, content, format, time
        FROM logging.logs
        WHERE secret=$1
        ORDER BY time DESC;
    `;
    let messages = await query(statement, params, client);

    maybeRelease(client, reusingClient);

    if (messages.length === 0) throw new Error("No messages available");

    return messages;
}


POOL.on("error", error => console.error(error.stack));
await POOL.query(INIT);

export default { POOL, connect, dump, log, multi, query };
