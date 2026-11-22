import clientsJson from "@data/clients.json";
import opportunitiesJson from "@data/opportunities.json";

/** Read-only names for ids shown in the UI. Lookups use own keys only. */

interface ClientRecord {
  client_id: string;
  name: string;
  sector: string;
}

interface OpportunityRecord {
  opportunity_id: string;
  client_id: string;
  title: string;
}

const clients: Record<string, ClientRecord> = clientsJson;
const opportunities: OpportunityRecord[] = opportunitiesJson;

export function findClient(clientId: string): ClientRecord | undefined {
  return Object.hasOwn(clients, clientId) ? clients[clientId] : undefined;
}

export function findOpportunity(opportunityId: string): OpportunityRecord | undefined {
  return opportunities.find((o) => o.opportunity_id === opportunityId);
}
