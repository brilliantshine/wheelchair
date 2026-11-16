# Remediation 2 — sudo-cards

Verification attempt 2 at `0de3bc1`. GPT verifier (`wc-306ee0793e11-verifier-4`, gpt-6.1-sol): PASS. Claude verifier (`wc-306ee0793e11-verifier-3`, claude-opus-5-5): FAIL. Its result did not reach the sub-lead through the app; the lead copied it from the verifier's pane and forwarded it.

## Gap list (verbatim)

GAP: Editable-file warning, "A path is flagged when the user, with their groups, could write it or any directory above it": a file or directory Collin's user owns but has made read-only gets no warning, though that user can always chmod u+w it and rewrite it. sudo-helper/helper.py:54: for an owned file, writable() looks only at S_IWUSR. Owning the file (or any directory above it) should count as writable. Probe: user owns /usr/local/bin/tool mode 0555, parents root:root 0755; editable('/usr/local/bin/tool --fix', user) returned []. No test covers an owned read-only file (sudo-helper/test/test_helper.py:121-127).

## Tasks

### R2-1 — owning a path counts as being able to write it

`writable()` in `sudo-helper/helper.py` returns true when the path's owner is the user, whatever the mode bits; a test covers an owned read-only file and an owned read-only directory above a root-owned-looking name. Lane: light, `--provider gpt` (T1 was built by GPT). Brief in the scratchpad (`R2-1.md`).
