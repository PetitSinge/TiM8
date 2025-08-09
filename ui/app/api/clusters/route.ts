export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const base = process.env.GATEWAY_URL || 'http://gateway.incident-copilot.svc.cluster.local:8000';
    const r = await fetch(`${base}/api/clusters`, { cache: 'no-store' });
    
    if (!r.ok) {
      console.error(`Gateway responded with ${r.status}`);
      return new Response('[]', { 
        status: r.status, 
        headers: { 'Content-Type':'application/json', 'Cache-Control':'no-store' }
      });
    }
    
    const data = await r.text();
    return new Response(data, { 
      status: r.status, 
      headers: { 'Content-Type':'application/json', 'Cache-Control':'no-store' }
    });
  } catch (error) {
    console.error('Error fetching clusters:', error);
    return new Response('[]', { 
      status: 500, 
      headers: { 'Content-Type':'application/json', 'Cache-Control':'no-store' }
    });
  }
}