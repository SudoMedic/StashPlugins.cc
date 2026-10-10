import ledgerText from '../../registry/ledger.jsonl?raw';

// The raw community ledger, so anyone can verify the chain without cloning the repo.
export function GET() {
  return new Response(ledgerText, { headers: { 'content-type': 'application/x-ndjson' } });
}
