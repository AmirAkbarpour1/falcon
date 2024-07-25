import { PrismaClient } from "@prisma/client";
import { encrypt, decrypt } from "../utils/encryptionManager.js";
import { hashKey } from "../utils/hashKeyManager.js";
import axios from "axios";
import logger from "../helper/logger.js";
import serverError from "../errors/serverError.js";
import moment from "moment-timezone";
import http from "http";
import https from "https";
import i18n from "../../i18n.js";
import { login } from "../helper/login.js";

// Initialize Prisma client
const prisma = new PrismaClient();

export const getClient = async (clientUuid) => {
  const uuidRegex = /^[a-fA-F0-9\-]{36}$/;
  const vlessRegex = /^vless:\/\/([a-fA-F0-9\-]{36})@/;
  const vmessRegex = /^vmess:\/\/([a-zA-Z0-9+/=]+)$/;

  const determineUUIDType = (clientUuid) => {
    if (vlessRegex.test(clientUuid)) {
      return vlessRegex.exec(clientUuid)[1];
    } else if (vmessRegex.test(clientUuid)) {
      return JSON.parse(atob(vmessRegex.exec(clientUuid)[1])).id;
    } else if (uuidRegex.test(clientUuid)) {
      return clientUuid;
    } else {
      return null;
    }
  };

  const extractedUuid = determineUUIDType(clientUuid);

  if (!extractedUuid) {
    throw new serverError(400, "Invalid UUID format");
  }

  const client = await prisma.client.findUnique({
    where: {
      key: hashKey(extractedUuid),
    },
  });

  if (!client) {
    throw new serverError(404, "Client Not found");
  }

  const { key, email, uuid, config, ...rest } = client;

  const decryptClient = {
    email: decrypt(email),
    uuid: decrypt(uuid),
    config: decrypt(config),
    ...rest,
  };

  return decryptClient;
};
export const updateClients = async (lng) => {
  i18n.changeLanguage(lng);
  await prisma.client.deleteMany();
  logger.info("Cleared existing clients");

  const panels = await prisma.panel.findMany();
  let successfullyPanels = [];
  let failedPanels = [];
  let finalClients = [];

  for (const panel of panels) {
    let clients = [];

    // Decrypt panel information
    const decryptPanel = {
      key: panel.key,
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

    const ipv4Regex =
      /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    const protocol = ipv4Regex.test(decryptPanel.host) ? "http" : "https";

    // If session is not available, login and get session
    if (!decryptPanel.session) {
      try {
        const getsession = await login(
          decryptPanel.key,
          decryptPanel.host,
          decryptPanel.port,
          decryptPanel.path,
          decryptPanel.username,
          decryptPanel.password
        );
        decryptPanel.session = getsession;
      } catch (error) {
        failedPanels.push({
          host: decryptPanel.host,
          error: `Failed to get inbounds: ${error.message}`,
        });
        continue;
      }
    }

    // Create axios instances for panel and subpanel URLs
    const panelUrl = axios.create({
      baseURL: `${protocol}://${decryptPanel.host}:${decryptPanel.port}${decryptPanel.path}/panel/api/inbounds`,
      headers: {
        Cookie: decryptPanel.session,
        "Content-Type": "application/json",
      },
      httpAgent: new http.Agent({ keepAlive: true, timeout: 10000 }),
      httpsAgent: new https.Agent({ keepAlive: true, timeout: 10000 }),
    });

    const subUrl = axios.create({
      baseURL: `${protocol}://${decryptPanel.host}:${decryptPanel.subPort}${decryptPanel.subPath}`,
      headers: {
        Cookie: decryptPanel.session,
        "Content-Type": "application/json",
      },
      httpAgent: new http.Agent({ keepAlive: true, timeout: 10000 }),
      httpsAgent: new https.Agent({ keepAlive: true, timeout: 10000 }),
    });

    // Fetch inbounds data
    let inbounds = [];
    try {
      const inboundsResponse = await panelUrl.get("/list");
      inbounds = inboundsResponse.data.obj;
    } catch (error) {
      logger.warn(
        `Failed to get inbounds: ${decryptPanel.host} - ${error.message}`
      );
      failedPanels.push({
        host: decryptPanel.host,
        error: `Failed to get inbounds: ${error.message}`,
      });
      continue; // Skip to the next panel
    }

    // Process inbounds to extract client data
    inbounds.forEach((inbound) => {
      const clientsStats = inbound.clientStats;
      const clientsDetails = JSON.parse(inbound.settings).clients;
      const enableInbound = inbound.enable;

      clientsStats.forEach((clientStats) => {
        const clientDetails = clientsDetails.find(
          (client) => client.email === clientStats.email
        );

        const enable =
          enableInbound !== false &&
          clientStats.enable !== false &&
          clientDetails?.enable !== false;

        let limitIp = clientDetails.limitIp;
        typeof limitIp !== "number" && (limitIp = 0);

        clients.push({
          ...clientStats,
          ...clientDetails,
          enable,
          limitIp,
        });
      });
    });

    // Format client data
    clients = clients.map((client) => {
      const {
        total,
        up,
        down,
        expiryTime,
        tgId,
        flow,
        reset,
        inboundId,
        ...rest
      } = client;

      let totalGB = (total / 1024 ** 3).toFixed(2);
      const upGB = (up / 1024 ** 3).toFixed(2);
      const downGB = (down / 1024 ** 3).toFixed(2);
      let remainingVolumeGB = ((total - up - down) / 1024 ** 3).toFixed(2);
      const consumedVolumeGB = ((up + down) / 1024 ** 3).toFixed(2);

      let remainingTime = "";
      let expirationDay = "";

      const now = moment();
      if (expiryTime) {
        remainingTime = moment
          .duration(moment(expiryTime).diff(now))
          .humanize(true);
        expirationDay = moment(expiryTime)
          .tz("Asia/Tehran")
          .format("YYYY-MM-DD");
      }

      if (expirationDay === "1970-01-01" || !expiryTime) {
        remainingTime = "Unlimited";
        expirationDay = "Unlimited";
      }
      if (totalGB === "0.00") {
        totalGB = "Unlimited";
        remainingVolumeGB = "Unlimited";
      }

      return {
        ...rest,
        totalGB,
        downGB,
        upGB,
        consumedVolumeGB,
        remainingVolumeGB,
        expirationDay,
        remainingTime,
      };
    });

    // Fetch configurations and IPs for clients
    const configRequests = clients.map((client) => {
      return subUrl
        .get(client.subId)
        .then((response) => ({
          id: client.id,
          config: response.data,
        }))
        .catch((error) => {
          const statusText = error.response
            ? error.response.statusText
            : "Network Error";
          logger.warn(
            `Failed to get config for client ${client.email}: ${statusText}`
          );
          return {
            id: client.id,
            config: null,
            error: statusText,
          };
        });
    });

    const ipsRequests = clients.map((client) => {
      return panelUrl
        .post(`/clientIps/${client.email}`)
        .then((response) => ({
          id: client.id,
          ipsData: response.data.obj,
        }))
        .catch((error) => {
          const statusText = error.response
            ? error.response.statusText
            : "Network Error";
          logger.warn(
            `Failed to get IPs for client ${client.email}: ${statusText}`
          );
          return {
            id: client.id,
            ipsData: null,
            error: statusText,
          };
        });
    });

    const configResults = await Promise.allSettled(configRequests);
    const ipsResults = await Promise.allSettled(ipsRequests);

    configResults.forEach((result) => {
      if (result.status === "rejected") {
        logger.warn(`Config request failed: ${result.reason}`);
      }
    });

    ipsResults.forEach((result) => {
      if (result.status === "rejected") {
        logger.warn(`IPs request failed: ${result.reason}`);
      }
    });

    // Combine client data with configurations and IPs
    clients.forEach((client) => {
      const { id, email, subId, ...rest } = client;
      const clientConfig = configResults.find(
        (c) => c.value.id === client.id
      )?.value;
      const clientIps = ipsResults.find((i) => i.value.id === client.id)?.value;

      if (!clientConfig || !clientIps) {
        logger.warn(`Config or IPs not found for client: ${client.email}`);
        return;
      }

      const base64regex =
        /^([0-9a-zA-Z+/]{4})*(([0-9a-zA-Z+/]{2}==)|([0-9a-zA-Z+/]{3}=))?$/;

      const config = base64regex.test(clientConfig.config)
        ? Buffer.from(clientConfig.config, "base64")
            .toString("utf-8")
            .replace(/\n/g, "")
        : clientConfig.config.replace(/\n/g, "");

      const ipsCount =
        clientIps.ipsData === "No IP Record"
          ? 0
          : JSON.parse(clientIps.ipsData).length;

      finalClients.push({
        key: hashKey(client.id),
        uuid: encrypt(client.id),
        email: encrypt(client.email),
        ipsCount,
        ...rest,
        config: encrypt(config),
      });
    });
    successfullyPanels.push({
      host: decryptPanel.host,
      message: "The panel was successfully used",
    });
  }

  // Insert updated clients into the database
  const { count } = await prisma.client.createMany({ data: finalClients });

  logger.info(`Clients updated successfully. Count: ${count}`);

  await prisma.$disconnect();

  return {
    message: i18n.t("clients.updated"),
    clientsCount: count,
    successfullyPanels,
    failedPanels,
  };
};
