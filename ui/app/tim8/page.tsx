'use client'
import { useEffect, useState } from 'react'

interface HealthComponent {
  id: number
  component: string
  component_type: string
  status: string
  details: any
  last_check: string
}

interface ClusterHealth {
  cluster_name: string
  workspace: string
  overall_status: string
  components: HealthComponent[]
  last_check: string
}

export default function TiM8Cluster() {
  const [clusterHealth, setClusterHealth] = useState<ClusterHealth | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchClusterHealth = async () => {
      try {
        const response = await fetch('/api/cluster/incident-copilot/health?workspace=TiM8-Local')
        const data = await response.json()
        setClusterHealth(data)
      } catch (error) {
        console.error('Failed to fetch cluster health:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchClusterHealth()
    const interval = setInterval(fetchClusterHealth, 30000) // Refresh every 30s
    return () => clearInterval(interval)
  }, [])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'status-healthy border-2'
      case 'warning': return 'status-warning border-2'
      case 'critical': return 'status-critical border-2'
      default: return 'text-muted border-glass border-2 bg-glass'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy': return '✅'
      case 'warning': return '⚠️'
      case 'critical': return '🔴'
      default: return '❓'
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center space-x-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-400"></div>
          <div className="text-xl text-secondary">Loading TiM8 cluster health...</div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-3xl font-bold bg-gradient-to-r from-emerald-400 to-sky-400 bg-clip-text text-transparent">
            🧠 TiM8 Local Cluster
          </h2>
          <p className="text-secondary mt-2">Monitoring détaillé du cluster incident-copilot en temps réel</p>
        </div>
        <div className="text-right">
          <div className="flex items-center space-x-2 text-sm text-muted">
            <div className="w-2 h-2 bg-accent rounded-full animate-pulse"></div>
            <span>Auto-refresh: 30s</span>
          </div>
        </div>
      </div>
      
      <div className="mb-8 p-6 bg-glass border-glass rounded-xl">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-2xl font-semibold text-emerald-400">📊 Overall Status</h3>
          <div className="text-right">
            <div className="flex items-center space-x-3">
              <span className="text-3xl">
                {getStatusIcon(clusterHealth?.overall_status || 'unknown')}
              </span>
              <div>
                <div className={`text-lg font-semibold capitalize ${getStatusColor(clusterHealth?.overall_status || 'unknown').split(' ')[0]}`}>
                  {clusterHealth?.overall_status || 'unknown'}
                </div>
                {clusterHealth?.last_check && (
                  <p className="text-xs text-muted">
                    Last check: {new Date(clusterHealth.last_check).toLocaleString()}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
        
        <div className="space-y-3">
          {clusterHealth?.components
            .filter((component, index, self) => 
              // Supprimer les doublons basés sur component + component_type
              index === self.findIndex(c => c.component === component.component && c.component_type === component.component_type)
            )
            .map((component) => (
            <div 
              key={`${component.component}-${component.component_type}`}
              className={`p-4 rounded-lg transition-all hover:shadow-lg ${getStatusColor(component.status)}`}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <span className="text-xl">{getStatusIcon(component.status)}</span>
                    <h4 className="text-lg font-semibold text-primary">{component.component}</h4>
                    <span className="px-2 py-1 bg-violet-600/20 border border-violet-400/30 rounded text-xs text-violet-300">
                      {component.component_type}
                    </span>
                  </div>
                  
                  {component.details && (
                    <div className="ml-8 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 text-sm">
                      {Object.entries(JSON.parse(component.details)).slice(0, 8).map(([key, value]) => (
                        <div key={key} className="flex flex-col">
                          <span className="text-muted text-xs uppercase tracking-wide">{key}:</span>
                          <span className="text-secondary font-medium">{String(value)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                
                <div className="text-right ml-4">
                  <div className={`text-sm font-semibold capitalize mb-1 ${getStatusColor(component.status).split(' ')[0]}`}>
                    {component.status}
                  </div>
                  <p className="text-xs text-muted">
                    {new Date(component.last_check).toLocaleTimeString()}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="p-6 bg-glass border-glass rounded-xl">
        <h3 className="text-xl font-semibold mb-6 text-sky-400 flex items-center space-x-2">
          <span>ℹ️</span>
          <span>Cluster Information</span>
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="text-center p-4 bg-glass border-glass rounded-lg">
            <p className="text-muted text-sm mb-1">Cluster Name</p>
            <p className="text-primary font-bold text-lg">{clusterHealth?.cluster_name}</p>
          </div>
          <div className="text-center p-4 bg-glass border-glass rounded-lg">
            <p className="text-muted text-sm mb-1">Workspace</p>
            <p className="text-primary font-bold text-lg">{clusterHealth?.workspace}</p>
          </div>
          <div className="text-center p-4 bg-glass border-glass rounded-lg">
            <p className="text-muted text-sm mb-1">Components (Unique)</p>
            <p className="text-primary font-bold text-lg">
              {clusterHealth?.components
                .filter((component, index, self) => 
                  index === self.findIndex(c => c.component === component.component && c.component_type === component.component_type)
                ).length || 0}
            </p>
          </div>
          <div className="text-center p-4 bg-glass border-glass rounded-lg">
            <p className="text-muted text-sm mb-1">Health Status</p>
            <p className={`font-bold text-lg capitalize ${getStatusColor(clusterHealth?.overall_status || 'unknown').split(' ')[0]}`}>
              {clusterHealth?.overall_status || 'unknown'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}