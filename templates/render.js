#!/usr/bin/env node
/**
 * Brandtrack Report Renderer
 *
 * 用法：
 *   node render.js <data.json> [output.html]
 *
 * 将 brandtrack-report.html 模板 + JSON 数据 → 最终 HTML 报告
 * 支持 Mustache 风格占位符：{{var}}, {{#array}}...{{/array}}, {{.}}
 *
 * 示例：
 *   node render.js brandtrack-report.sample.json output.html
 *   open output.html
 */

const fs = require('fs');
const path = require('path');

const templatePath = path.join(__dirname, 'brandtrack-report.html');
const dataPath = process.argv[2] || path.join(__dirname, 'brandtrack-report.sample.json');
const outputPath = process.argv[3] || path.join(path.dirname(dataPath), 'report-output.html');

// ── Mini Mustache renderer ──

function renderTemplate(tpl, data) {
  let result = tpl;

  // 1. Handle {{#array}}...{{/array}} blocks (repeat + nested)
  result = result.replace(/\{\{#(\w+)(\.\w+)?\}\}([\s\S]*?)\{\{\/\1\}\}/g, (_, key, subKey, body) => {
    const list = resolvePath(data, key);
    if (!Array.isArray(list)) return '';
    return list.map(item => {
      let row = body;
      if (subKey) {
        // {{#brands.post_share}} → item is object, render inner with item context
        row = renderTemplate(row, item);
      } else {
        // {{#findings}} → item is object
        if (typeof item === 'object' && item !== null) {
          row = renderTemplate(row, item);
        } else {
          // {{#tags}} → primitive, {{.}} → item
          row = row.replace(/\{\{\.\}\}/g, String(item));
        }
      }
      return row;
    }).join('');
  });

  // 2. Handle {{#flag}}...{{/flag}} (conditional boolean)
  result = result.replace(/\{\{#(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g, (_, key, body) => {
    const val = resolvePath(data, key);
    return val ? body : '';
  });

  // 3. Handle {{var}} simple replacement
  result = result.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const val = data[key];
    return val !== undefined && val !== null ? String(val) : '';
  });

  // 4. Handle {{{var}}} (unescaped / raw HTML)
  result = result.replace(/\{\{\{(\w+)\}\}\}/g, (_, key) => {
    const val = data[key];
    return val !== undefined && val !== null ? String(val) : '';
  });

  return result;
}

function resolvePath(obj, path) {
  return path.split('.').reduce((acc, key) => acc?.[key], obj);
}

// ── Main ──

const template = fs.readFileSync(templatePath, 'utf8');
const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
const html = renderTemplate(template, data);

fs.writeFileSync(outputPath, html, 'utf8');
console.log(`✅ Report rendered: ${outputPath} (${(html.length / 1024).toFixed(1)}KB)`);
