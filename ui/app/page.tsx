'use client'
import { useEffect, useState } from 'react'

interface Workspace {
  id: number
  name: string
  description: string
  clusters: string[]
}

interface Incident {
  id: number
  title: string
  workspace: string
  cluster: string
  status: string
  created_at: string
}

interface MTTRStat {
  workspace: string
  avg_mttr_seconds: number
  incident_count: number
}

export default function Dashboard() {
  const [dashboardData, setDashboardData] = useState<{
    workspaces: Workspace[]
    recent_incidents: Incident[]
    mttr_stats: MTTRStat[]
  } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const response = await fetch('/api/dashboard/overview')
        const data = await response.json()
        setDashboardData(data)
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchDashboardData()
  }, [])

  const formatMTTR = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`
    if (seconds < 3600) return `${Math.round(seconds / 60)}min`
    return `${Math.round(seconds / 3600)}h`
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-xl">Loading dashboard...</div>
      </div>
    )
  }

  return (
    <div>
      <h2 className="text-3xl font-bold mb-4 bg-gradient-to-r from-yellow-400 via-orange-400 to-yellow-400 bg-clip-text text-transparent">
        🧭 TiM8 Dashboard
      </h2>
      <p className="mb-8 text-gray-300">Santé globale des clusters par workspace</p>

      {/* Workspaces Health Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mb-10">
        {dashboardData?.workspaces.map((workspace) => {
          const mttrStat = dashboardData.mttr_stats.find(m => m.workspace === workspace.name)
          
          return (
            <div 
              key={workspace.id} 
              className="p-6 border-2 border-yellow-400/20 bg-black/30 rounded-xl backdrop-blur-sm hover:border-yellow-400/40 transition-all"
            >
              <h3 className="text-xl font-semibold text-yellow-400 mb-2">{workspace.name}</h3>
              <p className="text-sm text-gray-400 mb-3">{workspace.description}</p>
              <div className="space-y-2">
                <p className="flex justify-between">
                  <span>Status:</span> 
                  <span className="text-green-400">✅ Healthy</span>
                </p>
                <p className="flex justify-between">
                  <span>Clusters:</span> 
                  <span className="text-cyan-300">{workspace.clusters?.length || 0}</span>
                </p>
                <p className="flex justify-between">
                  <span>MTTR:</span> 
                  <span className="text-orange-300">{mttrStat ? formatMTTR(mttrStat.avg_mttr_seconds) : 'N/A'}</span>
                </p>
                <p className="flex justify-between">
                  <span>Incidents:</span> 
                  <span className="text-red-300">{mttrStat?.incident_count || 0}</span>
                </p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Recent Incidents */}
      <div className="p-6 border-2 border-red-400/20 bg-black/30 rounded-xl backdrop-blur-sm">
        <h3 className="text-2xl font-semibold mb-4 text-red-400">🔥 Recent Incidents</h3>
        {dashboardData?.recent_incidents.length === 0 ? (
          <p className="text-green-400">✨ No recent incidents - All systems healthy!</p>
        ) : (
          <div className="space-y-3">
            {dashboardData?.recent_incidents.map((incident) => (
              <div 
                key={incident.id} 
                className="p-4 border border-white/10 bg-black/20 rounded-lg hover:bg-black/40 transition-all"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-semibold text-white">{incident.title}</h4>
                    <p className="text-sm text-gray-400">
                      {incident.workspace} / {incident.cluster}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className={`px-2 py-1 rounded text-xs ${
                      incident.status === 'resolved' 
                        ? 'bg-green-600/20 text-green-300' 
                        : 'bg-red-600/20 text-red-300'
                    }`}>
                      {incident.status}
                    </span>
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(incident.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}