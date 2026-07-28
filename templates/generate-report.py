#!/usr/bin/env python3
"""
BrandTrack 报告生成器
用 PPTGenerator 的 mock 数据（6 campaigns, 13 creators）填充 brandtrack-report.html 模板。
"""
import re, json, os

TEMPLATE = "/Users/ap/Desktop/PPTGenerator/templates/brandtrack-report.html"
OUTPUT   = "/Users/ap/Desktop/PPTGenerator/templates/campaign-report-filled.html"

with open(TEMPLATE, "r") as f:
    tpl = f.read()

# ══════════════════════════════════════════════════════════════
# DATA (derived from PPTGenerator mock data)
# ══════════════════════════════════════════════════════════════

data = {
    # ── 全局 ──
    "logo_url": "",  # 用 CSS 文字 logo
    "hero_image": "",  # 用 CSS gradient 替代
    "report_title": "GLOW LAB / Q4 2026 CAMPAIGN",
    "report_h1": "Creator Intelligence",
    "report_h2": "Cross-platform content performance & creator collaboration insights from Q4 beauty campaign",
    "snapshot_headline": "Three findings that define Glow Lab's Q4 creator strategy",
    "landscape_headline": "Six campaigns benchmarked by creator reach intensity",
    "landscape_description": "Comparing campaign-level creator engagement across the portfolio. Reach intensity = weighted average of creator-tier impressions × campaign intensity coefficient.",
    "formats_headline": "Content format mix by platform",
    "formats_description": "Post share = percentage of total posts by format. Interaction share = percentage of total engagement captured by each format.",
    "formats_source": "Source: Creator performance mock data, deterministically derived from tier baselines × campaign intensity (n=12,000+ posts across 6 campaigns).",
    "angles_headline": "Content angle distribution by campaign",
    "angles_description": "How each campaign's creators split their content across thematic angles, from product-focused to lifestyle storytelling.",
    "recommendation_title": "Build a diversified content pyramid for Q1 2027",
    "keywords_headline": "High-frequency keywords across creator content",
    "keywords_description": "Word frequency analysis from 72+ creator post titles across the Glow Lab Q4 campaign.",
    "keyword_insight_title": "Functional authority drives discovery",
    "keyword_insight_body": "High-frequency words like 'serum', 'barrier', and 'skin' reinforce Glow Lab's positioning as a science-backed skincare brand. The emphasis on 'review' and 'routine' signals strong consideration-stage content.",
    "hashtags_headline": "Hashtag performance matrix",
    "hashtags_description": "Post count vs. interaction index per hashtag. Green dots = above-average engagement efficiency.",
    "hashtag_strategy_title": "Branded ecosystem + trend-surfing tags",
    "hashtag_strategy_body": "Combine <b>#glowlab</b> branded tags with high-reach beauty tags like <b>#skincareroutine</b> and <b>#barrierrepair</b>. Contextual tags (#sensitiveskin, #ceramide) drive qualified traffic from intent-driven searches.",
    "hashtag_brand_system": "#glowlab #glowlabserum #barrierrepair",
    "hashtag_contextual": "#sensitiveskin #ceramide #skincareroutine #rednessrelief",
    "actions_headline": "Three priority actions for Q1 2027",

    # ── Platforms ──
    "platforms": ["TikTok", "Instagram", "YouTube"],

    # ── Period & Edition ──
    "period": "OCT-DEC 2026",
    "edition": "BRANDTRACK / Q4 2026",

    # ── 01 SNAPSHOT: Findings ──
    "findings": [
        {"number": "01", "title": "Video drives disproportionate response", "description": "TikTok videos represent 37% of Glow Lab's creator output but generate 56% of total engagement. Reels follow at 32% output / 47% engagement. Short-form video is the clear winner for beauty content."},
        {"number": "02", "title": "Mega creators outperform on reach, micro on engagement", "description": "Mia Chen (1.28M followers, mega tier) delivers 850K avg impressions per post, while Tom Reyes (54K, micro) achieves 12.1% engagement rate — nearly 2× the platform average. A blended roster maximizes both reach and depth."},
        {"number": "03", "title": "Multi-platform campaigns show 2.3× conversion lift", "description": "Creators active on 3+ platforms (TikTok + Instagram + YouTube) generate 2.3× more CPS conversions than single-platform creators. Cross-platform retargeting via creator content compounds effectively."},
    ],

    # ── 02 LANDSCAPE: Competitors (using campaigns as benchmark) ──
    "competitors": [
        {"name": "Everyday BF", "highlight_percent": "130%", "highlight_label": "Peak intensity — Black Friday gift campaign", "bar_width": 100, "focus": True},
        {"name": "Nova Home 618", "highlight_percent": "125%", "highlight_label": "Home & lifestyle — highest intensity", "bar_width": 96, "focus": False},
        {"name": "Glow Lab Q4", "highlight_percent": "100%", "highlight_label": "Skincare — tracked campaign baseline", "bar_width": 77, "focus": False},
        {"name": "Lumiere Launch", "highlight_percent": "85%", "highlight_label": "Anti-aging skincare launch", "bar_width": 65, "focus": False},
    ],

    # ── 03 FORMATS: Content format analysis ──
    "brands_formats": [
        {
            "brand_name": "TikTok", "brand_type": "VIDEO-FIRST", "focus": True,
            "post_share": [
                {"format_name": "TikTok Video", "percent": "37.0", "width": 37},
                {"format_name": "Instagram Reel", "percent": "31.9", "width": 32},
                {"format_name": "IG Carousel", "percent": "20.2", "width": 20},
                {"format_name": "YouTube Video", "percent": "6.7", "width": 7},
                {"format_name": "Other", "percent": "4.2", "width": 4},
            ],
            "interaction_share": [
                {"format_name": "TikTok Video", "percent": "30.0", "width": 30},
                {"format_name": "Instagram Reel", "percent": "56.6", "width": 57},
                {"format_name": "IG Carousel", "percent": "9.7", "width": 10},
                {"format_name": "YouTube Video", "percent": "2.5", "width": 3},
                {"format_name": "Other", "percent": "1.3", "width": 1},
            ],
        },
        {
            "brand_name": "Instagram", "brand_type": "VISUAL-FIRST", "focus": False,
            "post_share": [
                {"format_name": "IG Post", "percent": "48.2", "width": 48},
                {"format_name": "IG Reel", "percent": "24.6", "width": 25},
                {"format_name": "IG Carousel", "percent": "20.9", "width": 21},
                {"format_name": "IG Story", "percent": "3.0", "width": 3},
                {"format_name": "Other", "percent": "3.2", "width": 3},
            ],
            "interaction_share": [
                {"format_name": "IG Post", "percent": "48.9", "width": 49},
                {"format_name": "IG Reel", "percent": "47.8", "width": 48},
                {"format_name": "IG Carousel", "percent": "2.7", "width": 3},
                {"format_name": "IG Story", "percent": "0.3", "width": 0},
                {"format_name": "Other", "percent": "0.3", "width": 0},
            ],
        },
        {
            "brand_name": "YouTube", "brand_type": "LONG-FORM", "focus": False,
            "post_share": [
                {"format_name": "Long Video", "percent": "39.3", "width": 39},
                {"format_name": "Shorts", "percent": "17.2", "width": 17},
                {"format_name": "Community", "percent": "16.1", "width": 16},
                {"format_name": "Live Clip", "percent": "15.1", "width": 15},
                {"format_name": "Other", "percent": "12.4", "width": 12},
            ],
            "interaction_share": [
                {"format_name": "Long Video", "percent": "94.4", "width": 94},
                {"format_name": "Shorts", "percent": "1.9", "width": 2},
                {"format_name": "Community", "percent": "2.1", "width": 2},
                {"format_name": "Live Clip", "percent": "0.2", "width": 0},
                {"format_name": "Other", "percent": "1.4", "width": 1},
            ],
        },
        {
            "brand_name": "Cross-Platform", "brand_type": "BLENDED", "focus": False,
            "post_share": [
                {"format_name": "TikTok Video", "percent": "35.5", "width": 36},
                {"format_name": "IG Reel", "percent": "29.0", "width": 29},
                {"format_name": "IG Carousel", "percent": "14.0", "width": 14},
                {"format_name": "YouTube Video", "percent": "9.3", "width": 9},
                {"format_name": "Other", "percent": "12.2", "width": 12},
            ],
            "interaction_share": [
                {"format_name": "TikTok Video", "percent": "73.9", "width": 74},
                {"format_name": "IG Reel", "percent": "17.8", "width": 18},
                {"format_name": "IG Carousel", "percent": "7.7", "width": 8},
                {"format_name": "YouTube Video", "percent": "0.3", "width": 0},
                {"format_name": "Other", "percent": "0.4", "width": 0},
            ],
        },
    ],

    # ── 04 ANGLES: Content angle analysis ──
    "brands_angles": [
        {
            "brand_name": "Glow Lab", "focus": True,
            "angles": [
                {"angle_name": "Product Review", "percent": 53, "bar_width": 95},
                {"angle_name": "Routine / GRWM", "percent": 30, "bar_width": 54},
                {"angle_name": "Ingredient Deep Dive", "percent": 12, "bar_width": 22},
                {"angle_name": "Promotion / Offer", "percent": 4, "bar_width": 7},
                {"angle_name": "Before & After", "percent": 1, "bar_width": 2},
            ],
        },
        {
            "brand_name": "Lumiere", "focus": False,
            "angles": [
                {"angle_name": "Product Review", "percent": 33, "bar_width": 59},
                {"angle_name": "Routine / GRWM", "percent": 50, "bar_width": 90},
                {"angle_name": "Ingredient Deep Dive", "percent": 10, "bar_width": 18},
                {"angle_name": "Promotion / Offer", "percent": 2, "bar_width": 4},
                {"angle_name": "Before & After", "percent": 1, "bar_width": 2},
            ],
        },
        {
            "brand_name": "Nova Home", "focus": False,
            "angles": [
                {"angle_name": "Product Review", "percent": 37, "bar_width": 67},
                {"angle_name": "Routine / GRWM", "percent": 35, "bar_width": 63},
                {"angle_name": "Ingredient Deep Dive", "percent": 15, "bar_width": 27},
                {"angle_name": "Promotion / Offer", "percent": 6, "bar_width": 11},
                {"angle_name": "Before & After", "percent": 4, "bar_width": 7},
            ],
        },
        {
            "brand_name": "Motion", "focus": False,
            "angles": [
                {"angle_name": "Product Review", "percent": 34, "bar_width": 61},
                {"angle_name": "Routine / GRWM", "percent": 49, "bar_width": 88},
                {"angle_name": "Ingredient Deep Dive", "percent": 13, "bar_width": 23},
                {"angle_name": "Promotion / Offer", "percent": 3, "bar_width": 5},
                {"angle_name": "Before & After", "percent": 1, "bar_width": 2},
            ],
        },
    ],
    "recommendation_items": [
        "Introduce lifestyle and before-and-after content to attract non-core audiences and diversify the content mix.",
        "Launch short-form tutorial series such as '7-Day Barrier Repair Challenge' to build a content franchise.",
        "Use seasonal moments (Black Friday, Lunar New Year) and limited-time offers to drive purchase-intent traffic.",
        "Allocate 40% budget to Reels/TikTok video, 30% to carousel product deep-dives, 20% to long-form YouTube reviews, 10% to experimental formats.",
    ],

    # ── 05 KEYWORDS ──
    "keywords": [
        {"word": "serum", "count": 607, "bar_width": 100},
        {"word": "barrier", "count": 223, "bar_width": 37},
        {"word": "skin", "count": 165, "bar_width": 27},
        {"word": "routine", "count": 122, "bar_width": 20},
        {"word": "glowlab", "count": 115, "bar_width": 19},
        {"word": "review", "count": 91, "bar_width": 15},
        {"word": "ceramide", "count": 91, "bar_width": 15},
        {"word": "sensitive", "count": 88, "bar_width": 15},
        {"word": "redness", "count": 88, "bar_width": 15},
        {"word": "repair", "count": 76, "bar_width": 13},
        {"word": "grwm", "count": 73, "bar_width": 12},
        {"word": "night", "count": 70, "bar_width": 12},
        {"word": "morning", "count": 70, "bar_width": 12},
        {"word": "calming", "count": 66, "bar_width": 11},
        {"word": "transform", "count": 66, "bar_width": 11},
        {"word": "challenge", "count": 61, "bar_width": 10},
        {"word": "results", "count": 59, "bar_width": 10},
        {"word": "diary", "count": 58, "bar_width": 10},
    ],
    "keyword_keep": "Serum, barrier, skin, review, routine, ceramide — these core functional keywords reinforce Glow Lab's science-backed positioning and should remain prominent in all creator briefs.",
    "keyword_expand": "Transform, challenge, results, diary — these narrative-driven keywords are underused but drive emotional engagement and social proof. Expand into storytelling-driven content.",

    # ── 06 HASHTAGS ──
    "hashtags_y_max": "36",
    "hashtags_y_mid": "27",
    "hashtags_y_low": "18",
    "hashtags_y_min": "9",
    "hashtags": [
        {"tag": "#glowlab", "post_count": 36, "post_height": 320, "interaction_index": 18, "interaction_bottom": 160},
        {"tag": "#glowlabserum", "post_count": 20, "post_height": 178, "interaction_index": 8, "interaction_bottom": 71},
        {"tag": "#skincareroutine", "post_count": 20, "post_height": 178, "interaction_index": 34, "interaction_bottom": 302},
        {"tag": "#barrierrepair", "post_count": 14, "post_height": 124, "interaction_index": 4, "interaction_bottom": 36},
        {"tag": "#sensitiveskin", "post_count": 12, "post_height": 107, "interaction_index": 20, "interaction_bottom": 178},
        {"tag": "#ceramide", "post_count": 11, "post_height": 98, "interaction_index": 7, "interaction_bottom": 62},
        {"tag": "#rednessrelief", "post_count": 9, "post_height": 80, "interaction_index": 13, "interaction_bottom": 116},
        {"tag": "#diy", "post_count": 8, "post_height": 71, "interaction_index": 8, "interaction_bottom": 71},
        {"tag": "#skintok", "post_count": 7, "post_height": 62, "interaction_index": 1, "interaction_bottom": 9},
        {"tag": "#tutorial", "post_count": 6, "post_height": 53, "interaction_index": 3, "interaction_bottom": 27},
    ],

    # ── 07 ACTIONS ──
    "actions": [
        {"number": "01", "category": "CONTENT STRATEGY", "title": "Shift 20% of budget from product reviews to storytelling", "description": "Product reviews dominate at 53% but are saturated. Reallocate to 'before & after', 'challenge', and 'routine diary' angles to build emotional connection and differentiation."},
        {"number": "02", "category": "CREATOR MIX", "title": "Add 3 micro-tier creators per market for the next campaign", "description": "Micro creators (Tom Reyes, Priya Rao, Yuki Tanaka) deliver 2× engagement rate vs. mega tier. Blending 60% mega / 40% micro maximizes both reach and depth at lower CPM."},
        {"number": "03", "category": "PLATFORM EXPANSION", "title": "Test Xiaohongshu for the CN market entry", "description": "Iris Lin (398K, Xiaohongshu) and Yuki Tanaka (48K) demonstrate strong engagement in the APAC beauty space. Xiaohongshu's 9.1% engagement rate outperforms Instagram's 6.9% for skincare content."},
    ],

    # ── Footer ──
    "footer_description": "BRANDTRACK is a competitive creator intelligence report. Data is deterministically derived from campaign performance mock data (6 campaigns, 13 creators, 12,000+ simulated posts). All figures are illustrative.",
    "footer_data_source": "Data source: PPTGenerator creator performance engine",
    "footer_period": "Period: Q4 2026 (Oct–Dec) | Generated: 2026-07-28",
}

# ══════════════════════════════════════════════════════════════
# Simple Mustache-like renderer
# ══════════════════════════════════════════════════════════════

def render_bool_sections(tpl, data):
    """Handle {{#focus}}...{{/focus}} boolean sections."""
    for sec_name in ["focus"]:
        pattern = r'\{\{#' + sec_name + r'\}\}(.*?)\{\{/' + sec_name + r'\}\}'
        def replacer(m):
            key = sec_name
            # This is used inside a list item context — handled in render_list
            return m.group(1)
        tpl = re.sub(pattern, lambda m: f"__BOOL_{sec_name}_OPEN__{m.group(1)}__BOOL_{sec_name}_CLOSE__", tpl, flags=re.DOTALL)
    return tpl

def render_list(tpl, key, items):
    """Render {{#key}}...{{/key}} list sections."""
    pattern = r'\{\{#' + key + r'\}\}(.*?)\{\{/' + key + r'\}\}'
    def replacer(m):
        inner = m.group(1)
        rendered_items = []
        for item in items:
            item_html = inner
            # Handle nested {{#post_share}}...{{/post_share}}
            for nested_key in ["post_share", "interaction_share", "angles", "platforms"]:
                nested_pat = r'\{\{#' + nested_key + r'\}\}(.*?)\{\{/' + nested_key + r'\}\}'
                nested_items = item.get(nested_key, [])
                def nested_repl(nm):
                    nested_inner = nm.group(1)
                    parts = []
                    for ni in nested_items:
                        part = nested_inner
                        for nk, nv in ni.items():
                            part = part.replace("{{" + nk + "}}", str(nv))
                        parts.append(part)
                    return "".join(parts)
                item_html = re.sub(nested_pat, nested_repl, item_html, flags=re.DOTALL)

            # Handle boolean focus sections
            focus_open = f"__BOOL_focus_OPEN__"
            focus_close = f"__BOOL_focus_CLOSE__"
            is_focus = item.get("focus", False)
            if focus_open in item_html:
                if is_focus:
                    item_html = item_html.replace(focus_open, "").replace(focus_close, "")
                else:
                    # Remove content between focus markers
                    item_html = re.sub(re.escape(focus_open) + r".*?" + re.escape(focus_close), "", item_html, flags=re.DOTALL)

            # Replace simple placeholders for this item
            for ik, iv in item.items():
                if ik != "focus":
                    item_html = item_html.replace("{{" + ik + "}}", str(iv))

            # Remove any remaining focus markers
            item_html = item_html.replace(focus_open, "").replace(focus_close, "")

            rendered_items.append(item_html)
        return "".join(rendered_items)

    return re.sub(pattern, replacer, tpl, flags=re.DOTALL)

def render_simple_list(tpl, key, items):
    """Render {{#key}}{{.}}{{/key}} simple list sections (like platforms)."""
    pattern = r'\{\{#' + key + r'\}\}(.*?)\{\{/' + key + r'\}\}'
    def replacer(m):
        inner = m.group(1)
        return "".join(inner.replace("{{.}}", str(item)) for item in items)
    return re.sub(pattern, replacer, tpl, flags=re.DOTALL)

def render_scalar(tpl, key, value):
    """Replace {{key}} with value."""
    return tpl.replace("{{" + key + "}}", str(value))

# ══════════════════════════════════════════════════════════════
# RENDER
# ══════════════════════════════════════════════════════════════

html = tpl

# 1. Pre-process boolean section markers
html = render_bool_sections(html, data)

# 2. Render nested list sections (formats with post_share/interaction_share)
list_keys_with_nested = ["brands_formats"]
for key in list_keys_with_nested:
    html = render_list(html, key, data.get(key, []))

# 3. Render list sections — only for dict-item lists
list_keys = ["findings", "competitors", "brands_angles", "keywords", "hashtags", "actions"]
for key in list_keys:
    items = data.get(key, [])
    if isinstance(items, list) and items and isinstance(items[0], dict):
        html = render_list(html, key, items)

# 3b. Render recommendation_items (string list with {{.}})
html = render_simple_list(html, "recommendation_items", data.get("recommendation_items", []))

# 4. Render platforms (simple {{.}} list)
html = render_simple_list(html, "platforms", data.get("platforms", []))

# 5. Render scalar placeholders
all_keys = set(re.findall(r'\{\{(\w+)\}\}', html))
for key in all_keys:
    if key in data:
        html = render_scalar(html, key, data[key])

# 6. Replace logo placeholder with text-based logo (no external image)
html = html.replace(
    '<img src="" alt="Logo"/>',
    '<span style="font-weight:700;font-size:14px;letter-spacing:-0.02em;">BRANDTRACK</span>'
)
html = html.replace(
    '<img src="" alt="Logo"/>',
    '<span class="footer-logo" style="font-weight:700;font-size:14px;letter-spacing:-0.02em;">BRANDTRACK</span>'
)

# 7. Replace hero image with CSS gradient placeholder
hero_pattern = r'<img src="" alt="Hero image"/>'
hero_replacement = '''<div style="width:100%;height:100%;background:
      linear-gradient(135deg, #1a1a2e 0%, #16213e 40%, #0f3460 100%);
      display:flex;align-items:center;justify-content:flex-end;padding-right:8vw;">
      <div style="text-align:right;color:rgba(255,255,255,0.06);font-size:180px;font-weight:900;letter-spacing:-0.08em;line-height:0.8;">GLOW<br/>LAB</div>
    </div>'''
html = re.sub(hero_pattern, hero_replacement, html)

# 8. Clean up any remaining {{placeholder}} with empty string
remaining = set(re.findall(r'\{\{(\w+)\}\}', html))
if remaining:
    print(f"Warning: {len(remaining)} unresolved placeholders: {remaining}")
    for key in remaining:
        html = html.replace("{{" + key + "}}", "")

# 9. Clean up remaining boolean markers
html = html.replace("__BOOL_focus_OPEN__", "").replace("__BOOL_focus_CLOSE__", "")

# Write output
with open(OUTPUT, "w") as f:
    f.write(html)

print(f"✅ Report generated: {OUTPUT}")
print(f"   Size: {len(html):,} chars")
print(f"   Remaining placeholders: {len(remaining)}")
