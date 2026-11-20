import type { User } from "@/user/domain/User.js";

export interface IUserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  list(): Promise<User[]>;
  count(): Promise<number>;
  countActiveAdmins(): Promise<number>;
  /** Insère ; `ConflictError` si l'e-mail existe déjà. */
  create(user: User): Promise<void>;
  update(user: User): Promise<void>;
  markSeen(id: string, at: Date): Promise<void>;
  /** Journées saisies par le compte ou validées par lui. */
  /** Synchronisations lancées et pièces comptabilisées par ce compte. */
  countActivity(id: string): Promise<number>;
  delete(id: string): Promise<void>;
}
