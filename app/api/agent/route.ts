import { createAnthropic } from '@ai-sdk/anthropic';
import { streamText } from 'ai';

// Configure Anthropic with custom endpoint
const anthropic = createAnthropic({
  baseURL: 'http://23.106.130.6:3000/api/v1',  // Hardcoded due to Edge Runtime env var caching issue
  apiKey: process.env.ANTHROPIC_AUTH_TOKEN,
});

export const runtime = 'edge';

export async function POST(req: Request) {
  try {
    console.log('🚀 [API Route] Received request');
    const { messages, availableFiles } = await req.json();
    console.log('📩 [API Route] Messages:', JSON.stringify(messages, null, 2));
    console.log('📁 [API Route] Available files:', availableFiles);

    // Build system prompt with file context
    const systemPrompt = `You are a data analysis assistant with access to a Python (Pyodide) environment. You help users analyze data by:
1. Understanding their requirements
2. Writing Python code to analyze the data
3. Explaining your thought process

Available libraries: pandas, numpy, matplotlib

${availableFiles && availableFiles.length > 0 ? `Available files in the virtual filesystem: ${availableFiles.join(', ')}` : 'No files uploaded yet.'}

IMPORTANT: Format your response as follows:

**Thought:** [Explain what you're going to do and why]

**Code:**
\`\`\`python
# Your Python code here
# Use print() statements to show results
\`\`\`

Keep responses focused and concise. Write complete, executable Python code.`;

    console.log('🤖 [API Route] Calling AI SDK with model: claude-sonnet-4-5-20250929');
    console.log('🔧 [API Route] Base URL: http://23.106.130.6:3000/api/v1 (hardcoded)');
    console.log('🔑 [API Route] Has API Key:', !!process.env.ANTHROPIC_AUTH_TOKEN);

    const result = streamText({
      model: anthropic('claude-sonnet-4-5-20250929'),
      system: systemPrompt,
      messages,
      temperature: 0.7,
      maxTokens: 2000,
    });

    console.log('📤 [API Route] Returning stream response');
    return result.toTextStreamResponse();
  } catch (error: any) {
    console.error('Agent API error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to process request' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
