import { PrismaClient } from "@prisma/client";
import { encrypt, decrypt } from "../utils/encryptionManager.js";
import { hashKey } from "../utils/hashKeyManager.js";
import ServerError from "../errors/serverError.js";
import logger from "../helper/logger.js";
import { login } from "../helper/login.js";
import axios from "axios";
import { updateClients } from "../clients/clientsServices.js";

const prisma = new PrismaClient();

export const getPanels = async () => {
  const panels = await prisma.panel.findMany();
  if (panels.length === 0) {
    return [];
  } else {
    const decryptPanels = panels.map((panel) => {
      return {
        host: decrypt(panel.host),
        username: decrypt(panel.username),
        password: decrypt(panel.password),
        port: panel.port,
        path: decrypt(panel.path),
        session: panel.session ? decrypt(panel.session) : undefined,
        subPort: panel.subPort,
        subPath: decrypt(panel.subPath),
        enable: panel.enable,
      };
    });

    return decryptPanels;
  }
};

export const addPanel = async (panel) => {
  const findPanel = await prisma.panel.findUnique({
    where: {
      key: hashKey(panel.host),
    },
  });

  if (findPanel) {
    throw new ServerError(409, `Panel with host ${panel.host} already exists`);
  } else {
    const encryptPanel = {
      key: hashKey(panel.host),
      host: encrypt(panel.host),
      username: encrypt(panel.username),
      password: encrypt(panel.password),
      port: panel.port,
      path: panel.path ? encrypt(panel.path) : encrypt("/"),
      session: panel.session ? encrypt(panel.session) : undefined,
      subPort: panel.subPort,
      subPath: panel.subPath ? encrypt(panel.subPath) : encrypt("/"),
      enable: panel.enable ? panel.enable : true,
    };

    const createdPanel = await prisma.panel.create({ data: encryptPanel });

    await login(
      hashKey(panel.host),
      panel.host,
      panel.port,
      panel.path ? panel.path : "/",
      panel.username,
      panel.password
    );

    logger.info(`Panel added successfully: ${panel.host}`);

    await updateClients();

    return {
      message: `Panel added successfully: ${panel.host}`,
    };
  }
};

export const updatePanel = async (host, panel) => {
  const hasNewData = Object.keys(panel).some(
    (key) =>
      panel[key] !== undefined && panel[key] !== null && panel[key] !== ""
  );

  if (!hasNewData) {
    throw new ServerError(
      400,
      `No data provided for update for panel with host ${host}`
    );
  }

  const existingPanel = await prisma.panel.findUnique({
    where: {
      key: hashKey(host),
    },
  });

  if (!existingPanel) {
    throw new ServerError(404, `Panel with host ${host} does not exist`);
  } else {
    const updatedData = {
      key: panel.host ? hashKey(panel.host) : existingPanel.key,
      host: panel.host ? encrypt(panel.host) : existingPanel.host,
      username: panel.username
        ? encrypt(panel.username)
        : existingPanel.username,
      password: panel.password
        ? encrypt(panel.password)
        : existingPanel.password,
      port: panel.port || existingPanel.port,
      path: panel.path ? encrypt(panel.path) : existingPanel.path,
      session: panel.session ? encrypt(panel.session) : existingPanel.session,
      subPort: panel.subPort || existingPanel.subPort,
      subPath: panel.subPath ? encrypt(panel.subPath) : existingPanel.subPath,
      enable: panel.enable !== undefined ? panel.enable : existingPanel.enable,
    };

    const updatedPanel = await prisma.panel.update({
      where: {
        key: hashKey(host),
      },
      data: updatedData,
    });

    
    await updateClients();

    logger.info(`Panel updated successfully: ${host}`);

    return {
      message: `Panel updated successfully: ${host}`,
    };
  }
};

export const deletePanel = async (host) => {
  const findPanel = await prisma.panel.findUnique({
    where: {
      key: hashKey(host),
    },
  });

  if (!findPanel) {
    throw new ServerError(409, `Panel with host ${host} no exists`);
  } else {
    const deletedPanel = await prisma.panel.delete({
      where: {
        key: hashKey(host),
      },
    });

    
    await updateClients();
    
    logger.info(`Panel deleted successfully: ${host}`);

    return {
      message: `Panel deleted successfully: ${host}`,
    };
  }
};
