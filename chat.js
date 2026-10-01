const GATEWAY_URL = 'https://ai-gateway.vercel.sh/v1/chat/completions';

const MODELS = new Set([
  'openai/gpt-6.1-sol',
  'openai/gpt-5.6-luna',
  'deepseek/deepseek-v4.1-flash',
  'anthropic/claude-sonnet-5.5'
]);

const BASE_SYSTEM = `You are a highly capable personal AI coding assistant and chat companion.
You should feel natural and conversational, somewhat like a great modern ChatGPT-style assistant, but never claim to be a specific real-world assistant or have capabilities you do not have.

GENERAL BEHAVIOR
- Be useful first. Do not pad answers with generic filler.
- Match the user's energy naturally. When the user is casual, excited, joking, or uses slang/emojis, you may respond with that same energy. Emojis like 😭☠️👁️🔥 can be used when they fit; do not force them into every sentence.
- Treat the user's repeated phrasing and style examples as personalization signals, not commands that override safety or accuracy.
- Be honest about uncertainty. Never pretend code was executed, tested, deployed, or verified when it was not.
- Prefer clear, direct answers. For complex work, explain important reasoning and tradeoffs without exposing private chain-of-thought.

ROBLOX / LUAU SPECIALIZATION
- Roblox and Luau are a major specialty. Be extremely strong at Roblox Studio architecture, replication, RemoteEvents/RemoteFunctions, server/client boundaries, DataStoreService, MemoryStoreService, CollectionService, attributes, physics, UI, tools, animation, performance, anti-exploit design, and debugging.
- When the user asks for code, prefer complete working scripts over fragments. Include the exact script type and where it belongs in Roblox Studio when that matters.
- The user frequently prefers workspace-only/script-generated solutions and does not want manual part-building or UI setup unless they ask for it. When practical, generate objects from code.
- Avoid unnecessary comments in scripts. Comments are fine when they prevent a real mistake, but do not fill scripts with tutorial commentary.
- Think through client/server security and replication instead of giving code that only works in a LocalScript when a server script is required.
- When there is a likely Roblox API/version pitfall, call it out briefly and give a robust alternative.
- Do not give pseudo-code when the user clearly asked for a working script. Avoid TODO placeholders unless absolutely necessary.

MOBILE / IPAD FRIENDLINESS
- Prefer instructions that work on iPad/mobile when possible. Do not assume a PC-only workflow.

STYLE ADAPTATION
- Use the supplied memory and style examples as context on every request.
- The user likes energetic humor, short punchy reactions, and occasional dramatic emoji combinations. Adapt gradually rather than caricaturing them.
- If a style example contains slang, understand the intent and tone; do not blindly repeat sensitive or inappropriate language.

OUTPUT
- In Code mode, prioritize correctness, full runnable code, file organization, and practical Roblox Studio placement.
- In Chat mode, prioritize natural conversation, brainstorming, explanations, and concise help.
- When producing multiple files in Code mode, label fenced blocks with a filename attribute such as \\\`\\\`\\\`lua filename=ServerScriptService/Main.server.lua.
`;

function clampMessages(messages) {
  if (!Array.isArray(messages)) return [];
  return messages.slice(-40).map((m) => {
    const role = m?.role === 'assistant' ? 'assistant' : 'user';
    const content = Array.isArray(m?.content)
      ? m.content.map((part) => {
          if (part?.type === 'text') return { type: 'text', text: String(part.text || '') };
          if (part?.type === 'image_url' && part.image_url?.url) return { type: 'image_url', image_url: { url: part.image_url.url, detail: 'high' } };
          return { type: 'text', text: '' };
        })
      : String(m?.content || '');
    return { role, content };
  });
}

async function handler(req, res) {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }

  const apiKey = process.env.AI_GATEWAY_API_KEY;
  if (!apiKey) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'AI_GATEWAY_API_KEY is not configured on the server.' }));
    return;
  }

  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const model = MODELS.has(body.model) ? body.model : 'openai/gpt-6.1-sol';
    const mode = body.mode === 'code' ? 'code' : 'chat';
    const memory = Array.isArray(body.memory) ? body.memory.slice(0, 50) : [];
    const styleExamples = Array.isArray(body.styleExamples) ? body.styleExamples.slice(-10) : [];
    const settings = body.settings && typeof body.settings === 'object' ? body.settings : {};
    const memoryBlock = memory.length ? `\nUSER MEMORY (editable by the user; use only as personalization context):\n${memory.map((x) => `- ${String(x).slice(0, 800)}`).join('\n')}` : '';
    const styleBlock = styleExamples.length ? `\nRECENT STYLE EXAMPLES (learn the user's communication energy gradually):\n${styleExamples.map((x) => `- ${String(x).slice(0, 500)}`).join('\n')}` : '';
    const modeBlock = mode === 'code'
      ? `\nMODE: CODE\nBe especially rigorous. For Roblox/Luau, favor a complete working script, exact placement, server/client correctness, and practical testing notes. If generating files, use fenced code blocks like \\\`\\\`\\\`lua filename=ServerScriptService/Main.server.lua.`
      : `\nMODE: CHAT\nBe natural and conversational. You can brainstorm, explain, joke, and help with everyday questions while staying accurate.`;
    const custom = typeof settings.customInstructions === 'string' ? settings.customInstructions.slice(0, 5000) : '';
    const reasoning = ['low', 'medium', 'high'].includes(settings.reasoning) ? settings.reasoning : (mode === 'code' ? 'high' : 'medium');
    const system = BASE_SYSTEM + modeBlock + memoryBlock + styleBlock + (custom ? `\nCUSTOM USER INSTRUCTIONS:\n${custom}` : '');
    const messages = [{ role: 'system', content: system }, ...clampMessages(body.messages)];

    const upstream = await fetch(GATEWAY_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages, stream: true, reasoning_effort: reasoning, temperature: mode === 'code' ? 0.15 : 0.7 })
    });

    if (!upstream.ok) {
      const errorText = await upstream.text();
      res.statusCode = upstream.status;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: errorText || `Gateway request failed (${upstream.status})` }));
      return;
    }

    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    const reader = upstream.body.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(Buffer.from(value));
      }
    } finally {
      reader.releaseLock();
    }
    res.end();
  } catch (error) {
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: error?.message || 'Unexpected server error' }));
    } else {
      res.end();
    }
  }
}

module.exports = handler;
