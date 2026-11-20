metadata description = 'Key Vault of the environment (RBAC): app secrets synced from 1Password on every deploy, the owner\'s database connection string written by this template.'

param name string
param location string
param tags object = {}
param workspaceId string

@description('Deploy identity (GitHub OIDC): writes the secrets. Empty = nobody here.')
#disable-next-line secure-secrets-in-params // a principal id, not a secret
param secretsOfficerPrincipalId string = ''

var keyVaultSecretsOfficer = 'b86a8fe4-44ce-4948-aee5-eccb2c155cd7'

resource vault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: name
  location: location
  tags: tags
  properties: {
    tenantId: subscription().tenantId
    sku: { family: 'A', name: 'standard' }
    enableRbacAuthorization: true
    enableSoftDelete: true
    softDeleteRetentionInDays: 30
    enablePurgeProtection: true
    publicNetworkAccess: 'Enabled'
  }
}

resource officer 'Microsoft.Authorization/roleAssignments@2022-04-01' = if (!empty(secretsOfficerPrincipalId)) {
  name: guid(vault.id, secretsOfficerPrincipalId, keyVaultSecretsOfficer)
  scope: vault
  properties: {
    principalId: secretsOfficerPrincipalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', keyVaultSecretsOfficer)
  }
}

resource diagnostics 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = {
  name: 'to-log-analytics'
  scope: vault
  properties: {
    workspaceId: workspaceId
    logs: [{ categoryGroup: 'audit', enabled: true }]
  }
}

output name string = vault.name
output id string = vault.id
output uri string = vault.properties.vaultUri
