export interface ErrorLog {
    operation: string;
    error: Error;
    timestamp: Date;
    textLength?: number;
}

export class ErrorHandler {
    private static instance: ErrorHandler;
    private errors: ErrorLog[] = [];
    private maxErrors = 100;

    private constructor() {}

    static getInstance(): ErrorHandler {
        if (!ErrorHandler.instance) {
            ErrorHandler.instance = new ErrorHandler();
        }
        return ErrorHandler.instance;
    }

    /**
     * Handle and log an error
     */
    handleError(operation: string, error: unknown, textLength?: number): string {
        const errorObj = error instanceof Error ? error : new Error(String(error));
        
        // Log error
        this.addError({
            operation: operation,
            error: errorObj,
            timestamp: new Date(),
            textLength: textLength
        });

        // Return user-friendly message
        return this.formatErrorMessage(operation, errorObj);
    }

    /**
     * Add error to log
     */
    private addError(errorLog: ErrorLog) {
        this.errors.push(errorLog);
        
        // Keep only the last N errors
        if (this.errors.length > this.maxErrors) {
            this.errors.shift();
        }
    }

    /**
     * Get all logged errors
     */
    getErrors(): ErrorLog[] {
        return [...this.errors];
    }

    /**
     * Clear error log
     */
    clearErrors() {
        this.errors = [];
    }

    /**
     * Format error message for display
     */
    private formatErrorMessage(operation: string, error: Error): string {
        const message = error.message.toLowerCase();
        
        // Provide user-friendly error messages for common issues
        if (message.includes('unexpected token')) {
            const match = error.message.match(/position\s+(\d+)/);
            const position = match ? ` at position ${match[1]}` : '';
            return `JSON ${operation} failed: Invalid JSON syntax${position}. Check for missing commas, quotes, or brackets.`;
        }
        
        if (message.includes('unexpected end of json') || message.includes('unexpected end of input')) {
            return `JSON ${operation} failed: Incomplete JSON. Check for missing closing brackets, braces, or quotes.`;
        }
        
        if (message.includes('invalid url encoded string')) {
            return `JSON ${operation} failed: Invalid URL encoding. Ensure the string is properly URL encoded.`;
        }
        
        if (message.includes('unexpected number')) {
            return `JSON ${operation} failed: Invalid number format or unexpected number used as key.`;
        }
        
        if (message.includes('expected property name')) {
            return `JSON ${operation} failed: Missing key or invalid property name.`;
        }

        // Default error message
        return `JSON ${operation} failed: ${error.message}`;
    }

    /**
     * Check if error is recoverable with lenient parsing
     */
    isRecoverable(error: unknown): boolean {
        if (!(error instanceof Error)) {
            return false;
        }

        const message = error.message.toLowerCase();
        
        // These errors can often be handled with lenient parsing
        const recoverablePatterns = [
            'trailing comma',
            'unexpected number',  // Numeric keys
            'single quote',       // Single-quoted strings
            'unquoted',          // Unquoted keys
            'comment'            // JSON with comments
        ];

        return recoverablePatterns.some(pattern => message.includes(pattern));
    }

    /**
     * Get suggestions for fixing common errors
     */
    getErrorSuggestions(error: unknown): string[] {
        if (!(error instanceof Error)) {
            return [];
        }

        const suggestions: string[] = [];
        const message = error.message.toLowerCase();

        if (message.includes('unexpected token')) {
            suggestions.push('Check for missing or extra commas between elements');
            suggestions.push('Ensure all strings are properly quoted');
            suggestions.push('Verify brackets and braces are properly matched');
        }
        
        if (message.includes('unexpected end')) {
            suggestions.push('Add missing closing brackets ] or braces }');
            suggestions.push('Check for unclosed strings');
        }
        
        if (message.includes('numeric key') || message.includes('unexpected number')) {
            suggestions.push('Numeric keys are supported via lenient parsing');
            suggestions.push('The JSON will be formatted with numeric keys quoted');
        }

        return suggestions;
    }
}
