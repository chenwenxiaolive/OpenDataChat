import { createAnthropic } from '@ai-sdk/anthropic';
import { streamText } from 'ai';

async function testAISDK() {
  console.log('\n🧪 Testing AI SDK directly');
  console.log('━'.repeat(80));

  const baseURL = process.env.ANTHROPIC_BASE_URL;
  const apiKey = process.env.ANTHROPIC_AUTH_TOKEN;

  console.log('Base URL:', baseURL);
  console.log('Has API Key:', !!apiKey);

  const anthropic = createAnthropic({
    baseURL: baseURL,
    apiKey: apiKey,
  });

  console.log('\n📤 Calling streamText...');

  try {
    const result = await streamText({
      model: anthropic('claude-sonnet-4-5-20250929'),
      messages: [
        { role: 'user', content: 'Say hello in 3 words' }
      ],
      temperature: 0.7,
      maxTokens: 50,
    });

    console.log('✅ StreamText returned');
    console.log('Result type:', typeof result);
    console.log('Result keys:', Object.keys(result));

    // Try toTextStreamResponse
    const response = result.toTextStreamResponse();
    console.log('\n📡 Response created');
    console.log('Response type:', response.constructor.name);
    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));

    // Read the body
    if (response.body) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let text = '';
      let chunkCount = 0;

      console.log('\n📥 Reading stream...');
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunkCount++;
        const chunk = decoder.decode(value, { stream: true });
        console.log(`Chunk ${chunkCount}:`, chunk.substring(0, 100));
        text += chunk;
      }

      console.log('\n✅ Full response:');
      console.log('━'.repeat(80));
      console.log(text);
      console.log('━'.repeat(80));
      console.log('Total chunks:', chunkCount);
    } else {
      console.log('❌ No body in response!');
    }
  } catch (error: any) {
    console.error('\n❌ Error:', error);
    console.error('Error type:', error.constructor.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
  }
}

testAISDK().catch(console.error);
