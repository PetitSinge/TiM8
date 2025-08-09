export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const base = process.env.GATEWAY_URL || 'http://gateway.incident-copilot.svc.cluster.local:8000';
    const body = await req.text();
    
    console.log('Registering cluster via gateway...');
    
    const r = await fetch(`${base}/api/clusters/register`, {
      method: 'POST', 
      headers: {'Content-Type':'application/json'}, 
      body, 
      cache: 'no-store'
    });
    
    const responseText = await r.text();
    console.log(`Gateway register response: ${r.status} ${responseText}`);
    
    return new Response(responseText, { 
      status: r.status, 
      headers: { 'Content-Type':'application/json','Cache-Control':'no-store' }
    });
  } catch (error) {
    console.error('Error registering cluster:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to register cluster' }), 
      { status: 500, headers: { 'Content-Type':'application/json','Cache-Control':'no-store' }}
    );
  }
}