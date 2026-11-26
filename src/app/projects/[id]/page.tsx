import { notFound, redirect } from "next/navigation";

import { accessRoleFromLegacy, canManageFolders } from "@/contexts/access";
import { logoutAction } from "@/contexts/access/ui/actions";
import { ProjectFoldersView } from "@/contexts/workspace";
import { getCurrentUser } from "@/lib/auth";
import { getFoldersByParentId, getParentProjectById, resolveProjectAccess } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function ProjectFoldersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  const access = await resolveProjectAccess(id, user?.id, user?.email);

  if (access.role === "none") {
    redirect("/");
  }

  const parentProject = await getParentProjectById(id);
  if (!parentProject) {
    notFound();
  }

  const folders = await getFoldersByParentId(id);
  const accessRole = accessRoleFromLegacy(access);

  return (
    <ProjectFoldersView
      project={{
        id: parentProject.id,
        name: parentProject.name,
        description: parentProject.description,
        isOwner: access.role === "owner",
      }}
      initialFolders={folders}
      canManageFolders={canManageFolders(accessRole)}
      currentUser={user ? { id: user.id, name: user.name, email: user.email } : null}
      onLogout={async () => {
        "use server";
        await logoutAction({});
      }}
    />
  );
}
