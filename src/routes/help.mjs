import Router from "express-promise-router";

let router = new Router();


router.all("/help", async (req, res) => res.end("https://github.com/cyrus01337/logging/blob/main/README.md"));


export default router;
