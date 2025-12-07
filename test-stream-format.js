// Test what format the AI SDK actually returns
async function testStreamFormat() {
  console.log('\n🧪 Testing AI SDK Stream Format');
  console.log('━'.repeat(80));

  const response = await fetch('http://localhost:54891/api/agent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: [{ role: 'user', content: 'Say hi in 2 words' }],
      availableFiles: []
    })
  });

  console.log('📡 Status:', response.status);
  console.log('📋 Content-Type:', response.headers.get('content-type'));

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let chunkNum = 0;

  console.log('\n📥 Raw chunks:');
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    chunkNum++;
    const chunk = decoder.decode(value, { stream: true });

    console.log(`\n--- Chunk ${chunkNum} ---`);
    console.log('Length:', chunk.length);
    console.log('Raw bytes:', Array.from(value.slice(0, 50)).map(b => b.toString(16).padStart(2, '0')).join(' '));
    console.log('Decoded text:', JSON.stringify(chunk));
    console.log('First 200 chars:', chunk.substring(0, 200));

    // Try different parsing strategies
    console.log('\nParsing attempts:');

    // Strategy 1: Lines starting with 0:
    const lines = chunk.split('\n');
    console.log('- Split into', lines.length, 'lines');
    lines.forEach((line, i) => {
      if (line.trim()) {
        console.log(`  Line ${i}:`, line.substring(0, 100));
        if (line.startsWith('0:')) {
          console.log('    ✓ Matches 0: pattern');
        }
      }
    });
  }

  console.log('\n✅ Stream complete');
  console.log('Total chunks:', chunkNum);
  console.log('━'.repeat(80));
}

testStreamFormat().catch(console.error);
