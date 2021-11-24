import Router from "express-promise-router";

import database from "../database";

const CHARACTERS = "abcdefghij",
      FORMAT = "[{time}] {player} - {content}",
      DISCORD_WEBHOOK = /^https?:\/\/(?:canary|ptb\.)?discord(app)?\.com\/api\/webhooks\/[0-9]+\/[a-z0-9_\-]+$/i;
let router = new Router();


function verifyWebhook(url) {
    let tail;

    if (!url) {
        tail = "not provided";
    } else if (typeof url !== "string") {
        tail = "is not a string";
    } else if (!url.match(DISCORD_WEBHOOK)) {
        tail = "format not accepted";
    } else {
        return null;
    }

    return `Webhook URL ${tail}`;
}


function sendStatusError({ res, error: message, status = 400 }) {
    res.status(status);
    res.send({ message });
}


function generateSecret() {
    let secret = [],
        added = Date.now();
    let converted = added.toString();

    for (let i = 0; i < converted.length; i++) {
        let charPos = converted[i];
        let character = CHARACTERS[charPos];

        secret.push(character);
    }

    secret = secret.join("");

    return { added, secret };
}


async function verifySecret(secret) {
    let params = [secret];
    let rows = await database.query("SELECT * FROM logging.secrets WHERE secret=$1;", params);

    if (rows.length === 0) {
        return "Invalid secret";
    }

    return null;
}


router.use("/api", async (req, res, next) => {
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Cache-Control", "s-max-age=1 stale-while-revalidate");
    next();
});


router.post("/api/authenticate", async (req, res) => {
    let { webhook } = req.body;
    let error = verifyWebhook(webhook);

    console.log(error);

    if (error) return sendStatusError({ error, res });

    let { added, secret } = generateSecret(),
        manager = req.app.get("manager");
    let params = [secret, added, webhook];

    manager.bind(webhook, secret);
    await database.query("INSERT INTO logging.secrets (secret, added, webhook) VALUES ($1, $2, $3);", params);
    res.status(200);
    res.end({ secret });
});


router.post("/api/log", async (req, res) => {
    let { messages, secret } = req.body;
    let error = await verifySecret(secret);

    if (error) return sendStatusError({ error, res });

    let isBulk = Array.isArray(messages),
        manager = req.app.get("manager");

    if (!messages) {
        let { content, player, time, format = FORMAT } = req.body;

        if (!(content && player && time)) {
            return sendStatusError({ error, res });
        }

        messages = { content, format, player, time };
    }

    if (!isBulk) {
        messages = [messages];
    }

    manager.append(secret, messages);
    await database.log(secret, messages);
    res.sendStatus(200);
    res.end();
});


router.post("/api/dump", async (req, res) => {
    let messages;
    let { secret } = req.body;

    try {
        messages = await database.dump(secret);
    } catch (error) {
        let status;

        switch (error.message) {
            case "No webhook bound to secret":
                status = 401;

                break
            case "No messages available":
                status = 404;

                break;
            default:
                status = 400;
        }

        res.status(status);

        return res.send(error);
    }

    if (messages.length === 0) return res.sendStatus(404);

    let manager = req.app.get("manager");

    try {
        manager.append(secret, messages);
        res.sendStatus(200);
        res.end();
    } catch ({ message }) {
        res.status(401);
        res.end({ message });
    }
});


export default router;
