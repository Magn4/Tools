# Path Extractor Tool

A tool to extract paths with parameters from JavaScript files and generate test URLs.

## Usage

```bash
node extract-paths.js -js <js_files_directory> -d <domain>
```

## Example

```bash
node extract-paths.js -js ./JS_files -d https://example.com
```

## Output Files

1. **paths.txt** - Contains all extracted paths with parameters (e.g., `/download/:id`)
2. **CSPT_magun4.txt** - Contains full URLs with parameters replaced by `magun4`, `magun4_1`, etc.

## Examples

### Input (from JS files):
```javascript
app.get('/download/:id', handler);
app.post('/user/:userId/post/:postId', handler);
```

### Output (paths.txt):
```
/download/:id
/user/:userId/post/:postId
```

### Output (CSPT_magun4.txt):
```
https://example.com/download/magun4
https://example.com/user/magun4/post/magun4_1
```

## How It Works

1. Scans all `.js` files in the specified directory (recursively)
2. Extracts paths containing `/:` (parameter indicators)
3. Saves original paths to `paths.txt`
4. Replaces parameters with `magun4` (first param) and `magun4_1`, `magun4_2`, etc. (subsequent params)
5. Prepends the provided domain
6. Saves full URLs to `CSPT_magun4.txt`
