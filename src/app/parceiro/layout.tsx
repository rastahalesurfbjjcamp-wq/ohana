import type { Metadata } from "next";
import { env } from "@/lib/env";

export const metadata: Metadata = { title: `Parceiros ${env.storeName()}`, robots: { index: false } };

export default function ParceiroLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="pp">
      <style>{CSS}</style>
      {children}
    </div>
  );
}

const CSS = `
html,body{background:#f4f3ef!important;color:#111}
.pp{min-height:100vh;background:#f4f3ef;color:#111;font-family:Geist,"Helvetica Neue",Arial,sans-serif;-webkit-font-smoothing:antialiased}
.pp .tw{font-family:Elite,serif;text-transform:uppercase;font-weight:400;letter-spacing:.01em}
.pp a{color:inherit}
.pp a.pp-btn{color:#fff}.pp a.pp-btn.line,.pp a.pp-btn.w{color:#111}
.pp-top{background:#000;color:#fff}
.pp-top .in{max-width:1080px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;padding:12px 18px;gap:12px}
.pp-brand{display:flex;align-items:center;gap:10px;text-decoration:none}
.pp-brand img{height:34px}
.pp-brand b{font-weight:900;font-style:italic;font-size:15px;display:block}
.pp-brand small{font-size:10.5px;letter-spacing:.2em;opacity:.7;display:block;margin-top:2px}
.pp-stripe{display:flex;flex-direction:column;gap:2px;width:72px;margin-top:4px}.pp-stripe i{height:2.5px;display:block}
.pp-stripe i:nth-child(1){background:#d62b2b}.pp-stripe i:nth-child(2){background:#f2c500}.pp-stripe i:nth-child(3){background:#13a538}
.pp-out{background:none;border:1px solid rgba(255,255,255,.3);color:#fff;font-size:12px;padding:7px 12px;cursor:pointer;font-family:inherit}
.pp-main{max-width:1080px;margin:0 auto;padding:26px 18px 60px}
.pp-hi{display:flex;justify-content:space-between;align-items:flex-end;gap:14px;flex-wrap:wrap;margin-bottom:18px}
.pp-hi h1{font-size:clamp(28px,4vw,40px);line-height:1}
.pp-hi p{color:#666;font-size:14px;margin-top:6px}
.pp-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
.pp-card{background:#fff;border:1px solid #e4e2dc;padding:18px}
.pp-card.dark{background:#111;color:#fff;border-color:#111}
.pp-card small{display:block;font-size:11px;font-weight:700;letter-spacing:.12em;color:#888;text-transform:uppercase}
.pp-card.dark small{color:#9a9a9a}
.pp-card b.v{display:block;font-size:30px;font-weight:700;letter-spacing:-.02em;margin-top:8px}
.pp-card span.s{display:block;font-size:12.5px;color:#777;margin-top:6px;line-height:1.45}
.pp-card.dark span.s{color:#aaa}
.pp-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;background:#111;color:#fff;border:0;font-family:inherit;font-weight:800;font-size:12.5px;letter-spacing:.1em;padding:13px 18px;cursor:pointer;text-decoration:none;text-transform:uppercase}
.pp-btn.w{background:#fff;color:#111}
.pp-btn.line{background:#fff;color:#111;border:1px solid #111}
.pp-btn:disabled{background:#bbb;cursor:not-allowed}
.pp-sec{margin-top:26px}
.pp-sec h2{font-size:20px;margin-bottom:12px}
.pp-two{display:grid;grid-template-columns:1.2fr 1fr;gap:12px}
.pp-bar{height:10px;background:#ecebe6;position:relative;margin:14px 0 8px}
.pp-bar i{position:absolute;left:0;top:0;bottom:0;background:#111}
.pp-bar i.y{background:linear-gradient(90deg,#13a538,#f2c500)}
.pp-tiers{display:flex;flex-direction:column;gap:6px;margin-top:10px}
.pp-tier{display:flex;justify-content:space-between;font-size:13px;padding:8px 10px;border:1px solid #ecebe6}
.pp-tier.on{border-color:#111;background:#fafaf7;font-weight:700}
.pp-link{display:flex;gap:8px;align-items:stretch;margin-top:10px}
.pp-link input{flex:1;min-width:0;border:1px solid #ddd;padding:10px;font-family:inherit;font-size:13px;background:#fafaf7}
.pp-code{font-family:Elite,serif;font-size:26px;letter-spacing:.06em;margin-top:6px}
.pp-tb{width:100%;border-collapse:collapse;font-size:13.5px;background:#fff;border:1px solid #e4e2dc}
.pp-tb th{text-align:left;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#888;font-weight:700;padding:10px 12px;border-bottom:1px solid #e4e2dc}
.pp-tb td{padding:10px 12px;border-bottom:1px solid #f0efea}
.pp-tb td.r,.pp-tb th.r{text-align:right}
.pp-tag{display:inline-block;white-space:nowrap;font-size:11px;font-weight:700;padding:3px 8px;border-radius:99px;background:#efeee9;color:#555}
.pp-tag.ok{background:#e3f4e8;color:#137a35}.pp-tag.wait{background:#fff5d6;color:#8a6a00}.pp-tag.no{background:#fde7e7;color:#a32020}
.pp-neg{color:#a32020}
.pp-form{display:grid;grid-template-columns:1fr 1.4fr auto;gap:8px;margin-top:12px;align-items:end}
.pp-form label{display:flex;flex-direction:column;gap:5px;font-size:12px;font-weight:700;letter-spacing:.06em;color:#555;text-transform:uppercase}
.pp-form input,.pp-f{border:1px solid #ccc;padding:11px;font-family:inherit;font-size:14px;background:#fff;width:100%}
.pp-msg{padding:12px 14px;font-size:13.5px;margin-bottom:14px;border:1px solid}
.pp-msg.ok{background:#e9f7ee;border-color:#9fd8b2;color:#145c2c}.pp-msg.err{background:#fdeeee;border-color:#f0b4b4;color:#8a1c1c}
.pp-auth{min-height:100vh;display:grid;place-items:center;padding:18px}
.pp-auth form{background:#fff;border:1px solid #e4e2dc;width:min(400px,100%);padding:26px;display:flex;flex-direction:column;gap:12px}
.pp-auth h1{font-size:26px}
.pp-auth p{color:#666;font-size:14px;line-height:1.5}
.pp-auth label{display:flex;flex-direction:column;gap:5px;font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#555}
.pp-head{display:flex;align-items:center;gap:10px;margin-bottom:4px}
.pp-head img{height:40px;filter:invert(1)}
.pp-head b{font-weight:900;font-style:italic}
.pp-months{display:flex;align-items:flex-end;gap:8px;height:140px;margin-top:14px}
.pp-months div{flex:1;display:flex;flex-direction:column;align-items:center;gap:6px;height:100%;justify-content:flex-end}
.pp-months i{display:block;width:100%;max-width:46px;background:#111;min-height:2px}
.pp-months i.b{background:#f2c500}
.pp-months span{font-size:11px;color:#777;text-transform:capitalize}
.pp-months em{font-style:normal;font-size:11px;font-weight:700}
@media(max-width:820px){.pp-grid{grid-template-columns:1fr 1fr}.pp-two{grid-template-columns:1fr}.pp-form{grid-template-columns:1fr}}
@media(max-width:480px){.pp-grid{grid-template-columns:1fr}.pp-tb{font-size:12.5px}}
`;
