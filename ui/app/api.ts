// ui/app/api.ts
export async function fetchIncidents() {
  const res = await fetch('/api/incidents')
  return await res.json()
}