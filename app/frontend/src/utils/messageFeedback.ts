export async function submitMessageFeedback(
  rating: 'up' | 'down',
  comment: string,
  agentMessage: string,
  lastUserMessage: string,
  context: { userName: string; agentId: string; agentName: string },
) {
  const submission = {
    id: `msgfb-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    userName: context.userName || 'Anonymous',
    agentId: context.agentId || '',
    agentName: context.agentName || 'Copilot Studio',
    rating,
    comment,
    lastUserMessage,
    agentMessage,
    submittedAt: new Date().toISOString(),
  };
  try {
    await fetch('/api/message-feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(submission),
    });
  } catch {
    const saved = JSON.parse(localStorage.getItem('messageFeedback') || '[]');
    saved.push(submission);
    localStorage.setItem('messageFeedback', JSON.stringify(saved));
  }
}
