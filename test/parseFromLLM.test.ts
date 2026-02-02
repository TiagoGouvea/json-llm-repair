import { describe, test, expect } from 'vitest';
import { z } from 'zod';
import { parseFromLLM } from '../src/index';

describe('parseFromLLM', () => {
  describe('parse mode (default)', () => {
    describe('happy path', () => {
      test('parses pure JSON without extra text', () => {
        const llmOutput = '{"name": "John", "age": 30}';
        const result = parseFromLLM(llmOutput);
        expect(result).toEqual({ name: 'John', age: 30 });
      });

      test('extracts JSON from text with extra content before and after', () => {
        const llmOutput = 'Sure! Here is the data: {"name": "John"} Hope this helps!';
        const result = parseFromLLM(llmOutput);
        expect(result).toEqual({ name: 'John' });
      });

      test('extracts JSON from markdown code blocks', () => {
        const llmOutput = `Here's your data:
\`\`\`json 
{"name": "John", "age": 30}
\`\`\``;
        const result = parseFromLLM(llmOutput);
        expect(result).toEqual({ name: 'John', age: 30 });
      });

      test('returns first JSON when multiple are concatenated', () => {
        const llmOutput = '{"id": 1}{"id": 2}{"id": 3}';
        const result = parseFromLLM(llmOutput);
        expect(result).toEqual({ id: 1 });
      });
    });

    describe('edge cases', () => {
      test('parses nested objects', () => {
        const llmOutput = '{"user": {"name": "John", "address": {"city": "NY"}}}';
        const result = parseFromLLM(llmOutput);
        expect(result).toEqual({
          user: { name: 'John', address: { city: 'NY' } },
        });
      });

      test('parses arrays', () => {
        const llmOutput = '{"items": [1, 2, 3], "tags": ["a", "b"]}';
        const result = parseFromLLM(llmOutput);
        expect(result).toEqual({ items: [1, 2, 3], tags: ['a', 'b'] });
      });

      test('parses empty object', () => {
        const llmOutput = '{}';
        const result = parseFromLLM(llmOutput);
        expect(result).toEqual({});
      });

      test('handles escaped characters in strings', () => {
        const llmOutput = '{"message": "Hello \\"world\\""}';
        const result = parseFromLLM(llmOutput);
        expect(result).toEqual({ message: 'Hello "world"' });
      });
    });

    describe('error cases', () => {
      test('throws error on invalid JSON syntax', () => {
        const llmOutput = '{name: "John", age: 30,}';
        expect(() => parseFromLLM(llmOutput)).toThrow();
      });

      test('throws error when no JSON braces found', () => {
        const llmOutput = 'Just plain text without any JSON';
        expect(() => parseFromLLM(llmOutput)).toThrow('No JSON found');
      });

      test('throws error on completely malformed JSON', () => {
        const llmOutput = '{{{broken}}}';
        expect(() => parseFromLLM(llmOutput)).toThrow();
      });
    });
  });

  describe('repair mode', () => {
    describe('syntax repair', () => {
      test('fixes missing quotes in keys', () => {
        const llmOutput = '{name: "John", age: 30}';
        const result = parseFromLLM(llmOutput, { mode: 'repair' });
        expect(result).toEqual({ name: 'John', age: 30 });
      });

      test('fixes trailing commas', () => {
        const llmOutput = '{"name": "John", "age": 30,}';
        const result = parseFromLLM(llmOutput, { mode: 'repair' });
        expect(result).toEqual({ name: 'John', age: 30 });
      });

      test('fixes both missing quotes and trailing commas', () => {
        const llmOutput = '{name: "John", age: 30,}';
        const result = parseFromLLM(llmOutput, { mode: 'repair' });
        expect(result).toEqual({ name: 'John', age: 30 });
      });

      test('handles already valid JSON without modification', () => {
        const llmOutput = '{"name": "John", "age": 30}';
        const result = parseFromLLM(llmOutput, { mode: 'repair' });
        expect(result).toEqual({ name: 'John', age: 30 });
      });
    });

    describe('schema fixes', () => {
      test('wraps object when root key is missing', () => {
        const UserSchema = z.object({
          user: z.object({
            name: z.string(),
            age: z.number(),
          }),
        });

        const llmOutput = '{"name": "John", "age": 30}';
        const result = parseFromLLM(llmOutput, { mode: 'repair', schema: UserSchema });
        expect(result).toEqual({ user: { name: 'John', age: 30 } });
      });

      test('does not wrap when root key is already present', () => {
        const UserSchema = z.object({
          user: z.object({
            name: z.string(),
          }),
        });

        const llmOutput = '{"user": {"name": "John"}}';
        const result = parseFromLLM(llmOutput, { mode: 'repair', schema: UserSchema });
        expect(result).toEqual({ user: { name: 'John' } });
      });

      test('does not wrap when schema has multiple root keys', () => {
        const MultiSchema = z.object({
          user: z.object({ name: z.string() }),
          meta: z.object({ timestamp: z.number() }),
        });

        const llmOutput = '{"name": "John"}';
        const result = parseFromLLM(llmOutput, { mode: 'repair', schema: MultiSchema });
        expect(result).toEqual({ name: 'John' });
      });

      test('does not wrap when root schema is not an object', () => {
        const StringSchema = z.object({
          data: z.string(),
        });

        const llmOutput = '{"value": "test"}';
        const result = parseFromLLM(llmOutput, { mode: 'repair', schema: StringSchema });
        expect(result).toEqual({ value: 'test' });
      });
    });

    describe('wrong root key name', () => {
      test('renames root key when LLM uses wrong name for array', () => {
        const schema = z.object({
          rankedKnowledge: z.array(
            z.object({
              id: z.string(),
              score: z.number(),
            }),
          ),
        });

        const llmOutput = '{"ranking": [{"id": "1", "score": 0.9}, {"id": "2", "score": 0.8}]}';
        const result = parseFromLLM(llmOutput, { mode: 'repair', schema });
        expect(result).toEqual({
          rankedKnowledge: [
            { id: '1', score: 0.9 },
            { id: '2', score: 0.8 },
          ],
        });
      });

      test('renames root key when LLM uses wrong name for object', () => {
        const schema = z.object({
          user: z.object({
            name: z.string(),
            age: z.number(),
          }),
        });

        const llmOutput = '{"person": {"name": "John", "age": 30}}';
        const result = parseFromLLM(llmOutput, { mode: 'repair', schema });
        expect(result).toEqual({
          user: { name: 'John', age: 30 },
        });
      });

      test('does not rename when types are incompatible', () => {
        const schema = z.object({
          users: z.array(z.object({ name: z.string() })),
        });

        // LLM returned object instead of array
        const llmOutput = '{"user": {"name": "John"}}';
        const result = parseFromLLM(llmOutput, { mode: 'repair', schema });
        // Should not rename because types don't match
        expect(result).toEqual({ user: { name: 'John' } });
      });
    });

    describe('repair without schema', () => {
      test('repairs syntax without schema provided', () => {
        const llmOutput = '{name: "John"}';
        const result = parseFromLLM(llmOutput, { mode: 'repair' });
        expect(result).toEqual({ name: 'John' });
      });

      test('extracts JSON from text in repair mode', () => {
        const llmOutput = 'Here: {name: "John"}';
        const result = parseFromLLM(llmOutput, { mode: 'repair' });
        expect(result).toEqual({ name: 'John' });
      });
    });

    describe('edge cases', () => {
      test('repairs nested objects with syntax errors', () => {
        const llmOutput = '{user: {name: "John", age: 30}}';
        const result = parseFromLLM(llmOutput, { mode: 'repair' });
        expect(result).toEqual({ user: { name: 'John', age: 30 } });
      });

      test('handles multiple JSONs in repair mode', () => {
        const llmOutput = '{id: 1}{id: 2}';
        const result = parseFromLLM(llmOutput, { mode: 'repair' });
        expect(result).toEqual({ id: 1 });
      });
    });

    describe('advanced repair cases', () => {
      test('handles unescaped quotes in strings', () => {
        const llmOutput = '{"message": "She said "hello" to me"}';
        const result = parseFromLLM(llmOutput, { mode: 'repair' });
        expect(result).toEqual({
          message: 'She said "hello" to me',
        });
      });

      test('handles nested JSON fragments (unescaped)', () => {
        const llmOutput = '{"assistant": "Here is data {"inner": "json"} more text"}';
        const result = parseFromLLM(llmOutput, { mode: 'repair' });
        expect(result).toBeDefined();
      });

      test('handles nested object without escaping', () => {
        const llmOutput = '{"outer": "text {"nested": "value"} end"}';
        const result = parseFromLLM(llmOutput, { mode: 'repair' });
        expect(result).toBeDefined();
      });

      test('handles missing closing quote in string', () => {
        const llmOutput = '{"name": "John, "age": 30}';
        const result = parseFromLLM(llmOutput, { mode: 'repair' });
        expect(result).toEqual({ name: 'John', age: 30 });
      });

      test('handles duplicate keys (last value wins)', () => {
        const llmOutput = '{"id": 1, "name": "Alice", "id": 2}';
        const result = parseFromLLM(llmOutput, { mode: 'repair' });
        expect(result).toEqual({ id: 2, name: 'Alice' });
      });

      test('handles multiple duplicate keys', () => {
        const llmOutput = '{"x": 1, "y": 2, "x": 3, "y": 4}';
        const result = parseFromLLM(llmOutput, { mode: 'repair' });
        expect(result).toEqual({ x: 3, y: 4 });
      });
    });
  });

  describe('mode parameter', () => {
    test('uses parse mode when mode is explicitly set to "parse"', () => {
      const llmOutput = '{"name": "John"}';
      const result = parseFromLLM(llmOutput, { mode: 'parse' });
      expect(result).toEqual({ name: 'John' });
    });

    test('uses parse mode by default when no options provided', () => {
      const llmOutput = '{"name": "John"}';
      const result = parseFromLLM(llmOutput);
      expect(result).toEqual({ name: 'John' });
    });

    test('uses repair mode when mode is set to "repair"', () => {
      const llmOutput = '{name: "John"}';
      const result = parseFromLLM(llmOutput, { mode: 'repair' });
      expect(result).toEqual({ name: 'John' });
    });
  });
});
