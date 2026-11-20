metadata description = 'Database of the environment on an existing PostgreSQL Flexible Server (shared, managed elsewhere): the server itself — SKU, backups, authentication, diagnostics — is left as it is.'

param serverName string
param databaseName string
param entraAdminObjectId string = ''
param entraAdminName string = ''
@allowed(['User', 'Group', 'ServicePrincipal'])
param entraAdminType string = 'Group'

// Prerequisites on the server: Entra authentication enabled (the Function App's managed identity)
// and password authentication enabled (migrations, as the administrator).
resource server 'Microsoft.DBforPostgreSQL/flexibleServers@2024-08-01' existing = {
  name: serverName
}

// Created when missing, left as it is otherwise (same charset and collation as a server of its own).
resource database 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2024-08-01' = {
  parent: server
  name: databaseName
  properties: { charset: 'UTF8', collation: 'en_US.utf8' }
}

// Added to the server's administrators, next to those already there.
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

// Same rule as a server of its own: the Function App and the deploy job's runner.
resource azureServices 'Microsoft.DBforPostgreSQL/flexibleServers/firewallRules@2024-08-01' = {
  parent: server
  name: 'AllowAllAzureServicesAndResourcesWithinAzureIps'
  properties: { startIpAddress: '0.0.0.0', endIpAddress: '0.0.0.0' }
}

output id string = server.id
output fqdn string = server.properties.fullyQualifiedDomainName
output administratorLogin string = server.properties.administratorLogin
