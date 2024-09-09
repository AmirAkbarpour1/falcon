import { encodeToken } from "../utils/jwtManager.js";
import ServerError from "../errors/serverError.js";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

export const login = async (data) => {
  const user = await prisma.user.findUnique({
    where: { username: data.username },
  });
  if (!user) throw new ServerError(404, "User not found");
  const compare = await bcrypt.compare(data.password, `${user.password}`);
  if (!compare) throw new ServerError(400, "Invalid credentials");
  const token = encodeToken({ username: data.username });
  return { token: `${token}` };
};
