# Changelog

## [1.0.0](https://github.com/jraylan/django-template-extension/commit/1fbc88316d1d3fa826dfcdf63d46bdb8710d0e3f) (2025-12-12)

### Added

- **Syntax Highlighting**: Full support for Django and Jinja2 template syntax
  - Template tags: `{% if %}`, `{% for %}`, `{% block %}`, `{% extends %}`, etc.
  - Template variables: `{{ variable }}`, `{{ object.property }}`
  - Template filters: `{{ value|filter }}`, `{{ value|filter:arg }}`
  - Template comments: `{# comment #}`

- **Smart Comment Wrapping**: Automatic handling of Django tags in JavaScript/TypeScript
  - Wraps Django tags with `/* */` when file is opened (prevents syntax errors)
  - Removes wrappers on save (keeps original Django syntax in file)
  - Nearly invisible markers (15% opacity) so they don't distract

- **Code Formatting**: Integrated Prettier support
  - HTML formatting with preserved Django tags
  - XML formatting support
  - Configurable through VS Code settings

- **Auto-detection**: Automatically activates for files in template directories
  - Detects `templates/` folder structure common in Django projects
  - Works with `.html`, `.htm`, `.xml` files

### Technical Details

- Built with TypeScript
- Uses TextMate grammar injection for syntax highlighting
- Leverages VS Code's Decoration API for invisible markers
- Integrates with Prettier v3 for formatting

### Requirements

- VS Code 1.78.0 or higher
- Node.js (for Prettier formatting)
