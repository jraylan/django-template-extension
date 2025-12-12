import * as prettier from 'prettier';

let cachedXmlPlugin: any | null = null;
let didTryLoadXmlPlugin = false;

function getXmlPlugin(): any | null {
    if (didTryLoadXmlPlugin) return cachedXmlPlugin;
    didTryLoadXmlPlugin = true;

    try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        cachedXmlPlugin = require('@prettier/plugin-xml');
    } catch {
        cachedXmlPlugin = null;
    }

    return cachedXmlPlugin;
}

/**
 * Format Django/Jinja HTML template content
 */
export async function formatDjangoTemplate(text: string): Promise<string> {
    try {
        const options: prettier.Options = {
            parser: 'html',
            htmlWhitespaceSensitivity: 'ignore'
        };

        return await prettier.format(text, options);
    } catch (err) {
        console.error('formatDjangoTemplate failed:', err);
        return text;
    }
}

/**
 * Format JavaScript content with Django template tags preserved
 */
export async function formatDjangoJS(text: string): Promise<string> {
    const { masked, placeholders } = maskDjangoTags(text);

    try {
        const options: prettier.Options = { parser: 'babel' };
        const formatted = await prettier.format(masked, options);
        return restoreDjangoTags(formatted, placeholders);
    } catch (err) {
        console.error('formatDjangoJS failed:', err);
        return text;
    }
}

/**
 * Format TypeScript content with Django template tags preserved
 */
export async function formatDjangoTS(text: string): Promise<string> {
    const { masked, placeholders } = maskDjangoTags(text);

    try {
        const options: prettier.Options = { parser: 'typescript' };
        const formatted = await prettier.format(masked, options);
        return restoreDjangoTags(formatted, placeholders);
    } catch (err) {
        console.error('formatDjangoTS failed:', err);
        return text;
    }
}

/**
 * Format XML content with Django template tags preserved
 */
export async function formatDjangoXML(text: string): Promise<string> {
    const { masked, placeholders } = maskDjangoTags(text);

    try {
        const xmlPlugin = getXmlPlugin();

        const options: prettier.Options = {
            parser: 'xml',
            plugins: xmlPlugin ? [xmlPlugin] : []
        };
        const formatted = await prettier.format(masked, options);
        return restoreDjangoTags(formatted, placeholders);
    } catch (err) {
        console.error('formatDjangoXML failed:', err);
        return text;
    }
}

interface Placeholder {
    key: string;
    original: string;
}

/**
 * Mask Django/Jinja template tags with placeholders
 * Also handles tags wrapped in \/* *\/ comments
*/
function maskDjangoTags(text: string): { masked: string; placeholders: Placeholder[] } {
    // First, handle wrapped tags: {{ ... }} or {% ... %} or {# ... #}
    const wrappedRegex = /(\/\*\s*(?:{{[\s\S]*?}}|{%[\s\S]*?%}|{#[\s\S]*?#})\s*\*\/)/g;
    // Then handle unwrapped tags
    const unwrappedRegex = /({{[\s\S]*?}}|{%[\s\S]*?%}|{#[\s\S]*?#})/g;

    const placeholders: Placeholder[] = [];
    let i = 0;

    // First pass: mask wrapped tags
    let masked = text.replace(wrappedRegex, (match) => {
        const key = `__DJANGO_WRAPPED_${i++}__`;
        placeholders.push({ key, original: match });
        return key;
    });

    // Second pass: mask unwrapped tags (that weren't already masked)
    masked = masked.replace(unwrappedRegex, (match) => {
        const key = `__DJANGO_PLACEHOLDER_${i++}__`;
        placeholders.push({ key, original: match });
        return key;
    });

    return { masked, placeholders };
}

/**
 * Restore Django/Jinja template tags from placeholders
 */
function restoreDjangoTags(text: string, placeholders: Placeholder[]): string {
    let restored = text;
    for (const p of placeholders) {
        restored = restored.split(p.key).join(p.original);
    }
    return restored;
}
