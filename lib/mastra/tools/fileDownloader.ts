import { createTool } from '@mastra/core';
import { z } from 'zod';

/**
 * File Downloader Tool
 * Downloads a file from a URL and saves it to the Pyodide virtual filesystem
 */
export const fileDownloader = createTool({
  id: 'file-downloader',
  description: 'Download a file from a URL and save it to the virtual filesystem. Use this when the user provides a URL to a CSV, Excel, or other data file.',
  inputSchema: z.object({
    url: z.string().url().describe('The URL of the file to download'),
    filename: z.string().optional().describe('Optional filename to save as. If not provided, will extract from URL'),
  }),
  execute: async () => {
    // This tool will be executed on the frontend where we have access to fetch and Pyodide
    // The actual execution logic is handled in the frontend
    return {
      success: true,
      message: 'File download initiated'
    };
  },
});

export default fileDownloader;
