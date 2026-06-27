import type { EmailData, EmailProductItem } from '@ppt-generator/shared'

function renderGrid(list: EmailProductItem[]): string {
  let html = ''
  for (let i = 0; i < list.length; i++) {
    if (i % 3 === 0) html += '<tr>'
    html += `
                    <td class="stack-column" valign="top" width="33.33%" style="padding: 10px 5px;">
                        <p style="font-family:Arial,sans-serif;font-size:11px;font-weight:700;color:#FF099E;text-transform:uppercase;margin:0 0 5px 0;">${list[i].brand}</p>
                        <h4 style="font-family:Arial,sans-serif;font-size:14px;font-weight:400;margin:0 0 5px 0;height:36px;overflow:hidden;line-height:1.2;color:#000000;">${list[i].name}</h4>
                        <p style="font-family:Arial,sans-serif;font-size:12px;font-weight:700;color:#d32f2f;margin:0 0 10px 0;">${list[i].discount}</p>
                        <a href="${list[i].link}" style="display:block;">
                            <img src="${list[i].img}" width="300" height="375" style="width:100%;height:375px;display:block;object-fit:cover;margin-bottom:15px;border-radius:2px;">
                        </a>
                        <div style="text-align:center;">
                            <a href="${list[i].link}" style="background-color:#FF099E;color:#ffffff;padding:10px 20px;font-family:Arial,sans-serif;font-size:11px;font-weight:bold;text-decoration:none;text-transform:uppercase;display:inline-block;border-radius:2px;">VISIT NOW</a>
                        </div>
                    </td>
                `
    if (i % 3 === 2 || i === list.length - 1) html += '</tr>'
  }
  return html
}

export function generateEmailHtml(d: EmailData): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>${d.hero.title}</title>
<style>
body{margin:0;padding:0;background-color:#ffffff;font-family:Arial,sans-serif;}
@media screen and (max-width: 600px) {
    .email-container{width:100%!important;}
    .stack-column{display:block!important;width:100%!important;padding-bottom:30px;}
    img{width:100%!important;height:auto!important;}
}
</style>
</head>
<body style="margin:0;padding:0;background-color:#ffffff;">
<table border="0" cellpadding="0" cellspacing="0" width="100%">
    <tr><td align="center">
        <table class="email-container" border="0" cellpadding="0" cellspacing="0" width="600" style="margin:0 auto;max-width:600px;">
            <tr><td align="center" style="padding:40px 0 10px 0;"><a href="#"><img src="${d.header.logo}" width="240" style="display:block;border:0;"></a></td></tr>
            <tr><td align="center" style="padding:0 32px 40px 32px;"><p style="font-size:11px;color:#666;letter-spacing:2px;margin:0;">${d.header.subtitle}</p><div style="height:1px;background:#e0e0e0;margin-top:20px;"></div></td></tr>
            <tr><td align="center" style="padding:0 32px 30px 32px;"><h1 style="font-size:48px;line-height:1;margin:0;text-transform:uppercase;">${d.hero.title}</h1></td></tr>
            <tr><td align="center" style="padding:0 32px 40px 32px;">
                <table border="0" cellpadding="0" cellspacing="0" width="100%"><tr>
                    ${d.topDeals
                      .map(
                        (item) => `
                    <td class="stack-column" valign="top" width="33.33%" style="padding-right:10px;">
                        <a href="${item.link}"><img src="${item.img}" width="170" height="110" style="width:100%;height:110px;object-fit:cover;margin-bottom:12px;background:#f4f4f4;"></a>
                        <p style="margin:0 0 5px 0;font-size:12px;font-weight:700;color:#FF099E;">${item.brand}</p>
                        <p style="margin:0;font-size:13px;line-height:1.4;">${item.text}</p>
                    </td>`,
                      )
                      .join('')}
                </tr></table>
            </td></tr>
            <tr><td align="center" style="padding-bottom:25px;"><div style="height:1px;background:#e0e0e0;margin-bottom:20px;"></div><span style="font-size:18px;font-weight:900;">${d.date}</span><div style="height:1px;background:#e0e0e0;margin-top:20px;"></div></td></tr>
            <tr><td bgcolor="#FF099E" align="center" style="padding:15px 32px;"><h2 style="margin:0;color:#fff;font-size:30px;">${d.feature.title}</h2></td></tr>
            <tr><td align="center" style="padding:30px 32px 40px 32px;">
                <p style="font-size:20px;margin:0 0 20px 0;">${d.feature.intro}</p>
                <a href="${d.feature.btnLink}"><img src="${d.feature.mainImg}" width="536" style="width:100%;height:auto;display:block;margin-bottom:30px;"></a>
                <h3 style="font-size:22px;margin:0 0 25px 0;">${d.feature.prodName}</h3>
                <table border="0" cellpadding="0" cellspacing="0" width="100%"><tr>
                    ${d.feature.details
                      .map(
                        (det) => `
                    <td class="stack-column" valign="top" width="33.33%" align="center" style="padding:0 5px;">
                        <img src="${det.img}" width="300" height="400" style="width:100%;height:auto;margin-bottom:15px;">
                        <p style="margin:0;font-size:14px;font-weight:900;">${det.text}</p>
                    </td>`,
                      )
                      .join('')}
                </tr></table>
                <div style="padding-top:40px;"><a href="${d.feature.btnLink}" style="background:#FF099E;color:#fff;padding:14px 40px;text-decoration:none;font-weight:bold;display:inline-block;">${d.feature.btnText}</a></div>
            </td></tr>
            <tr><td style="padding:20px 32px 10px 32px;"><h3 style="margin:0;font-size:18px;border-bottom:1px solid #ccc;padding-bottom:10px;">FASHION</h3></td></tr>
            <tr><td align="center" style="padding:0 32px 40px 32px;">
                <table border="0" cellpadding="0" cellspacing="0" width="100%">
                    ${renderGrid(d.fashion)}
                </table>
            </td></tr>
            <tr><td style="padding:20px 32px 10px 32px;"><h3 style="margin:0;font-size:18px;border-bottom:1px solid #ccc;padding-bottom:10px;">BEAUTY</h3></td></tr>
            <tr><td align="center" style="padding:0 32px 60px 32px;">
                <table border="0" cellpadding="0" cellspacing="0" width="100%">
                    ${renderGrid(d.beauty)}
                </table>
            </td></tr>
            <tr><td bgcolor="#000000" align="center" style="padding:40px 32px;color:#999;font-size:13px;">
                <p style="margin-bottom:20px;color:#fff;">UNSUBSCRIBE | PRIVACY POLICY | WEB</p>
                <p>Thank you for your support.</p>
            </td></tr>
        </table>
    </td></tr>
</table>
</body>
</html>`
}
