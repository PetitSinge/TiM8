'use client'
import { useState, useEffect } from 'react'

export default function SimpleWorkspaces() {
  const [workspaces, setWorkspaces] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')

  const loadWorkspaces = async () => {
    try {
      console.log('Loading workspaces...')
      const response = await fetch('/api/workspaces')
      const data = await response.json()
      console.log('Workspaces loaded:', data)
      setWorkspaces(data)
    } catch (error) {
      console.error('Error loading workspaces:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadWorkspaces()
  }, [])

  const createWorkspace = async () => {
    console.log('Creating workspace:', { name, description })
    
    if (!name.trim()) {
      alert('Le nom est obligatoire')
      return
    }

    try {
      const response = await fetch('/api/workspaces/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          clusters: []
        })
      })

      console.log('Create response status:', response.status)
      const result = await response.json()
      console.log('Create response:', result)

      if (response.ok) {
        alert('Workspace créé !')
        setName('')
        setDescription('')
        loadWorkspaces() // Reload list
      } else {
        alert('Erreur lors de la création')
      }
    } catch (error) {
      console.error('Error creating workspace:', error)
      alert('Erreur lors de la création')
    }
  }

  const deleteWorkspace = async (id: string, workspaceName: string) => {
    console.log('Deleting workspace:', id, workspaceName)
    
    if (!confirm(`Supprimer "${workspaceName}" ?`)) {
      return
    }

    try {
      const response = await fetch(`/api/workspaces/${id}`, {
        method: 'DELETE'
      })

      console.log('Delete response status:', response.status)

      if (response.ok) {
        alert('Workspace supprimé !')
        loadWorkspaces() // Reload list
      } else {
        alert('Erreur lors de la suppression')
      }
    } catch (error) {
      console.error('Error deleting workspace:', error)
      alert('Erreur lors de la suppression')
    }
  }

  if (loading) {
    return <div className="p-8">Chargement...</div>
  }

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-8">🏗️ Workspaces Simples</h1>
      
      {/* Création */}
      <div className="bg-black/20 p-6 rounded-xl mb-8">
        <h2 className="text-xl font-semibold mb-4">Créer un Workspace</h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Nom *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Boubou, MonProjet..."
              className="w-full bg-black/40 border border-white/20 rounded px-3 py-2 text-white"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-2">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description optionnelle..."
              rows={2}
              className="w-full bg-black/40 border border-white/20 rounded px-3 py-2 text-white"
            />
          </div>
          
          <button
            onClick={createWorkspace}
            className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded font-semibold"
          >
            ✅ Créer
          </button>
        </div>
      </div>

      {/* Liste */}
      <div className="bg-black/20 p-6 rounded-xl">
        <h2 className="text-xl font-semibold mb-4">Mes Workspaces ({workspaces.length})</h2>
        
        {workspaces.length === 0 ? (
          <p className="text-gray-400">Aucun workspace pour le moment.</p>
        ) : (
          <div className="space-y-4">
            {workspaces.map((ws) => (
              <div key={ws.id} className="bg-black/30 p-4 rounded-lg flex justify-between items-center">
                <div>
                  <h3 className="font-semibold text-white">{ws.name}</h3>
                  <p className="text-sm text-gray-400">{ws.description}</p>
                  <p className="text-xs text-gray-500">ID: {ws.id}</p>
                </div>
                <button
                  onClick={() => deleteWorkspace(ws.id.toString(), ws.name)}
                  className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded text-sm"
                >
                  🗑️ Supprimer
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-8 text-sm text-gray-500">
        <p>Cette interface simple permet de tester la création/suppression de workspaces.</p>
        <p>Ouvre la console du navigateur (F12) pour voir les logs détaillés.</p>
      </div>
    </div>
  )
}