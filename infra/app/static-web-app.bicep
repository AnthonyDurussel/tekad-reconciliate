metadata description = 'The SPA on Azure Static Web Apps (Standard), with the Function App linked as its /api backend: one origin for the pages and the API; the Static Web App\'s Entra sign-in hands the API its x-ms-client-principal.'

param name string
param location string
param tags object = {}
param functionAppId string
param functionAppLocation string

@description('Custom domains; their DNS records must exist first (infra/README.md).')
param customDomains array = []

resource site 'Microsoft.Web/staticSites@2024-04-01' = {
  name: name
  location: location
  tags: union(tags, { 'azd-service-name': 'frontend' })
  sku: { name: 'Standard', tier: 'Standard' }
  properties: {
    // Deployed by the deploy workflow (swa deploy), never from a repository link.
    allowConfigFileUpdates: true
    stagingEnvironmentPolicy: 'Disabled'
  }
}

// /api/* is proxied to the Function App, which then only answers through the Static Web App:
// nobody can call it directly with a forged x-ms-client-principal.
resource backend 'Microsoft.Web/staticSites/linkedBackends@2024-04-01' = {
  parent: site
  name: 'api'
  properties: {
    backendResourceId: functionAppId
    region: functionAppLocation
  }
}

// Apex domains validate with a TXT record, subdomains with their CNAME (see infra/README.md).
@batchSize(1)
resource domains 'Microsoft.Web/staticSites/customDomains@2024-04-01' = [
  for domain in customDomains: {
    parent: site
    name: domain
    properties: {
      validationMethod: length(split(domain, '.')) == 2 ? 'dns-txt-token' : 'cname-delegation'
    }
  }
]

output id string = site.id
output name string = site.name
output defaultHostname string = site.properties.defaultHostname
