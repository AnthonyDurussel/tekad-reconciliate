metadata description = 'PostgreSQL Flexible Server: Entra sign-in for the Function App\'s managed identity, password sign-in for the owner (migrations). Backups and point-in-time restore by Azure.'

param name string
param location string
param tags object = {}
param databaseName string
param administratorLogin string = 'tekadadmin'

@secure()
param administratorLoginPassword string

@allowed(['16', '17'])
param version string = '16'
param skuName string = 'Standard_B1ms'
@allowed(['Burstable', 'GeneralPurpose', 'MemoryOptimized'])
param tier string = 'Burstable'
param storageSizeGB int = 32
param backupRetentionDays int = 7
param geoRedundantBackup string = 'Disabled'
param entraAdminObjectId string = ''
param entraAdminName string = ''
@allowed(['User', 'Group', 'ServicePrincipal'])
param entraAdminType string = 'Group'
param workspaceId string

resource server 'Microsoft.DBforPostgreSQL/flexibleServers@2024-08-01' = {
  name: name
  location: location
  tags: tags
  sku: { name: skuName, tier: tier }
  properties: {
    version: version
    administratorLogin: administratorLogin
    administratorLoginPassword: administratorLoginPassword
    authConfig: {
      activeDirectoryAuth: 'Enabled'
      // Migrations still run as the owner, with the password kept in Key Vault.
      passwordAuth: 'Enabled'
      tenantId: subscription().tenantId
    }
    storage: { storageSizeGB: storageSizeGB, autoGrow: 'Enabled' }
    backup: { backupRetentionDays: backupRetentionDays, geoRedundantBackup: geoRedundantBackup }
    highAvailability: { mode: 'Disabled' }
  }
}

resource database 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2024-08-01' = {
  parent: server
  name: databaseName
  properties: { charset: 'UTF8', collation: 'en_US.utf8' }
}

// Creates the Postgres roles of managed identities (infra/scripts/postgres-entra-roles.sh).
resource entraAdmin 'Microsoft.DBforPostgreSQL/flexibleServers/administrators@2024-08-01' = if (!empty(entraAdminObjectId)) {
  parent: server
  name: entraAdminObjectId
  properties: {
    principalName: entraAdminName
    principalType: entraAdminType
    tenantId: subscription().tenantId
  }
  dependsOn: [database]
}

// Connections from Azure only: the Function App, and the GitHub-hosted runner of the deploy job
// that applies the migrations (it runs in Azure). Sign-in still needs a token or the password.
resource azureServices 'Microsoft.DBforPostgreSQL/flexibleServers/firewallRules@2024-08-01' = {
  parent: server
  name: 'AllowAllAzureServicesAndResourcesWithinAzureIps'
  properties: { startIpAddress: '0.0.0.0', endIpAddress: '0.0.0.0' }
}

resource diagnostics 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = {
  name: 'to-log-analytics'
  scope: server
  properties: {
    workspaceId: workspaceId
    logs: [{ category: 'PostgreSQLLogs', enabled: true }]
    metrics: [{ category: 'AllMetrics', enabled: true }]
  }
}

output id string = server.id
output fqdn string = server.properties.fullyQualifiedDomainName
output administratorLogin string = administratorLogin
