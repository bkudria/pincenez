# Changelog

## [0.2.0](https://github.com/bkudria/pincenez/compare/v0.1.1...v0.2.0) (2026-07-03)


### Features

* **auth:** never use CLAUDE_CODE_OAUTH_TOKEN; add CLAUDE_SDK_OAUTH_TOKEN ([#58](https://github.com/bkudria/pincenez/issues/58)) ([2236a59](https://github.com/bkudria/pincenez/commit/2236a598ceb2dcb6c82ffa7e736ca3072503e240))
* **auth:** prefer Claude subscription credentials over the API key ([#57](https://github.com/bkudria/pincenez/issues/57)) ([91b4d68](https://github.com/bkudria/pincenez/commit/91b4d685d625de3848d00fb432d2b1f8b6f4ac86))
* **lint:** add unfalsifiable anti-pattern for vacuous checks ([#40](https://github.com/bkudria/pincenez/issues/40)) ([435f2b0](https://github.com/bkudria/pincenez/commit/435f2b0e91c5b103d979de2ef9120d0011080aa9))
* **lint:** carve out pure ordering claims from compound ([#51](https://github.com/bkudria/pincenez/issues/51)) ([b870e90](https://github.com/bkudria/pincenez/commit/b870e90930c399095313eb6346c74824bfceafea))
* **lint:** ground judges in tool availability and the transcript field contract ([#45](https://github.com/bkudria/pincenez/issues/45)) ([ed506b4](https://github.com/bkudria/pincenez/commit/ed506b42eccba9ce2f8511524cc28cd71325fef2))
* **lint:** honor note-declared intent for regression and presence-anchor checks ([#48](https://github.com/bkudria/pincenez/issues/48)) ([ac3d86c](https://github.com/bkudria/pincenez/commit/ac3d86c2ef34936c6e7016c0fe8cc3d0d224ab01))
* **lint:** name 5 Common Slips under their parent anti-patterns ([#39](https://github.com/bkudria/pincenez/issues/39)) ([f8623a0](https://github.com/bkudria/pincenez/commit/f8623a0b7d5fc2b81f298fe9c48523a3254733bf))
* **lint:** sanction the outcome-plus-non-exhaustive-examples check form ([#50](https://github.com/bkudria/pincenez/issues/50)) ([4852637](https://github.com/bkudria/pincenez/commit/4852637bbdb9d76c08ea521c5cfbcb088e43dda6))
* **lint:** unverifiable recognises plugin-component tool calls as observable ([#36](https://github.com/bkudria/pincenez/issues/36)) ([f09ddf1](https://github.com/bkudria/pincenez/commit/f09ddf14006845e8d48a666a3307c8d845a1d502))
* **prompt:** orient grader to plugin-component evidence in YAML transcripts ([#38](https://github.com/bkudria/pincenez/issues/38)) ([569060b](https://github.com/bkudria/pincenez/commit/569060b32ea79a920e301e8cbad65a035b3aa56c))

## [0.1.1](https://github.com/bkudria/pincenez/compare/v0.1.0...v0.1.1) (2026-05-20)


### Bug Fixes

* **grader:** grant Read access to output dir under SDK 0.3 sandbox ([#12](https://github.com/bkudria/pincenez/issues/12)) ([8c7158c](https://github.com/bkudria/pincenez/commit/8c7158c95c868524b1509a28afac55aa9a2f8de0))

## [0.1.0](https://github.com/bkudria/pincenez/compare/v0.0.1...v0.1.0) (2026-05-17)


### Features

* **linter:** constrain anti_pattern in JSON schema to AntiPattern enum ([b9f9adb](https://github.com/bkudria/pincenez/commit/b9f9adb5e3dca5db1ba036835071b39f0efb9c6f))


### Bug Fixes

* **cli:** read --version from package.json instead of hardcoding ([1ae35c2](https://github.com/bkudria/pincenez/commit/1ae35c23ab7bf4f565602deacbfa6fe37c0553ad))
* **deps:** upgrade @anthropic-ai/claude-agent-sdk to ^0.3.143 ([5d58459](https://github.com/bkudria/pincenez/commit/5d584591280ba5555ef62b0ab420c92105e6b43d))

## Changelog
