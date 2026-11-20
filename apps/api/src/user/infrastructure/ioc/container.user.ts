import { ContainerModuleLoadOptions } from "inversify";
import { USER_TYPES } from "./types.user.js";
import { PrismaUserRepository } from "@/user/infrastructure/PrismaUserRepository.js";
import { AuthorizationService } from "@/user/infrastructure/AuthorizationService.js";
import { UserUseCases } from "@/user/application/usecases/UserUseCases.js";
import { UserController } from "@/user/infrastructure/UserController.js";
import { GraphEntraDirectory } from "@/user/infrastructure/GraphEntraDirectory.js";
import { EntraAccessChecker } from "@/user/application/services/EntraAccessChecker.js";
import { GetEntraAccessSettingsUseCase } from "@/user/application/usecases/GetEntraAccessSettingsUseCase.js";
import { UserInvitationSender } from "@/user/application/services/UserInvitationSender.js";

export function configureUserContainer(c: ContainerModuleLoadOptions): void {
  c.bind(USER_TYPES.IUserRepository)
    .to(PrismaUserRepository)
    .inSingletonScope();
  c.bind(USER_TYPES.IAuthorizationService)
    .to(AuthorizationService)
    .inSingletonScope();
  c.bind(USER_TYPES.UserUseCases).to(UserUseCases).inSingletonScope();
  c.bind(USER_TYPES.IEntraDirectory).to(GraphEntraDirectory).inSingletonScope();
  c.bind(USER_TYPES.EntraAccessChecker)
    .to(EntraAccessChecker)
    .inSingletonScope();
  c.bind(USER_TYPES.GetEntraAccessSettingsUseCase)
    .to(GetEntraAccessSettingsUseCase)
    .inSingletonScope();
  c.bind(USER_TYPES.UserInvitationSender)
    .to(UserInvitationSender)
    .inSingletonScope();
  c.bind(USER_TYPES.UserController).to(UserController).inSingletonScope();
}
