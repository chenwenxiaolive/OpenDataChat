import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DataAgent, MockDataAgent, type AgentStep } from '../dataAgent';
import type { PyodideInterface } from 'pyodide';

// Mock PyodideInterface
const createMockPyodide = (): PyodideInterface => {
  return {
    runPythonAsync: vi.fn().mockResolvedValue(''),
    FS: {
      writeFile: vi.fn(),
      readFile: vi.fn(),
    },
  } as unknown as PyodideInterface;
};

// Mock fetch globally
global.fetch = vi.fn();

describe('DataAgent', () => {
  let mockPyodide: PyodideInterface;
  let agent: DataAgent;
  let steps: AgentStep[];
  const onStep = (step: AgentStep) => steps.push(step);

  beforeEach(() => {
    mockPyodide = createMockPyodide();
    agent = new DataAgent(mockPyodide);
    steps = [];
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Constructor and Basic Methods', () => {
    it('should create an instance', () => {
      expect(agent).toBeInstanceOf(DataAgent);
    });

    it('should update available files', () => {
      const files = ['test.csv', 'data.xlsx'];
      agent.updateAvailableFiles(files);
      // Files are updated internally (we can verify through processQuery behavior)
      expect(agent).toBeDefined();
    });

    it('should reset conversation history', () => {
      agent.reset();
      expect(agent).toBeDefined();
    });
  });

  describe('parseResponse', () => {
    it('should parse thought and code from response', async () => {
      const mockResponseParts = [
        '**Thought:** ',
        'This is my thought process\n\n',
        '**Code:**\n',
        '```python\n',
        'print("Hello, World!")\n',
        '```'
      ];

      // Mock successful API response with streaming chunks
      let callCount = 0;
      const mockReader = {
        read: vi.fn().mockImplementation(() => {
          if (callCount < mockResponseParts.length) {
            const part = mockResponseParts[callCount++];
            return Promise.resolve({
              done: false,
              value: new TextEncoder().encode(`0:${JSON.stringify(part)}\n`)
            });
          }
          return Promise.resolve({ done: true, value: undefined });
        })
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        body: {
          getReader: () => mockReader
        }
      });

      // Mock Pyodide execution
      (mockPyodide.runPythonAsync as any)
        .mockResolvedValueOnce(undefined) // Setup stdout/stderr
        .mockResolvedValueOnce(undefined) // Execute code
        .mockResolvedValueOnce('Hello, World!') // Get stdout
        .mockResolvedValueOnce(''); // Get stderr

      await agent.processQuery('test query', onStep);

      // Check that thought and code steps were called
      expect(steps.some(s => s.type === 'thought')).toBe(true);
      expect(steps.some(s => s.type === 'code')).toBe(true);
      expect(steps.some(s => s.type === 'result')).toBe(true);
    });

    it('should handle response without code block', async () => {
      const mockResponse = 'Just a text response without code';

      const mockReader = {
        read: vi.fn()
          .mockResolvedValueOnce({
            done: false,
            value: new TextEncoder().encode(`0:"${mockResponse}"\\n`)
          })
          .mockResolvedValueOnce({ done: true, value: undefined })
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        body: {
          getReader: () => mockReader
        }
      });

      await agent.processQuery('test query', onStep);

      // Should have result step with full response
      const resultStep = steps.find(s => s.type === 'result');
      expect(resultStep).toBeDefined();
    });
  });

  describe('executeCode', () => {
    it('should execute Python code and return output', async () => {
      const code = 'print("Test output")';
      const fullResponse = `**Code:**\n\`\`\`python\n${code}\n\`\`\``;

      let callCount = 0;
      const mockReader = {
        read: vi.fn().mockImplementation(() => {
          if (callCount === 0) {
            callCount++;
            return Promise.resolve({
              done: false,
              value: new TextEncoder().encode(`0:${JSON.stringify(fullResponse)}\n`)
            });
          }
          return Promise.resolve({ done: true, value: undefined });
        })
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        body: {
          getReader: () => mockReader
        }
      });

      (mockPyodide.runPythonAsync as any)
        .mockResolvedValueOnce(undefined) // Setup stdout/stderr
        .mockResolvedValueOnce(undefined) // Execute code
        .mockResolvedValueOnce('Test output\n') // Get stdout
        .mockResolvedValueOnce(''); // Get stderr

      await agent.processQuery('run code', onStep);

      const resultStep = steps.find(s => s.type === 'result');
      expect(resultStep).toBeDefined();
      expect(resultStep?.content).toContain('Test output');
    });

    it('should handle execution errors', async () => {
      const fullResponse = '**Code:**\n```python\nraise Exception("error")\n```';

      let callCount = 0;
      const mockReader = {
        read: vi.fn().mockImplementation(() => {
          if (callCount === 0) {
            callCount++;
            return Promise.resolve({
              done: false,
              value: new TextEncoder().encode(`0:${JSON.stringify(fullResponse)}\n`)
            });
          }
          return Promise.resolve({ done: true, value: undefined });
        })
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        body: {
          getReader: () => mockReader
        }
      });

      (mockPyodide.runPythonAsync as any)
        .mockResolvedValueOnce(undefined) // Setup stdout/stderr
        .mockRejectedValueOnce(new Error('Python execution error'));

      await agent.processQuery('bad code', onStep);

      const errorStep = steps.find(s => s.type === 'error');
      expect(errorStep).toBeDefined();
    });

    it('should include stderr in output if present', async () => {
      const fullResponse = '**Code:**\n```python\nprint("output")\n```';

      let callCount = 0;
      const mockReader = {
        read: vi.fn().mockImplementation(() => {
          if (callCount === 0) {
            callCount++;
            return Promise.resolve({
              done: false,
              value: new TextEncoder().encode(`0:${JSON.stringify(fullResponse)}\n`)
            });
          }
          return Promise.resolve({ done: true, value: undefined });
        })
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        body: {
          getReader: () => mockReader
        }
      });

      (mockPyodide.runPythonAsync as any)
        .mockResolvedValueOnce(undefined) // Setup stdout/stderr
        .mockResolvedValueOnce(undefined) // Execute code
        .mockResolvedValueOnce('output\n') // Get stdout
        .mockResolvedValueOnce('Warning: deprecated'); // Get stderr

      await agent.processQuery('code with warnings', onStep);

      const resultStep = steps.find(s => s.type === 'result');
      expect(resultStep?.content).toContain('⚠️ Warnings:');
      expect(resultStep?.content).toContain('Warning: deprecated');
    });
  });

  describe('processQuery', () => {
    it('should call API with correct parameters', async () => {
      agent.updateAvailableFiles(['test.csv']);

      const mockReader = {
        read: vi.fn()
          .mockResolvedValueOnce({
            done: false,
            value: new TextEncoder().encode('0:"Response"\\n')
          })
          .mockResolvedValueOnce({ done: true, value: undefined })
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        body: {
          getReader: () => mockReader
        }
      });

      await agent.processQuery('analyze data', onStep);

      expect(global.fetch).toHaveBeenCalledWith('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: expect.stringContaining('analyze data')
      });
    });

    it('should handle API errors', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: false,
        json: async () => ({ error: 'API Error' })
      });

      await agent.processQuery('test query', onStep);

      const errorStep = steps.find(s => s.type === 'error');
      expect(errorStep).toBeDefined();
      expect(errorStep?.content).toContain('API Error');
    });

    it('should emit steps in correct order', async () => {
      const fullResponse = '**Thought:** thinking\n**Code:**\n```python\nprint("test")\n```';

      let callCount = 0;
      const mockReader = {
        read: vi.fn().mockImplementation(() => {
          if (callCount === 0) {
            callCount++;
            return Promise.resolve({
              done: false,
              value: new TextEncoder().encode(`0:${JSON.stringify(fullResponse)}\n`)
            });
          }
          return Promise.resolve({ done: true, value: undefined });
        })
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        body: {
          getReader: () => mockReader
        }
      });

      (mockPyodide.runPythonAsync as any)
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce('test\n')
        .mockResolvedValueOnce('');

      await agent.processQuery('test', onStep);

      // Check step order
      const stepTypes = steps.map(s => s.type);
      expect(stepTypes[0]).toBe('thought'); // Initial thinking
      expect(stepTypes).toContain('thought'); // Parsed thought
      expect(stepTypes).toContain('code');
      expect(stepTypes).toContain('result');
    });
  });
});

describe('MockDataAgent', () => {
  let mockPyodide: PyodideInterface;
  let mockAgent: MockDataAgent;
  let steps: AgentStep[];
  const onStep = (step: AgentStep) => steps.push(step);

  beforeEach(() => {
    mockPyodide = createMockPyodide();
    mockAgent = new MockDataAgent(mockPyodide);
    steps = [];
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('Constructor and Basic Methods', () => {
    it('should create an instance', () => {
      expect(mockAgent).toBeInstanceOf(MockDataAgent);
    });

    it('should update available files', () => {
      const files = ['test.csv'];
      mockAgent.updateAvailableFiles(files);
      expect(mockAgent).toBeDefined();
    });

    it('should reset without errors', () => {
      mockAgent.reset();
      expect(mockAgent).toBeDefined();
    });
  });

  describe('processQuery with files', () => {
    it('should generate code for CSV files', async () => {
      mockAgent.updateAvailableFiles(['data.csv']);

      (mockPyodide.runPythonAsync as any)
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce('Dataset info')
        .mockResolvedValueOnce('');

      const promise = mockAgent.processQuery('analyze', onStep);
      await vi.runAllTimersAsync();
      await promise;

      const codeStep = steps.find(s => s.type === 'code');
      expect(codeStep).toBeDefined();
      expect(codeStep?.content).toContain('read_csv');
      expect(codeStep?.content).toContain('data.csv');
    });

    it('should generate code for Excel files', async () => {
      mockAgent.updateAvailableFiles(['data.xlsx']);

      (mockPyodide.runPythonAsync as any)
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce('Dataset info')
        .mockResolvedValueOnce('');

      const promise = mockAgent.processQuery('analyze', onStep);
      await vi.runAllTimersAsync();
      await promise;

      const codeStep = steps.find(s => s.type === 'code');
      expect(codeStep).toBeDefined();
      expect(codeStep?.content).toContain('read_excel');
      expect(codeStep?.content).toContain('data.xlsx');
    });
  });

  describe('processQuery without files', () => {
    it('should generate sample data when no files available', async () => {
      (mockPyodide.runPythonAsync as any)
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce('Sample data created')
        .mockResolvedValueOnce('');

      const promise = mockAgent.processQuery('test', onStep);
      await vi.runAllTimersAsync();
      await promise;

      const thoughtStep = steps.find(s => s.type === 'thought' && s.content.includes('sample dataset'));
      expect(thoughtStep).toBeDefined();

      const codeStep = steps.find(s => s.type === 'code');
      expect(codeStep?.content).toContain('np.random');
    });
  });

  describe('Code execution', () => {
    it('should execute generated code', async () => {
      (mockPyodide.runPythonAsync as any)
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce('Execution output')
        .mockResolvedValueOnce('');

      const promise = mockAgent.processQuery('test', onStep);
      await vi.runAllTimersAsync();
      await promise;

      const resultStep = steps.find(s => s.type === 'result');
      expect(resultStep).toBeDefined();
      expect(resultStep?.content).toBe('Execution output');
    });

    it('should handle execution errors', async () => {
      (mockPyodide.runPythonAsync as any)
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('Execution failed'));

      const promise = mockAgent.processQuery('test', onStep);
      await vi.runAllTimersAsync();
      await promise;

      const errorStep = steps.find(s => s.type === 'error');
      expect(errorStep).toBeDefined();
      expect(errorStep?.content).toContain('Execution error');
    });

    it('should show warnings if stderr is present', async () => {
      (mockPyodide.runPythonAsync as any)
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce('Output')
        .mockResolvedValueOnce('Warning message');

      const promise = mockAgent.processQuery('test', onStep);
      await vi.runAllTimersAsync();
      await promise;

      const resultStep = steps.find(s => s.type === 'result');
      expect(resultStep?.content).toContain('⚠️ Warnings:');
      expect(resultStep?.content).toContain('Warning message');
    });
  });

  describe('Step timing', () => {
    it('should emit steps with delays', async () => {
      (mockPyodide.runPythonAsync as any)
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce('output')
        .mockResolvedValueOnce('');

      const promise = mockAgent.processQuery('test', onStep);

      // Fast-forward through all timers
      await vi.runAllTimersAsync();
      await promise;

      // Check all steps were emitted
      expect(steps.filter(s => s.type === 'thought').length).toBeGreaterThan(0);
      expect(steps.some(s => s.type === 'code')).toBe(true);
      expect(steps.some(s => s.type === 'result')).toBe(true);
    });
  });
});
