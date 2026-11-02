import type { Metadata } from "next";

export const metadata: Metadata = { title: "Rasta Hale Parceiros", robots: { index: false } };

export default function ParceiroLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style>{CSS}</style>
      {children}
    </>
  );
}

// Mesmo visual do Hub; aqui só o que é próprio do portal
const CSS = `
.pt-lab{font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--ink3)}
.pt-g{color:var(--lagoon)}.pt-y{color:var(--sun)}
.pt-bar{height:10px;border-radius:99px;background:#1a1f1d;overflow:hidden}
.pt-bar i{display:block;height:100%;border-radius:99px;background:linear-gradient(90deg,#1f8f4a,var(--lagoon))}
.pt-bar.y i{background:linear-gradient(90deg,#b8901a,var(--sun))}
.pt-code{font-family:Elite,serif;font-size:30px;letter-spacing:.05em;color:#fff}
.pt-link{display:flex;gap:8px;align-items:center;margin-top:10px;background:var(--bg);border:1px solid var(--line);border-radius:12px;padding:6px 6px 6px 12px}
.pt-link code{flex:1;min-width:0;font-size:12.5px;color:var(--ink2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pt-more{display:inline-flex;align-items:center;gap:6px;margin-top:14px;font-size:13px;color:var(--lagoon)}
.pt-tip{border-left:3px solid var(--sun);background:var(--sun2);border-radius:0 12px 12px 0;padding:12px 14px;font-size:14px;line-height:1.55;color:#f3e7b8}
.pt-list{margin:14px 0 0 18px;display:flex;flex-direction:column;gap:6px;color:var(--ink2);font-size:13.5px}
.pt-form{display:grid;grid-template-columns:1fr 1.4fr auto;gap:12px;align-items:end}
.pt-pre{font-family:inherit;font-size:14px;background:var(--bg);border:1px solid var(--line);border-radius:12px;padding:12px 14px;white-space:pre-wrap;word-break:break-all;color:#fff;line-height:1.5}
.pt-bio{display:grid;grid-template-columns:330px 1fr;gap:28px;align-items:start}
.pt-ig{position:relative;border:1px solid var(--line);border-radius:16px;padding:18px;background:#000;font-family:-apple-system,system-ui,sans-serif;color:#f5f5f5}
.pt-ig-tag{position:absolute;top:10px;right:12px;font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:#666}
.pt-ig-top{display:flex;align-items:center;gap:18px}
.pt-ig-av{width:72px;height:72px;border-radius:50%;background:#111;color:var(--sun);display:grid;place-items:center;font-family:Elite,serif;font-size:30px;box-shadow:0 0 0 3px #000,0 0 0 5px var(--lagoon);flex:none}
.pt-ig-st{display:flex;gap:14px;text-align:center}.pt-ig-st b{display:block;font-size:15px}.pt-ig-st span{font-size:11.5px;color:#a8a8a8}
.pt-ig-name{font-weight:700;font-size:14px;margin-top:12px}.pt-ig-at{font-size:12.5px;color:#8a8a8a}
.pt-ig-bio{font-size:13.5px;line-height:1.45;margin-top:6px}.pt-ig-bio .at{color:#8ab4f8;font-weight:600}
.pt-ig-link{font-size:13px;color:#8ab4f8;font-weight:600;margin-top:2px;word-break:break-all}
.chip.pt-ok{background:var(--lagoon2);color:var(--lagoon)}.chip.pt-wait{background:var(--sun2);color:var(--sun)}.chip.pt-no{background:var(--coral2);color:var(--coral)}
.pt-auth .card{max-width:420px}
.pt-auth .alt{font-size:13px;text-align:center;color:var(--ink2)}.pt-auth .alt a{color:var(--lagoon)}
.pt-auth .pre{display:flex;align-items:center;background:var(--bg);border:1px solid #2a312e;border-radius:12px;padding-left:12px;color:var(--ink3)}
.pt-auth .pre{height:42px}.pt-auth .pre .in{border:0;background:none;box-shadow:none;padding-left:4px;height:40px;min-height:0}
.pt-warn{border-left:3px solid var(--coral);background:var(--coral2);border-radius:0 12px 12px 0;padding:12px 14px;font-size:13.5px;line-height:1.55;color:#f6c9c0}
.pt-search{display:flex;align-items:center;gap:8px;background:var(--bg);border:1px solid var(--line);border-radius:12px;padding-left:12px;color:var(--ink3)}
.pt-search .in{border:0;background:none;box-shadow:none;flex:1;height:42px;min-height:0;padding-left:2px}
.pt-plist{display:flex;flex-direction:column;gap:4px;max-height:360px;overflow:auto}
.pt-pitem{display:flex;align-items:center;gap:12px;width:100%;text-align:left;background:none;border:1px solid transparent;border-radius:12px;padding:6px 8px;color:inherit;cursor:pointer;font:inherit}
.pt-pitem:hover{background:var(--bg);border-color:var(--line)}
.pt-pitem img,.pt-pimg{width:42px;height:42px;border-radius:8px;object-fit:cover;background:#1a1f1d;flex:none}
.pt-pitem .t{flex:1;min-width:0;font-size:13.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.pt-pitem .v{font-size:12.5px;color:var(--ink3)}
.pt-prod{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.2fr);gap:28px;align-items:start}.pt-prod>*{min-width:0}
.pt-gen{border:1px solid var(--line);border-radius:14px;padding:14px;background:var(--bg)}
.pt-gimg{width:56px;height:56px;border-radius:10px;object-fit:cover;flex:none}
@media(max-width:900px){.pt-prod{grid-template-columns:minmax(0,1fr)}.pt-bio{grid-template-columns:1fr}.pt-form{grid-template-columns:1fr}}
`;
