# Architecture rules
- Normalize all imported and restored analysis payloads through a shared runtime schema so visualizations never consume unchecked JSON.
- Infer survival statistics only from individual observed outcomes or supplied validated statistics, never reconstructed subtype mixtures.
- Persist analyses through a transactional user-scoped operation and keep full canonical payloads for lossless restoration.
- Keep regression tests beside data and numerical utilities; compare numerical results with independent reference fixtures.