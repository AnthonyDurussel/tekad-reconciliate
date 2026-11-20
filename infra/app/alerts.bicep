metadata description = 'Alerts of the environment: availability, server errors, unhandled errors, slow API, database saturation, the ingestion cap. One action group, by e-mail.'

param location string
param tags object = {}
param actionGroupName string
param alertEmails array = []
param workspaceId string
param appInsightsId string
param postgresId string
@description('Checked every 5 minutes from three European locations.')
param healthUrl string
param resourceToken string

resource actionGroup 'Microsoft.Insights/actionGroups@2023-01-01' = {
  name: actionGroupName
  location: 'global'
  tags: tags
  properties: {
    groupShortName: take('tekad-${uniqueString(resourceToken)}', 12)
    enabled: true
    emailReceivers: [
      for (email, i) in alertEmails: {
        name: 'email-${i}'
        emailAddress: email
        useCommonAlertSchema: true
      }
    ]
  }
}

var actions = { actionGroups: [actionGroup.id] }

// ---------------------------------------------------------------------------
// Availability: GET /api/health (database included) through the public host
// ---------------------------------------------------------------------------
resource availability 'Microsoft.Insights/webtests@2022-06-15' = {
  name: 'health-${resourceToken}'
  location: location
  tags: union(tags, { 'hidden-link:${appInsightsId}': 'Resource' })
  kind: 'standard'
  properties: {
    SyntheticMonitorId: 'health-${resourceToken}'
    Name: 'Plimo /api/health'
    Enabled: true
    Frequency: 300
    Timeout: 30
    Kind: 'standard'
    RetryEnabled: true
    Locations: [
      { Id: 'emea-ch-zrh-edge' }
      { Id: 'emea-nl-ams-azr' }
      { Id: 'emea-fr-pra-edge' }
    ]
    Request: {
      RequestUrl: healthUrl
      HttpVerb: 'GET'
      ParseDependentRequests: false
    }
    ValidationRules: {
      ExpectedHttpStatusCode: 200
      SSLCheck: true
      SSLCertRemainingLifetimeCheck: 14
    }
  }
}

resource availabilityAlert 'Microsoft.Insights/metricAlerts@2018-03-01' = {
  name: 'tekad-unavailable-${resourceToken}'
  location: 'global'
  tags: tags
  properties: {
    description: 'GET /api/health fails from at least two locations: the site or its database is down.'
    severity: 0
    enabled: true
    scopes: [availability.id, appInsightsId]
    evaluationFrequency: 'PT1M'
    windowSize: 'PT5M'
    criteria: {
      'odata.type': 'Microsoft.Azure.Monitor.WebtestLocationAvailabilityCriteria'
      webTestId: availability.id
      componentId: appInsightsId
      failedLocationCount: 2
    }
    actions: [{ actionGroupId: actionGroup.id }]
  }
}

// ---------------------------------------------------------------------------
// Log alerts on the workspace (Application Insights tables)
// ---------------------------------------------------------------------------
var logAlerts = [
  {
    key: 'api-5xx'
    severity: 1
    frequency: 'PT5M'
    window: 'PT15M'
    threshold: 5
    title: 'API: server errors'
    description: 'More than 5 answers 5xx in 15 minutes. Look up the correlationId of the answer in AppRequests / AppTraces.'
    query: '''
AppRequests
| where toint(ResultCode) >= 500
'''
  }
  {
    key: 'api-exceptions'
    severity: 2
    frequency: 'PT15M'
    window: 'PT15M'
    threshold: 0
    title: 'API: unhandled errors'
    description: 'An exception was logged by the Functions host (an error the domain did not type). The host/worker gRPC channel cut when Flex Consumption recycles an instance (IOException « request stream was aborted » in FunctionRpcService, no request involved) is left out.'
    query: '''
AppExceptions
| where not(Details has "FunctionRpcService" and Details has "Grpc.AspNetCore.Server")
'''
  }
  {
    key: 'api-slow'
    severity: 3
    frequency: 'PT15M'
    window: 'PT30M'
    threshold: 0
    title: 'API: slow'
    description: 'p95 of the API above 3 s over 30 minutes (at least 50 calls).'
    query: '''
AppRequests
| summarize p95 = percentile(DurationMs, 95), n = count()
| where n >= 50 and p95 > 3000
'''
  }
  {
    key: 'ingestion-cap'
    severity: 2
    frequency: 'PT1H'
    window: 'PT1H'
    threshold: 0
    title: 'Log Analytics: daily cap reached'
    description: 'The workspace stopped ingesting for the day: raise logDailyQuotaGb or find the noise.'
    query: '''
_LogOperation
| where Category == "Ingestion" and Operation has "Data collection stopped"
'''
  }
]

resource logRules 'Microsoft.Insights/scheduledQueryRules@2023-03-15-preview' = [
  for rule in logAlerts: {
    name: 'tekad-${rule.key}-${resourceToken}'
    location: location
    tags: tags
    properties: {
      displayName: rule.title
      description: rule.description
      severity: rule.severity
      enabled: true
      evaluationFrequency: rule.frequency
      windowSize: rule.window
      scopes: [workspaceId]
      criteria: {
        allOf: [
          {
            query: rule.query
            timeAggregation: 'Count'
            operator: 'GreaterThan'
            threshold: rule.threshold
            failingPeriods: { numberOfEvaluationPeriods: 1, minFailingPeriodsToAlert: 1 }
          }
        ]
      }
      autoMitigate: true
      actions: actions
    }
  }
]

// ---------------------------------------------------------------------------
// Database
// ---------------------------------------------------------------------------
var dbAlerts = [
  { key: 'cpu', metric: 'cpu_percent', threshold: 85, title: 'PostgreSQL: CPU above 85 %' }
  { key: 'storage', metric: 'storage_percent', threshold: 80, title: 'PostgreSQL: storage above 80 %' }
  { key: 'connections', metric: 'active_connections', threshold: 40, title: 'PostgreSQL: more than 40 connections (B1ms allows 50)' }
]

resource dbRules 'Microsoft.Insights/metricAlerts@2018-03-01' = [
  for rule in dbAlerts: {
    name: 'tekad-db-${rule.key}-${resourceToken}'
    location: 'global'
    tags: tags
    properties: {
      description: rule.title
      severity: 2
      enabled: true
      scopes: [postgresId]
      evaluationFrequency: 'PT5M'
      windowSize: 'PT15M'
      criteria: {
        'odata.type': 'Microsoft.Azure.Monitor.SingleResourceMultipleMetricCriteria'
        allOf: [
          {
            name: rule.key
            criterionType: 'StaticThresholdCriterion'
            metricName: rule.metric
            operator: 'GreaterThan'
            threshold: rule.threshold
            timeAggregation: 'Average'
          }
        ]
      }
      actions: [{ actionGroupId: actionGroup.id }]
    }
  }
]
