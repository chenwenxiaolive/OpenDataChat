# Data Agent Unit Tests

This directory contains comprehensive unit tests for the Data Agent functionality.

## Test Coverage

### DataAgent Tests (11 tests)

**Constructor and Basic Methods (3 tests)**
- ✅ Instance creation
- ✅ Update available files
- ✅ Reset conversation history

**Response Parsing (2 tests)**
- ✅ Parse thought and code from formatted response
- ✅ Handle response without code block

**Code Execution (3 tests)**
- ✅ Execute Python code and return output
- ✅ Handle execution errors
- ✅ Include stderr warnings in output

**Query Processing (3 tests)**
- ✅ Call API with correct parameters
- ✅ Handle API errors
- ✅ Emit steps in correct order (thought → code → result)

### MockDataAgent Tests (10 tests)

**Constructor and Basic Methods (3 tests)**
- ✅ Instance creation
- ✅ Update available files
- ✅ Reset without errors

**Query Processing with Files (2 tests)**
- ✅ Generate code for CSV files
- ✅ Generate code for Excel files

**Query Processing without Files (1 test)**
- ✅ Generate sample data when no files available

**Code Execution (3 tests)**
- ✅ Execute generated code
- ✅ Handle execution errors
- ✅ Show warnings if stderr is present

**Step Timing (1 test)**
- ✅ Emit steps with appropriate delays

## Running Tests

### Run all tests (watch mode)
```bash
npm test
```

### Run tests once
```bash
npm run test:run
```

### Run tests with UI
```bash
npm run test:ui
```

## Test Framework

- **Framework**: Vitest 4.0
- **Environment**: happy-dom (browser-like environment)
- **Mocking**: Vitest's built-in mocking capabilities

## Test Structure

Each test suite follows this pattern:

1. **Setup**: Create mock Pyodide instance and agent
2. **Execution**: Call agent methods with test data
3. **Verification**: Assert expected behavior using steps callback

### Example Test

```typescript
it('should execute Python code and return output', async () => {
  // Setup
  const code = 'print("Hello")';
  const mockResponse = `**Code:**\n\`\`\`python\n${code}\n\`\`\``;

  // Mock API response
  setupMockFetch(mockResponse);

  // Mock Pyodide execution
  mockPyodide.runPythonAsync
    .mockResolvedValueOnce(undefined) // Setup
    .mockResolvedValueOnce(undefined) // Execute
    .mockResolvedValueOnce('Hello\n') // Get output
    .mockResolvedValueOnce(''); // Get stderr

  // Execute
  await agent.processQuery('run code', onStep);

  // Verify
  const resultStep = steps.find(s => s.type === 'result');
  expect(resultStep?.content).toContain('Hello');
});
```

## Key Test Scenarios

### DataAgent

- **API Integration**: Tests proper communication with the backend API
- **Stream Parsing**: Validates parsing of streaming text responses
- **Code Extraction**: Ensures Python code blocks are correctly extracted
- **Error Handling**: Verifies graceful error handling for API and execution errors

### MockDataAgent

- **File Type Detection**: Tests CSV vs Excel file handling
- **Sample Data Generation**: Validates fallback to sample data when no files provided
- **Async Timing**: Ensures proper delays between steps for UX
- **Pyodide Integration**: Tests Python code execution in browser environment

## Mocking Strategy

### PyodideInterface
- Minimal mock with only required methods
- `runPythonAsync`: Returns test data or errors as needed
- `FS.writeFile`/`readFile`: No-op mocks

### Fetch API
- Global fetch is mocked for each test
- Simulates streaming responses from backend API
- Allows testing of both success and error scenarios

### Timers
- Uses Vitest's fake timers for MockDataAgent timing tests
- Allows fast-forwarding through delays

## Maintenance

When updating the agent code:

1. Update corresponding tests
2. Ensure all tests pass: `npm run test:run`
3. Check coverage if needed
4. Update this README if test structure changes

## Common Issues

### Test Timeout
If tests timeout, check:
- Fake timers are properly advanced
- All promises are awaited
- Mock implementations return values

### Mock Data Format
The streaming API response format is:
```
0:"text chunk"\n
```

Ensure mock responses match this format.
