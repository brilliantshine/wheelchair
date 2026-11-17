# Mac check

Please send back what happened at each numbered step, including any error message.
Do not send passwords or sign-in codes.

1. On the Mac, follow [On macOS](../../../README.md#on-macos) to install the needed
   apps and tools. In Terminal, open the wheelchair folder and type `./install.sh --serve`.
   You should see the installer finish and offer Tailscale mappings (the routes that let
   your phone reach the app). Accept the offered commands. Send back any errors.
2. In Terminal, type `node viewer/server.js --url`. On your phone, connected to the same
   Tailscale network, open the address it prints. You should see the app. Send back whether
   the mappings were set and the app opened; do not send the address, which contains a
   sign-in token.
3. In the app on your phone, open Settings and sign in to Claude and GPT. Start a new
   thread with a Claude session, then another with a GPT session. You should see each
   session start and respond. Send back whether each worked and any error message.
4. Restart the Mac, log in, and open the app on your phone again. You should see the app
   return. Send back whether it opened.
5. If you use two Claude accounts, sign both in from Settings. On the Mac, type
   `security dump-keychain | grep -c "Claude Code-credentials"` in Terminal. This counts
   matching saved login entries. Start a session on each account, then check Settings to
   see whether both still show as logged in. Send back the number and whether both stayed
   logged in. If you use only one account, say you skipped this step.
