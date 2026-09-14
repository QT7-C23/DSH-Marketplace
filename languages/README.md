# Shared interface languages

The backend and React plugin share `zh-CN.json`, `en-US.json`, and `ja-JP.json`. Use stable message keys through `translate(locale, key, values)`. Update all three files together; `npm run verify` checks matching keys and placeholders.

The plugin Settings page persists interface language in browser storage. API errors use `x-market-language`; unsupported values fall back to Chinese. Known legacy messages are translated at the presentation boundary. Upstream resource bodies, authors, licenses and unrecognized diagnostics retain their original text.

Keep `{count}`-style interface placeholders identical across translations. Prompt placeholders such as `{{variable}}` are resource content and are not substituted by the translation layer.
