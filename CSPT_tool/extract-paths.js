#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { URL } = require('url');

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const config = {
    jsDir: null,
    domain: null,
    urlsFile: null
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '-js' && args[i + 1]) {
      config.jsDir = args[i + 1];
      i++;
    } else if (args[i] === '-d' && args[i + 1]) {
      config.domain = args[i + 1];
      i++;
    } else if (args[i] === '-urls' && args[i + 1]) {
      config.urlsFile = args[i + 1];
      i++;
    }
  }

  return config;
}

// Recursively get all JS files in a directory
function getAllJsFiles(dir) {
  const files = [];
  
  if (!fs.existsSync(dir)) {
    console.error(`Error: Directory ${dir} does not exist`);
    return files;
  }

  const items = fs.readdirSync(dir);
  
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      files.push(...getAllJsFiles(fullPath));
    } else if (item.endsWith('.js')) {
      files.push(fullPath);
    }
  }
  
  return files;
}

// Extract paths with parameters (containing /:) from file content
function extractPaths(content) {
  const paths = new Set();
  
  // Match strings that look like route paths with parameters
  // Must start with / and contain /: for parameter
  const pathRegex = /['"`](\/[a-zA-Z0-9\-_/*]*\/:[a-zA-Z0-9\-_]+[a-zA-Z0-9\-_/*:]*?)['"`]/g;
  
  let match;
  while ((match = pathRegex.exec(content)) !== null) {
    const path = match[1];
    
    // Validate it's a real path:
    // 1. Must start with /
    // 2. Must contain /:
    // 3. Should not contain spaces or weird characters
    // 4. Should not be a regex pattern (no unescaped parentheses, brackets, etc.)
    // 5. Must have reasonable structure
    
    if (
      path.startsWith('/') &&
      path.includes('/:') &&
      !path.includes(' ') &&
      !path.includes('(') &&
      !path.includes(')') &&
      !path.includes('[') &&
      !path.includes(']') &&
      !path.includes('\\') &&
      !path.includes('?!') &&
      !path.includes('|') &&
      path.length > 2 &&
      path.length < 200 &&
      // Ensure parameter names are reasonable (alphanumeric, dash, underscore)
      /\/:[a-zA-Z][a-zA-Z0-9\-_]*/.test(path)
    ) {
      // Clean up any trailing wildcards or slashes for consistency
      const cleanPath = path.replace(/\/\*$/, '/*');
      paths.add(cleanPath);
    }
  }
  
  return Array.from(paths);
}

// Replace parameters in path with magun4, magun4_1, magun4_2, etc.
function replacePaths(pathStr, domain) {
  let paramIndex = 0;
  
  // Replace each :paramName with magun4 or magun4_N
  const replaced = pathStr.replace(/:([a-zA-Z0-9_]+)/g, () => {
    const value = paramIndex === 0 ? 'magun4' : `magun4_${paramIndex}`;
    paramIndex++;
    return value;
  });
  
  // Remove wildcard /* from the end
  const withoutWildcard = replaced.replace(/\/\*$/, '');
  
  // Ensure domain doesn't end with / and path starts with /
  const cleanDomain = domain.replace(/\/$/, '');
  const cleanPath = withoutWildcard.startsWith('/') ? withoutWildcard : '/' + withoutWildcard;
  
  return cleanDomain + cleanPath;
}

// Process a file with URLs: inject magun4 into query parameters
function processUrlList(filePath) {
  if (!fs.existsSync(filePath)) {
    console.error(`Error: URLs file ${filePath} does not exist`);
    process.exit(1);
  }

  const text = fs.readFileSync(filePath, 'utf8');
  const lines = text.split(/\r?\n/);
  const output = new Set();

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    // Only process http/https URLs that contain a query string
    if (!/^https?:\/\//i.test(trimmed)) continue;
    if (!trimmed.includes('?')) continue;

    try {
      const urlObj = new URL(trimmed);
      // Collect all entries including duplicates, then canonicalize order by key
      const entries = Array.from(urlObj.searchParams.entries());
      if (entries.length === 0) continue;

      // Build a canonical multiset of keys (ignore original order for dedup)
      const keyCounts = {};
      for (const [key] of entries) {
        keyCounts[key] = (keyCounts[key] || 0) + 1;
      }
      const sortedKeys = Object.keys(keyCounts).sort();
      const keysWithDupes = [];
      for (const k of sortedKeys) {
        for (let i = 0; i < keyCounts[k]; i++) keysWithDupes.push(k);
      }

      // Inject values for every parameter occurrence
      const canonParams = new URLSearchParams();
      let idx = 0;
      for (const k of keysWithDupes) {
        const value = idx === 0 ? 'magun4' : `magun4_${idx}`;
        canonParams.append(k, value);
        idx++;
      }

      // Write canonical params back to URL and construct consistent final string
      const canonSearch = canonParams.toString();
      const finalUrl = urlObj.origin + urlObj.pathname + (canonSearch ? `?${canonSearch}` : '') + (urlObj.hash || '');
      output.add(finalUrl);
    } catch (err) {
      // Ignore malformed URLs
      continue;
    }
  }

  const outArr = Array.from(output);
  if (outArr.length === 0) {
    console.log('No URLs with query parameters found in the provided list.');
  } else {
    fs.writeFileSync('CSPT_magun4_waymore.txt', outArr.join('\n'));
    console.log(`Created CSPT_magun4_waymore.txt with ${outArr.length} URL(s)`);
  }
}

// Main function
function main() {
  const config = parseArgs();

  // Help text
  const showUsage = () => {
    console.log('Usage: cspt -js <js_files_directory> -d <domain>');
    console.log('       cspt -urls <file_with_urls>');
    console.log('Examples:');
    console.log('  cspt -js ./JS_files -d https://example.com');
    console.log('  cspt -urls Waymore.txt');
  };

  // If -urls mode is provided, process URL list
  if (config.urlsFile) {
    console.log(`Processing URL list: ${config.urlsFile}`);
    processUrlList(config.urlsFile);
    console.log('\n✓ Done!');
    return;
  }

  // Otherwise expect -js and -d
  if (!config.jsDir || !config.domain) {
    showUsage();
    process.exit(1);
  }

  console.log(`Scanning JS files in: ${config.jsDir}`);
  console.log(`Domain: ${config.domain}`);
  
  const jsFiles = getAllJsFiles(config.jsDir);
  console.log(`Found ${jsFiles.length} JS file(s)`);
  
  const allPaths = new Set();
  
  // Process each JS file
  for (const file of jsFiles) {
    try {
      const content = fs.readFileSync(file, 'utf8');
      const paths = extractPaths(content);
      
      if (paths.length > 0) {
        console.log(`Found ${paths.length} path(s) in ${path.basename(file)}`);
        paths.forEach(p => allPaths.add(p));
      }
    } catch (error) {
      console.error(`Error reading ${file}: ${error.message}`);
    }
  }
  
  if (allPaths.size === 0) {
    console.log('No paths with parameters found!');
    return;
  }
  
  const pathsArray = Array.from(allPaths).sort();
  
  // Create paths.txt
  const pathsContent = pathsArray.join('\n');
  fs.writeFileSync('paths.txt', pathsContent);
  console.log(`\nCreated paths.txt with ${pathsArray.length} path(s)`);
  
  // Create CSPT_magun4.txt with replaced parameters (remove duplicates)
  const csptUrls = [...new Set(pathsArray.map(p => replacePaths(p, config.domain)))];
  const csptContent = csptUrls.join('\n');
  fs.writeFileSync('CSPT_magun4.txt', csptContent);
  console.log(`Created CSPT_magun4.txt with ${csptUrls.length} URL(s)`);
  
  console.log('\n✓ Done!');
}

main();
