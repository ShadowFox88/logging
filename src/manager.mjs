import process from "process";

import fetch from "node-fetch";
import File from "fetch-blob/file.js";
import { FormData } from "formdata-polyfill/esm.min.js";

import database from "./database";
import utils from "./utils/es";


export let createWebhookPayload = ({ buffer, webhook }) => ({ buffer, webhook });
export class WebhookRequestManager {
    constructor() {
        /*
            this.data -> {
                webhook1: {
                    secret1: [message1, message2],
                    secret2: [message3],
                    secret3: []
                },
                webhook2: {}
                ...
            }
        */
        this.processing = false;
        this.resolver = {};
        this.data = {};

        let callback = this.main.bind(this);

        this.interval = setInterval(callback, process.env.INTERVAL * 1000 || 10000);
    }

    bind(webhook, secret) {
        this.resolver[secret] = webhook;
        let webhookBound = this.data[webhook];

        if (!webhookBound) {
            webhookBound = {};
            this.data[webhook] = webhookBound;
        }

        let secretBound = webhookBound[secret];

        if (!secretBound) {
            secretBound = [];
            webhookBound[secret] = secretBound;
        }
    }

    append(secret, messages) {
        let webhook = this.resolver[secret];
        let messageCache = this.data[webhook];

        if (!(webhook || messageCache)) throw new Error("Cannot append to unbound webhook's dataset");

        let messagesFound = messageCache[secret];

        if (!messagesFound) {
            this.data[webhook] = messages;
        } else {
            messagesFound.push(...messages);
        }
    }

    close() {
        clearInterval(this.interval);
    }

    applyFormat(format, env) {
        return format.replace(/\{(\w+)\}/g, (_, key) => Object.hasOwn(env, key) ?
                                                        env[key] :
                                                        key);
    }

    async purgeData({ client, webhook, secret }) {
        // empty message arrays can exist from database errors or manual deletions, to handle this special case we
        // remove it from the database which ensures this doesn't repeat
        let params = [[secret], [secret]];
        let statements = [
            "DELETE FROM logging.logs WHERE secret=$1;",
            "DELETE FROM logging.secrets WHERE secret=$1;"
        ];

        await database.multi(statements, params, client);
        delete this.data[webhook][secret];
    }

    async send(webhook, files) {
        let secrets = [],
            body = new FormData();

        for (let i = 0; i < files.length; i++) {
            let { content, secret } = files[i];
            let file = new File([content], `${secret}.txt`);

            secrets.push(secret);
            body.append(`files[${i}]`, file);
        }

        try {
            await fetch(webhook, {
                method: "POST",
                body
            });

            // there has to be a better way to do this rather than spamming database calls
            for (let secret of secrets) {
                await this.purgeData({ secret, webhook });
            }
        } catch (error) {
            console.error(error.stack);
        }
    }

    async main() {
        if (this.processing || utils.isObjectEmpty(this.data)) return;

        this.processing = true;

        let client = await database.connect();

        for (let [webhook, secrets] of Object.entries(this.data)) {
            let files = [];

            for (let [secret, messages] of Object.entries(secrets)) {
                let content = "",
                    totalMessages = messages.length;

                if (totalMessages === 0) {
                    await this.purgeData({ client,  secret, webhook });

                    continue;
                }

                for (let i = 0; i < totalMessages; i++) {
                    let { format, ...env } = messages[i];
                    content += this.applyFormat(format, env);

                    if (i < totalMessages) {
                        content += "\n";
                    }
                }

                files.push({ content, secret });

                if (files.length < 10) {
                    continue;
                }

                await this.send(webhook, files);

                files = [];
            }

            if (files.length > 0) {
                await this.send(webhook, files);
            }

            delete this.data[webhook];
        }

        this.processing = false;
    }
}
