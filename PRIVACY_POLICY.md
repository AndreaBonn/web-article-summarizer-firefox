# Privacy Policy - AI Article Summarizer

**Last updated:** 2026-05-23

## What this extension does

AI Article Summarizer extracts text content from web pages you visit and sends it to third-party AI services to generate summaries and key points. The extension only processes pages when you explicitly request a summary.

## Data collected

### Article content
When you click the summarize button, the extension extracts the main text content from the current page. This content is sent to one of the following AI providers, depending on your settings:

- Groq (api.groq.com)
- OpenAI (api.openai.com)
- Anthropic (api.anthropic.com)
- Google Gemini (generativelanguage.googleapis.com)

### API keys
Your API keys are stored locally in your browser using the `browser.storage.local` API. Keys are never transmitted to any server other than the corresponding AI provider.

### History and cache
Summaries and article metadata are stored locally in your browser storage. This data never leaves your device.

## Data NOT collected

- No personal information is collected
- No browsing history is tracked
- No analytics or telemetry is sent
- No cookies are set
- No data is sold or shared with third parties beyond the AI providers listed above

## Third-party services

Each AI provider has its own privacy policy governing how they handle the article content sent to them:

- [Groq Privacy Policy](https://groq.com/privacy-policy/)
- [OpenAI Privacy Policy](https://openai.com/privacy/)
- [Anthropic Privacy Policy](https://www.anthropic.com/privacy)
- [Google Privacy Policy](https://policies.google.com/privacy)

You choose which provider to use. The extension only contacts the provider you have configured.

## Permissions

- **activeTab**: access the current tab content when you request a summary
- **storage**: save your settings, API keys, and summary history locally
- **alarms**: schedule periodic cleanup of cached data
- **host_permissions**: connect to AI provider APIs to generate summaries

## Data retention

All data is stored locally and persists until you clear it through the extension's history page or uninstall the extension.

## Changes to this policy

Updates to this policy will be posted here and reflected in the extension's version notes on addons.mozilla.org.

## Contact

Andrea Bonacci - andreabonacci95@protonmail.com
