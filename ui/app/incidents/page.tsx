'use client'
import { useEffect, useState } from 'react'

interface Incident {
  id: number
  title: string
  cluster: string
  namespace: string
  app: string
  workspace: string
  status: 'open' | 'mitigating' | 'resolved'
  suspect?: string
  summary?: string
  resolution?: string
  mttr_seconds?: number
  created_at: string
}

interface NewIncident {
  title: string
  cluster: string
  namespace: string
  app: string
  workspace: string
}

export default function Incidents() {
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'open' | 'mitigating' | 'resolved'>('all')
  const [workspaceFilter, setWorkspaceFilter] = useState<string>('all')
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [workspaces, setWorkspaces] = useState<string[]>([])
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null)
  const [newIncident, setNewIncident] = useState<NewIncident>({
    title: '',
    cluster: '',
    namespace: '',
    app: '',
    workspace: ''
  })

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch incidents
        const incidentsResponse = await fetch('/api/incidents/recent?limit=50')
        const incidentsData = await incidentsResponse.json()
        setIncidents(incidentsData)

        // Fetch workspaces
        const workspacesResponse = await fetch('/api/workspaces')
        const workspacesData = await workspacesResponse.json()
        setWorkspaces(workspacesData.map((w: any) => w.name))
      } catch (error) {
        console.error('Failed to fetch data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
    // Refresh every minute
    const interval = setInterval(fetchData, 60000)
    return () => clearInterval(interval)
  }, [])

  const handleCreateIncident = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const response = await fetch('/incidents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newIncident)
      })
      
      if (response.ok) {
        setShowCreateForm(false)
        setNewIncident({ title: '', cluster: '', namespace: '', app: '', workspace: '' })
        // Refresh incidents list
        window.location.reload()
      }
    } catch (error) {
      console.error('Failed to create incident:', error)
    }
  }

  const handleStatusChange = async (incidentId: number, newStatus: string) => {
    try {
      if (newStatus === 'resolved') {
        await fetch(`/incidents/${incidentId}/resolve`, { method: 'POST' })
      }
      // Refresh incidents list
      window.location.reload()
    } catch (error) {
      console.error('Failed to update incident:', error)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'text-red-400 bg-red-400/10 border-red-400/20'
      case 'mitigating': return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20'
      case 'resolved': return 'text-green-400 bg-green-400/10 border-green-400/20'
      default: return 'text-gray-400 bg-gray-400/10 border-gray-400/20'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'open': return '🔥'
      case 'mitigating': return '🚧'
      case 'resolved': return '✅'
      default: return '❓'
    }
  }

  const getPriorityFromAge = (createdAt: string) => {
    const hours = (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60)
    if (hours > 4) return { level: 'High', color: 'text-red-400' }
    if (hours > 1) return { level: 'Medium', color: 'text-yellow-400' }
    return { level: 'Low', color: 'text-green-400' }
  }

  const formatMTTR = (seconds?: number) => {
    if (!seconds) return 'N/A'
    if (seconds < 60) return `${seconds}s`
    if (seconds < 3600) return `${Math.round(seconds / 60)}min`
    return `${Math.round(seconds / 3600)}h`
  }

  const filteredIncidents = incidents.filter(incident => {
    const statusMatch = filter === 'all' || incident.status === filter
    const workspaceMatch = workspaceFilter === 'all' || incident.workspace === workspaceFilter
    return statusMatch && workspaceMatch
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-xl">Loading incidents...</div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold bg-gradient-to-r from-red-400 via-orange-400 to-red-400 bg-clip-text text-transparent">
          🔥 Incident Management
        </h2>
        
        <button 
          onClick={() => setShowCreateForm(true)}
          className="bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700 text-white px-6 py-2 rounded-lg font-semibold transition-all"
        >
          ➕ Create Incident
        </button>
      </div>

      <p className="mb-6 text-gray-300">
        Comprehensive incident lifecycle management with AI-powered analysis
      </p>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-6 p-4 bg-black/30 rounded-xl">
        <div className="flex items-center space-x-2">
          <span className="text-gray-400 text-sm">Status:</span>
          <select 
            value={filter}
            onChange={(e) => setFilter(e.target.value as any)}
            className="bg-black/40 border border-white/20 rounded px-3 py-1 text-sm text-white focus:outline-none focus:border-blue-400/50"
          >
            <option value="all">All Statuses</option>
            <option value="open">Open</option>
            <option value="mitigating">Mitigating</option>
            <option value="resolved">Resolved</option>
          </select>
        </div>
        
        <div className="flex items-center space-x-2">
          <span className="text-gray-400 text-sm">Workspace:</span>
          <select 
            value={workspaceFilter}
            onChange={(e) => setWorkspaceFilter(e.target.value)}
            className="bg-black/40 border border-white/20 rounded px-3 py-1 text-sm text-white focus:outline-none focus:border-blue-400/50"
          >
            <option value="all">All Workspaces</option>
            {workspaces.map(ws => (
              <option key={ws} value={ws}>{ws}</option>
            ))}
          </select>
        </div>

        <div className="ml-auto text-sm text-gray-400">
          Showing {filteredIncidents.length} of {incidents.length} incidents
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        {['open', 'mitigating', 'resolved'].map(status => {
          const count = incidents.filter(i => i.status === status).length
          return (
            <div key={status} className={`p-4 rounded-xl border-2 backdrop-blur-sm ${getStatusColor(status)}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm opacity-80 capitalize">{status}</p>
                  <p className="text-2xl font-bold">{count}</p>
                </div>
                <span className="text-2xl">{getStatusIcon(status)}</span>
              </div>
            </div>
          )
        })}
        
        <div className="p-4 rounded-xl border-2 border-blue-400/20 bg-blue-400/10 text-blue-400">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm opacity-80">Avg MTTR</p>
              <p className="text-2xl font-bold">
                {formatMTTR(incidents.filter(i => i.mttr_seconds).reduce((acc, i) => acc + (i.mttr_seconds || 0), 0) / incidents.filter(i => i.mttr_seconds).length)}
              </p>
            </div>
            <span className="text-2xl">⏱️</span>
          </div>
        </div>
      </div>

      {/* Incidents Table */}
      <div className="bg-black/30 rounded-xl overflow-hidden border border-white/10">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-black/50">
              <tr className="text-left">
                <th className="p-4 text-gray-300 font-semibold">Incident</th>
                <th className="p-4 text-gray-300 font-semibold">Status</th>
                <th className="p-4 text-gray-300 font-semibold">Priority</th>
                <th className="p-4 text-gray-300 font-semibold">Scope</th>
                <th className="p-4 text-gray-300 font-semibold">Age</th>
                <th className="p-4 text-gray-300 font-semibold">MTTR</th>
                <th className="p-4 text-gray-300 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredIncidents.map((incident) => {
                const priority = getPriorityFromAge(incident.created_at)
                const age = Math.round((Date.now() - new Date(incident.created_at).getTime()) / (1000 * 60))
                
                return (
                  <tr 
                    key={incident.id} 
                    className="border-t border-white/10 hover:bg-white/5 transition-colors cursor-pointer"
                    onClick={() => setSelectedIncident(incident)}
                  >
                    <td className="p-4">
                      <div>
                        <div className="font-semibold text-white mb-1">{incident.title}</div>
                        <div className="text-xs text-gray-400">#{incident.id}</div>
                        {incident.suspect && (
                          <div className="text-xs text-orange-400 mt-1">Suspect: {incident.suspect}</div>
                        )}
                      </div>
                    </td>
                    <td className="p-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getStatusColor(incident.status)}`}>
                        {getStatusIcon(incident.status)} {incident.status}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className={`font-semibold ${priority.color}`}>
                        {priority.level}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="text-sm">
                        <div className="text-white">{incident.workspace}</div>
                        <div className="text-gray-400">{incident.cluster}/{incident.namespace}/{incident.app}</div>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="text-sm text-gray-300">
                        {age < 60 ? `${age}min` : `${Math.round(age / 60)}h`}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="text-sm text-gray-300">
                        {formatMTTR(incident.mttr_seconds)}
                      </div>
                    </td>
                    <td className="p-4">
                      {incident.status !== 'resolved' && (
                        <div className="flex space-x-2">
                          {incident.status === 'open' && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleStatusChange(incident.id, 'mitigating')
                              }}
                              className="px-3 py-1 bg-yellow-600/20 hover:bg-yellow-600/30 border border-yellow-400/30 rounded text-xs font-semibold text-yellow-300 transition-colors"
                            >
                              Start Mitigation
                            </button>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleStatusChange(incident.id, 'resolved')
                            }}
                            className="px-3 py-1 bg-green-600/20 hover:bg-green-600/30 border border-green-400/30 rounded text-xs font-semibold text-green-300 transition-colors"
                          >
                            Resolve
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {filteredIncidents.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <div className="text-4xl mb-4">🎉</div>
            <p className="text-lg">No incidents found</p>
            <p className="text-sm">All systems are running smoothly!</p>
          </div>
        )}
      </div>

      {/* Create Incident Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-black/80 border border-white/20 rounded-xl p-6 w-full max-w-md">
            <h3 className="text-xl font-bold mb-4 text-white">Create New Incident</h3>
            
            <form onSubmit={handleCreateIncident} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Title *</label>
                <input
                  type="text"
                  required
                  value={newIncident.title}
                  onChange={(e) => setNewIncident({...newIncident, title: e.target.value})}
                  className="w-full bg-black/40 border border-white/20 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-400/50"
                  placeholder="Brief description of the incident"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Cluster *</label>
                  <input
                    type="text"
                    required
                    value={newIncident.cluster}
                    onChange={(e) => setNewIncident({...newIncident, cluster: e.target.value})}
                    className="w-full bg-black/40 border border-white/20 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-400/50"
                    placeholder="cluster-name"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Namespace *</label>
                  <input
                    type="text"
                    required
                    value={newIncident.namespace}
                    onChange={(e) => setNewIncident({...newIncident, namespace: e.target.value})}
                    className="w-full bg-black/40 border border-white/20 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-400/50"
                    placeholder="default"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">App *</label>
                  <input
                    type="text"
                    required
                    value={newIncident.app}
                    onChange={(e) => setNewIncident({...newIncident, app: e.target.value})}
                    className="w-full bg-black/40 border border-white/20 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-400/50"
                    placeholder="app-name"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Workspace *</label>
                  <select
                    required
                    value={newIncident.workspace}
                    onChange={(e) => setNewIncident({...newIncident, workspace: e.target.value})}
                    className="w-full bg-black/40 border border-white/20 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-400/50"
                  >
                    <option value="">Select workspace</option>
                    {workspaces.map(ws => (
                      <option key={ws} value={ws}>{ws}</option>
                    ))}
                  </select>
                </div>
              </div>
              
              <div className="flex justify-end space-x-4 mt-6">
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg font-semibold transition-colors"
                >
                  Create Incident
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Incident Detail Modal */}
      {selectedIncident && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-black/90 border border-white/20 rounded-xl p-6 w-full max-w-4xl max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-2xl font-bold text-white mb-2">{selectedIncident.title}</h3>
                <div className="flex items-center space-x-4">
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getStatusColor(selectedIncident.status)}`}>
                    {getStatusIcon(selectedIncident.status)} {selectedIncident.status}
                  </span>
                  <span className="text-gray-400">#{selectedIncident.id}</span>
                  <span className="text-gray-400">{new Date(selectedIncident.created_at).toLocaleString()}</span>
                </div>
              </div>
              <button
                onClick={() => setSelectedIncident(null)}
                className="text-gray-400 hover:text-white text-2xl"
              >
                ×
              </button>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                {selectedIncident.summary && (
                  <div className="mb-6">
                    <h4 className="text-lg font-semibold text-white mb-3">AI Analysis</h4>
                    <div className="bg-black/30 p-4 rounded-lg border border-blue-400/20">
                      <pre className="text-sm text-gray-300 whitespace-pre-wrap">{selectedIncident.summary}</pre>
                    </div>
                  </div>
                )}
                
                {selectedIncident.resolution && (
                  <div className="mb-6">
                    <h4 className="text-lg font-semibold text-white mb-3">Resolution</h4>
                    <div className="bg-black/30 p-4 rounded-lg border border-green-400/20">
                      <pre className="text-sm text-gray-300 whitespace-pre-wrap">{selectedIncident.resolution}</pre>
                    </div>
                  </div>
                )}
              </div>
              
              <div>
                <h4 className="text-lg font-semibold text-white mb-3">Incident Details</h4>
                <div className="space-y-3 text-sm">
                  <div>
                    <span className="text-gray-400">Workspace:</span>
                    <span className="text-white ml-2 font-semibold">{selectedIncident.workspace}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Cluster:</span>
                    <span className="text-white ml-2">{selectedIncident.cluster}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Namespace:</span>
                    <span className="text-white ml-2">{selectedIncident.namespace}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Application:</span>
                    <span className="text-white ml-2">{selectedIncident.app}</span>
                  </div>
                  {selectedIncident.suspect && (
                    <div>
                      <span className="text-gray-400">Suspect:</span>
                      <span className="text-orange-400 ml-2">{selectedIncident.suspect}</span>
                    </div>
                  )}
                  {selectedIncident.mttr_seconds && (
                    <div>
                      <span className="text-gray-400">MTTR:</span>
                      <span className="text-green-400 ml-2 font-semibold">{formatMTTR(selectedIncident.mttr_seconds)}</span>
                    </div>
                  )}
                </div>
                
                {selectedIncident.status !== 'resolved' && (
                  <div className="mt-6 space-y-3">
                    <h4 className="text-lg font-semibold text-white">Actions</h4>
                    {selectedIncident.status === 'open' && (
                      <button
                        onClick={() => {
                          handleStatusChange(selectedIncident.id, 'mitigating')
                          setSelectedIncident(null)
                        }}
                        className="w-full bg-yellow-600/20 hover:bg-yellow-600/30 border border-yellow-400/30 rounded-lg py-2 px-4 text-yellow-300 font-semibold transition-colors"
                      >
                        🚧 Start Mitigation
                      </button>
                    )}
                    <button
                      onClick={() => {
                        handleStatusChange(selectedIncident.id, 'resolved')
                        setSelectedIncident(null)
                      }}
                      className="w-full bg-green-600/20 hover:bg-green-600/30 border border-green-400/30 rounded-lg py-2 px-4 text-green-300 font-semibold transition-colors"
                    >
                      ✅ Mark Resolved
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}