import * as vscode from 'vscode';

const DJANGO_TAG_REGEX = /(\{%[\s\S]*?%\}|\{\{[\s\S]*?\}\}|\{#[\s\S]*?#\})/g;
const WRAPPED_TAG_REGEX = /\/\*\s*(\{%[\s\S]*?%\}|\{\{[\s\S]*?\}\}|\{#[\s\S]*?#\})\s*\*\//g;

// Decoration type for hiding the /* and */ around Django tags - make them nearly invisible
const hiddenCommentDecorationType = vscode.window.createTextEditorDecorationType({
    opacity: '0.15',
    letterSpacing: '-0.5em'
});

// Decoration type for highlighting Django tags inside strings (without /* */)
const djangoTagInStringDecorationType = vscode.window.createTextEditorDecorationType({
    backgroundColor: 'rgba(255, 200, 0, 0.15)',
    borderRadius: '3px'
});

/**
 * Check if a position is inside a string literal (single, double, or template)
 */
function isInsideString(content: string, position: number): boolean {
    let inSingleQuote = false;
    let inDoubleQuote = false;
    let inTemplateString = false;
    let i = 0;

    while (i < position && i < content.length) {
        const char = content[i];
        const prevChar = i > 0 ? content[i - 1] : '';

        // Skip escaped characters
        if (prevChar === '\\') {
            i++;
            continue;
        }

        // Handle template strings
        if (char === '`' && !inSingleQuote && !inDoubleQuote) {
            inTemplateString = !inTemplateString;
        }
        // Handle single quotes (not in template or double)
        else if (char === "'" && !inTemplateString && !inDoubleQuote) {
            inSingleQuote = !inSingleQuote;
        }
        // Handle double quotes (not in template or single)
        else if (char === '"' && !inTemplateString && !inSingleQuote) {
            inDoubleQuote = !inDoubleQuote;
        }

        i++;
    }

    return inSingleQuote || inDoubleQuote || inTemplateString;
}

/**
 * Wraps Django template tags with block comments for TypeScript/JavaScript compatibility.
 * Only wraps tags that are not already wrapped and not inside strings.
 */
export function wrapDjangoTags(content: string): string {
    // First, find all positions of already wrapped tags
    const wrappedPositions: Set<number> = new Set();
    let wrappedMatch;
    const wrappedCopy = new RegExp(WRAPPED_TAG_REGEX.source, 'g');
    while ((wrappedMatch = wrappedCopy.exec(content)) !== null) {
        // Store the position of the inner Django tag
        const innerTagStart = wrappedMatch.index + wrappedMatch[0].indexOf(wrappedMatch[1]);
        wrappedPositions.add(innerTagStart);
    }

    // Now replace only unwrapped Django tags
    const tagCopy = new RegExp(DJANGO_TAG_REGEX.source, 'g');
    let result = '';
    let lastIndex = 0;
    let match;

    while ((match = tagCopy.exec(content)) !== null) {
        // Check if this tag is already wrapped (by checking if its position is in wrappedPositions)
        let isWrapped = false;
        for (const pos of wrappedPositions) {
            if (Math.abs(pos - match.index) < 5) {
                isWrapped = true;
                break;
            }
        }

        // Check if the tag is inside a string literal
        const isInString = isInsideString(content, match.index);

        result += content.substring(lastIndex, match.index);

        if (isWrapped || isInString) {
            // Don't wrap if already wrapped or inside a string
            result += match[0];
        } else {
            result += `/* ${match[0]} */`;
        }

        lastIndex = tagCopy.lastIndex;
    }

    result += content.substring(lastIndex);
    return result;
}

/**
 * Unwraps Django template tags by removing block comment wrappers.
 */
export function unwrapDjangoTags(content: string): string {
    return content.replace(WRAPPED_TAG_REGEX, (_, djangoTag) => {
        return djangoTag;
    });
}

/**
 * Check if content has any Django tags (wrapped or unwrapped)
 */
export function hasDjangoTags(content: string): boolean {
    const tagRegex = new RegExp(DJANGO_TAG_REGEX.source, 'g');
    return tagRegex.test(content);
}

/**
 * Check if content has unwrapped Django tags
 */
export function hasUnwrappedDjangoTags(content: string): boolean {
    // Get all Django tags
    const tagRegex = new RegExp(DJANGO_TAG_REGEX.source, 'g');
    let match;

    while ((match = tagRegex.exec(content)) !== null) {
        const tagStart = match.index;
        // Check if preceded by /* (with optional whitespace)
        const before = content.substring(Math.max(0, tagStart - 10), tagStart);
        if (!before.trimEnd().endsWith('/*')) {
            return true;
        }
        // Also check if followed by */ (with optional whitespace)
        const tagEnd = tagStart + match[0].length;
        const after = content.substring(tagEnd, Math.min(content.length, tagEnd + 10));
        if (!after.trimStart().startsWith('*/')) {
            return true;
        }
    }

    return false;
}

/**
 * Check if content has wrapped Django tags
 */
export function hasWrappedDjangoTags(content: string): boolean {
    const wrappedRegex = new RegExp(WRAPPED_TAG_REGEX.source, 'g');
    return wrappedRegex.test(content);
}

/**
 * Apply decorations to hide the \/* and *\/ around Django tags
 * and highlight Django tags inside strings
*/
export function applyHiddenCommentDecorations(editor: vscode.TextEditor): void {
    const document = editor.document;
    const content = document.getText();
    const hiddenDecorations: vscode.DecorationOptions[] = [];
    const stringTagDecorations: vscode.DecorationOptions[] = [];

    // Regex to find /* before Django tags and */ after them
    const wrapperRegex = /(\/\*)\s*(\{%[\s\S]*?%\}|\{\{[\s\S]*?\}\}|\{#[\s\S]*?#\})\s*(\*\/)/g;
    let match;

    while ((match = wrapperRegex.exec(content)) !== null) {
        // Position of /*
        const openStart = document.positionAt(match.index);
        const openEnd = document.positionAt(match.index + match[1].length + 1); // +1 for space

        // Position of */
        const closeStart = document.positionAt(match.index + match[0].length - match[3].length - 1); // -1 for space
        const closeEnd = document.positionAt(match.index + match[0].length);

        hiddenDecorations.push({ range: new vscode.Range(openStart, openEnd) });
        hiddenDecorations.push({ range: new vscode.Range(closeStart, closeEnd) });
    }

    // Find Django tags inside strings (not wrapped with /* */)
    const tagRegex = new RegExp(DJANGO_TAG_REGEX.source, 'g');
    while ((match = tagRegex.exec(content)) !== null) {
        // Check if this tag is inside a string
        if (isInsideString(content, match.index)) {
            const start = document.positionAt(match.index);
            const end = document.positionAt(match.index + match[0].length);
            stringTagDecorations.push({ range: new vscode.Range(start, end) });
        }
    }

    editor.setDecorations(hiddenCommentDecorationType, hiddenDecorations);
    editor.setDecorations(djangoTagInStringDecorationType, stringTagDecorations);
}

/**
 * Clear hidden comment decorations from an editor
 */
export function clearHiddenCommentDecorations(editor: vscode.TextEditor): void {
    editor.setDecorations(hiddenCommentDecorationType, []);
    editor.setDecorations(djangoTagInStringDecorationType, []);
}

/**
 * Manager class for handling Django tag wrapping/unwrapping
 */
export class DjangoTagWrapManager implements vscode.Disposable {
    private disposables: vscode.Disposable[] = [];
    private wrappedDocuments: Set<string> = new Set();
    private isSaving: boolean = false;
    private isOpening: boolean = false;
    private enabled: boolean = true;

    constructor() {
        this.setupListeners();
    }

    public setEnabled(enabled: boolean): void {
        this.enabled = enabled;
    }

    public isEnabled(): boolean {
        return this.enabled;
    }

    private setupListeners(): void {
        // When a document is opened, wrap Django tags
        this.disposables.push(
            vscode.workspace.onDidOpenTextDocument((document) => {
                this.onDocumentOpen(document);
            })
        );

        // Before saving, unwrap Django tags
        this.disposables.push(
            vscode.workspace.onWillSaveTextDocument((event) => {
                this.onWillSave(event);
            })
        );

        // After saving, re-wrap Django tags
        this.disposables.push(
            vscode.workspace.onDidSaveTextDocument((document) => {
                this.onDidSave(document);
            })
        );

        // Apply decorations when editor changes
        this.disposables.push(
            vscode.window.onDidChangeActiveTextEditor((editor) => {
                if (editor && this.isTargetLanguage(editor.document.languageId)) {
                    this.updateDecorations(editor);
                }
            })
        );

        // Apply decorations when document content changes
        this.disposables.push(
            vscode.workspace.onDidChangeTextDocument((event) => {
                const editor = vscode.window.activeTextEditor;
                if (editor && editor.document === event.document && this.isTargetLanguage(event.document.languageId)) {
                    this.updateDecorations(editor);
                }
            })
        );

        // Process already open documents
        for (const document of vscode.workspace.textDocuments) {
            this.onDocumentOpen(document);
        }

        // Apply decorations to current editor
        if (vscode.window.activeTextEditor && this.isTargetLanguage(vscode.window.activeTextEditor.document.languageId)) {
            this.updateDecorations(vscode.window.activeTextEditor);
        }
    }

    private updateDecorations(editor: vscode.TextEditor): void {
        if (!this.enabled) {
            clearHiddenCommentDecorations(editor);
            return;
        }
        applyHiddenCommentDecorations(editor);
    }

    private isTargetLanguage(languageId: string): boolean {
        return languageId === 'typescript' ||
            languageId === 'javascript' ||
            languageId === 'typescriptreact' ||
            languageId === 'javascriptreact';
    }

    private async onDocumentOpen(document: vscode.TextDocument): Promise<void> {
        if (!this.enabled) return;
        if (this.isOpening || this.isSaving) return;
        if (!this.isTargetLanguage(document.languageId)) return;

        const content = document.getText();

        // Check if the document has unwrapped Django tags that need wrapping
        if (!hasUnwrappedDjangoTags(content)) return;

        this.isOpening = true;
        try {
            const wrapped = wrapDjangoTags(content);
            if (wrapped !== content) {
                const edit = new vscode.WorkspaceEdit();
                const fullRange = new vscode.Range(
                    document.positionAt(0),
                    document.positionAt(content.length)
                );
                edit.replace(document.uri, fullRange, wrapped);
                await vscode.workspace.applyEdit(edit);
                this.wrappedDocuments.add(document.uri.toString());
            }
        } finally {
            this.isOpening = false;
        }
    }

    private onWillSave(event: vscode.TextDocumentWillSaveEvent): void {
        if (!this.enabled) return;
        const document = event.document;
        if (!this.isTargetLanguage(document.languageId)) return;
        if (!this.wrappedDocuments.has(document.uri.toString())) return;

        this.isSaving = true;

        // Create edit to unwrap Django tags before saving
        const content = document.getText();
        const unwrapped = unwrapDjangoTags(content);

        if (unwrapped !== content) {
            const edit = new vscode.TextEdit(
                new vscode.Range(
                    document.positionAt(0),
                    document.positionAt(content.length)
                ),
                unwrapped
            );
            event.waitUntil(Promise.resolve([edit]));
        }
    }

    private async onDidSave(document: vscode.TextDocument): Promise<void> {
        if (!this.enabled) return;
        if (!this.isSaving) return;
        if (!this.isTargetLanguage(document.languageId)) return;

        this.isSaving = false;

        // Re-wrap Django tags after saving
        const content = document.getText();
        if (hasUnwrappedDjangoTags(content)) {
            const wrapped = wrapDjangoTags(content);
            if (wrapped !== content) {
                const edit = new vscode.WorkspaceEdit();
                const fullRange = new vscode.Range(
                    document.positionAt(0),
                    document.positionAt(content.length)
                );
                edit.replace(document.uri, fullRange, wrapped);
                await vscode.workspace.applyEdit(edit);
                this.wrappedDocuments.add(document.uri.toString());
            }
        }
    }

    /**
     * Manually wrap Django tags in the current document
     */
    public async wrapCurrentDocument(): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) return;

        const document = editor.document;
        if (!this.isTargetLanguage(document.languageId)) {
            vscode.window.showWarningMessage('This command only works with TypeScript/JavaScript files');
            return;
        }

        const content = document.getText();
        const wrapped = wrapDjangoTags(content);

        if (wrapped !== content) {
            const edit = new vscode.WorkspaceEdit();
            const fullRange = new vscode.Range(
                document.positionAt(0),
                document.positionAt(content.length)
            );
            edit.replace(document.uri, fullRange, wrapped);
            await vscode.workspace.applyEdit(edit);
            this.wrappedDocuments.add(document.uri.toString());
            vscode.window.showInformationMessage('Django tags wrapped with /* */');
        } else {
            vscode.window.showInformationMessage('No Django tags to wrap');
        }
    }

    /**
     * Manually unwrap Django tags in the current document
     */
    public async unwrapCurrentDocument(): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) return;

        const document = editor.document;
        const content = document.getText();
        const unwrapped = unwrapDjangoTags(content);

        if (unwrapped !== content) {
            const edit = new vscode.WorkspaceEdit();
            const fullRange = new vscode.Range(
                document.positionAt(0),
                document.positionAt(content.length)
            );
            edit.replace(document.uri, fullRange, unwrapped);
            await vscode.workspace.applyEdit(edit);
            this.wrappedDocuments.delete(document.uri.toString());
            vscode.window.showInformationMessage('Django tags unwrapped');
        } else {
            vscode.window.showInformationMessage('No wrapped Django tags found');
        }
    }

    public dispose(): void {
        for (const d of this.disposables) {
            d.dispose();
        }
    }
}
