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

describe('Integration Test: Say Hello', () => {
  let mockPyodide: PyodideInterface;
  let steps: AgentStep[];
  const onStep = (step: AgentStep) => {
    console.log(`[Step] ${step.type}: ${step.content.substring(0, 100)}...`);
    steps.push(step);
  };

  beforeEach(() => {
    mockPyodide = createMockPyodide();
    steps = [];
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('DataAgent - "say hello"', () => {
    it('should respond to "say hello" with Python print statement', async () => {
      const agent = new DataAgent(mockPyodide);

      // Mock AI response for "say hello"
      const aiResponse = `**Thought:** I'll create a simple Python script to print "Hello!"

**Code:**
\`\`\`python
print("Hello!")
print("Nice to meet you!")
\`\`\``;

      let callCount = 0;
      const mockReader = {
        read: vi.fn().mockImplementation(() => {
          if (callCount === 0) {
            callCount++;
            return Promise.resolve({
              done: false,
              value: new TextEncoder().encode(`0:${JSON.stringify(aiResponse)}\n`)
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
        .mockResolvedValueOnce('Hello!\nNice to meet you!\n') // Get stdout
        .mockResolvedValueOnce(''); // Get stderr

      // Execute
      await agent.processQuery('say hello', onStep);

      // Verify steps
      expect(steps.length).toBeGreaterThan(0);

      // Should have thinking step
      const thinkingSteps = steps.filter(s => s.type === 'thought');
      expect(thinkingSteps.length).toBeGreaterThan(0);

      // Should have code step
      const codeStep = steps.find(s => s.type === 'code');
      expect(codeStep).toBeDefined();
      expect(codeStep?.content).toContain('print');
      expect(codeStep?.content).toContain('Hello');

      // Should have result step
      const resultStep = steps.find(s => s.type === 'result');
      expect(resultStep).toBeDefined();
      expect(resultStep?.content).toContain('Hello');

      // Verify API was called correctly
      expect(global.fetch).toHaveBeenCalledWith('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: expect.stringContaining('say hello')
      });

      // Verify Pyodide was called
      expect(mockPyodide.runPythonAsync).toHaveBeenCalled();
    });

    it('should handle "say hello" with no files uploaded', async () => {
      const agent = new DataAgent(mockPyodide);
      agent.updateAvailableFiles([]);

      const aiResponse = `**Thought:** Simple greeting without file context

**Code:**
\`\`\`python
print("Hello! I'm your data analysis agent.")
print("Upload some data files and I'll help you analyze them!")
\`\`\``;

      let callCount = 0;
      (global.fetch as any).mockResolvedValue({
        ok: true,
        body: {
          getReader: () => ({
            read: vi.fn().mockImplementation(() => {
              if (callCount === 0) {
                callCount++;
                return Promise.resolve({
                  done: false,
                  value: new TextEncoder().encode(`0:${JSON.stringify(aiResponse)}\n`)
                });
              }
              return Promise.resolve({ done: true, value: undefined });
            })
          })
        }
      });

      (mockPyodide.runPythonAsync as any)
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce("Hello! I'm your data analysis agent.\nUpload some data files and I'll help you analyze them!\n")
        .mockResolvedValueOnce('');

      await agent.processQuery('say hello', onStep);

      const resultStep = steps.find(s => s.type === 'result');
      expect(resultStep?.content).toContain('Hello');
    });
  });

  describe('MockDataAgent - "say hello"', () => {
    it('should respond to "say hello" with generated code', async () => {
      const mockAgent = new MockDataAgent(mockPyodide);

      // Use fake timers for MockDataAgent
      vi.useFakeTimers();

      (mockPyodide.runPythonAsync as any)
        .mockResolvedValueOnce(undefined) // Setup
        .mockResolvedValueOnce(undefined) // Execute
        .mockResolvedValueOnce('Sample Dataset Created:\nShape: (100, 4)\n...') // Output
        .mockResolvedValueOnce(''); // Stderr

      const promise = mockAgent.processQuery('say hello', onStep);

      // Fast-forward timers
      await vi.runAllTimersAsync();
      await promise;

      vi.useRealTimers();

      // Verify steps were emitted
      expect(steps.length).toBeGreaterThan(0);

      // Should have thought step
      const thoughtStep = steps.find(s => s.type === 'thought');
      expect(thoughtStep).toBeDefined();

      // Should have code step
      const codeStep = steps.find(s => s.type === 'code');
      expect(codeStep).toBeDefined();
      expect(codeStep?.content).toContain('print');

      // Should have result step
      const resultStep = steps.find(s => s.type === 'result');
      expect(resultStep).toBeDefined();
    });

    it('should respond to "say hello" with HR dataset context', async () => {
      const mockAgent = new MockDataAgent(mockPyodide);
      mockAgent.updateAvailableFiles(['HRDataset_v14.csv']);

      vi.useFakeTimers();

      (mockPyodide.runPythonAsync as any)
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce('Dataset Overview:\nShape: 311 rows × 36 columns\n...')
        .mockResolvedValueOnce('');

      const promise = mockAgent.processQuery('say hello', onStep);

      await vi.runAllTimersAsync();
      await promise;

      vi.useRealTimers();

      // Should mention the file (skip the initial "Analyzing..." thought)
      const thoughtSteps = steps.filter(s => s.type === 'thought');
      const fileThought = thoughtSteps.find(t => t.content.includes('HRDataset'));
      expect(fileThought).toBeDefined();
      expect(fileThought?.content).toContain('HRDataset_v14.csv');

      // Code should use read_csv
      const codeStep = steps.find(s => s.type === 'code');
      expect(codeStep?.content).toContain('read_csv');
      expect(codeStep?.content).toContain('HRDataset_v14.csv');
    });
  });

  describe('Full Workflow Test', () => {
    it('should complete full "say hello" workflow with all steps', async () => {
      const agent = new DataAgent(mockPyodide);

      const fullResponse = `**Thought:** I'll greet you with a friendly Python message

**Code:**
\`\`\`python
# Simple greeting
message = "Hello! 👋"
print(message)
print("How can I help you with data analysis today?")
\`\`\``;

      let callCount = 0;
      (global.fetch as any).mockResolvedValue({
        ok: true,
        body: {
          getReader: () => ({
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
          })
        }
      });

      (mockPyodide.runPythonAsync as any)
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce('Hello! 👋\nHow can I help you with data analysis today?\n')
        .mockResolvedValueOnce('');

      await agent.processQuery('say hello', onStep);

      // Verify complete workflow
      const stepTypes = steps.map(s => s.type);

      // Should have all step types
      expect(stepTypes).toContain('thought');
      expect(stepTypes).toContain('code');
      expect(stepTypes).toContain('result');

      // Verify step order (thought comes before code, code before result)
      const thoughtIndex = stepTypes.indexOf('thought');
      const codeIndex = stepTypes.indexOf('code');
      const resultIndex = stepTypes.indexOf('result');

      expect(thoughtIndex).toBeGreaterThanOrEqual(0);
      expect(codeIndex).toBeGreaterThan(thoughtIndex);
      expect(resultIndex).toBeGreaterThan(codeIndex);

      // Verify content quality
      const thoughtStep = steps.find(s => s.type === 'thought');
      expect(thoughtStep?.content.length).toBeGreaterThan(10);

      const codeStep = steps.find(s => s.type === 'code');
      expect(codeStep?.content).toContain('print');
      expect(codeStep?.content).toMatch(/message|Hello/);

      const resultStep = steps.find(s => s.type === 'result');
      expect(resultStep?.content).toContain('Hello');
      expect(resultStep?.content).not.toContain('undefined');
      expect(resultStep?.content).not.toContain('null');

      console.log('\n=== Full Workflow Test Results ===');
      console.log('Steps executed:', steps.length);
      steps.forEach((step, i) => {
        console.log(`${i + 1}. [${step.type}] ${step.content.substring(0, 50)}...`);
      });
    });
  });
});
