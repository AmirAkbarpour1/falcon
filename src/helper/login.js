import ServerError from "../errors/serverError.js";
import logger from "./logger.js";
import axios from "axios";
import { PrismaClient } from "@prisma/client";
import { encrypt } from "../utils/encryptionManager.js";

const prisma = new PrismaClient();

export const login = async (key, host, port, path, username, password) => {
  try {
    const ipv4Regex =
      /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    const protocol = ipv4Regex.test(host) ? "http" : "https";
    const response = await axios.post(
      `${protocol}://${host}:${port}${path}/login`,
      {
        username: username,
        password: password,
      }
    );
    const session = response.headers["set-cookie"][0].split(";")[0].split("=")[1];

    await prisma.panel.update({
      where: {
        key: key,
      },
      data: {
        session: encrypt(session),
      },
    });

    logger.info(`Panel session updated: ${host}`);
    return session;
  } catch (error) {
    logger.warn(`Failed to login panel: ${host} - ${error.message}`);
    throw new ServerError(
      400,
      `Failed to login panel: ${host} - ${error.message}`
    );
  }
};
