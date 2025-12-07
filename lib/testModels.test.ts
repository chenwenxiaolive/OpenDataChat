import { describe, it } from 'vitest';

describe('Test Available Models', () => {
  const ANTHROPIC_BASE_URL = process.env.ANTHROPIC_BASE_URL || 'http://23.106.130.6:3000';
  const ANTHROPIC_AUTH_TOKEN = process.env.ANTHROPIC_AUTH_TOKEN || '';

  const modelsToTest = [
    'claude-3-5-sonnet-20241022',
    'claude-3-5-sonnet-latest',
    'claude-3-sonnet-20240229',
    'claude-3-opus-20240229',
    'claude-3-haiku-20240307',
    'claude-2.1',
    'claude-2.0',
  ];

  modelsToTest.forEach(model => {
    it(`should test model: ${model}`, async () => {
      console.log(`\n🧪 Testing model: ${model}`);
      console.log('━'.repeat(80));

      const response = await fetch(`${ANTHROPIC_BASE_URL}/v1/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': ANTHROPIC_AUTH_TOKEN,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model,
          max_tokens: 10,
          messages: [{ role: 'user', content: 'Hi' }]
        })
      });

      const responseText = await response.text();

      console.log('Status:', response.status);
      if (!response.ok) {
        console.log('❌ Error:', responseText);
      } else {
        console.log('✅ Success!');
        const data = JSON.parse(responseText);
        console.log('Response:', data.content?.[0]?.text || data);
      }
      console.log('━'.repeat(80));
    }, 10000);
  });
});
