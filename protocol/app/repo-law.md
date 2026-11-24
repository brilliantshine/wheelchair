# The project's repo law

The law is the first file that exists at the root of your own checkout, in this order:
`CONTRIBUTING.md`, `.github/CONTRIBUTING.md`, `docs/CONTRIBUTING.md`. If none exists,
the rest of this file and every role rule referring to it do nothing. Steps-only verifier
work (Check it yourself) skips this file.

Read the law yourself, not through a scout or helper, before changing or judging anything.
Follow it. On the project's code, files, layout, tests and documentation it wins over your
judgement and role rules.

Wheelchair's role rules win on how agents coordinate (commits through `wc.js git`, pushes,
the mechanics of opening a PR, sessions, cards and each task's ownership boundary), which
validation commands run and when, and the format of wheelchair's own files (`docs/plans/`,
`docs/maps/`, mockups and reports). Send an edit the law needs outside a worker's boundary
to the sub-lead as a `message`. When the law clashes with these role rules, follow the role
rules and name the clash in your report or result; a verifier does not report it as a gap.
A PR's title, description and checklist follow the law as far as `wc.js git pr` allows;
name what it cannot do in the done card's `note`. In a project whose root `AGENTS.md` has a
`Test picker and full run` heading, a whole suite the law requires is covered by the full
run before each push: it goes in no Spec or verifier brief, and leaving it out is not a
finding or a gap. The law's targeted commands still go in.

There are no waivers. The law for a change is the law file at the merge-base used by the
verifier, amended by edits the plan's Spec names as its own items, or by edits the user's
small-fix request asks for. Plan, review, build and verify against that law. Add, loosen or
remove a rule only by such a named edit. Other upkeep, such as adding a suite to the
validation list, follows the file's own rules.
