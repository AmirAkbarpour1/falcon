import { getClient, updateClients } from "./clientsServices.js";
import { Router } from "express";
import AuthMiddlware from "../middlewares/authMiddleware.js";
import logger from "../helper/logger.js";
const router = Router();

router.post("/get", async (req, res, next) => {
  try {
    const { uuid: clientUuid } = req.body;
    res.send(await getClient(clientUuid));
  } catch (err) {
    next(err);
  }
});

router.get("/update", AuthMiddlware, async (req, res, next) => {
  try {
    const { lng } = req.query;
    res.send(await updateClients(lng));
  } catch (err) {
    logger.error(err.message);
    next(err);
  }
});

export { router };
