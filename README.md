# Roblox Brain

A flat, iPad-friendly personal AI chatbot focused on Roblox + Luau coding, memory, images, and code-file export.

## ZIP structure

This repository is intentionally **100% flat**. There are **NO folders** inside the ZIP. Every file is at the repository root so it can be uploaded from iOS/iPad without nested-directory handling.

## Included

- Chat mode + Code mode
- Roblox/Luau-focused coding behavior
- Editable local memory
- Auto-style memory for recurring slang/emoji energy
- Image and text-file attachments
- Streaming responses
- Model + reasoning settings
- Dark/light/system themes
- Compact/comfortable layout
- Copy + Save buttons for generated code
- Multiple persistent chats
- iPad/mobile-friendly UI
- Server-side AI Gateway key; no API key in frontend

## AI setup

Set `AI_GATEWAY_API_KEY` as a Vercel environment variable. Do not put the key in GitHub.

The model names are configurable in `app.js` and `chat.js` so you can use models currently available to your AI Gateway account.

## Deploy

1. Create a GitHub repository.
2. Upload the files from this repository directly to the root.
3. Import the repository into Vercel.
4. Add `AI_GATEWAY_API_KEY` to the Vercel project's environment variables.
5. Deploy.

## Local

Node 18+ is enough. Run `AI_GATEWAY_API_KEY="your-key" npm run dev`, then open `http://localhost:3000`.
