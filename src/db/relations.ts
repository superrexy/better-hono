import { defineRelations } from "drizzle-orm";
import * as schema from "@/db/schema";

export const relations = defineRelations(schema, (r) => ({
    user: {
        sessions: r.many.session({ from: r.user.id, to: r.session.userId }),
        accounts: r.many.account({ from: r.user.id, to: r.account.userId }),
        role: r.one.role({ from: r.user.roleId, to: r.role.id }),
    },
    session: {
        user: r.one.user({ from: r.session.userId, to: r.user.id }),
    },
    account: {
        user: r.one.user({ from: r.account.userId, to: r.user.id }),
    },
    role: {
        users: r.many.user({ from: r.role.id, to: r.user.roleId }),
        permissions: r.many.permission({
            from: r.role.id.through(r.rolePermission.roleId),
            to: r.permission.id.through(r.rolePermission.permissionId),
        }),
    },
    permission: {
        roles: r.many.role({
            from: r.permission.id.through(r.rolePermission.permissionId),
            to: r.role.id.through(r.rolePermission.roleId),
        }),
    },
}));
