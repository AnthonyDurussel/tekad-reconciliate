import { InvocationContext } from "@azure/functions";
import { ClientPrincipal } from "@repo/models";

export type LocalContext = {
  context: InvocationContext;
  userPrincipal?: ClientPrincipal;
};
