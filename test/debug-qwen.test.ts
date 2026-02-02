import { describe, it, expect } from 'vitest';
import { parseFromLLM } from '../src/index';
import { z } from 'zod';

describe('Debug qwen-max case', () => {
  it('should wrap missing root key "character"', () => {
    const llmOutput = '{"name":"João","age":28,"favoriteBand":"Legião Urbana"}';

    const schema = z.object({
      character: z.object({
        name: z.string(),
        age: z.number(),
        favoriteBand: z.string(),
      }),
    });

    const result = parseFromLLM(llmOutput, { mode: 'repair', schema });

    console.log('\n🔍 Debug info:');
    console.log('Input:', llmOutput);
    console.log('Result:', result);
    console.log('Result JSON:', JSON.stringify(result));
    console.log('Schema shape:', Object.keys(schema.shape));
    console.log('Has character key?', 'character' in result);

    // Test zod validation
    const validation = schema.safeParse(result);
    console.log('Zod validation success?', validation.success);
    if (!validation.success) {
      console.log('Validation errors:', validation.error.errors);
    }

    expect(result).toBeDefined();
    expect(result).toHaveProperty('character');
    expect(result.character).toHaveProperty('name', 'João');
    expect(result.character).toHaveProperty('age', 28);
    expect(result.character).toHaveProperty('favoriteBand', 'Legião Urbana');
    expect(validation.success).toBe(true);
  });

  it('should work when stringified and parsed again', () => {
    const llmOutput = '{"name":"João","age":28,"favoriteBand":"Legião Urbana"}';

    const schema = z.object({
      character: z.object({
        name: z.string(),
        age: z.number(),
        favoriteBand: z.string(),
      }),
    });

    const parsed = parseFromLLM(llmOutput, { mode: 'repair', schema });
    const stringified = JSON.stringify(parsed);
    const reParsed = JSON.parse(stringified);

    console.log('\n🔄 After stringify/parse cycle:');
    console.log('Stringified:', stringified);
    console.log('Re-parsed:', reParsed);

    const validation = schema.safeParse(reParsed);
    console.log('Validation after cycle?', validation.success);

    expect(validation.success).toBe(true);
  });
});
