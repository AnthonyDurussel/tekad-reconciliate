import { boolean, mixed, string, type ObjectSchema } from "yup";
import { RoleDTO } from "../@types/authorization.js";
import type {
  CreateUserDTO,
  UpdateMyPreferencesDTO,
  UpdateUserDTO,
} from "../@types/dto/user.dto.js";
import { requiredLabel, strictObject } from "./common.schemas.js";

const role = () => mixed<RoleDTO>().oneOf(Object.values(RoleDTO));

export const createUserSchema: ObjectSchema<CreateUserDTO> = strictObject({
  email: string().trim().lowercase().email().max(255).required(),
  name: requiredLabel(),
  role: role().required(),
  active: boolean().optional(),
});

export const updateUserSchema: ObjectSchema<UpdateUserDTO> = strictObject({
  email: string().trim().lowercase().email().max(255).optional(),
  name: requiredLabel().optional(),
  role: role().optional(),
  active: boolean().optional(),
  notificationsEnabled: boolean().optional(),
});

export const updateMyPreferencesSchema: ObjectSchema<UpdateMyPreferencesDTO> =
  strictObject({
    notificationsEnabled: boolean().required(),
  });
