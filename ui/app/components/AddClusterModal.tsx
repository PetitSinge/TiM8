'use client';

import { useState } from 'react';

export default function AddClusterModal({ onClose }: { onClose: ()=>void }) {
  const [tab, setTab] = useState<'agent'|'kubeconfig'>('agent');

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="w-full max-w-4xl rounded-xl bg-black/90 border border-white/20 p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-2xl font-semibold bg-gradient-to-r from-sky-400 to-cyan-400 bg-clip-text text-transparent">
            Add External Cluster
          </h3>
          <button 
            onClick={onClose} 
            className="text-white/70 hover:text-white text-xl p-2 hover:bg-white/10 rounded-lg transition-all"
          >
            ✕
          </button>
        </div>

        <div className="flex gap-2 mb-6">
          <button 
            onClick={() => setTab('agent')} 
            className={`px-4 py-2 rounded-lg font-semibold transition-all ${
              tab === 'agent' 
                ? 'bg-sky-600 text-white' 
                : 'bg-white/10 text-white/70 hover:bg-white/20 hover:text-white'
            }`}
          >
            📡 Agent (Recommended)
          </button>
          <button 
            onClick={() => setTab('kubeconfig')} 
            className={`px-4 py-2 rounded-lg font-semibold transition-all ${
              tab === 'kubeconfig' 
                ? 'bg-violet-600 text-white' 
                : 'bg-white/10 text-white/70 hover:bg-white/20 hover:text-white'
            }`}
          >
            ⚙️ Kubeconfig (Direct)
          </button>
        </div>

        {tab === 'agent' ? <AgentTab /> : <KubeconfigTab onDone={onClose} />}
      </div>
    </div>
  );
}

function AgentTab() {
  const [workspace, setWorkspace] = useState('Default');
  const [clusterName, setClusterName] = useState('');
  const [namespaces, setNamespaces] = useState('default');
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function issueToken() {
    if (!workspace.trim() || !clusterName.trim()) {
      alert('Please fill in workspace and cluster name first');
      return;
    }

    setLoading(true);
    try {
      const r = await fetch('/api/enroll-token', {
        method: 'POST', 
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ workspace: workspace.trim(), ttl_minutes: 60 })
      });
      
      if (!r.ok) {
        throw new Error(`Failed to generate token: ${r.status}`);
      }
      
      const data = await r.json();
      setToken(data.token);
    } catch (error) {
      console.error('Failed to issue token:', error);
      alert('Failed to generate enrollment token');
    } finally {
      setLoading(false);
    }
  }

  const gateway = process.env.NEXT_PUBLIC_GATEWAY_URL || 'https://your-gateway-url.com';

  return (
    <div className="space-y-6">
      <div className="bg-sky-600/10 border border-sky-400/30 rounded-lg p-4">
        <h4 className="text-sky-300 font-semibold mb-2">🔄 Push-based Monitoring</h4>
        <p className="text-sm text-gray-300">
          The agent runs in your external cluster and pushes health data to TiM8. 
          This approach is secure (no inbound connections), scalable, and works behind NAT/firewalls.
        </p>
      </div>

      <div className="grid gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Workspace Name *
          </label>
          <input 
            className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-sky-400" 
            placeholder="e.g., Dev, Staging, Production" 
            value={workspace} 
            onChange={e => setWorkspace(e.target.value)} 
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Cluster Name *
          </label>
          <input 
            className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-sky-400" 
            placeholder="e.g., dev-cluster-1, staging-k8s" 
            value={clusterName} 
            onChange={e => setClusterName(e.target.value)} 
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Monitored Namespaces
          </label>
          <input 
            className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-sky-400" 
            placeholder="default,kube-system,myapp (comma separated)" 
            value={namespaces} 
            onChange={e => setNamespaces(e.target.value)} 
          />
          <p className="text-xs text-gray-500 mt-1">
            The agent will only read from these namespaces (RBAC enforced)
          </p>
        </div>
        
        <button 
          onClick={issueToken} 
          disabled={loading}
          className="w-fit px-6 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:bg-sky-600/50 text-white font-semibold transition-all"
        >
          {loading ? 'Generating...' : '🔑 Generate Enrollment Token'}
        </button>
      </div>

      {token && (
        <div className="bg-black/40 border border-white/20 rounded-lg p-4">
          <div className="flex items-center space-x-2 mb-3">
            <span className="text-lg">⚡</span>
            <h4 className="text-green-300 font-semibold">Installation Command</h4>
            <span className="text-xs bg-amber-600/20 text-amber-300 px-2 py-1 rounded">
              Token expires in 1 hour
            </span>
          </div>
          
          <p className="text-sm text-gray-400 mb-3">
            Run this command on your external cluster:
          </p>
          
          <pre className="text-xs p-3 bg-black/60 rounded border border-white/10 whitespace-pre-wrap overflow-x-auto font-mono">
{`# First, create the Helm chart locally or use our registry
# wget https://github.com/your-org/tim8-collector/releases/download/v0.1.0/tim8-collector-0.1.0.tgz

helm upgrade --install tim8-collector ./helm/tim8-collector \\
  --create-namespace \\
  --namespace tim8-agent \\
  --set gatewayUrl="${gateway}" \\
  --set clusterName="${clusterName}" \\
  --set workspace="${workspace}" \\
  --set enrollToken="${token}" \\
  --set namespaces="{${namespaces.split(',').map(n => n.trim()).join(',')}}"

# Check deployment status
kubectl -n tim8-agent get pods -l app=tim8-collector`}
          </pre>
          
          <div className="mt-4 p-3 bg-green-600/10 border border-green-400/30 rounded">
            <p className="text-sm text-green-300">
              ✅ Once deployed, the agent will appear in the clusters list within 30 seconds
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function KubeconfigTab({ onDone }: { onDone: ()=>void }) {
  const [workspace, setWorkspace] = useState('Default');
  const [name, setName] = useState('');
  const [namespaces, setNamespaces] = useState('default');
  const [kubeconfig, setKubeconfig] = useState('');
  const [loading, setLoading] = useState(false);

  async function onRegister() {
    if (!name.trim() || !workspace.trim() || !kubeconfig.trim()) {
      alert('Please fill in all required fields');
      return;
    }

    setLoading(true);
    try {
      const r = await fetch('/api/clusters/register', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({
          name: name.trim(), 
          workspace: workspace.trim(), 
          mode: 'kubeconfig',
          namespaces: namespaces.split(',').map(s => s.trim()).filter(Boolean),
          kubeconfig: kubeconfig.trim()
        })
      });
      
      if (r.ok) { 
        onDone(); 
      } else { 
        const error = await r.text();
        alert('Registration failed: ' + error); 
      }
    } catch (error) {
      console.error('Registration error:', error);
      alert('Registration failed: ' + error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-violet-600/10 border border-violet-400/30 rounded-lg p-4">
        <h4 className="text-violet-300 font-semibold mb-2">🔗 Pull-based Monitoring</h4>
        <p className="text-sm text-gray-300">
          TiM8 gateway connects directly to your cluster's API server using a kubeconfig. 
          Requires network access to the cluster (VPN, firewall rules, etc).
        </p>
      </div>

      <div className="grid gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Workspace Name *
          </label>
          <input 
            className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-violet-400" 
            placeholder="e.g., Dev, Staging, Production" 
            value={workspace} 
            onChange={e => setWorkspace(e.target.value)} 
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Cluster Name *
          </label>
          <input 
            className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-violet-400" 
            placeholder="e.g., production-eks, staging-gke" 
            value={name} 
            onChange={e => setName(e.target.value)} 
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Monitored Namespaces
          </label>
          <input 
            className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-violet-400" 
            placeholder="default,kube-system,myapp (comma separated)" 
            value={namespaces} 
            onChange={e => setNamespaces(e.target.value)} 
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Kubeconfig (Read-only SA) *
          </label>
          <textarea 
            className="w-full h-40 px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white font-mono text-sm focus:outline-none focus:border-violet-400" 
            placeholder="Paste your kubeconfig with read-only ServiceAccount here..."
            value={kubeconfig} 
            onChange={e => setKubeconfig(e.target.value)} 
          />
          <div className="mt-2 p-3 bg-amber-600/10 border border-amber-400/30 rounded">
            <p className="text-xs text-amber-300 font-semibold mb-1">⚠️ Security Requirements:</p>
            <ul className="text-xs text-gray-300 space-y-1">
              <li>• Use a dedicated ServiceAccount with minimal RBAC (get/list/watch only)</li>
              <li>• Use short-lived tokens (6-24 hours) not permanent certificates</li>
              <li>• Only grant access to specific namespaces</li>
            </ul>
          </div>
        </div>
        
        <button 
          onClick={onRegister} 
          disabled={loading}
          className="w-fit px-6 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:bg-violet-600/50 text-white font-semibold transition-all"
        >
          {loading ? 'Registering...' : '📝 Register Cluster'}
        </button>
      </div>
    </div>
  );
}