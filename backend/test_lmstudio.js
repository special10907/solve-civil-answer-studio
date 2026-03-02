async function testConnection() {
  const url = 'http://localhost:12434/v1/models';
  console.log(`Checking LM Studio models endpoint: ${url}`);
  try {
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      console.log('SUCCESS: Connected to LM Studio');
      console.log(JSON.stringify(data, null, 2));
    } else {
      console.log(`FAILED: Received status ${res.status}`);
      const text = await res.text();
      console.log(text);
    }
  } catch (err) {
    console.log(`ERROR: Could not connect to LM Studio. Is the server running?`);
    console.log(err.message);
  }
}

testConnection();
