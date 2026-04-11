import { describe, it, expect } from 'vitest';
import { formatDjangoTemplate, formatDjangoJS, formatDjangoTS } from '../src/formatter';

// Tags that were on their own line in the input should remain on their own line
function soloTagLines(text: string): string[] {
    return text
        .split('\n')
        .filter(l => /\{%/.test(l) && l.replace(/(\{\{[\s\S]*?\}\}|\{%[\s\S]*?%\}|\{#[\s\S]*?#\})/g, '').trim() === '')
        .map(l => l.trim());
}

function allTags(text: string): string[] {
    return text.match(/(\{\{[\s\S]*?\}\}|\{%[\s\S]*?%\}|\{#[\s\S]*?#\})/g) ?? [];
}

// No placeholder strings should leak into the output
function hasLeakedPlaceholders(text: string): boolean {
    return /DJANGOBLOCK\d+|DJANGOINLINE\d+/.test(text);
}

describe('formatDjangoTemplate', () => {
    it('preserves all Django tags', async () => {
        const input = `{% extends "base.html" %}
{% block content %}
<p>Hello {{ user.name }}</p>
{% endblock %}`;
        const output = await formatDjangoTemplate(input);
        expect(allTags(output)).toEqual(expect.arrayContaining(allTags(input)));
        expect(allTags(output)).toHaveLength(allTags(input).length);
    });

    it('keeps block tags on their own lines (issue #9)', async () => {
        const input = `{% block foo %}
Lorem
ipsum
{% endblock %}`;
        const output = await formatDjangoTemplate(input);
        const inputSolo = soloTagLines(input);
        const outputSolo = soloTagLines(output);
        expect(outputSolo.length).toBeGreaterThanOrEqual(inputSolo.length);
    });

    it('keeps adjacent blocks on separate lines (issue #9)', async () => {
        const input = `{% block foo %}
content
{% endblock %}
{% block bar %}
more content
{% endblock %}`;
        const output = await formatDjangoTemplate(input);
        expect(soloTagLines(output).length).toBeGreaterThanOrEqual(soloTagLines(input).length);
    });

    it('preserves inline variable tags in attribute values', async () => {
        const input = `<div class="{{ cls }}" id="{{ obj.id }}">
<p>{{ message }}</p>
</div>`;
        const output = await formatDjangoTemplate(input);
        expect(output).toContain('{{ cls }}');
        expect(output).toContain('{{ obj.id }}');
        expect(output).toContain('{{ message }}');
    });

    it('keeps if/elif/else/endif on their own lines', async () => {
        const input = `{% if user.is_authenticated %}
<p>Welcome, {{ user.name }}</p>
{% elif user.is_guest %}
<p>Welcome, guest</p>
{% else %}
<p>Please log in</p>
{% endif %}`;
        const output = await formatDjangoTemplate(input);
        expect(soloTagLines(output).length).toBeGreaterThanOrEqual(soloTagLines(input).length);
    });

    it('does not leak placeholder strings into output', async () => {
        const input = `{% block content %}
<p>{{ message }}</p>
{% endblock %}`;
        const output = await formatDjangoTemplate(input);
        expect(hasLeakedPlaceholders(output)).toBe(false);
    });
});

describe('formatDjangoJS', () => {
    it('preserves Django tags in JavaScript', async () => {
        const input = `const url = "{% url 'home' %}";
const name = "{{ user.name }}";`;
        const output = await formatDjangoJS(input);
        expect(output).toContain("{% url 'home' %}");
        expect(output).toContain('{{ user.name }}');
    });
});

describe('formatDjangoTS', () => {
    it('preserves Django tags in TypeScript', async () => {
        const input = `const url: string = "{% url 'home' %}";
const name: string = "{{ user.name }}";`;
        const output = await formatDjangoTS(input);
        expect(output).toContain("{% url 'home' %}");
        expect(output).toContain('{{ user.name }}');
    });
});
