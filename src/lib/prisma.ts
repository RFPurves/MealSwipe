import "server-only";
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { mealSwipePrisma?: PrismaClient };

export const prisma = globalForPrisma.mealSwipePrisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.mealSwipePrisma = prisma;
