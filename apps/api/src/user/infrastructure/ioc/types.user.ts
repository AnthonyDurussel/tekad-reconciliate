export const USER_TYPES = {
  IUserRepository: Symbol.for("User.IUserRepository"),
  IAuthorizationService: Symbol.for("User.IAuthorizationService"),
  UserUseCases: Symbol.for("User.UserUseCases"),
  UserController: Symbol.for("User.UserController"),
  IEntraDirectory: Symbol.for("User.IEntraDirectory"),
  EntraAccessChecker: Symbol.for("User.EntraAccessChecker"),
  GetEntraAccessSettingsUseCase: Symbol.for(
    "User.GetEntraAccessSettingsUseCase",
  ),
  UserInvitationSender: Symbol.for("User.UserInvitationSender"),
} as const;
