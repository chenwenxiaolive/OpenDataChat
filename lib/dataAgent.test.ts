import { describe, it, expect, beforeAll, vi } from 'vitest';

describe('AI Agent API Tests', () => {
  const ANTHROPIC_BASE_URL = process.env.ANTHROPIC_BASE_URL || 'http://23.106.130.6:3000';
  const ANTHROPIC_AUTH_TOKEN = process.env.ANTHROPIC_AUTH_TOKEN || '';

  beforeAll(() => {
    if (!ANTHROPIC_AUTH_TOKEN) {
      console.warn('Warning: ANTHROPIC_AUTH_TOKEN not set');
    }
    console.log('Testing with base URL:', ANTHROPIC_BASE_URL);
  });

  it('should call Anthropic API directly with correct endpoint', async () => {
    const messages = [
      {
        role: 'user' as const,
        content: 'Say hello in one word'
      }
    ];

    const systemPrompt = 'You are a helpful assistant. Respond concisely.';

    console.log('\n🧪 Test: Direct Anthropic API Call');
    console.log('━'.repeat(80));
    console.log('Base URL:', ANTHROPIC_BASE_URL);
    console.log('Endpoint:', `${ANTHROPIC_BASE_URL}/v1/messages`);
    console.log('Has Auth Token:', !!ANTHROPIC_AUTH_TOKEN);
    console.log('Request Body:', JSON.stringify({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 100,
      messages,
      system: systemPrompt
    }, null, 2));

    const response = await fetch(`${ANTHROPIC_BASE_URL}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_AUTH_TOKEN,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 100,
        messages,
        system: systemPrompt
      })
    });

    console.log('\n📡 Response Status:', response.status);
    console.log('Response Headers:', Object.fromEntries(response.headers.entries()));

    const responseText = await response.text();
    console.log('\n📦 Response Body:', responseText);
    console.log('━'.repeat(80));

    expect(response.ok).toBe(true);

    const data = JSON.parse(responseText);
    expect(data).toHaveProperty('content');
    expect(Array.isArray(data.content)).toBe(true);
    expect(data.content.length).toBeGreaterThan(0);
    expect(data.content[0]).toHaveProperty('text');

    console.log('\n✅ AI Response:', data.content[0].text);
  });

  it('should call Anthropic API with streaming', async () => {
    const messages = [
      {
        role: 'user' as const,
        content: 'Count from 1 to 3'
      }
    ];

    const systemPrompt = 'You are a helpful assistant.';

    console.log('\n🧪 Test: Streaming Anthropic API Call');
    console.log('━'.repeat(80));

    const response = await fetch(`${ANTHROPIC_BASE_URL}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_AUTH_TOKEN,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 100,
        messages,
        system: systemPrompt,
        stream: true
      })
    });

    console.log('\n📡 Response Status:', response.status);
    console.log('Content-Type:', response.headers.get('content-type'));

    expect(response.ok).toBe(true);
    expect(response.body).not.toBeNull();

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let fullText = '';
    let eventCount = 0;

    console.log('\n📥 Streaming events:');
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          eventCount++;
          const data = line.substring(6);
          console.log(`Event ${eventCount}:`, data.substring(0, 100));

          if (data !== '[DONE]') {
            try {
              const event = JSON.parse(data);
              if (event.type === 'content_block_delta' && event.delta?.text) {
                fullText += event.delta.text;
              }
            } catch (e) {
              console.error('Failed to parse event:', data);
            }
          }
        }
      }
    }

    console.log('\n✅ Full streamed text:', fullText);
    console.log('Total events:', eventCount);
    console.log('━'.repeat(80));

    expect(eventCount).toBeGreaterThan(0);
    expect(fullText.length).toBeGreaterThan(0);
  });

  it('should test the Next.js API route', async () => {
    console.log('\n🧪 Test: Next.js API Route /api/agent');
    console.log('━'.repeat(80));

    // This test will only work if Next.js is running
    try {
      const response = await fetch('http://localhost:54891/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            { role: 'user', content: 'Say hello in one word' }
          ],
          availableFiles: []
        })
      });

      console.log('📡 Response Status:', response.status);
      console.log('Content-Type:', response.headers.get('content-type'));

      if (!response.ok) {
        const errorText = await response.text();
        console.log('❌ Error Response:', errorText);
        throw new Error(`API returned ${response.status}: ${errorText}`);
      }

      // Read streaming response
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullResponse = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          console.log('📦 Chunk:', chunk.substring(0, 100));

          const lines = chunk.split('\n');
          for (const line of lines) {
            if (line.startsWith('0:')) {
              const jsonStr = line.substring(2);
              try {
                const data = JSON.parse(jsonStr);
                if (typeof data === 'string') {
                  fullResponse += data;
                }
              } catch (e) {
                console.error('Failed to parse:', line);
              }
            }
          }
        }
      }

      console.log('\n✅ Full Response:', fullResponse);
      console.log('━'.repeat(80));

      expect(fullResponse.length).toBeGreaterThan(0);
    } catch (error: any) {
      console.error('❌ Test failed:', error.message);
      // Don't fail the test if server is not running
      if (error.message.includes('fetch failed') || error.message.includes('ECONNREFUSED')) {
        console.log('⚠️  Skipping test - Next.js server not running');
      } else {
        throw error;
      }
    }
  });

  it('should verify environment variables', () => {
    console.log('\n🧪 Test: Environment Variables');
    console.log('━'.repeat(80));
    console.log('ANTHROPIC_BASE_URL:', process.env.ANTHROPIC_BASE_URL);
    console.log('ANTHROPIC_AUTH_TOKEN:', process.env.ANTHROPIC_AUTH_TOKEN ? '✓ Set' : '✗ Not set');
    console.log('━'.repeat(80));

    expect(process.env.ANTHROPIC_BASE_URL).toBeDefined();
    expect(process.env.ANTHROPIC_AUTH_TOKEN).toBeDefined();
  });
});
