// Test the Next.js API route directly
async function testAPI() {
  console.log('\n🧪 Testing Next.js API Route');
  console.log('━'.repeat(80));

  const response = await fetch('http://localhost:54891/api/agent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: [
        { role: 'user', content: 'Say hello' }
      ],
      availableFiles: []
    })
  });

  console.log('📡 Status:', response.status);
  console.log('📋 Headers:', Object.fromEntries(response.headers.entries()));

  if (!response.ok) {
    const error = await response.text();
    console.error('❌ Error:', error);
    return;
  }

  // Read the streaming response
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let fullResponse = '';
  let chunkCount = 0;

  console.log('\n📥 Receiving chunks:');
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    chunkCount++;
    const chunk = decoder.decode(value, { stream: true });
    console.log(`\nChunk ${chunkCount}:`);
    console.log('Raw:', chunk.substring(0, 200));

    const lines = chunk.split('\n');
    console.log(`Lines (${lines.length}):`, lines.map(l => l.substring(0, 50)));

    for (const line of lines) {
      if (line.startsWith('0:')) {
        const jsonStr = line.substring(2);
        try {
          const data = JSON.parse(jsonStr);
          console.log('Parsed data type:', typeof data);
          if (typeof data === 'string') {
            fullResponse += data;
            console.log('  Text chunk:', data);
          }
        } catch (e) {
          console.error('  Failed to parse:', line);
        }
      }
    }
  }

  console.log('\n✅ Complete Response:');
  console.log('━'.repeat(80));
  console.log(fullResponse);
  console.log('━'.repeat(80));
  console.log(`Total chunks: ${chunkCount}`);
  console.log(`Response length: ${fullResponse.length} chars`);
}

testAPI().catch(console.error);
