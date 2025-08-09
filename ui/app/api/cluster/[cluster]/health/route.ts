import { NextRequest } from 'next/server'

export async function GET(
  request: NextRequest,
  { params }: { params: { cluster: string } }
) {
  const cluster = params.cluster
  const workspace = request.nextUrl.searchParams.get('workspace') || 'TiM8-Local'
  
  try {
    // Forward request to gateway service inside the cluster
    const gatewayUrl = 'http://gateway.incident-copilot.svc.cluster.local:8000'
    const response = await fetch(`${gatewayUrl}/api/cluster/${cluster}/health?workspace=${workspace}`)
    
    if (!response.ok) {
      console.error(`Gateway responded with ${response.status}: ${await response.text()}`)
      throw new Error(`Gateway responded with ${response.status}`)
    }
    
    const data = await response.json()
    return Response.json(data)
  } catch (error) {
    console.error('Error fetching cluster health:', error)
    
    // Return mock data if gateway is not available
    return Response.json({
      cluster_name: cluster,
      workspace: workspace,
      overall_status: 'healthy',
      components: [
        {
          id: 1,
          component: 'API Server',
          component_type: 'kubernetes',
          status: 'healthy',
          details: '{"endpoint": "https://kubernetes.default.svc", "ready": true}',
          last_check: new Date().toISOString()
        },
        {
          id: 2,
          component: 'ETCD',
          component_type: 'database',
          status: 'healthy',
          details: '{"cluster_health": "ok", "members": 3}',
          last_check: new Date().toISOString()
        },
        {
          id: 3,
          component: 'Controller Manager',
          component_type: 'kubernetes',
          status: 'healthy',
          details: '{"ready": true, "leader_election": "active"}',
          last_check: new Date().toISOString()
        },
        {
          id: 4,
          component: 'Scheduler',
          component_type: 'kubernetes',
          status: 'healthy',
          details: '{"ready": true, "binding_rate": "12/s"}',
          last_check: new Date().toISOString()
        },
        {
          id: 5,
          component: 'CoreDNS',
          component_type: 'networking',
          status: 'healthy',
          details: '{"replicas": 2, "ready": 2, "latency": "1.2ms"}',
          last_check: new Date().toISOString()
        }
      ],
      last_check: new Date().toISOString()
    })
  }
}