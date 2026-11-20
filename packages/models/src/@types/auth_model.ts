export type UserToken = {
  clientPrincipal: ClientPrincipal;
};

export type Claim = {
  typ: string;
  val: string;
};

export type ClientPrincipal = {
  userId: string;
  userDetails: string;
  userRoles: string[];
  identityProvider: string;
  claims: Claim[];
};

/**
 * Corps de `POST roles` (hook de rôles Azure Static Web Apps). La plateforme
 * n'envoie pas tous les champs du `ClientPrincipal` — et peut en ajouter — :
 * seul l'identifiant est exigé, le reste est optionnel.
 */
export type RolesRequestDTO = Pick<ClientPrincipal, "userId"> &
  Partial<Omit<ClientPrincipal, "userId">> & {
    accessToken?: string;
  };
