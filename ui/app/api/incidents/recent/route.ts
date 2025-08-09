import { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const limit = request.nextUrl.searchParams.get('limit') || '20'
  
  try {
    // Forward request to gateway service inside the cluster
    const gatewayUrl = 'http://gateway.incident-copilot.svc.cluster.local:8000'
    const response = await fetch(`${gatewayUrl}/api/incidents/recent?limit=${limit}`)
    
    if (!response.ok) {
      console.error(`Gateway responded with ${response.status}: ${await response.text()}`)
      throw new Error(`Gateway responded with ${response.status}`)
    }
    
    const data = await response.json()
    return Response.json(data)
  } catch (error) {
    console.error('Error fetching incidents:', error)
    
    // Return empty array if gateway is not available
    return Response.json([])
  }
}