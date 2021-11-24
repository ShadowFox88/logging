import path from "path";
import process from "process";
import url from "url";

import express from "express";

import database from "./src/database";
import routes from "./src/routes";
import { WebhookRequestManager } from "./src/manager";

const DIRNAME = path.dirname(url.fileURLToPath(import.meta.url)),
      PORT = process.env.PORT || 3000;
let app = express();
let manager = new WebhookRequestManager();

app.set("manager", manager);
app.set("dirname", DIRNAME);

if (process.env.NODE_ENV === "production") {
    let livereload = import("./src/live-reload");

    app.use(livereload(PORT));
}

app.use(express.json());
app.use(routes);


app.on("error", error => console.error(error.stack));
process.on("beforeExit", async () => {
    await database.POOL.end();
    manager.close();
});


app.listen(PORT, error => {
    if (error) throw error;

    console.log(`[${HOST}:${PORT}] Up!`);
});
