import * as vscode from 'vscode';

export type JsonOperation = 'beauty' | 'ugly' | 'escape' | 'unescape' | 'urlencode' | 'urldecode';

export interface ProcessResult {
    success: boolean;
    data?: string;
    error?: string;
    warnings?: string[];
}

export class JsonProcessor {
    private indentSize: number = 2;

    constructor() {
        this.updateConfig();
        
        // Listen for configuration changes
        vscode.workspace.onDidChangeConfiguration(() => {
            this.updateConfig();
        });
    }

    private updateConfig() {
        const config = vscode.workspace.getConfiguration('breezeJson');
        this.indentSize = config.get<number>('indentSize', 2);
    }

    /**
     * Process text with the specified operation
     */
    process(text: string, operation: JsonOperation): ProcessResult {
        text = text.trim();
        const warnings: string[] = [];
        
        try {
            let result: string;
            
            switch (operation) {
                case 'beauty':
                    result = this.beauty(text, warnings);
                    break;
                case 'ugly':
                    result = this.ugly(text, warnings);
                    break;
                case 'escape':
                    result = this.escape(text);
                    break;
                case 'unescape':
                    result = this.unescape(text);
                    break;
                case 'urlencode':
                    result = this.urlencode(text);
                    break;
                case 'urldecode':
                    result = this.urldecode(text, warnings);
                    break;
                default:
                    return {
                        success: false,
                        error: `Unknown operation: ${operation}`
                    };
            }

            return {
                success: true,
                data: result,
                warnings: warnings.length > 0 ? warnings : undefined
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error occurred'
            };
        }
    }

    /**
     * Format JSON with indentation (beautify)
     */
    private beauty(text: string, warnings: string[]): string {
        try {
            // Try standard JSON parse first
            const parsed = JSON.parse(text);
            return JSON.stringify(parsed, null, this.indentSize);
        } catch (error) {
            // If standard parse fails, try lenient parse
            const result = this.lenientParse(text);
            if (result.warnings.length > 0) {
                warnings.push(...result.warnings);
            }
            return this.lenientStringify(result.data, this.indentSize);
        }
    }

    /**
     * Minify JSON (remove all whitespace)
     */
    private ugly(text: string, warnings: string[]): string {
        try {
            const parsed = JSON.parse(text);
            return JSON.stringify(parsed);
        } catch (error) {
            const result = this.lenientParse(text);
            if (result.warnings.length > 0) {
                warnings.push(...result.warnings);
            }
            return this.lenientStringify(result.data, 0);
        }
    }

    /**
     * Escape JSON string (convert to escaped single-line string)
     */
    private escape(text: string): string {
        // Escape the text for use as a JSON string value
        return JSON.stringify(text);
    }

    /**
     * Unescape JSON string
     */
    private unescape(text: string): string {
        try {
            // Remove surrounding quotes if present
            let processedText = text.trim();
            if (processedText.startsWith('"') && processedText.endsWith('"')) {
                processedText = processedText.slice(1, -1);
            }
            
            // Parse as JSON string to unescape
            const parsed = JSON.parse(`"${processedText.replace(/"/g, '\\"')}"`);
            return parsed;
        } catch (error) {
            // Try a simpler approach: manually unescape common sequences
            return text
                .replace(/^["']|["']$/g, '')
                .replace(/\\"/g, '"')
                .replace(/\\n/g, '\n')
                .replace(/\\r/g, '\r')
                .replace(/\\t/g, '\t')
                .replace(/\\\\/g, '\\');
        }
    }

    /**
     * URL encode JSON string
     */
    private urlencode(text: string): string {
        return encodeURIComponent(text);
    }

    /**
     * URL decode and optionally parse JSON
     */
    private urldecode(text: string, warnings: string[]): string {
        try {
            const decoded = decodeURIComponent(text);
            return decoded;
        } catch (error) {
            throw new Error(`Invalid URL encoded string: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Lenient JSON parser that allows non-standard features like:
     * - Numeric keys (fastjson compatibility)
     * - Trailing commas
     * - Comments (single-line and multi-line)
     * - Unquoted keys (when safe)
     */
    private lenientParse(text: string): { data: any; warnings: string[] } {
        const warnings: string[] = [];
        
        // Remove comments (single-line and multi-line)
        let processedText = text.replace(/\/\*[\s\S]*?\*\//g, '');
        processedText = processedText.replace(/\/\/.*$/gm, '');
        
        // Try to parse with a lenient approach
        try {
            // Use Function constructor for lenient parsing
            // This allows numeric keys, trailing commas, etc.
            const parseFn = new Function(`return (${processedText})`);
            const result = parseFn();
            
            // Check if there were any non-standard features
            this.detectNonStandardFeatures(text, warnings);
            
            return { data: result, warnings };
        } catch (error) {
            // Last resort: try standard JSON.parse
            try {
                return { data: JSON.parse(text), warnings };
            } catch (jsonError) {
                throw new Error(`Invalid JSON format: ${jsonError instanceof Error ? jsonError.message : 'Unknown error'}`);
            }
        }
    }

    /**
     * Detect non-standard JSON features in the text
     */
    private detectNonStandardFeatures(text: string, warnings: string[]): void {
        // Check for numeric keys
        const numericKeyPattern = /"?\d+"?\s*:/g;
        const numericKeyMatches = text.match(numericKeyPattern);
        if (numericKeyMatches && numericKeyMatches.length > 0) {
            warnings.push(`Found ${numericKeyMatches.length} numeric key(s) - non-standard JSON (fastjson compatibility)`);
        }
        
        // Check for trailing commas
        const trailingCommaPattern = /,\s*[}\]]/g;
        const trailingCommaMatches = text.match(trailingCommaPattern);
        if (trailingCommaMatches && trailingCommaMatches.length > 0) {
            warnings.push(`Found ${trailingCommaMatches.length} trailing comma(s) - non-standard JSON`);
        }
        
        // Check for single quotes
        const singleQuotePattern = /'[^']*'\s*:/g;
        const singleQuoteMatches = text.match(singleQuotePattern);
        if (singleQuoteMatches && singleQuoteMatches.length > 0) {
            warnings.push(`Found ${singleQuoteMatches.length} single-quoted key(s) - non-standard JSON`);
        }
    }

    /**
     * Stringify with support for numeric keys and other non-standard features
     */
    private lenientStringify(obj: any, indent: number): string {
        return this.lenientStringifyHelper(obj, indent);
    }

    /**
     * Helper for lenientStringify to track indentation levels
     */
    private lenientStringifyHelper(obj: any, indent: number): string {
        if (obj === null) {
            return 'null';
        }
        
        if (obj === undefined) {
            return 'null';
        }
        
        if (typeof obj === 'boolean') {
            return obj ? 'true' : 'false';
        }
        
        if (typeof obj === 'number') {
            if (Number.isFinite(obj)) {
                return String(obj);
            }
            return 'null';
        }
        
        if (typeof obj === 'string') {
            return JSON.stringify(obj);
        }
        
        if (Array.isArray(obj)) {
            if (obj.length === 0) {
                return '[]';
            }
            
            // If indent is 0, we're doing minify (no formatting)
            if (indent === 0) {
                const items = obj.map(item => this.lenientStringifyHelper(item, 0));
                return '[' + items.join(',') + ']';
            }
            
            // Otherwise, we're doing pretty-print
            const indentStr = ' '.repeat(indent);
            const nextIndent = indent + this.indentSize;
            const nextIndentStr = ' '.repeat(nextIndent);
            
            const items = obj.map(item => 
                nextIndentStr + this.lenientStringifyHelper(item, nextIndent)
            );
            
            return '[\n' + items.join(',\n') + '\n' + indentStr + ']';
        }
        
        if (typeof obj === 'object') {
            const keys = Object.keys(obj);
            if (keys.length === 0) {
                return '{}';
            }
            
            // If indent is 0, we're doing minify (no formatting)
            if (indent === 0) {
                const items = keys.map(key => {
                    const keyStr = JSON.stringify(key);
                    const valueStr = this.lenientStringifyHelper(obj[key], 0);
                    return `${keyStr}:${valueStr}`;
                });
                return '{' + items.join(',') + '}';
            }
            
            // Otherwise, we're doing pretty-print
            const indentStr = ' '.repeat(indent);
            const nextIndent = indent + this.indentSize;
            const nextIndentStr = ' '.repeat(nextIndent);
            
            const items = keys.map(key => {
                const keyStr = JSON.stringify(key);
                const valueStr = this.lenientStringifyHelper(obj[key], nextIndent);
                return `${nextIndentStr}${keyStr}: ${valueStr}`;
            });
            
            return '{\n' + items.join(',\n') + '\n' + indentStr + '}';
        }
        
        // Fallback for other types (function, symbol, etc.)
        return JSON.stringify(obj);
    }

    /**
     * Check if text size is large and might need performance optimization
     */
    isLargeText(text: string): boolean {
        const config = vscode.workspace.getConfiguration('breezeJson');
        const maxSizeMB = config.get<number>('maxFileSizeMB', 10);
        const maxBytes = maxSizeMB * 1024 * 1024;
        return text.length > maxBytes;
    }
}
