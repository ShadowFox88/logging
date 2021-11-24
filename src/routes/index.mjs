import path from "path";

import Router from "express-promise-router";

import api from "./api";
import help from "./help";

let router = new Router();

router.get(api);
router.get(help);

export default router;
