import { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, description, clusters } = body
    
    if (!name) {
      return new Response(JSON.stringify({ error: 'Name is required' }), { 
        status: 400,
        headers: { 'Cache-Control': 'no-store' }
      })
    }
    
    // Description and clusters are optional
    const workspaceData = {
      name: name.trim(),
      description: description?.trim() || '',
      clusters: clusters || []
    }
    
    // Forward request to gateway service
    const gatewayUrl = 'http://gateway.incident-copilot.svc.cluster.local:8000'
    console.log('Creating workspace with data:', workspaceData)
    const response = await fetch(`${gatewayUrl}/api/workspaces`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(workspaceData),
      cache: 'no-store'
    })
    
    if (!response.ok) {
      console.error(`Gateway responded with ${response.status}: ${await response.text()}`)
      throw new Error(`Gateway responded with ${response.status}`)
    }
    
    const data = await response.json()
    return new Response(JSON.stringify(data), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
      }
    })
  } catch (error) {
    console.error('Error creating workspace:', error)
    return new Response(JSON.stringify({ error: 'Failed to create workspace' }), { 
      status: 500,
      headers: { 'Cache-Control': 'no-store' }
    })
  }
}