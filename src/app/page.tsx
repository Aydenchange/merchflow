import { connection } from "next/server";
import { getDb } from "@/lib/db";
import { createPrismaAuthContextRepository } from "@/server/modules/authz/prisma-repository";
import { createPrismaDemoRepository } from "@/server/demo/prisma-repository";
import { loadDemoContext } from "@/server/demo/workbench";
import { PosWorkbench } from "@/features/pos/pos-workbench";

export default async function Home() {
  await connection();

  const db = getDb();
  const initialContext = await loadDemoContext(
    { role: "owner" },
    {
      authRepository: createPrismaAuthContextRepository(db),
      demoRepository: createPrismaDemoRepository(db),
    },
  );

  return <PosWorkbench initialContext={initialContext} />;
}
