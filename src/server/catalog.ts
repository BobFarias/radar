import "server-only";
import clientsJson from "@data/clients.json";
import opportunitiesJson from "@data/opportunities.json";
import fixturesJson from "@data/response_fixtures.json";
import sourcesJson from "@data/sources.json";
import type { ScenarioId, SourceRecord } from "@/contracts/api";

/** Read-only access to the supplied data files. Lookups use own keys only. */

interface ClientRecord {
  client_id: string;
  name: string;
}

interface OpportunityRecord {
  opportunity_id: string;
  client_id: string;
}

export interface Fixture {
  prompt: string;
  http_status: number;
  run_id: string;
  events: unknown[];
}

const clients: Record<string, ClientRecord> = clientsJson;
const sources: Record<string, SourceRecord> = sourcesJson;
const fixtures: Record<string, Fixture> = fixturesJson;
const opportunities: OpportunityRecord[] = opportunitiesJson;

function ownValue<T>(record: Record<string, T>, key: string): T | undefined {
  return Object.hasOwn(record, key) ? record[key] : undefined;
}

export function findClient(clientId: string): ClientRecord | undefined {
  return ownValue(clients, clientId);
}

export function findOpportunity(opportunityId: string): OpportunityRecord | undefined {
  return opportunities.find((o) => o.opportunity_id === opportunityId);
}

export function findSource(sourceId: string): SourceRecord | undefined {
  const source = ownValue(sources, sourceId);
  return source ? { ...source } : undefined;
}

export function findFixture(scenarioId: ScenarioId): Fixture | undefined {
  const fixture = ownValue(fixtures, scenarioId);
  return fixture ? structuredClone(fixture) : undefined;
}
