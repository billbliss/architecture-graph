export function formatGreeting(name = '', tone = 'friendly') {
  const person = name.trim() || 'world';
  if (tone === 'friendly') return `Hello, ${person}!`;
  if (tone === 'formal') return `Good day, ${person}.`;
  throw new Error(`Unsupported tone: ${tone}`);
}
