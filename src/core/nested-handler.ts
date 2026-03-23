import * as vscode from 'vscode';
import { JsonProcessor, JsonOperation, ProcessResult } from './json-processor';

export interface NestedProcessResult extends ProcessResult {
    range?: vscode.Range;
    isKeyValue?: boolean;
}

export class NestedHandler {
    constructor(private jsonProcessor: JsonProcessor) {}

    /**
     * Process selected text, detecting if it's a key and processing its value
     */
    processSelectedText(
        selectedText: string,
        fullText: string,
        selectionStart: vscode.Position,
        operation: JsonOperation
    ): NestedProcessResult {
        const offset = this.positionToOffset(fullText, selectionStart);
        
        // Try to detect if selected text is a key
        const keyValueInfo = this.extractKeyValue(fullText, offset, selectedText.trim());
        
        if (keyValueInfo) {
            // Calculate the indentation at this position
            const contextIndent = this.calculateContextIndent(fullText, keyValueInfo.valueStart);
            
            // Process the value with context-aware indentation
            const result = this.jsonProcessor.processWithIndent(keyValueInfo.value, operation, contextIndent);
            
            if (result.success && result.data) {
                return {
                    success: true,
                    data: result.data,
                    range: new vscode.Range(
                        this.offsetToPosition(fullText, keyValueInfo.valueStart),
                        this.offsetToPosition(fullText, keyValueInfo.valueEnd)
                    ),
                    isKeyValue: true,
                    warnings: result.warnings
                };
            }
            
            return result;
        }
        
        // Not a key, process as regular text
        return {
            ...this.jsonProcessor.process(selectedText, operation),
            isKeyValue: false
        };
    }

    /**
     * Calculate the indentation level at a given position in the document
     */
    private calculateContextIndent(text: string, valueStart: number): number {
        // Find the beginning of the current line
        let lineStart = valueStart;
        while (lineStart > 0 && text[lineStart - 1] !== '\n') {
            lineStart--;
        }
        
        // Count leading whitespace
        let indent = 0;
        for (let i = lineStart; i < valueStart; i++) {
            if (text[i] === ' ') {
                indent++;
            } else if (text[i] === '\t') {
                indent += 4; // Treat tab as 4 spaces
            } else {
                break;
            }
        }
        
        return indent;
    }

    /**
     * Extract key-value pair from JSON text
     */
    private extractKeyValue(
        text: string,
        selectedOffset: number,
        selectedText: string
    ): { key: string; value: string; valueStart: number; valueEnd: number } | null {
        // Find the selected text in the document
        const searchStart = Math.max(0, selectedOffset - 100);
        const searchEnd = Math.min(text.length, selectedOffset + selectedText.length + 100);
        const searchText = text.substring(searchStart, searchEnd);
        
        const localIndex = searchText.indexOf(selectedText);
        if (localIndex === -1) {
            return null;
        }
        
        const actualOffset = searchStart + localIndex;
        
        // Check if it looks like a key (followed by colon)
        const afterSelection = text.substring(actualOffset + selectedText.length);
        const trimmedAfter = afterSelection.trimStart();
        
        if (!trimmedAfter.startsWith(':')) {
            return null;
        }

        // Find the value after the colon
        const colonIndex = actualOffset + selectedText.length + afterSelection.indexOf(':');
        const valueStart = this.findValueStart(text, colonIndex + 1);
        
        if (valueStart === -1) {
            return null;
        }

        const valueEnd = this.findValueEnd(text, valueStart);
        
        if (valueEnd === -1) {
            return null;
        }

        const value = text.substring(valueStart, valueEnd);
        
        return {
            key: selectedText.replace(/['"]/g, '').trim(),
            value: value,
            valueStart: valueStart,
            valueEnd: valueEnd
        };
    }

    /**
     * Find the start of a JSON value after a colon
     */
    private findValueStart(text: string, afterColon: number): number {
        let i = afterColon;
        while (i < text.length) {
            const char = text[i];
            if (char === ' ' || char === '\t' || char === '\n' || char === '\r') {
                i++;
                continue;
            }
            return i;
        }
        return -1;
    }

    /**
     * Find the end of a JSON value
     */
    private findValueEnd(text: string, valueStart: number): number {
        const startChar = text[valueStart];
        
        // String value
        if (startChar === '"' || startChar === "'") {
            return this.findStringEnd(text, valueStart);
        }
        
        // Object value
        if (startChar === '{') {
            return this.findObjectEnd(text, valueStart);
        }
        
        // Array value
        if (startChar === '[') {
            return this.findArrayEnd(text, valueStart);
        }
        
        // Boolean, null, or number
        return this.findPrimitiveEnd(text, valueStart);
    }

    /**
     * Find the end of a JSON string
     */
    private findStringEnd(text: string, start: number): number {
        const quote = text[start];
        let i = start + 1;
        
        while (i < text.length) {
            if (text[i] === '\\' && i + 1 < text.length) {
                i += 2; // Skip escaped character
                continue;
            }
            
            if (text[i] === quote) {
                return i + 1;
            }
            
            i++;
        }
        
        return -1;
    }

    /**
     * Find the end of a JSON object
     */
    private findObjectEnd(text: string, start: number): number {
        let depth = 0;
        let inString = false;
        let escapeNext = false;
        let i = start;
        
        while (i < text.length) {
            const char = text[i];
            
            if (escapeNext) {
                escapeNext = false;
                i++;
                continue;
            }
            
            if (char === '\\' && inString) {
                escapeNext = true;
                i++;
                continue;
            }
            
            if (char === '"' || char === "'") {
                inString = !inString;
            } else if (!inString) {
                if (char === '{') {
                    depth++;
                } else if (char === '}') {
                    depth--;
                    if (depth === 0) {
                        return i + 1;
                    }
                }
            }
            
            i++;
        }
        
        return -1;
    }

    /**
     * Find the end of a JSON array
     */
    private findArrayEnd(text: string, start: number): number {
        let depth = 0;
        let inString = false;
        let escapeNext = false;
        let i = start;
        
        while (i < text.length) {
            const char = text[i];
            
            if (escapeNext) {
                escapeNext = false;
                i++;
                continue;
            }
            
            if (char === '\\' && inString) {
                escapeNext = true;
                i++;
                continue;
            }
            
            if (char === '"' || char === "'") {
                inString = !inString;
            } else if (!inString) {
                if (char === '[') {
                    depth++;
                } else if (char === ']') {
                    depth--;
                    if (depth === 0) {
                        return i + 1;
                    }
                }
            }
            
            i++;
        }
        
        return -1;
    }

    /**
     * Find the end of a primitive value (number, boolean, null)
     */
    private findPrimitiveEnd(text: string, start: number): number {
        let i = start;
        
        while (i < text.length) {
            const char = text[i];
            if (char === ',' || char === '}' || char === ']' || char === '\n' || char === '\r' || char === ' ' || char === '\t') {
                break;
            }
            i++;
        }
        
        return i;
    }

    /**
     * Convert position to offset
     */
    private positionToOffset(text: string, position: vscode.Position): number {
        const lines = text.split('\n');
        let offset = 0;
        
        for (let i = 0; i < position.line && i < lines.length; i++) {
            offset += lines[i].length + 1; // +1 for newline
        }
        
        offset += Math.min(position.character, lines[position.line]?.length || 0);
        return offset;
    }

    /**
     * Convert offset to position
     */
    private offsetToPosition(text: string, offset: number): vscode.Position {
        let line = 0;
        let character = 0;
        let currentOffset = 0;
        
        for (let i = 0; i < text.length && currentOffset < offset; i++) {
            if (text[i] === '\n') {
                line++;
                character = 0;
                currentOffset++;
            } else {
                character++;
                currentOffset++;
            }
        }
        
        return new vscode.Position(line, character);
    }
}
