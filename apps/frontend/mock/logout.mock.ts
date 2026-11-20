import { defineMock } from "vite-plugin-mock-dev-server";
import { currentToken, extractedRoles } from "./token";

export default defineMock({
  url: "/.auth/logout",
  response: async (req, res) => {
    currentToken.value = { clientPrincipal: null };
    extractedRoles.value = [];
    // Comme Static Web Apps : retour vers `post_logout_redirect_uri` (chemin local seulement).
    const target = new URL(req.url ?? "/", "http://localhost").searchParams.get(
      "post_logout_redirect_uri",
    );
    const location =
      target?.startsWith("/") && !target.startsWith("//") ? target : "/";
    res.writeHead(302, { Location: location });
    res.end();
  },
});
