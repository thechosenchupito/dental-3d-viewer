---
name: o3dv-website-viewer
description: Use when changing the Online 3D Viewer browser UI, dialogs, navigation, settings, plugins, CSS, or website-to-engine integration.
---

# Website and viewer UI development

Use this skill for the vanilla JavaScript browser application under `source/website` and its CSS under `source/website/css`. The website composes the engine's viewer; it is not a React application.

## Follow the existing UI architecture

- Trace the feature through `source/website/website.js`, the closest focused UI module, and `source/website/index.js` before changing structure. Keep DOM behavior in the existing website modules and viewer behavior in the engine unless the feature genuinely crosses that boundary.
- Reuse existing dialog, panel, event, settings, and plugin patterns rather than creating parallel UI infrastructure. Preserve the plugin APIs in `pluginregistry.js` where relevant.
- Keep styles in the existing website CSS files and follow their naming/layout patterns. Check responsive panel and canvas sizing when changing layout or controls.
- Visible text should use the existing localization helpers such as `Loc`; trace the current locale-data loading path when a new translatable string needs entries.
- Preserve keyboard and pointer interaction semantics, accessible names/focus behavior, and clear loading/error feedback when changing controls or dialogs.

## Viewer and Three.js integration

- Use the existing viewer/model-loader interfaces for displaying or replacing models. Avoid constructing a parallel scene or loader when the viewer already owns that lifecycle.
- Dispose of Three.js resources and listeners according to the existing ownership and cleanup patterns; do not assume a UI module owns resources managed by the engine.
- Check `package.json` for the installed Three.js version and use the project's existing APIs and module/bundling setup.

## Validation

- Run `npm run lint` for source changes and `npm run build_website` to validate the production website bundle. Use `npm run build_website_dev` when the development bundle is specifically needed.
- The current test suite is engine-focused and does not provide a general website browser-test harness. Add tests only where behavior fits the existing harness, and do not claim UI behavior was browser-tested unless it was.
