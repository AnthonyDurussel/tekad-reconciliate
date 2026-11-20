using './main.bicep'

// Read from the environment of the provision job (.github/workflows/provision.yml): the azd
// environment's values, then the 1Password note `tekad-frais-infra.<env>.provision`.
param environmentName = readEnvironmentVariable('AZURE_ENV_NAME', 'staging')
param resourceToken = readEnvironmentVariable('AZURE_RESOURCE_TOKEN', 'tekad-frais-staging')
param location = readEnvironmentVariable('AZURE_LOCATION', 'switzerlandnorth')
param staticWebAppLocation = readEnvironmentVariable('AZURE_STATIC_WEB_APP_LOCATION', 'westeurope')

// Resource id of an existing PostgreSQL Flexible Server (empty: a server of its own, SKU and backups below).
param postgresExistingServerId = readEnvironmentVariable('POSTGRESQL_EXISTING_SERVER_ID', '')
param postgresAdminPassword = readEnvironmentVariable('POSTGRESQL_ADMIN_PASSWORD', '')
param postgresSkuName = readEnvironmentVariable('POSTGRESQL_SKU_NAME', 'Standard_B1ms')
param postgresTier = readEnvironmentVariable('POSTGRESQL_TIER', 'Burstable')
param postgresBackupRetentionDays = int(readEnvironmentVariable('POSTGRESQL_BACKUP_RETENTION_DAYS', '7'))
param postgresGeoRedundantBackup = readEnvironmentVariable('POSTGRESQL_GEO_REDUNDANT_BACKUP', 'Disabled')
param postgresEntraAdminObjectId = readEnvironmentVariable('POSTGRESQL_ENTRA_ADMIN_OBJECT_ID', '')
param postgresEntraAdminName = readEnvironmentVariable('POSTGRESQL_ENTRA_ADMIN_NAME', '')
param postgresEntraAdminType = readEnvironmentVariable('POSTGRESQL_ENTRA_ADMIN_TYPE', 'Group')

param functionAlwaysReadyInstances = int(readEnvironmentVariable('FUNCTION_ALWAYS_READY_INSTANCES', '0'))
param functionMaximumInstanceCount = int(readEnvironmentVariable('FUNCTION_MAXIMUM_INSTANCE_COUNT', '10'))

// Comma-separated: "frais.tekad.ch". Empty until the DNS records exist (docs/DEPLOYMENT.md).
param customDomains = empty(readEnvironmentVariable('CUSTOM_DOMAINS', '')) ? [] : split(readEnvironmentVariable('CUSTOM_DOMAINS', ''), ',')
param publicBaseUrl = readEnvironmentVariable('PUBLIC_BASE_URL', '')

param logRetentionDays = int(readEnvironmentVariable('LOG_RETENTION_DAYS', '90'))
param logDailyQuotaGb = int(readEnvironmentVariable('LOG_DAILY_QUOTA_GB', '1'))
param alertEmails = empty(readEnvironmentVariable('ALERT_EMAILS', '')) ? [] : split(readEnvironmentVariable('ALERT_EMAILS', ''), ',')

// The deploy identity of the GitHub environment (variable AZURE_PRINCIPAL_ID).
param deployPrincipalId = readEnvironmentVariable('AZURE_PRINCIPAL_ID', '')


