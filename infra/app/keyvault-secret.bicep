param keyVaultName string
param name string

@secure()
param value string

resource vault 'Microsoft.KeyVault/vaults@2023-07-01' existing = {
  name: keyVaultName
}

resource secret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: vault
  name: name
  properties: {
    value: value
  }
}

output uri string = secret.properties.secretUri
