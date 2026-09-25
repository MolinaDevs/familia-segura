import { clerkClient } from "@clerk/express";
import { logger } from "./logger";

/** Apaga o usuário no Clerk (exigência da Apple: exclusão completa da conta pelo app). */
export async function deleteClerkUser(clerkUserId: string) {
  if (!process.env.CLERK_SECRET_KEY) {
    logger.warn("CLERK_SECRET_KEY ausente: conta de login não foi apagada no Clerk");
    return false;
  }
  try {
    await clerkClient.users.deleteUser(clerkUserId);
    return true;
  } catch (err) {
    logger.error({ err }, "Falha ao apagar usuário no Clerk");
    return false;
  }
}
