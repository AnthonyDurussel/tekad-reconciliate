metadata description = 'The API: a Function App on the Flex Consumption plan with rolling updates, so a code or settings deployment never restarts every instance at once.'

param name string
param location string
param tags object = {}
param storageAccountName string
param deploymentContainerName string
param applicationInsightsName string
param keyVaultName string
param workspaceId string

@description('Node.js major version of the Flex Consumption runtime.')
param runtimeVersion string = '22'

@allowed([512, 2048, 4096])
param instanceMemoryMB int = 2048
param maximumInstanceCount int = 10
param alwaysReadyInstances int = 0

@description('Settings computed by the template; the rest comes with each release (deploy/env/<env>/appsettings.json).')
param appSettings object = {}

resource storage 'Microsoft.Storage/storageAccounts@2023-05-01' existing = {
  name: storageAccountName
}

resource appInsights 'Microsoft.Insights/components@2020-02-02' existing = {
  name: applicationInsightsName
}

// The host's own storage (leases) and the package: one account, its key.
var storageConnectionString = 'DefaultEndpointsProtocol=https;AccountName=${storage.name};EndpointSuffix=${environment().suffixes.storage};AccountKey=${storage.listKeys().keys[0].value}'

resource plan 'Microsoft.Web/serverfarms@2024-04-01' = {
  name: '${name}-plan'
  location: location
  tags: tags
  kind: 'functionapp'
  sku: { tier: 'FlexConsumption', name: 'FC1' }
  properties: { reserved: true }
}

resource functionApp 'Microsoft.Web/sites@2024-04-01' = {
  name: name
  location: location
  tags: union(tags, { 'azd-service-name': 'api' })
  kind: 'functionapp,linux'
  identity: { type: 'SystemAssigned' }
  properties: {
    serverFarmId: plan.id
    httpsOnly: true
    functionAppConfig: {
      deployment: {
        storage: {
          type: 'blobContainer'
          value: '${storage.properties.primaryEndpoints.blob}${deploymentContainerName}'
          authentication: {
            type: 'StorageAccountConnectionString'
            storageAccountConnectionStringName: 'DEPLOYMENT_STORAGE_CONNECTION_STRING'
          }
        }
      }
      scaleAndConcurrency: {
        maximumInstanceCount: maximumInstanceCount
        instanceMemoryMB: instanceMemoryMB
        alwaysReady: alwaysReadyInstances > 0 ? [{ name: 'http', instanceCount: alwaysReadyInstances }] : []
      }
      runtime: { name: 'node', version: runtimeVersion }
      // Zero-downtime deployments: instances are replaced by batches, in-flight executions
      // complete. Two releases therefore run side by side for a few minutes: migrations are
      // expand/contract (docs/DEPLOYMENT.md).
      #disable-next-line BCP037
      siteUpdateStrategy: { type: 'RollingUpdate' }
    }
    siteConfig: {
      minTlsVersion: '1.2'
      ftpsState: 'Disabled'
      http20Enabled: true
      // No WEBSITE_RUN_FROM_PACKAGE, FUNCTIONS_EXTENSION_VERSION nor FUNCTIONS_WORKER_RUNTIME:
      // Flex Consumption refuses them (functionAppConfig above says it).
      appSettings: concat(
        [
          { name: 'AzureWebJobsStorage', value: storageConnectionString }
          { name: 'DEPLOYMENT_STORAGE_CONNECTION_STRING', value: storageConnectionString }
          {
            name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
            value: appInsights.properties.ConnectionString
          }
        ],
        map(items(appSettings), item => { name: item.key, value: item.value })
      )
    }
  }
}

// Reads the app secrets (Key Vault references in the app settings).
module secretsUser 'keyvault-role.bicep' = {
  name: 'function-keyvault-secrets-user'
  params: {
    keyVaultName: keyVaultName
    principalId: functionApp.identity.principalId
    roleDefinitionId: '4633458b-17de-408a-b874-0445c86b69e6'
  }
}

resource diagnostics 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = {
  name: 'to-log-analytics'
  scope: functionApp
  properties: {
    workspaceId: workspaceId
    logs: [{ category: 'FunctionAppLogs', enabled: true }]
    metrics: [{ category: 'AllMetrics', enabled: true }]
  }
}

output id string = functionApp.id
output name string = functionApp.name
output principalId string = functionApp.identity.principalId
output defaultHostname string = functionApp.properties.defaultHostName
