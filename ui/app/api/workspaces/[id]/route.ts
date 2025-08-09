import { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const workspaceId = params.id
    console.log('DELETE /api/workspaces/[id] called with ID:', workspaceId)
    
    // Forward request to gateway service
    const gatewayUrl = 'http://gateway.incident-copilot.svc.cluster.local:8000'
    console.log('Calling gateway DELETE:', `${gatewayUrl}/api/workspaces/${workspaceId}`)
    const response = await fetch(`${gatewayUrl}/api/workspaces/${workspaceId}`, {
      method: 'DELETE',
      cache: 'no-store'
    })
    
    if (!response.ok) {
      console.error(`Gateway responded with ${response.status}: ${await response.text()}`)
      return new Response(JSON.stringify({ error: 'Failed to delete workspace' }), { 
        status: response.status,
        headers: { 'Cache-Control': 'no-store' }
      })
    }
    
    const data = await response.json()
    return new Response(JSON.stringify(data), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
      }
    })
  } catch (error) {
    console.error('Error deleting workspace:', error)
    return new Response(JSON.stringify({ error: 'Failed to delete workspace' }), { 
      status: 500,
      headers: { 'Cache-Control': 'no-store' }
    })
  }
}