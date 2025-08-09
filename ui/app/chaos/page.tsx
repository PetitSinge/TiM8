'use client'
import { useState, useEffect } from 'react'

interface ChaosExperiment {
  id: string
  name: string
  description: string
  icon: string
  category: 'pod' | 'node' | 'network' | 'storage' | 'cpu' | 'memory'
  duration: number
  impact: 'low' | 'medium' | 'high'
  parameters: Record<string, any>
}

interface ExperimentRun {
  id: string
  experimentId: string
  status: 'running' | 'completed' | 'failed' | 'scheduled'
  startedAt: string
  completedAt?: string
  results?: string
  workspace: string
  cluster: string
}

export default function ChaosMonkey() {
  const [experiments] = useState<ChaosExperiment[]>([
    {
      id: 'pod-killer',
      name: 'Pod Killer',
      description: 'Randomly terminate pods to test recovery mechanisms',
      icon: '💥',
      category: 'pod',
      duration: 300,
      impact: 'medium',
      parameters: { namespace: '', replicas: 1, interval: 60 }
    },
    {
      id: 'node-drain',
      name: 'Node Drain',
      description: 'Drain a node to test pod rescheduling',
      icon: '🌊',
      category: 'node',
      duration: 600,
      impact: 'high',
      parameters: { node: '', gracePeriod: 60 }
    },
    {
      id: 'network-latency',
      name: 'Network Latency',
      description: 'Inject network delays between pods',
      icon: '🐌',
      category: 'network',
      duration: 120,
      impact: 'low',
      parameters: { delay: '100ms', jitter: '10ms', loss: '1%' }
    },
    {
      id: 'disk-pressure',
      name: 'Disk Pressure',
      description: 'Simulate high disk usage',
      icon: '💾',
      category: 'storage',
      duration: 180,
      impact: 'medium',
      parameters: { size: '1GB', mountPath: '/tmp' }
    },
    {
      id: 'cpu-stress',
      name: 'CPU Stress',
      description: 'Generate high CPU load',
      icon: '⚡',
      category: 'cpu',
      duration: 150,
      impact: 'high',
      parameters: { workers: 2, load: '80%' }
    },
    {
      id: 'memory-pressure',
      name: 'Memory Pressure',
      description: 'Consume memory to trigger OOM conditions',
      icon: '🧠',
      category: 'memory',
      duration: 90,
      impact: 'high',
      parameters: { size: '512MB', duration: 60 }
    }
  ])

  const [experimentRuns, setExperimentRuns] = useState<ExperimentRun[]>([])
  const [selectedExperiment, setSelectedExperiment] = useState<ChaosExperiment | null>(null)
  const [showRunModal, setShowRunModal] = useState(false)
  const [runConfig, setRunConfig] = useState({
    workspace: 'TiM8-Local',
    cluster: 'incident-copilot',
    namespace: 'default',
    parameters: {}
  })
  const [activeCategory, setActiveCategory] = useState<string>('all')

  useEffect(() => {
    // Simulate some past runs
    setExperimentRuns([
      {
        id: 'run-1',
        experimentId: 'pod-killer',
        status: 'completed',
        startedAt: new Date(Date.now() - 3600000).toISOString(),
        completedAt: new Date(Date.now() - 3300000).toISOString(),
        results: 'Successfully tested pod recovery. All pods restarted within 30 seconds.',
        workspace: 'TiM8-Local',
        cluster: 'incident-copilot'
      },
      {
        id: 'run-2',
        experimentId: 'network-latency',
        status: 'running',
        startedAt: new Date(Date.now() - 60000).toISOString(),
        workspace: 'TiM8-Local',
        cluster: 'incident-copilot'
      }
    ])
  }, [])

  const handleRunExperiment = (experiment: ChaosExperiment) => {
    setSelectedExperiment(experiment)
    setRunConfig({
      ...runConfig,
      parameters: { ...experiment.parameters }
    })
    setShowRunModal(true)
  }

  const handleStartExperiment = () => {
    if (!selectedExperiment) return
    
    const newRun: ExperimentRun = {
      id: `run-${Date.now()}`,
      experimentId: selectedExperiment.id,
      status: 'running',
      startedAt: new Date().toISOString(),
      workspace: runConfig.workspace,
      cluster: runConfig.cluster
    }
    
    setExperimentRuns(prev => [newRun, ...prev])
    setShowRunModal(false)
    setSelectedExperiment(null)
    
    // Simulate completion after experiment duration
    setTimeout(() => {
      setExperimentRuns(prev => 
        prev.map(run => 
          run.id === newRun.id 
            ? { 
                ...run, 
                status: 'completed' as const,
                completedAt: new Date().toISOString(),
                results: `Chaos experiment "${selectedExperiment.name}" completed successfully. System resilience validated.`
              }
            : run
        )
      )
    }, 5000) // Simulate 5s instead of real duration for demo
  }

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'low': return 'text-green-400 border-green-400/20 bg-green-400/10'
      case 'medium': return 'text-yellow-400 border-yellow-400/20 bg-yellow-400/10'
      case 'high': return 'text-red-400 border-red-400/20 bg-red-400/10'
      default: return 'text-gray-400 border-gray-400/20 bg-gray-400/10'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': return 'text-blue-400 bg-blue-400/10 border-blue-400/20'
      case 'completed': return 'text-green-400 bg-green-400/10 border-green-400/20'
      case 'failed': return 'text-red-400 bg-red-400/10 border-red-400/20'
      case 'scheduled': return 'text-purple-400 bg-purple-400/10 border-purple-400/20'
      default: return 'text-gray-400 bg-gray-400/10 border-gray-400/20'
    }
  }

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'pod': return 'from-blue-400 to-cyan-400'
      case 'node': return 'from-purple-400 to-pink-400'
      case 'network': return 'from-green-400 to-emerald-400'
      case 'storage': return 'from-orange-400 to-red-400'
      case 'cpu': return 'from-yellow-400 to-orange-400'
      case 'memory': return 'from-red-400 to-pink-400'
      default: return 'from-gray-400 to-slate-400'
    }
  }

  const filteredExperiments = activeCategory === 'all' 
    ? experiments 
    : experiments.filter(exp => exp.category === activeCategory)

  const categories = ['all', ...Array.from(new Set(experiments.map(exp => exp.category)))]
  const runningExperiments = experimentRuns.filter(run => run.status === 'running').length

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold bg-gradient-to-r from-red-400 via-orange-400 to-yellow-400 bg-clip-text text-transparent">
          🧨 Chaos Engineering
        </h2>
        
        <div className="flex items-center space-x-4">
          {runningExperiments > 0 && (
            <div className="flex items-center space-x-2 bg-blue-600/20 border border-blue-400/30 rounded-lg px-4 py-2">
              <div className="w-3 h-3 bg-blue-400 rounded-full animate-pulse"></div>
              <span className="text-blue-300 font-semibold">{runningExperiments} Running</span>
            </div>
          )}
        </div>
      </div>

      <p className="mb-8 text-gray-300">
        Test your system's resilience with controlled chaos experiments. Validate recovery mechanisms and improve system reliability.
      </p>

      {/* Safety Warning */}
      <div className="mb-8 p-4 bg-red-900/20 border border-red-400/30 rounded-xl">
        <div className="flex items-start space-x-3">
          <span className="text-2xl">⚠️</span>
          <div>
            <h3 className="text-red-400 font-semibold mb-1">Safety First!</h3>
            <p className="text-sm text-gray-300">
              Always run chaos experiments in non-production environments first. 
              Ensure you have proper monitoring and rollback procedures in place.
            </p>
          </div>
        </div>
      </div>

      {/* Category Filter */}
      <div className="flex flex-wrap gap-2 mb-6">
        {categories.map(category => (
          <button
            key={category}
            onClick={() => setActiveCategory(category)}
            className={`px-4 py-2 rounded-lg font-semibold transition-all capitalize ${
              activeCategory === category
                ? `bg-gradient-to-r ${getCategoryColor(category)} text-black`
                : 'bg-black/30 text-gray-400 hover:text-white hover:bg-black/50'
            }`}
          >
            {category}
          </button>
        ))}
      </div>

      {/* Experiments Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mb-10">
        {filteredExperiments.map((experiment) => (
          <div 
            key={experiment.id}
            className="p-6 bg-black/30 border border-white/10 rounded-xl backdrop-blur-sm hover:border-white/20 transition-all group"
          >
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center space-x-3">
                <span className="text-3xl">{experiment.icon}</span>
                <div>
                  <h3 className="text-xl font-bold text-white">{experiment.name}</h3>
                  <p className="text-sm text-gray-400 capitalize">{experiment.category}</p>
                </div>
              </div>
              
              <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getImpactColor(experiment.impact)}`}>
                {experiment.impact} impact
              </span>
            </div>

            <p className="text-gray-300 mb-4 text-sm leading-relaxed">
              {experiment.description}
            </p>

            <div className="flex justify-between items-center text-sm text-gray-400 mb-4">
              <span>Duration: {Math.floor(experiment.duration / 60)}m {experiment.duration % 60}s</span>
              <span>Category: {experiment.category}</span>
            </div>

            <button
              onClick={() => handleRunExperiment(experiment)}
              className="w-full bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white py-3 px-4 rounded-lg font-semibold transition-all group-hover:shadow-lg"
            >
              🚀 Run Experiment
            </button>
          </div>
        ))}
      </div>

      {/* Recent Experiment Runs */}
      <div className="bg-black/30 rounded-xl border border-white/10 overflow-hidden">
        <div className="p-6 border-b border-white/10">
          <h3 className="text-2xl font-bold text-white mb-2">Recent Experiment Runs</h3>
          <p className="text-gray-400">Track the status and results of your chaos experiments</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-black/50">
              <tr className="text-left">
                <th className="p-4 text-gray-300 font-semibold">Experiment</th>
                <th className="p-4 text-gray-300 font-semibold">Status</th>
                <th className="p-4 text-gray-300 font-semibold">Environment</th>
                <th className="p-4 text-gray-300 font-semibold">Started</th>
                <th className="p-4 text-gray-300 font-semibold">Duration</th>
                <th className="p-4 text-gray-300 font-semibold">Results</th>
              </tr>
            </thead>
            <tbody>
              {experimentRuns.map((run) => {
                const experiment = experiments.find(exp => exp.id === run.experimentId)
                const duration = run.completedAt 
                  ? Math.round((new Date(run.completedAt).getTime() - new Date(run.startedAt).getTime()) / 1000)
                  : Math.round((Date.now() - new Date(run.startedAt).getTime()) / 1000)
                
                return (
                  <tr key={run.id} className="border-t border-white/10 hover:bg-white/5">
                    <td className="p-4">
                      <div className="flex items-center space-x-3">
                        <span className="text-2xl">{experiment?.icon}</span>
                        <div>
                          <div className="font-semibold text-white">{experiment?.name}</div>
                          <div className="text-xs text-gray-400">#{run.id}</div>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getStatusColor(run.status)}`}>
                        {run.status === 'running' && '🏃'} {run.status}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="text-sm">
                        <div className="text-white">{run.workspace}</div>
                        <div className="text-gray-400">{run.cluster}</div>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="text-sm text-gray-300">
                        {new Date(run.startedAt).toLocaleString()}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="text-sm text-gray-300">
                        {Math.floor(duration / 60)}m {duration % 60}s
                      </div>
                    </td>
                    <td className="p-4">
                      {run.results ? (
                        <div className="text-sm text-green-400 max-w-xs truncate" title={run.results}>
                          {run.results}
                        </div>
                      ) : run.status === 'running' ? (
                        <div className="text-sm text-blue-400">In progress...</div>
                      ) : (
                        <div className="text-sm text-gray-500">-</div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          
          {experimentRuns.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <div className="text-4xl mb-4">🧪</div>
              <p className="text-lg">No experiments run yet</p>
              <p className="text-sm">Start your first chaos experiment to test system resilience!</p>
            </div>
          )}
        </div>
      </div>

      {/* Run Experiment Modal */}
      {showRunModal && selectedExperiment && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-black/90 border border-white/20 rounded-xl p-6 w-full max-w-md">
            <div className="flex items-center space-x-3 mb-4">
              <span className="text-3xl">{selectedExperiment.icon}</span>
              <h3 className="text-xl font-bold text-white">{selectedExperiment.name}</h3>
            </div>
            
            <p className="text-gray-300 mb-6">{selectedExperiment.description}</p>
            
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Workspace</label>
                <select
                  value={runConfig.workspace}
                  onChange={(e) => setRunConfig({...runConfig, workspace: e.target.value})}
                  className="w-full bg-black/40 border border-white/20 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-400/50"
                >
                  <option value="TiM8-Local">TiM8-Local</option>
                  <option value="Dev">Dev</option>
                  <option value="Staging">Staging</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Cluster</label>
                <input
                  type="text"
                  value={runConfig.cluster}
                  onChange={(e) => setRunConfig({...runConfig, cluster: e.target.value})}
                  className="w-full bg-black/40 border border-white/20 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-400/50"
                  placeholder="incident-copilot"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Namespace</label>
                <input
                  type="text"
                  value={runConfig.namespace}
                  onChange={(e) => setRunConfig({...runConfig, namespace: e.target.value})}
                  className="w-full bg-black/40 border border-white/20 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-400/50"
                  placeholder="default"
                />
              </div>

              <div className={`p-4 rounded-lg border ${getImpactColor(selectedExperiment.impact)}`}>
                <div className="flex justify-between items-center mb-2">
                  <span className="font-semibold">Impact Level: {selectedExperiment.impact}</span>
                  <span>Duration: {Math.floor(selectedExperiment.duration / 60)}m</span>
                </div>
                <p className="text-sm opacity-80">
                  This experiment will run for {Math.floor(selectedExperiment.duration / 60)} minutes and may cause temporary service disruption.
                </p>
              </div>
            </div>
            
            <div className="flex justify-end space-x-4">
              <button
                onClick={() => setShowRunModal(false)}
                className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleStartExperiment}
                className="bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white px-6 py-2 rounded-lg font-semibold transition-all"
              >
                🚀 Start Experiment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}