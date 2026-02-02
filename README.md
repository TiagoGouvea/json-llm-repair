# json-llm-repair

[![npm version](https://badge.fury.io/js/json-llm-repair.svg)](https://www.npmjs.com/package/json-llm-repair)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Parse and repair JSON from LLM outputs with intelligent repair strategies.

## Why?

LLMs frequently return JSON in unexpected formats. Models without `response_format` support often wrap JSON in explanatory text or produce malformed syntax. Even models with structured output support (like OpenAI's JSON mode or Anthropic's tool use) occasionally fail to return the exact schema, omitting wrapper objects or adding extra fields.

This library handles these issues automatically, with configurable repair strategies.

## Installation

```bash
npm install json-llm-repair
# or
yarn add json-llm-repair
```

## Quick Start

```typescript
import { parseFromLLM } from 'json-llm-repair';

const llmOutput = 'Sure! Here is the data: {"name": "John", "age": 30} if you need anything else please let me know.';
const data = parseFromLLM(llmOutput);
console.log(data); // { name: "John", age: 30 }
```

## What It Fixes

### 1. Extra Text Around JSON
LLMs often add explanatory text before or after JSON.

```typescript
const llmOutput = 'Sure! Here is the data: {"name": "John"} Hope this helps!';
const data = parseFromLLM(llmOutput);
// Both modes handle this
```

### 2. JSON Inside Markdown Code Blocks
Common with ChatGPT, Claude, and other assistants.

```typescript
const llmOutput = `Here's your data:
\`\`\`json
{"name": "John", "age": 30}
\`\`\``;
const data = parseFromLLM(llmOutput);
// Both modes handle this
```

### 3. Multiple JSONs Concatenated
When LLM outputs multiple JSON objects in sequence.

```typescript
const llmOutput = '{"id": 1}{"id": 2}{"id": 3}';
const data = parseFromLLM(llmOutput);
// Returns first valid JSON: {"id": 1}
```

### 4. Invalid JSON Syntax
Missing quotes, trailing commas, unquoted keys (repair mode only).

```typescript
const llmOutput = '{name: "John", age: 30,}';
const data = parseFromLLM(llmOutput, { mode: 'repair' });
// Fixed to: {"name": "John", "age": 30}
```

### 5. Missing Root Key
LLM forgets the wrapper object expected by your schema (repair mode + schema).

```typescript
import { z } from 'zod';

const UserSchema = z.object({
  user: z.object({ name: z.string(), age: z.number() })
});

const llmOutput = '{"name": "John", "age": 30}';
const data = parseFromLLM(llmOutput, { mode: 'repair', schema: UserSchema });
// Wrapped to: { user: { name: "John", age: 30 } }
```

### 6. Unescaped Quotes in Strings
LLM embeds quotes without proper escaping (repair mode only).

```typescript
const llmOutput = '{"message": "She said "hello" to me"}';
const data = parseFromLLM(llmOutput, { mode: 'repair' });
// Fixed to: { message: 'She said "hello" to me' }
```

> **Note:** May not work reliably with non-ASCII characters (accents, etc).

### 7. Missing Closing Braces or Quotes
Incomplete JSON from streaming or interrupted responses (repair mode only).

```typescript
const llmOutput = '{"name": "John", "age": 30';
const data = parseFromLLM(llmOutput, { mode: 'repair' });
// Fixed to: { name: "John", age: 30 }
```

### 8. Duplicate Keys
Same property appearing multiple times (repair mode only).

```typescript
const llmOutput = '{"id": 1, "name": "Alice", "id": 2}';
const data = parseFromLLM(llmOutput, { mode: 'repair' });
// Result: { id: 2, name: "Alice" } (last value wins)
```

### 9. Wrong Root Key Name
LLM uses a different name for the root property (repair mode + schema).

```typescript
import { z } from 'zod';

const RankingSchema = z.object({
  rankedKnowledge: z.array(
    z.object({
      id: z.string(),
      score: z.number()
    })
  )
});

const llmOutput = '{"ranking": [{"id": "1", "score": 0.9}]}';
const data = parseFromLLM(llmOutput, { mode: 'repair', schema: RankingSchema });
// Renamed to: { rankedKnowledge: [{ id: "1", score: 0.9 }] }
```

## Mode Comparison

| Failure Type | Parse Mode | Repair Mode |
|--------------|------------|-------------|
| Text before/after JSON | ✅ Extracts | ✅ Extracts |
| JSON in markdown blocks | ✅ Extracts | ✅ Extracts |
| Concatenated JSONs | ✅ Returns first | ✅ Returns first |
| Missing quotes in keys | ❌ Throws error | ✅ Fixes |
| Trailing commas | ❌ Throws error | ✅ Fixes |
| Unquoted keys | ❌ Throws error | ✅ Fixes |
| Unescaped quotes in values | ❌ Throws error | ✅ Fixes |
| Missing closing braces/quotes | ❌ Throws error | ✅ Fixes |
| Duplicate keys in object | ❌ Throws error | ✅ Fixes (last wins) |
| Missing root object | ❌ Returns as-is | ✅ Wraps (with schema) |
| Wrong root key name | ❌ Returns as-is | ✅ Renames (with schema) |
| Completely invalid JSON | ❌ Throws error | ⚠️ Best effort repair |

## Modes

| Mode | Behavior |
|------|----------|
| `parse` (default) | Extract and parse JSON. Fails on syntax errors. |
| `repair` | All strategies: jsonrepair, multiple candidates, schema fixes. |

## Examples

### Parse Mode (default)

```typescript
// Extracts JSON from text, no repair
const data = parseFromLLM('Here is your data: {"name": "John"}');
```

### Repair Mode

```typescript
// Handles broken JSON syntax
const data = parseFromLLM(
  'Sure! {name: "John", age: 30}', // missing quotes
  { mode: 'repair' }
);
```

### Repair Mode + Schema

```typescript
import { z } from 'zod';

const UserSchema = z.object({
  user: z.object({
    name: z.string(),
    age: z.number()
  })
});

// LLM forgot the root "user" key
const data = parseFromLLM(
  '{"name": "John", "age": 30}',
  { mode: 'repair', schema: UserSchema }
);
console.log(data); // { user: { name: "John", age: 30 } }
```

## API

### `parseFromLLM<T>(llmOutput: string, options?: ParseOptions): T`

Parses JSON from LLM output.

**Parameters:**
- `llmOutput: string` - Raw string from LLM that may contain JSON
- `options?: ParseOptions` - Optional configuration

**Options:**
- `mode?: 'parse' | 'repair'` - Parsing strategy (default: `'parse'`)
- `schema?: ZodSchema` - Optional Zod schema for validation and fixes (repair mode only)

### Helper Functions

- `hasPossibleJson(str: string): boolean` - Check if string contains JSON braces
- `isJsonString(str: string): boolean` - Validate if string is valid JSON

## Found an Issue?

If you encounter a JSON output format that this library doesn't handle, please [open an issue](../../issues) with an example. We'll be happy to help and improve the library!

## License

MIT
