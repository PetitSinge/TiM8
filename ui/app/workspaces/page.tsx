'use client'
import { useEffect, useState } from 'react'

interface Workspace {
  id: string  // BIGINT as string to preserve precision
  name: string
  description: string
  clusters: string
  created_at: string
}

export default function WorkspacesManagement() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newWorkspace, setNewWorkspace] = useState({
    name: '',
    description: '',
    clusters: ''
  })

  // Centralized fetch function with no-cache
  const fetchWorkspaces = async () => {
    try {
      console.log('Fetching workspaces...')
      const response = await fetch('/api/workspaces', { cache: 'no-store' })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const data = await response.json()
      console.log('Fetched workspaces:', data)
      
      // Ensure IDs are strings
      const workspacesWithStringIds = data.map((ws: any) => ({
        ...ws,
        id: ws.id.toString()
      }))
      setWorkspaces(workspacesWithStringIds)
    } catch (error) {
      console.error('Failed to fetch workspaces:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchWorkspaces()
  }, [])

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newWorkspace.name.trim()) return
    
    try {
      console.log('Creating workspace:', newWorkspace.name)
      const response = await fetch('/api/workspaces/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newWorkspace.name.trim(),
          description: newWorkspace.description.trim() || '',
          clusters: [] // No clusters at creation
        }),
        cache: 'no-store'
      })
      
      if (response.ok) {
        console.log('Workspace created successfully')
        setShowCreateForm(false)
        setNewWorkspace({ name: '', description: '', clusters: '' })
        // Critical: Always re-fetch after mutation
        await fetchWorkspaces()
      } else {
        console.error('Create failed:', response.status)
        alert('Erreur lors de la création du workspace')
      }
    } catch (error) {
      console.error('Failed to create workspace:', error)
      alert('Erreur lors de la création du workspace')
    }
  }

  const handleDeleteWorkspace = async (workspaceId: string, workspaceName: string) => {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer le workspace "${workspaceName}" ?`)) {
      return
    }

    try {
      console.log('Deleting workspace:', workspaceId, workspaceName)
      const response = await fetch(`/api/workspaces/${encodeURIComponent(workspaceId)}`, {
        method: 'DELETE',
        cache: 'no-store'
      })
      
      console.log('Delete response status:', response.status)
      
      if (response.ok) {
        console.log('Workspace deleted successfully')
        // Critical: Always re-fetch after mutation to get fresh data
        await fetchWorkspaces()
      } else {
        console.error('Delete failed:', response.status, await response.text())
        alert('Erreur lors de la suppression du workspace')
        // Even on error, re-fetch to ensure UI state is correct
        await fetchWorkspaces()
      }
    } catch (error) {
      console.error('Failed to delete workspace:', error)
      alert('Erreur lors de la suppression du workspace')
      // Always re-fetch to be safe
      await fetchWorkspaces()
    }
  }

  const parseClusters = (clustersJson: string) => {
    try {
      return JSON.parse(clustersJson)
    } catch {
      return []
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-xl">Chargement des workspaces...</div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold bg-gradient-to-r from-purple-400 via-pink-400 to-purple-400 bg-clip-text text-transparent">
          🏗️ Gestion des Workspaces
        </h2>
        
        <button 
          onClick={() => setShowCreateForm(true)}
          className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-6 py-2 rounded-lg font-semibold transition-all"
        >
          ➕ Nouveau Workspace
        </button>
      </div>

      <p className="mb-8 text-gray-300">
        Créez des workspaces avec des noms personnalisés (ex: "Boubou", "MonProjet"). Vous assignerez les clusters plus tard.
      </p>

      {/* Workspaces List */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {workspaces.map((workspace) => {
          const clusters = parseClusters(workspace.clusters)
          
          return (
            <div 
              key={workspace.id}
              className="p-6 bg-glass border-glass rounded-xl hover:border-violet-400/50 transition-all group"
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-xl font-bold text-white mb-2">{workspace.name}</h3>
                  <p className="text-sm text-gray-400 mb-3">{workspace.description}</p>
                </div>
                
                <button
                  onClick={() => handleDeleteWorkspace(workspace.id, workspace.name)}
                  className="text-red-400 hover:text-red-300 text-sm opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Supprimer ce workspace"
                >
                  🗑️
                </button>
              </div>

              <div className="mb-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-400">Clusters:</span>
                    <span className="text-white font-semibold ml-2">{clusters.length}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Créé le:</span>
                    <span className="text-white font-semibold ml-2">
                      {new Date(workspace.created_at).toLocaleDateString('fr-FR')}
                    </span>
                  </div>
                </div>
                
                {clusters.length > 0 && (
                  <div className="mt-3">
                    <div className="flex flex-wrap gap-2">
                      {clusters.map((cluster: string, idx: number) => (
                        <span 
                          key={idx}
                          className="px-2 py-1 bg-purple-600/20 border border-purple-400/30 rounded text-xs text-purple-300"
                        >
                          {cluster}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {workspaces.length === 0 && (
        <div className="text-center py-12">
          <div className="text-4xl mb-4">🏗️</div>
          <p className="text-lg text-gray-400 mb-2">Aucun workspace configuré</p>
          <p className="text-sm text-gray-500">Créez votre premier workspace pour commencer !</p>
        </div>
      )}

      {/* Create Workspace Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-black/90 border border-white/20 rounded-xl p-6 w-full max-w-md">
            <h3 className="text-xl font-bold mb-4 text-white">Créer un nouveau Workspace</h3>
            
            <form onSubmit={handleCreateWorkspace} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Titre du Workspace *</label>
                <input
                  type="text"
                  required
                  value={newWorkspace.name}
                  onChange={(e) => setNewWorkspace({...newWorkspace, name: e.target.value})}
                  className="w-full bg-glass border-glass rounded px-3 py-2 text-primary focus-ring"
                  placeholder="Ex: Boubou, MonProjet, TestEnv, ProdFinance..."
                />
                <p className="text-xs text-gray-500 mt-1">
                  Donnez un nom personnalisé à votre workspace
                </p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Description (optionnelle)</label>
                <textarea
                  value={newWorkspace.description}
                  onChange={(e) => setNewWorkspace({...newWorkspace, description: e.target.value})}
                  className="w-full bg-glass border-glass rounded px-3 py-2 text-primary focus-ring"
                  placeholder="Courte description de ce workspace..."
                  rows={2}
                />
              </div>
              
              <div className="p-3 bg-purple-900/10 border border-purple-400/20 rounded-lg">
                <div className="flex items-center space-x-2 mb-1">
                  <span className="text-purple-400">ℹ️</span>
                  <span className="text-sm font-medium text-purple-300">Information</span>
                </div>
                <p className="text-xs text-gray-400">
                  Les clusters seront assignés plus tard depuis la page Clusters • Date de création : automatique
                </p>
              </div>
              
              <div className="flex justify-end space-x-4 mt-6">
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-lg font-semibold transition-colors"
                >
                  Créer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}