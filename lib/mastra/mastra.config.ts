import { Mastra } from '@mastra/core';
import { createAnthropic } from '@ai-sdk/anthropic';

// Configure Anthropic provider
const anthropic = createAnthropic({
  baseURL: 'http://23.106.130.6:3000/api/v1',
  apiKey: process.env.ANTHROPIC_AUTH_TOKEN!,
});

// Create Mastra instance
export const mastra = new Mastra({
  llms: {
    claude: {
      provider: 'ANTHROPIC',
      name: 'claude-sonnet-4-5-20250929',
      toolChoice: 'auto',
    },
  },
});

export default mastra;
