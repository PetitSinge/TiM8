export const dynamic = 'force-dynamic'

export async function GET() {
  console.log('API route /api/workspaces called')
  try {
    // Forward request to gateway service inside the cluster
    const gatewayUrl = 'http://gateway.incident-copilot.svc.cluster.local:8000'
    console.log('Calling gateway at:', `${gatewayUrl}/api/workspaces`)
    const response = await fetch(`${gatewayUrl}/api/workspaces`, { cache: 'no-store' })
    
    if (!response.ok) {
      console.error(`Gateway responded with ${response.status}: ${await response.text()}`)
      throw new Error(`Gateway responded with ${response.status}`)
    }
    
    const data = await response.json()
    console.log('Gateway returned data:', data)
    
    // Ensure IDs remain as strings to preserve BIGINT precision
    const dataWithStringIds = data.map((workspace: any) => ({
      ...workspace,
      id: workspace.id.toString()
    }))
    
    return new Response(JSON.stringify(dataWithStringIds), {
      headers: {
        'Content-Type': 'application/json',
        // Critical: No cache for fresh data
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0'
      }
    })
  } catch (error) {
    console.error('Error fetching workspaces:', error)
    
    // Return empty array if gateway is not available
    console.log('Returning empty array due to error')
    return new Response('[]', {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0'
      }
    })
  }
}