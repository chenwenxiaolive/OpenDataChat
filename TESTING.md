# Testing Guide

## Overview

This project includes comprehensive unit tests for the Data Agent functionality using Vitest.

## Quick Start

```bash
# Run tests in watch mode
npm test

# Run tests once
npm run test:run

# Run tests with UI
npm run test:ui
```

## Test Results

```
✅ 21/21 tests passing
📁 1 test file
⏱️  Duration: ~235ms
```

## Test Coverage

### DataAgent Class (11 tests)

The main agent that communicates with the Claude AI API:

**Basic Functionality**
- Constructor and initialization
- File management (updateAvailableFiles)
- Conversation reset

**Response Processing**
- Parse structured responses (Thought + Code format)
- Handle plain text responses
- Extract Python code blocks from markdown

**Code Execution**
- Execute Python code via Pyodide
- Capture stdout/stderr
- Handle execution errors gracefully
- Display warnings from stderr

**API Integration**
- Stream responses from backend API
- Handle API errors
- Maintain conversation history
- Pass file context to API

### MockDataAgent Class (10 tests)

Development/testing agent with predefined responses:

**Basic Functionality**
- Constructor and initialization
- File management
- Reset functionality

**Smart Code Generation**
- Detect CSV files and use `read_csv`
- Detect Excel files and use `read_excel`
- Generate sample data when no files provided

**Code Execution**
- Execute generated Python code
- Handle execution errors
- Display stderr warnings

**User Experience**
- Proper timing delays between steps
- Progressive step emission (thought → code → result)

## Test Architecture

### Mocking Strategy

**PyodideInterface Mock**
```typescript
const mockPyodide = {
  runPythonAsync: vi.fn().mockResolvedValue(''),
  FS: {
    writeFile: vi.fn(),
    readFile: vi.fn(),
  },
};
```

**Fetch API Mock**
```typescript
global.fetch = vi.fn().mockResolvedValue({
  ok: true,
  body: {
    getReader: () => mockReader
  }
});
```

### Step Callback Pattern

Tests use the `onStep` callback to verify agent behavior:

```typescript
const steps: AgentStep[] = [];
const onStep = (step: AgentStep) => steps.push(step);

await agent.processQuery('test query', onStep);

// Verify steps
expect(steps.some(s => s.type === 'thought')).toBe(true);
expect(steps.some(s => s.type === 'code')).toBe(true);
expect(steps.some(s => s.type === 'result')).toBe(true);
```

## Key Test Scenarios

### 1. Full Workflow Test
```typescript
it('should parse thought and code from response', async () => {
  // Tests complete flow: API → Parse → Execute → Result
});
```

### 2. Error Handling
```typescript
it('should handle execution errors', async () => {
  // Ensures errors are caught and displayed gracefully
});
```

### 3. Stream Processing
```typescript
it('should call API with correct parameters', async () => {
  // Validates streaming response parsing
});
```

### 4. File Context
```typescript
it('should generate code for CSV files', async () => {
  // Tests file-aware code generation
});
```

## Configuration

### Vitest Config (`vitest.config.ts`)

```typescript
{
  test: {
    environment: 'happy-dom',  // Browser-like environment
    globals: true,              // Global test APIs
    setupFiles: ['./vitest.setup.ts'],
  }
}
```

### Setup File (`vitest.setup.ts`)

```typescript
import '@testing-library/jest-dom';
```

## Writing New Tests

### Template

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DataAgent, type AgentStep } from '../dataAgent';

describe('MyFeature', () => {
  let agent: DataAgent;
  let steps: AgentStep[];

  beforeEach(() => {
    // Setup
    agent = new DataAgent(mockPyodide);
    steps = [];
    vi.clearAllMocks();
  });

  it('should do something', async () => {
    // Arrange
    setupMocks();

    // Act
    await agent.processQuery('test', onStep);

    // Assert
    expect(steps).toHaveLength(3);
  });
});
```

### Best Practices

1. **Clear Test Names**: Describe what is being tested
2. **AAA Pattern**: Arrange, Act, Assert
3. **Mock Isolation**: Clear mocks between tests
4. **Async/Await**: Properly handle promises
5. **Step Verification**: Check step types and content

## Debugging Tests

### Verbose Output
```bash
npm run test:run -- --reporter=verbose
```

### Run Specific Test
```bash
npm test -- -t "should execute Python code"
```

### UI Mode (Visual Debugger)
```bash
npm run test:ui
```

## CI/CD Integration

Add to your CI pipeline:

```yaml
- name: Run tests
  run: npm run test:run
```

## Troubleshooting

### Tests Timeout
- Check fake timers: `vi.useFakeTimers()` / `vi.useRealTimers()`
- Ensure all promises are awaited
- Verify mock implementations return values

### Mock Not Working
- Clear mocks in `beforeEach`: `vi.clearAllMocks()`
- Check mock call order matches implementation
- Verify mock return values

### Stream Parsing Issues
- Stream format: `0:"chunk"\n`
- Use JSON.stringify for proper escaping
- Mock reader must return proper structure

## Future Improvements

- [ ] Add integration tests with real Pyodide
- [ ] Add coverage reporting
- [ ] Test data visualizations (matplotlib)
- [ ] Test file upload scenarios
- [ ] Add performance benchmarks

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Testing Library](https://testing-library.com/)
- [Pyodide Documentation](https://pyodide.org/)

---

**Last Updated**: 2025-12-07
**Test Framework**: Vitest 4.0.15
**Test Count**: 21 tests
**Pass Rate**: 100%
