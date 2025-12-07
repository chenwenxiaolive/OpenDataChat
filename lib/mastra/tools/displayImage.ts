import { createTool } from '@mastra/core';
import { z } from 'zod';

/**
 * Display Image Tool for Mastra
 * Displays an image file from Pyodide's virtual filesystem
 */
export const displayImage = createTool({
  id: 'display-image',
  description: 'Display an image file that was saved to the virtual filesystem. Use this after saving a matplotlib plot to a file.',
  inputSchema: z.object({
    filepath: z.string().describe('The path to the image file in the virtual filesystem (e.g., "plot.png")'),
    title: z.string().optional().describe('Optional title for the image'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
  }),
  execute: async ({ context }) => {
    const { filepath, title } = context;

    try {
      // This will be handled on the frontend where the image file is read
      return {
        success: true,
        message: `Image queued for display: ${filepath}${title ? ` (${title})` : ''}`,
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || String(error),
      };
    }
  },
});
