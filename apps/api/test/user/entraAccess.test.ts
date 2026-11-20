import "reflect-metadata";
import { describe, expect, it } from "vitest";
import { EntraAccessChecker } from "@/user/application/services/EntraAccessChecker.js";
import { GetEntraAccessSettingsUseCase } from "@/user/application/usecases/GetEntraAccessSettingsUseCase.js";
import {
  EntraApplication,
  EntraTenant,
  IEntraDirectory,
} from "@/user/application/services/IEntraDirectory.js";

const HOME = "t-home";

class FakeDirectory implements IEntraDirectory {
  configured = true;
  application: EntraApplication = {
    appId: "app-1",
    displayName: "Tekad",
    signInAudience: "AzureADMultipleOrgs",
    allowedTenantIds: ["T-PARTNER"],
    assignmentRequired: false,
  };
  /** Domaine → tenant, comme `findTenantInformationByDomainName`. */
  tenants = new Map<string, EntraTenant>([
    ["tekad.ch", { tenantId: "T-HOME", displayName: "Tekad" }],
    [
      "partner.ch",
      {
        tenantId: "T-PARTNER",
        displayName: "Partner SA",
        defaultDomainName: "partner.ch",
      },
    ],
    ["ext.ch", { tenantId: "T-EXT", displayName: "Ext SA" }],
  ]);

  isConfigured() {
    return this.configured;
  }
  homeTenantId() {
    return HOME;
  }
  async getApplication() {
    return this.application;
  }
  async findTenantByDomain(domain: string) {
    return this.tenants.get(domain) ?? null;
  }
  async findTenantById(tenantId: string) {
    return (
      [...this.tenants.values()].find(
        (t) => t.tenantId.toLowerCase() === tenantId.toLowerCase(),
      ) ?? null
    );
  }
  invited: { email: string; displayName: string; redirectUrl: string }[] = [];
  assigned: string[] = [];
  assignmentFails = false;
  async inviteGuest(input: {
    email: string;
    displayName: string;
    redirectUrl: string;
  }) {
    this.invited.push(input);
    return { userId: `guest-${input.email}` };
  }
  async assignToApplication(userId: string) {
    if (this.assignmentFails) throw new Error("Insufficient privileges");
    this.assigned.push(userId);
  }
}

const check = (directory: FakeDirectory, email: string) =>
  new EntraAccessChecker(directory).check(email);

describe("vérification Entra d'un compte", () => {
  it("ne vérifie rien sans configuration Graph", async () => {
    const directory = new FakeDirectory();
    directory.configured = false;
    await expect(check(directory, "a@ext.ch")).resolves.toEqual({
      outcome: "NOT_CONFIGURED",
    });
  });

  it("accepte le tenant d'origine", async () => {
    await expect(check(new FakeDirectory(), "A@Tekad.ch")).resolves.toEqual({
      outcome: "HOME_TENANT",
      tenant: { tenantId: "T-HOME", displayName: "Tekad" },
    });
  });

  it("invite une adresse sans tenant, sans e-mail Microsoft", async () => {
    const directory = new FakeDirectory();
    await expect(
      new EntraAccessChecker(directory).check("Marie@Gmail.com", "Marie"),
    ).resolves.toEqual({
      outcome: "GUEST_INVITED",
      tenant: { tenantId: "T-HOME", displayName: "Tekad" },
    });
    expect(directory.invited).toEqual([
      expect.objectContaining({
        email: "marie@gmail.com",
        displayName: "Marie",
      }),
    ]);
    // Pas d'affectation requise : rien d'autre.
    expect(directory.assigned).toEqual([]);
  });

  it("invite aussi l'adresse d'une autre entreprise", async () => {
    const directory = new FakeDirectory();
    await expect(check(directory, "a@partner.ch")).resolves.toMatchObject({
      outcome: "GUEST_INVITED",
    });
    expect(directory.invited).toHaveLength(1);
  });

  it("affecte l'invité à l'application quand l'affectation est requise", async () => {
    const directory = new FakeDirectory();
    directory.application.assignmentRequired = true;
    await check(directory, "a@gmail.com");
    expect(directory.assigned).toEqual(["guest-a@gmail.com"]);
  });

  it("une affectation refusée ne bloque pas : elle est signalée", async () => {
    const directory = new FakeDirectory();
    directory.application.assignmentRequired = true;
    directory.assignmentFails = true;
    const access = await check(directory, "a@gmail.com");
    expect(access.outcome).toBe("GUEST_INVITED");
    expect(access.assignmentError).toMatch(/Applications d'entreprise/);
  });

  it("n'invite pas un compte du tenant d'origine", async () => {
    const directory = new FakeDirectory();
    await check(directory, "a@tekad.ch");
    expect(directory.invited).toEqual([]);
  });

  it("refuse tout pour une application réservée aux comptes personnels", async () => {
    const directory = new FakeDirectory();
    directory.application.signInAudience = "PersonalMicrosoftAccount";
    await expect(check(directory, "a@tekad.ch")).rejects.toThrow();
  });
});

describe("résumé de l'App Registration", () => {
  it("nomme le tenant d'origine et les tenants autorisés", async () => {
    const directory = new FakeDirectory();
    directory.application.allowedTenantIds = ["T-HOME", "T-PARTNER", "T-X"];
    const settings = await new GetEntraAccessSettingsUseCase(
      directory,
    ).execute();
    expect(settings.homeTenant).toEqual({
      tenantId: "T-HOME",
      displayName: "Tekad",
    });
    expect(settings.allowedTenants).toEqual([
      {
        tenantId: "T-PARTNER",
        displayName: "Partner SA",
        defaultDomainName: "partner.ch",
      },
      { tenantId: "T-X" },
    ]);
  });

  it("distingue « tous les tenants » et « tenant d'origine seulement »", async () => {
    const directory = new FakeDirectory();
    directory.application.allowedTenantIds = null;
    await expect(
      new GetEntraAccessSettingsUseCase(directory).execute(),
    ).resolves.toMatchObject({ allowedTenants: null });

    directory.application.signInAudience = "AzureADMyOrg";
    await expect(
      new GetEntraAccessSettingsUseCase(directory).execute(),
    ).resolves.toMatchObject({ allowedTenants: [] });

    directory.configured = false;
    await expect(
      new GetEntraAccessSettingsUseCase(directory).execute(),
    ).resolves.toEqual({ configured: false });
  });
});
