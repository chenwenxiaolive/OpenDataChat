import { createTool } from '@mastra/core';
import { z } from 'zod';

/**
 * Python Executor Tool for Mastra
 * Executes Python code in Pyodide environment
 */
export const pythonExecutor = createTool({
  id: 'python-executor',
  description: 'Execute Python code in a Pyodide environment. Use this to run data analysis code with pandas, numpy, and matplotlib.',
  inputSchema: z.object({
    code: z.string().describe('The Python code to execute'),
    files: z.array(z.string()).optional().describe('List of available files in the virtual filesystem'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    output: z.string().optional(),
    error: z.string().optional(),
  }),
  execute: async ({ context }) => {
    const { code, files } = context;

    try {
      // Note: This will be called from the browser side where Pyodide is available
      // The actual execution happens in the frontend
      return {
        success: true,
        output: `Code queued for execution:\n${code}`,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || String(error),
      };
    }
  },
});
