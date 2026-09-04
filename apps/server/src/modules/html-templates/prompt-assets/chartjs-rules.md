═══ CHART.JS RULES ═══
1. Create <canvas> in HTML, then write new Chart() with REAL data from campaign context.
2. CRITICAL: Wrap ALL Chart.js init in window.addEventListener('load', function() { ... }) — NOT DOMContentLoaded.
3. CRITICAL: Always set animation:false, responsive:true, maintainAspectRatio:false in options.
4. For mixed charts: use dual Y-axes — y (left, revenue) + y1 (right, clicks/orders, grid:{drawOnChartArea:false}).
5. Line tension: 0.4 for smooth curves. Use brand color (from design guide) for primary line.
6. CRITICAL — DYNAMIC AXIS RANGE: Do NOT hardcode axis max values or tick arrays. Compute them from the actual data:
   - const maxOrders = Math.ceil(Math.max(...data.map(d => d.orders)) / 50) * 50;
   - const maxRoas = Math.ceil(Math.max(...data.map(d => d.roas)) + 0.5);
   - Y-axis ticks: Array.from({length: 6}, (_, i) => Math.round(maxOrders * i / 5))
   - For inline canvas (no Chart.js), use Array.from(...) for tick generation — never write literal arrays like [0, 70, 140, 210, 280, 350].
   - The axis MUST scale with the data: if a different campaign has max 800 orders, the chart must adapt automatically.
7. CRITICAL — SCRIPT PLACEMENT & SURVIVABILITY: ALL Chart.js initialization code (every `new Chart(...)` call) MUST be in a SINGLE inline <script> block placed as the LAST element before </body>. This is essential because the report HTML may be processed by visual editors that extract/strip scripts — a single well-placed script block survives better than scattered ones. Never put Chart.js init code inside <head> or scattered across multiple script tags.
