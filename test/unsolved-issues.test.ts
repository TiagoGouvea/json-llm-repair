import { describe, test, expect } from 'vitest';
import { parseFromLLM } from '../src/index';

/**
 * Test cases from https://github.com/josdejong/jsonrepair/issues/139
 * These are edge cases that are NOT YET handled by the library.
 * Keep this file as a roadmap for future improvements.
 */
describe('unsolved issues from jsonrepair #139', () => {
  describe('unescaped quotes with non-ASCII characters', () => {
    test('handles unescaped quotes in Portuguese text with accents', () => {
      const llmOutput = '{"text": "A pergunta é sobre "cajuzinho", que parece ser um doce."}';
      const result = parseFromLLM(llmOutput, { mode: 'repair' });
      expect(result).toEqual({
        text: 'A pergunta é sobre "cajuzinho", que parece ser um doce.',
      });
    });
  });

  describe('incomplete array objects', () => {
    test('handles array items missing closing braces', () => {
      const llmOutput = '[{"name": "Alice", {"name": "Bob"}]';
      const result = parseFromLLM(llmOutput, { mode: 'repair' });
      expect(result).toEqual([{ name: 'Alice' }, { name: 'Bob' }]);
    });

    test('handles array with duplicate attributes across unclosed objects', () => {
      const llmOutput = '[{"id": 1, "name": "A", "id": 2, "name": "B"}]';
      const result = parseFromLLM(llmOutput, { mode: 'repair' });
      // Expected: should split into two objects
      expect(result).toEqual([
        { id: 1, name: 'A' },
        { id: 2, name: 'B' },
      ]);
    });
  });

  describe('missing closing braces in objects', () => {
    test('handles missing closing brace', () => {
      const llmOutput = '{"name": "John", "age": 30';
      const result = parseFromLLM(llmOutput, { mode: 'repair' });
      expect(result).toEqual({ name: 'John', age: 30 });
    });

    test('handles missing multiple closing braces in nested object', () => {
      const llmOutput = '{"user": {"name": "John", "address": {"city": "NY"';
      const result = parseFromLLM(llmOutput, { mode: 'repair' });
      expect(result).toEqual({
        user: { name: 'John', address: { city: 'NY' } },
      });
    });
  });
});
