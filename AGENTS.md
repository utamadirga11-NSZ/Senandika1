<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Senandika chat streams through the `/api/chat` server route (verifies the user's bearer token, checks thread ownership via RLS, saves messages); persona text lives in `src/lib/ai/system-prompt.server.ts` — why: keeps the prompt and AI key server-side.
- Threads and messages are per-user tables with RLS; each thread has its own `/chat/$threadId` page — why: reload restores the same conversation.
- Live voice uses the shared server relay and lifecycle hook at `/api/live`, authenticates the initial socket message and verifies thread ownership and saved age before starting a paid session; reuse the text persona and age guidance — why: spoken support must follow the same protections and identity as chat.
- Visible chat messages are filtered by the shared message helper before rendering — why: streaming placeholders and repeated IDs must not create duplicate bubbles.
