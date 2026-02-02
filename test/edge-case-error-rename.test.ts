import { describe, it, expect } from 'vitest';
import { parseFromLLM } from '../src/index';
import { z } from 'zod';

describe('Edge case: LLM returns error object instead of expected schema', () => {
  it('should NOT rename "error" to "character" when fields do not match', () => {
    const schema = z.object({
      character: z.object({
        name: z.string(),
        age: z.number(),
        favoriteBand: z.string(),
      }),
    });

    // LLM returned an error object instead of character
    const llmOutput = '{"error":{"type":"llm_call_failed","message":"Invalid request"}}';

    const result = parseFromLLM(llmOutput, { mode: 'repair', schema });

    console.log('Input:', llmOutput);
    console.log('Result:', result);
    console.log('Expected schema fields:', Object.keys(schema.shape.character.shape));
    console.log('Actual fields:', Object.keys((result as any).error || (result as any).character || {}));

    // Should NOT rename because fields are completely different
    // error has: {type, message}
    // character expects: {name, age, favoriteBand}
    expect(result).toHaveProperty('error');
    expect(result).not.toHaveProperty('character');
  });

  it('SHOULD rename when object has matching fields', () => {
    const schema = z.object({
      character: z.object({
        name: z.string(),
        age: z.number(),
        favoriteBand: z.string(),
      }),
    });

    // LLM used wrong key name but fields match
    const llmOutput = '{"person":{"name":"John","age":30,"favoriteBand":"Beatles"}}';

    const result = parseFromLLM(llmOutput, { mode: 'repair', schema });

    console.log('\nCorrect rename case:');
    console.log('Input:', llmOutput);
    console.log('Result:', result);

    // SHOULD rename because fields match
    expect(result).toHaveProperty('character');
    expect(result).not.toHaveProperty('person');
    expect(result.character).toEqual({
      name: 'John',
      age: 30,
      favoriteBand: 'Beatles',
    });
  });
});
