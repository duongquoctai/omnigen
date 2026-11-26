import { logoutAction } from "@/contexts/access/ui/actions";
import { ProjectsDashboard } from "@/contexts/workspace";
import { getCurrentUser } from "@/lib/auth";
import { getDatabaseStatus, getParentProjects } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await getCurrentUser();
  const projects = await getParentProjects(user?.id, user?.email);
  const dbStatus = getDatabaseStatus();

  const mappedProjects = projects.map((p) => {
    const isOwner = p.isOwner !== false;
    const canEdit =
      isOwner ||
      Boolean(
        p.sharePermissions?.split?.enabled && p.sharePermissions.split.actions.includes("edit"),
      ) ||
      Boolean(
        p.sharePermissions?.mix?.enabled && p.sharePermissions.mix.actions.includes("edit"),
      ) ||
      Boolean(
        p.sharePermissions?.history?.enabled && p.sharePermissions.history.actions.includes("edit"),
      );

    const permissionBadges: Array<string> = [];
    if (!isOwner && p.sharePermissions) {
      if (p.sharePermissions.split?.enabled && p.sharePermissions.split.actions.length > 0) {
        permissionBadges.push(`Tách cảnh: ${p.sharePermissions.split.actions.join(", ")}`);
      }
      if (p.sharePermissions.mix?.enabled && p.sharePermissions.mix.actions.length > 0) {
        permissionBadges.push(`Trộn ghép: ${p.sharePermissions.mix.actions.join(", ")}`);
      }
      if (p.sharePermissions.history?.enabled && p.sharePermissions.history.actions.length > 0) {
        permissionBadges.push(`Lịch sử: ${p.sharePermissions.history.actions.join(", ")}`);
      }
    }

    return {
      id: p.id,
      name: p.name,
      description: p.description,
      foldersCount: p.foldersCount,
      poolCount: p.poolCount,
      renderedCount: p.renderedCount,
      permissionBadges,
      isOwner,
      canEdit,
      ownerName: p.ownerName,
      ownerEmail: p.ownerEmail,
      updatedAt: p.updatedAt,
    };
  });

  return (
    <ProjectsDashboard
      initialProjects={mappedProjects}
      currentUser={user ? { id: user.id, name: user.name, email: user.email } : null}
      dbStatus={dbStatus}
      onLogout={async () => {
        "use server";
        await logoutAction({});
      }}
    />
  );
}
