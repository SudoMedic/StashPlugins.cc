import { listItems } from '../lib/catalog';

// Slim catalog for client-side search, filter and sort.
export function GET() {
  return new Response(JSON.stringify(listItems), { headers: { 'content-type': 'application/json' } });
}
