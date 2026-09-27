export async function moderateContent(subject, description) {
  const response = await fetch('/api/moderate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subject, description }),
  });
  if (!response.ok) {
    throw new Error(`Moderation server responded with ${response.status}`);
  }
  return await response.json();
}
