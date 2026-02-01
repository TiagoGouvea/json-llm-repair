import { describe, test, expect } from 'vitest';
import { hasPossibleJson, isJsonString } from '../src/index';

describe('hasPossibleJson', () => {
  test('returns true for valid JSON', () => {
    expect(hasPossibleJson('{"name": "John"}')).toBe(true);
  });

  test('returns true for JSON with surrounding text', () => {
    expect(hasPossibleJson('Here: {"x": 1}')).toBe(true);
    expect(hasPossibleJson('{"x": 1} done')).toBe(true);
    expect(hasPossibleJson('text {"x": 1} more text')).toBe(true);
  });

  test('returns true for invalid JSON with braces', () => {
    expect(hasPossibleJson('{invalid}')).toBe(true);
    expect(hasPossibleJson('{name: "John"}')).toBe(true);
  });

  test('returns false when no JSON braces found', () => {
    expect(hasPossibleJson('No JSON here')).toBe(false);
    expect(hasPossibleJson('')).toBe(false);
    expect(hasPossibleJson('just text')).toBe(false);
  });

  test('returns false for only opening brace', () => {
    expect(hasPossibleJson('{')).toBe(false);
  });

  test('returns false for only closing brace', () => {
    expect(hasPossibleJson('}')).toBe(false);
  });
});

describe('isJsonString', () => {
  test('returns true for valid JSON objects', () => {
    expect(isJsonString('{"name": "John"}')).toBe(true);
    expect(isJsonString('{"a": 1, "b": 2}')).toBe(true);
  });

  test('returns true for valid JSON arrays', () => {
    expect(isJsonString('[1, 2, 3]')).toBe(true);
    expect(isJsonString('["a", "b"]')).toBe(true);
  });

  test('returns true for valid JSON primitives', () => {
    expect(isJsonString('123')).toBe(true);
    expect(isJsonString('"string"')).toBe(true);
    expect(isJsonString('true')).toBe(true);
    expect(isJsonString('null')).toBe(true);
  });

  test('returns false for invalid JSON syntax', () => {
    expect(isJsonString('{name: "John"}')).toBe(false);
    expect(isJsonString('{"name": "John",}')).toBe(false);
    expect(isJsonString('{invalid}')).toBe(false);
  });

  test('returns false for plain text', () => {
    expect(isJsonString('not json')).toBe(false);
    expect(isJsonString('')).toBe(false);
    expect(isJsonString('undefined')).toBe(false);
  });

  test('returns false for JSON with surrounding text', () => {
    expect(isJsonString('Here: {"x": 1}')).toBe(false);
    expect(isJsonString('{"x": 1} extra')).toBe(false);
  });
});
