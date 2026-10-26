import { createRouter } from "@/lib/create-app";
import auth from "@/api/auth/auth.index";
import me from "@/api/me/me.index";
import users from "@/api/users/users.index";
import roles from "@/api/roles/roles.index";

const api = createRouter()
  .route("/auth", auth)
  .route("/me", me)
  .route("/users", users)
  .route("/roles", roles);

export type ApiType = typeof api;
export default api;
