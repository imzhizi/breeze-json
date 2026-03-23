# Breeze JSON

A high-performance JSON formatter extension for VSCode with support for beauty, ugly, escape, unescape, URL encode, URL decode operations and nested JSON handling.

## Features

### Basic Operations
- **Beauty (Format)** - Format JSON with proper indentation
- **Ugly (Minify)** - Minify JSON by removing all whitespace
- **Escape** - Escape JSON string for use as a string value
- **Unescape** - Unescape a JSON string
- **URL Encode** - URL encode the entire JSON
- **URL Decode** - URL decode and parse JSON

### Nested JSON Support
When you select a key in a JSON document, you can perform operations on its value:
- **Beauty Selected Value** - Format the nested JSON value
- **Ugly Selected Value** - Minify the nested JSON value
- **Escape Selected Value** - Escape the nested JSON value
- **Unescape Selected Value** - Unescape the nested JSON value

### Error Tolerance
- Supports numeric keys (fastjson compatibility)
- Handles trailing commas
- Provides clear error messages with suggestions

## Usage

### Via Context Menu
1. Right-click in the editor
2. Hover over **JSON Format** submenu
3. Select the desired operation

### Via Command Palette
1. Press `Cmd+Shift+P` (macOS) or `Ctrl+Shift+P` (Windows/Linux)
2. Type `Breeze JSON` and select the operation

### Via Keyboard Shortcuts
- `Cmd+Shift+F J B` - Beauty (Format)
- `Cmd+Shift+F J U` - Ugly (Minify)
- `Cmd+Shift+F J E` - Escape
- `Cmd+Shift+F J N` - Unescape

### Status Bar
Click the **Breeze JSON** button in the status bar to quickly access all operations.

## Configuration

| Setting | Description | Default |
|---------|-------------|---------|
| `breezeJson.indentSize` | Indentation size for JSON beauty format | `2` |
| `breezeJson.maxFileSizeMB` | Maximum file size (in MB) before showing performance warning | `10` |

## Examples

### Beauty
**Before:**
```json
{"name":"test","value":123}
```

**After:**
```json
{
  "name": "test",
  "value": 123
}
```

### Nested JSON Processing
**Before:** (select the `data` key)
```json
{
  "data": "{\"inner\":\"value\",\"count\":1}"
}
```

**After:** (using Beauty Selected Value)
```json
{
  "data": {
    "inner": "value",
    "count": 1
  }
}
```

### Escape
**Before:**
```json
{"name":"test","value":123}
```

**After:**
```
"{\"name\":\"test\",\"value\":123}"
```

### URL Encode
**Before:**
```json
{"test":"value"}
```

**After:**
```
%7B%22test%22%3A%22value%22%7D
```

## License

MIT License
