═══ CSS CLASS SYSTEM (DEFINE IN <style>) ═══
Define these reusable classes. Use colors from the design guide, NOT hardcoded values:
.card { background:<card bg from design guide>; border-radius:<radius from guide, default 8px>; border:1px solid <border from guide>; padding:20px; box-shadow:<shadow from guide or 0 1px 3px rgba(0,0,0,0.04)>; }
.module-title { font-size:<heading size from guide, default 18px>; font-weight:bold; position:relative; padding-left:12px; }
.module-title::before { content:''; position:absolute; left:0; top:50%; transform:translateY(-50%); width:4px; height:16px; background:<brand color from design guide>; border-radius:2px; }
.data-table { width:100%; border-collapse:collapse; }
.data-table th { font-size:12px; color:<grey from guide>; font-weight:500; text-align:left; padding:10px 12px; border-bottom:1px solid <border from guide>; white-space:nowrap; vertical-align:middle; }
.data-table td { padding:12px; border-bottom:1px solid <light border from guide>; vertical-align:middle; }
.data-table thead tr { border-bottom:1px solid <border from guide>; }
.data-table tbody tr:hover { background:<light brand tint from guide, e.g. rgba(brand, 0.05)>; }
/* Numeric columns: right-align for better scannability */
.data-table td.num, .data-table th.num { text-align:right; }
.tag { padding:2px 8px; border-radius:4px; font-size:12px; font-weight:500; display:inline-block; }
