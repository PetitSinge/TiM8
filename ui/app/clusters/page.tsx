'use client';

import { useEffect, useState } from 'react';
import AddClusterModal from '../components/AddClusterModal';

type Cluster = {
  id: string;
  name: string;
  workspace: string;
  mode: 'agent'|'kubeconfig';
  status: 'connected'|'error'|'unknown';
  last_sync?: string | null;
  namespaces?: string[];
};

export default function ClustersPage() {
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      const r = await fetch('/api/clusters', { cache: 'no-store' });
      if (!r.ok) return;
      const data = await r.json() as Cluster[];
      setClusters(data.map(c => ({ ...c, id: String(c.id) })));
    } catch (error) {
      console.error('Failed to load clusters:', error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { 
    load();
    // Auto-refresh every 30 seconds
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected': return 'bg-emerald-600/20 border-emerald-400/30 text-emerald-300';
      case 'error': return 'bg-red-600/20 border-red-400/30 text-red-300';
      default: return 'bg-amber-600/20 border-amber-400/30 text-amber-300';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected': return '✅';
      case 'error': return '🔴';
      default: return '⚠️';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-xl">Loading clusters...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-3xl font-bold bg-gradient-to-r from-sky-400 to-cyan-400 bg-clip-text text-transparent">
            📡 Clusters
          </h2>
          <p className="text-gray-400 mt-2">Manage external clusters with TiM8 monitoring</p>
        </div>
        <button 
          onClick={() => setOpen(true)} 
          className="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-semibold transition-all"
        >
          + Add Cluster
        </button>
      </div>

      {clusters.length === 0 && (
        <div className="text-center py-12 bg-black/20 rounded-xl border border-white/10">
          <div className="text-4xl mb-4">🏗️</div>
          <h3 className="text-xl font-semibold mb-2">No clusters registered</h3>
          <p className="text-gray-400 mb-4">Start monitoring external clusters with TiM8</p>
          <button 
            onClick={() => setOpen(true)}
            className="px-6 py-3 bg-sky-600 hover:bg-sky-500 rounded-lg text-white font-semibold"
          >
            Add Your First Cluster
          </button>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {clusters.map(c => (
          <div key={c.id} className="p-6 rounded-xl bg-black/20 border border-white/10 hover:border-white/20 transition-all">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-white">{c.name}</h3>
                <p className="text-sm text-gray-400">{c.workspace} workspace</p>
              </div>
              <div className="text-right">
                <div className="text-2xl mb-1">{getStatusIcon(c.status)}</div>
                <span className={`text-xs px-2 py-1 rounded ${getStatusColor(c.status)}`}>
                  {c.status}
                </span>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-400">Mode:</span>
                <span className="text-white capitalize">{c.mode}</span>
              </div>
              
              {c.namespaces && c.namespaces.length > 0 && (
                <div>
                  <p className="text-sm text-gray-400 mb-2">Monitored namespaces:</p>
                  <div className="flex flex-wrap gap-1">
                    {c.namespaces.slice(0, 3).map((ns, idx) => (
                      <span key={idx} className="text-xs px-2 py-1 bg-violet-600/20 border border-violet-400/30 rounded text-violet-300">
                        {ns}
                      </span>
                    ))}
                    {c.namespaces.length > 3 && (
                      <span className="text-xs text-gray-500">+{c.namespaces.length - 3} more</span>
                    )}
                  </div>
                </div>
              )}
              
              {c.last_sync && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-400">Last sync:</span>
                  <span className="text-white">{new Date(c.last_sync).toLocaleString()}</span>
                </div>
              )}
            </div>

            <div className="mt-4 pt-4 border-t border-white/10">
              <div className="flex space-x-2">
                <button className="flex-1 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-400/30 rounded-lg py-2 px-3 text-center text-sm font-semibold text-blue-300 transition-colors">
                  View Health
                </button>
                <button className="flex-1 bg-red-600/20 hover:bg-red-600/30 border border-red-400/30 rounded-lg py-2 px-3 text-center text-sm font-semibold text-red-300 transition-colors">
                  Remove
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {open && <AddClusterModal onClose={() => { setOpen(false); load(); }} />}
    </div>
  );
}