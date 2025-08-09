'use client'
import { useState } from 'react'

interface WebhookConfig {
  name: string
  url: string
  enabled: boolean
  events: string[]
  token?: string
}

interface IntegrationSettings {
  slack: WebhookConfig
  jira: WebhookConfig & { 
    project: string
    issueType: string
    assignee: string
  }
  gitlab: WebhookConfig & {
    project: string
    branch: string
    triggerPipeline: boolean
  }
  alertmanager: WebhookConfig & {
    instance: string
    severity: string[]
  }
}

export default function Settings() {
  const [settings, setSettings] = useState<IntegrationSettings>({
    slack: {
      name: 'Slack Notifications',
      url: '',
      enabled: false,
      events: ['incident_opened', 'incident_resolved', 'critical_health'],
      token: ''
    },
    jira: {
      name: 'Jira Integration',
      url: '',
      enabled: false,
      events: ['incident_opened', 'incident_escalated'],
      project: 'OPS',
      issueType: 'Incident',
      assignee: 'unassigned'
    },
    gitlab: {
      name: 'GitLab Webhooks',
      url: '',
      enabled: false,
      events: ['incident_resolved'],
      project: 'infrastructure',
      branch: 'main',
      triggerPipeline: false
    },
    alertmanager: {
      name: 'Alertmanager',
      url: '',
      enabled: false,
      events: ['cluster_health_critical'],
      instance: 'prometheus.monitoring.svc.cluster.local',
      severity: ['critical', 'warning']
    }
  })

  const [activeTab, setActiveTab] = useState<keyof IntegrationSettings>('slack')
  const [testResults, setTestResults] = useState<Record<string, string>>({})

  const handleSettingChange = (integration: keyof IntegrationSettings, field: string, value: any) => {
    setSettings(prev => ({
      ...prev,
      [integration]: {
        ...prev[integration],
        [field]: value
      }
    }))
  }

  const handleTestWebhook = async (integration: keyof IntegrationSettings) => {
    setTestResults(prev => ({ ...prev, [integration]: 'Testing...' }))
    
    // Simulate API call
    setTimeout(() => {
      const isValid = settings[integration].url && settings[integration].url.startsWith('http')
      setTestResults(prev => ({ 
        ...prev, 
        [integration]: isValid ? '✅ Connection successful' : '❌ Invalid URL or connection failed'
      }))
    }, 1500)
  }

  const handleSaveSettings = async () => {
    // Simulate save
    console.log('Saving settings:', settings)
    alert('Settings saved successfully!')
  }

  const getTabColor = (tab: string) => {
    switch (tab) {
      case 'slack': return 'from-green-400 to-emerald-400'
      case 'jira': return 'from-blue-400 to-cyan-400'
      case 'gitlab': return 'from-orange-400 to-red-400'
      case 'alertmanager': return 'from-purple-400 to-pink-400'
      default: return 'from-gray-400 to-slate-400'
    }
  }

  const currentSettings = settings[activeTab]

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold bg-gradient-to-r from-purple-400 via-pink-400 to-purple-400 bg-clip-text text-transparent">
          ⚙️ Settings & Integrations
        </h2>
        
        <button 
          onClick={handleSaveSettings}
          className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white px-6 py-2 rounded-lg font-semibold transition-all"
        >
          💾 Save Changes
        </button>
      </div>

      <p className="mb-8 text-gray-300">
        Configure integrations with external tools and webhook notifications
      </p>

      {/* Tab Navigation */}
      <div className="flex space-x-1 mb-8 bg-black/30 p-1 rounded-xl">
        {Object.keys(settings).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab as keyof IntegrationSettings)}
            className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-all ${
              activeTab === tab
                ? `bg-gradient-to-r ${getTabColor(tab)} text-black`
                : 'text-gray-400 hover:text-white hover:bg-white/10'
            }`}
          >
            {tab === 'slack' && '💬'} 
            {tab === 'jira' && '🎫'} 
            {tab === 'gitlab' && '🦊'} 
            {tab === 'alertmanager' && '🚨'} 
            {' '}
            {settings[tab as keyof IntegrationSettings].name}
          </button>
        ))}
      </div>

      {/* Settings Content */}
      <div className="bg-black/30 rounded-xl p-6 backdrop-blur-sm border border-white/10">
        <div className="flex justify-between items-center mb-6">
          <h3 className={`text-2xl font-bold bg-gradient-to-r ${getTabColor(activeTab)} bg-clip-text text-transparent`}>
            {currentSettings.name}
          </h3>
          
          <div className="flex items-center space-x-3">
            <span className="text-gray-400">Enabled</span>
            <button
              onClick={() => handleSettingChange(activeTab, 'enabled', !currentSettings.enabled)}
              className={`relative w-12 h-6 rounded-full transition-colors ${
                currentSettings.enabled ? 'bg-green-500' : 'bg-gray-600'
              }`}
            >
              <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                currentSettings.enabled ? 'translate-x-6' : 'translate-x-0.5'
              }`} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Basic Configuration */}
          <div className="space-y-4">
            <h4 className="text-lg font-semibold text-white mb-3">Basic Configuration</h4>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Webhook URL *
              </label>
              <input
                type="url"
                value={currentSettings.url}
                onChange={(e) => handleSettingChange(activeTab, 'url', e.target.value)}
                placeholder={`https://hooks.${activeTab}.com/...`}
                className="w-full bg-black/40 border border-white/20 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-400/50"
              />
            </div>

            {currentSettings.token !== undefined && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Authentication Token
                </label>
                <input
                  type="password"
                  value={currentSettings.token}
                  onChange={(e) => handleSettingChange(activeTab, 'token', e.target.value)}
                  placeholder="Enter token or API key"
                  className="w-full bg-black/40 border border-white/20 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-400/50"
                />
              </div>
            )}

            {/* Integration-specific fields */}
            {'project' in currentSettings && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  {activeTab === 'jira' ? 'Project Key' : 'Project Name'}
                </label>
                <input
                  type="text"
                  value={currentSettings.project}
                  onChange={(e) => handleSettingChange(activeTab, 'project', e.target.value)}
                  placeholder={activeTab === 'jira' ? 'OPS' : 'infrastructure'}
                  className="w-full bg-black/40 border border-white/20 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-400/50"
                />
              </div>
            )}

            {'issueType' in currentSettings && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Issue Type</label>
                <select
                  value={currentSettings.issueType}
                  onChange={(e) => handleSettingChange(activeTab, 'issueType', e.target.value)}
                  className="w-full bg-black/40 border border-white/20 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-400/50"
                >
                  <option value="Incident">Incident</option>
                  <option value="Bug">Bug</option>
                  <option value="Task">Task</option>
                  <option value="Story">Story</option>
                </select>
              </div>
            )}
          </div>

          {/* Event Configuration */}
          <div className="space-y-4">
            <h4 className="text-lg font-semibold text-white mb-3">Event Triggers</h4>
            
            <div className="space-y-3">
              {[
                { key: 'incident_opened', label: 'Incident Opened', desc: 'When a new incident is created' },
                { key: 'incident_resolved', label: 'Incident Resolved', desc: 'When an incident is marked as resolved' },
                { key: 'incident_escalated', label: 'Incident Escalated', desc: 'When an incident priority increases' },
                { key: 'critical_health', label: 'Critical Health Alert', desc: 'When cluster health becomes critical' },
                { key: 'cluster_health_critical', label: 'Cluster Critical', desc: 'When entire cluster status is critical' }
              ].map((event) => (
                <div key={event.key} className="flex items-center justify-between p-3 bg-black/20 rounded-lg border border-white/5">
                  <div>
                    <div className="font-medium text-white">{event.label}</div>
                    <div className="text-sm text-gray-400">{event.desc}</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={currentSettings.events.includes(event.key)}
                    onChange={(e) => {
                      const newEvents = e.target.checked
                        ? [...currentSettings.events, event.key]
                        : currentSettings.events.filter(ev => ev !== event.key)
                      handleSettingChange(activeTab, 'events', newEvents)
                    }}
                    className="w-4 h-4 text-blue-600 bg-black border-gray-600 rounded focus:ring-blue-500"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Test & Status */}
        <div className="mt-8 pt-6 border-t border-white/10">
          <div className="flex justify-between items-center">
            <div>
              <h4 className="text-lg font-semibold text-white mb-1">Connection Test</h4>
              <p className="text-sm text-gray-400">Test the webhook configuration</p>
            </div>
            
            <div className="flex items-center space-x-4">
              {testResults[activeTab] && (
                <span className={`text-sm ${testResults[activeTab].includes('✅') ? 'text-green-400' : 'text-red-400'}`}>
                  {testResults[activeTab]}
                </span>
              )}
              
              <button
                onClick={() => handleTestWebhook(activeTab)}
                disabled={!currentSettings.url}
                className="bg-blue-600/20 hover:bg-blue-600/30 disabled:bg-gray-600/20 disabled:text-gray-500 border border-blue-400/30 rounded-lg py-2 px-4 text-sm font-semibold text-blue-300 transition-colors"
              >
                🧪 Test Connection
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Setup Examples */}
      <div className="mt-8 bg-black/20 rounded-xl p-6 border border-white/5">
        <h3 className="text-xl font-semibold text-white mb-4">📖 Quick Setup Examples</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="font-semibold text-green-400 mb-2">💬 Slack Webhook</h4>
            <code className="text-xs text-gray-300 bg-black/40 p-2 rounded block">
              https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX
            </code>
          </div>
          
          <div>
            <h4 className="font-semibold text-blue-400 mb-2">🎫 Jira REST API</h4>
            <code className="text-xs text-gray-300 bg-black/40 p-2 rounded block">
              https://your-domain.atlassian.net/rest/api/3/issue
            </code>
          </div>
          
          <div>
            <h4 className="font-semibold text-orange-400 mb-2">🦊 GitLab Webhook</h4>
            <code className="text-xs text-gray-300 bg-black/40 p-2 rounded block">
              https://gitlab.com/api/v4/projects/123/trigger/pipeline
            </code>
          </div>
          
          <div>
            <h4 className="font-semibold text-purple-400 mb-2">🚨 Alertmanager</h4>
            <code className="text-xs text-gray-300 bg-black/40 p-2 rounded block">
              http://alertmanager.monitoring.svc.cluster.local:9093/api/v1/alerts
            </code>
          </div>
        </div>
      </div>
    </div>
  )
}