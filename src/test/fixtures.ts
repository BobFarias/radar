import responseFixtures from "@data/response_fixtures.json";

/** Read-only access to the supplied fixtures for tests. Never mutate. */
export const fixtures = responseFixtures;

export function fixtureBlock(scenario: keyof typeof responseFixtures, blockId: string): unknown {
  for (const event of responseFixtures[scenario].events as unknown[]) {
    const e = event as { kind?: string; block?: { id?: string } };
    if (e.kind === "block" && e.block?.id === blockId) {
      return structuredClone(e.block);
    }
  }
  throw new Error(`Fixture block ${scenario}/${blockId} not found`);
}
