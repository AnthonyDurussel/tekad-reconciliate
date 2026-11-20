metadata description = 'Log Analytics workspace and the one Application Insights resource of the environment: the Functions host reports there.'

param location string
param tags object = {}
param workspaceName string
param appInsightsName string

@description('Days of retention: an error reference read over the phone must still find its trace weeks later.')
param retentionInDays int = 90

@description('Daily ingestion cap in GB (-1: none). The cost lever, never sampling: sampling drops error traces at random.')
param dailyQuotaGb int = 2

resource workspace 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: workspaceName
  location: location
  tags: tags
  properties: {
    // Analytics tier: joins across tables (requests, dependencies, exceptions) are the point.
    sku: { name: 'PerGB2018' }
    retentionInDays: retentionInDays
    workspaceCapping: { dailyQuotaGb: dailyQuotaGb }
    features: { enableLogAccessUsingOnlyResourcePermissions: true }
  }
}

resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: appInsightsName
  location: location
  tags: tags
  kind: 'web'
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: workspace.id
    IngestionMode: 'LogAnalytics'
    // Browsers send from anywhere; queries need Azure sign-in anyway.
    publicNetworkAccessForIngestion: 'Enabled'
    publicNetworkAccessForQuery: 'Enabled'
    // Client addresses are not kept (nLPD): Application Insights keeps only the country.
    DisableIpMasking: false
    RetentionInDays: retentionInDays
  }
}

output workspaceId string = workspace.id
output appInsightsId string = appInsights.id
output appInsightsName string = appInsights.name
