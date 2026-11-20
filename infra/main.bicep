// Infrastructure of one environment of Tekad — réconciliation des frais (staging, production),
// applied by `azd provision` (azure.yaml at the root) through .github/workflows/provision.yml.
// See infra/README.md and docs/DEPLOYMENT.md. Deployed into the environment's resource group
// (AZURE_RESOURCE_GROUP), created beforehand by infra/scripts/github-oidc.sh: the Provision
// identity only needs rights on that group.
//
//   Static Web App (SPA, Entra sign-in) ──/api──▶ Function App (Flex Consumption)
//                                                   ├─ PostgreSQL Flexible Server (Entra), own or existing
//                                                   ├─ Storage (host, package)
//                                                   ├─ Key Vault (secrets)
//                                                   └─ Application Insights ─▶ Log Analytics
targetScope = 'resourceGroup'

@minLength(1)
@maxLength(30)
@description('azd environment name (staging, production).')
param environmentName string

@description('Base of every resource name: tekad-frais-staging, tekad-frais.')
param resourceToken string

@description('Region of the resources (Flex Consumption must be available there: az functionapp list-flexconsumption-locations).')
param location string

@description('Region of the Static Web App: only a few regions host one, none in Switzerland.')
param staticWebAppLocation string = 'westeurope'

// ---- PostgreSQL ----
@description('PostgreSQL database name.')
param postgresDatabaseName string = 'tekad'

@description('Resource id of an existing PostgreSQL Flexible Server that hosts the database (shared server, any resource group). Empty = a server of its own; the SKU and backup parameters below then apply.')
param postgresExistingServerId string = ''

@secure()
@description('Password of the server administrator (migrations, emergencies); for an existing server, its current password.')
param postgresAdminPassword string

@description('PostgreSQL compute: Burstable (B1ms, B2s) or GeneralPurpose.')
param postgresSkuName string = 'Standard_B1ms'
param postgresTier string = 'Burstable'
param postgresStorageSizeGB int = 32
@minValue(7)
@maxValue(35)
param postgresBackupRetentionDays int = 7
@allowed(['Enabled', 'Disabled'])
param postgresGeoRedundantBackup string = 'Disabled'

@description('Entra administrator of the server: object id, name, User | Group | ServicePrincipal. Empty = none.')
param postgresEntraAdminObjectId string = ''
param postgresEntraAdminName string = ''
param postgresEntraAdminType string = 'Group'

// ---- Functions ----
@description('Upper bound of Function App instances; each holds DATABASE_POOL_MAX connections.')
param functionMaximumInstanceCount int = 10

@allowed([512, 2048, 4096])
param functionInstanceMemoryMB int = 2048

@description('Instances kept warm for HTTP (0 = pay per execution only, with cold starts).')
param functionAlwaysReadyInstances int = 0

// ---- Web ----
@description('Custom domains of the Static Web App (DNS records created first, see docs/DEPLOYMENT.md).')
param customDomains array = []

// ---- Observability ----
// A range, not @allowed: main.bicepparam reads it with int(), which a list of literals rejects.
@minValue(30)
@maxValue(730)
param logRetentionDays int = 90

@description('Daily ingestion cap of the Log Analytics workspace, in GB (-1: none).')
param logDailyQuotaGb int = 1

@description('Recipients of the alerts; empty deploys the rules without notification.')
param alertEmails array = []

@description('Public URL checked by the availability test (empty: the Static Web App\'s own host).')
param publicBaseUrl string = ''

// ---- Access ----
@description('Principal of the deploy identity (GitHub OIDC): Key Vault Secrets Officer.')
param deployPrincipalId string = ''

// ---- IA ----

var tags = { 'azd-env-name': environmentName, application: 'tekad-frais' }
var compactToken = toLower(replace(resourceToken, '-', ''))

// Key Vault, storage, Function App and PostgreSQL names are global (DNS): a stable suffix keeps
// them free. The deploy scripts find the resources by their tags, not by name.
var suffix = take(uniqueString(subscription().id, resourceGroup().name), 6)
var names = {
  keyVault: take('kv-${compactToken}-${suffix}', 24)
  storage: take('st${compactToken}${suffix}', 24)
  functionApp: 'func-${resourceToken}-${suffix}'
  staticWebApp: 'stapp-${resourceToken}'
  postgres: 'psql-${resourceToken}-${suffix}'
  workspace: 'log-${resourceToken}'
  appInsights: 'appi-${resourceToken}'
  actionGroup: 'ag-${resourceToken}'
}

var useExistingPostgres = !empty(postgresExistingServerId)
// /subscriptions/<id>/resourceGroups/<rg>/providers/Microsoft.DBforPostgreSQL/flexibleServers/<name>
var postgresServer = split(useExistingPostgres ? postgresExistingServerId : resourceId('Microsoft.DBforPostgreSQL/flexibleServers', names.postgres), '/')

module monitoring 'app/monitoring.bicep' = {
  name: 'monitoring'
  params: {
    location: location
    tags: tags
    workspaceName: names.workspace
    appInsightsName: names.appInsights
    retentionInDays: logRetentionDays
    dailyQuotaGb: logDailyQuotaGb
  }
}

module keyVault 'app/keyvault.bicep' = {
  name: 'keyvault'
  params: {
    name: names.keyVault
    location: location
    tags: tags
    workspaceId: monitoring.outputs.workspaceId
    secretsOfficerPrincipalId: deployPrincipalId
  }
}

module storage 'app/storage.bicep' = {
  name: 'storage'
  params: {
    name: names.storage
    location: location
    tags: tags
    deploymentContainerName: 'app-package'
  }
}

module postgres 'app/postgresql.bicep' = if (!useExistingPostgres) {
  name: 'postgres'
  params: {
    name: names.postgres
    location: location
    tags: tags
    databaseName: postgresDatabaseName
    administratorLoginPassword: postgresAdminPassword
    skuName: postgresSkuName
    tier: postgresTier
    storageSizeGB: postgresStorageSizeGB
    backupRetentionDays: postgresBackupRetentionDays
    geoRedundantBackup: postgresGeoRedundantBackup
    entraAdminObjectId: postgresEntraAdminObjectId
    entraAdminName: postgresEntraAdminName
    entraAdminType: postgresEntraAdminType
    workspaceId: monitoring.outputs.workspaceId
  }
}

module existingPostgres 'app/postgresql-existing.bicep' = if (useExistingPostgres) {
  name: 'postgres-existing'
  scope: resourceGroup(postgresServer[2], postgresServer[4])
  params: {
    serverName: postgresServer[8]
    databaseName: postgresDatabaseName
    entraAdminObjectId: postgresEntraAdminObjectId
    entraAdminName: postgresEntraAdminName
    entraAdminType: postgresEntraAdminType
  }
}

// Pick each output individually: a ternary over the whole `outputs` object compiles to raw
// ARM outputs ({type, value} wrappers), so property access would yield objects, not strings.
var postgresOutputs = {
  id: useExistingPostgres ? existingPostgres!.outputs.id : postgres!.outputs.id
  fqdn: useExistingPostgres ? existingPostgres!.outputs.fqdn : postgres!.outputs.fqdn
  administratorLogin: useExistingPostgres ? existingPostgres!.outputs.administratorLogin : postgres!.outputs.administratorLogin
}

// The owner's connection string, read by the deploy job for `prisma migrate deploy` (and the
// administrator / seed steps) only: the API itself signs in with its managed identity
// (DATABASE_ENTRA_URL).
module postgresConnectionString 'app/keyvault-secret.bicep' = {
  name: 'postgres-connection-string'
  params: {
    keyVaultName: keyVault.outputs.name
    name: 'POSTGRES-CONNECTION-STRING'
    value: 'postgresql://${postgresOutputs.administratorLogin}:${uriComponent(postgresAdminPassword)}@${postgresOutputs.fqdn}:5432/${postgresDatabaseName}?sslmode=require'
  }
}

module function 'app/function.bicep' = {
  name: 'function'
  params: {
    name: names.functionApp
    location: location
    tags: tags
    storageAccountName: storage.outputs.name
    deploymentContainerName: storage.outputs.deploymentContainerName
    applicationInsightsName: monitoring.outputs.appInsightsName
    keyVaultName: keyVault.outputs.name
    workspaceId: monitoring.outputs.workspaceId
    maximumInstanceCount: functionMaximumInstanceCount
    instanceMemoryMB: functionInstanceMemoryMB
    alwaysReadyInstances: functionAlwaysReadyInstances
    appSettings: {
      ENVIRONMENT: environmentName
      // Role = the Function App's name (infra/scripts/postgres-entra-roles.sh creates it).
      DATABASE_ENTRA_URL: 'postgresql://${names.functionApp}@${postgresOutputs.fqdn}:5432/${postgresDatabaseName}'
    }
  }
}

module staticWebApp 'app/static-web-app.bicep' = {
  name: 'static-web-app'
  params: {
    name: names.staticWebApp
    location: staticWebAppLocation
    tags: tags
    functionAppId: function.outputs.id
    functionAppLocation: location
    customDomains: customDomains
  }
}


module alerts 'app/alerts.bicep' = {
  name: 'alerts'
  params: {
    location: location
    tags: tags
    actionGroupName: names.actionGroup
    alertEmails: alertEmails
    workspaceId: monitoring.outputs.workspaceId
    appInsightsId: monitoring.outputs.appInsightsId
    postgresId: postgresOutputs.id
    healthUrl: '${empty(publicBaseUrl) ? 'https://${staticWebApp.outputs.defaultHostname}' : publicBaseUrl}/api/health'
    resourceToken: resourceToken
  }
}

output AZURE_LOCATION string = location
output AZURE_RESOURCE_GROUP string = resourceGroup().name
output KEY_VAULT_NAME string = keyVault.outputs.name
output FUNCTION_APP_NAME string = function.outputs.name
output STATIC_WEB_APP_NAME string = staticWebApp.outputs.name
output STATIC_WEB_APP_HOSTNAME string = staticWebApp.outputs.defaultHostname
output POSTGRES_FQDN string = postgresOutputs.fqdn
output STORAGE_ACCOUNT_NAME string = storage.outputs.name
output APPLICATIONINSIGHTS_NAME string = monitoring.outputs.appInsightsName
