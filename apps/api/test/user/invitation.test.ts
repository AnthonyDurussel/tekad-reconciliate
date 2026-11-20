import { describe, expect, it } from "vitest";
import { RoleDTO } from "@repo/models";
import type { INotifier } from "@/notification/application/INotifier.js";
import type { RenderedEmail } from "@/notification/domain/NotificationMessage.js";
import {
  UserInvitationSender,
  invitationMessage,
} from "@/user/application/services/UserInvitationSender.js";
import { User } from "@/user/domain/User.js";

class FakeNotifier implements INotifier {
  sent: RenderedEmail[] = [];
  constructor(
    private configured = true,
    private fail = false,
  ) {}
  isConfigured() {
    return this.configured;
  }
  async send(email: RenderedEmail) {
    if (this.fail) throw new Error("ACS refuse");
    this.sent.push(email);
  }
}

const user = User.create({
  id: "u",
  email: "jean.dupont@tekad.ch",
  name: "Jean Dupont",
  role: RoleDTO.ACCOUNTANT,
});
const env = { APP_PUBLIC_URL: "https://frais.example.ch/" };

describe("invitation d'un compte", () => {
  it("envoie le rôle et le lien vers l'application", async () => {
    const notifier = new FakeNotifier();
    await expect(
      new UserInvitationSender(notifier).send(user, env),
    ).resolves.toEqual({
      outcome: "SENT",
    });
    const [email] = notifier.sent;
    expect(email.to).toEqual([{ email: user.email, name: "Jean Dupont" }]);
    expect(email.text).toContain("Comptable");
    expect(email.text).toContain("https://frais.example.ch/");
  });

  it("le dit sans messagerie ni adresse publique", async () => {
    await expect(
      new UserInvitationSender(new FakeNotifier(false)).send(user, env),
    ).resolves.toEqual({ outcome: "NOT_CONFIGURED" });
    await expect(
      new UserInvitationSender(new FakeNotifier()).send(user, {}),
    ).resolves.toEqual({ outcome: "NOT_CONFIGURED" });
  });

  it("un échec d'envoi ne lève pas", async () => {
    await expect(
      new UserInvitationSender(new FakeNotifier(true, true)).send(user, env),
    ).resolves.toEqual({ outcome: "FAILED" });
  });
});

describe("invitation d'un invité externe", () => {
  it("explique la connexion par code reçu par e-mail", () => {
    const guest = User.create({
      id: "g",
      email: "marie@gmail.com",
      name: "Marie",
      role: RoleDTO.ACCOUNTANT,
      entraGuest: true,
    });
    expect(invitationMessage(guest).paragraphs.join(" ")).toMatch(
      /code vous est envoyé par e-mail/,
    );
  });
});
