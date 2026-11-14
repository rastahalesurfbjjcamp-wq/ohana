export default function EmbaixadorLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style>{CSS}</style>
      {children}
    </>
  );
}

const CSS = `
.em{min-height:100vh;background:radial-gradient(900px 480px at 50% -8%,rgba(52,194,106,.12),transparent),var(--bg);padding:0 20px 40px}
.em>*{max-width:1040px;margin-left:auto;margin-right:auto}
.em-top{display:flex;align-items:center;justify-content:space-between;padding:20px 0}
.em-brand{display:flex;align-items:center;gap:10px}.em-brand img{width:34px;height:34px;object-fit:contain}.em-brand b{font-family:Elite,serif;font-weight:400;font-size:20px;color:#fff}
.em-hero{text-align:center;padding:56px 0 40px;max-width:720px}
.em-kicker{font-size:11.5px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:var(--lagoon)}
.em-hero h1{font-family:Brico,system-ui;font-weight:700;font-size:44px;line-height:1.08;letter-spacing:-.02em;margin:14px 0 16px;color:#fff}
.em-hero p{font-size:16.5px;line-height:1.6;color:var(--ink2);max-width:600px;margin:0 auto}
.em-cta{margin-top:26px;height:46px;padding:0 22px;font-size:15px}
.em-steps{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:56px}
.em-step{background:var(--sf);border:1px solid var(--line);border-radius:16px;padding:20px;display:flex;flex-direction:column;gap:8px;color:var(--lagoon)}
.em-step b{color:#fff;font-size:15px}.em-step span{color:var(--ink2);font-size:13.5px;line-height:1.55}
.em-sec{margin-bottom:56px}
.em-sec h2{font-family:Brico,system-ui;font-weight:700;font-size:26px;color:#fff;letter-spacing:-.01em}
.em-lede{color:var(--ink2);font-size:14.5px;margin:8px 0 20px;line-height:1.55}
.em-levels{display:grid;grid-template-columns:repeat(5,1fr);gap:12px}
.em-lv{background:var(--sf);border:1px solid var(--line);border-radius:16px;padding:18px;display:flex;flex-direction:column;gap:10px}
.em-lv-h{display:flex;align-items:center;gap:8px;color:#fff;font-size:15px}.em-lv-h i{width:12px;height:12px;border-radius:50%;background:var(--c)}
.em-lv-v{font-family:Brico,system-ui;font-weight:700;font-size:30px;color:#fff}.em-lv-v small{font-family:Geist,system-ui;font-weight:400;font-size:12.5px;color:var(--ink2)}
.em-lv-r{font-size:12.5px;color:var(--ink2);line-height:1.5}
.em-lv.soon{opacity:.55}.em-lv.soon .em-lv-v{font-size:18px;color:var(--ink2)}
.lv-bronze{--c:#c47a3d}.lv-prata{--c:#c9d1d6}.lv-ouro{--c:#f2c200}.lv-diamante{--c:#7dd3fc}.lv-esmeralda{--c:#34d399}.lv-premium{--c:#7dd3fc}.lv-team{--c:#f97316}
.lv-bronze{border-top:3px solid var(--c)}.lv-prata{border-top:3px solid var(--c)}.lv-ouro{border-top:3px solid var(--c)}.lv-diamante{border-top:3px solid var(--c)}.lv-esmeralda{border-top:3px solid var(--c)}.lv-premium{border-top:3px solid var(--c)}.lv-team{border-top:3px solid var(--c)}
.em-lv-p{font-size:13px;color:#fff;line-height:1.45}.em-lv.inv{background:linear-gradient(160deg,#1a1410,var(--sf))}.em-lv.inv .em-lv-v{font-size:18px;color:var(--c)}
.em-rules{list-style:none;display:flex;flex-direction:column;gap:10px;margin-top:16px}
.em-rules li{display:flex;gap:10px;align-items:flex-start;color:#d5dbd8;font-size:14.5px;line-height:1.5}.em-rules svg{color:var(--lagoon);margin-top:3px;flex:none}
.em-form,.em-done{max-width:480px;margin:0 auto;padding:26px 24px;display:flex;flex-direction:column;gap:12px;border:1px solid var(--line);border-radius:18px;background:rgba(255,255,255,.015)}
.em-fh{margin-bottom:4px}.em-fh h2{font-size:22px}.em-fh span{display:block;color:var(--ink2);font-size:13px;margin-top:4px}
.em-form .field{gap:5px}.em-form .field>label{font-size:12px;color:var(--ink2)}
.em-form .in{height:40px;background:#0c0f0e;border-color:#1f2522}
.em-send{justify-content:center;height:44px;margin-top:4px}
.em-done p{color:var(--ink2);line-height:1.6}
.em-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.em-pre{display:flex;align-items:center;background:var(--bg);border:1px solid var(--line);border-radius:10px;padding-left:12px;color:var(--ink3)}
.em-pre{height:40px;background:#0c0f0e!important;border-color:#1f2522!important}.em-pre .in{border:0;background:none;box-shadow:none;padding-left:3px;height:40px;min-height:0}
.em-igok{display:flex;gap:8px;align-items:center;margin-top:2px}
.em-igok a,.em-chk{display:inline-flex;align-items:center;gap:5px;font-size:12px;height:26px;padding:0 10px;border-radius:99px;border:1px solid var(--line);color:var(--ink2);cursor:pointer}
.em-igok a:hover{color:#fff}
.em-chk input{width:13px;height:13px;accent-color:var(--lagoon);margin:0}
.em-chk:has(input:checked){border-color:rgba(52,194,106,.5);color:var(--lagoon);background:var(--lagoon2)}
.em-yn{display:flex;gap:6px;height:40px;align-items:center}.em-yn label{flex:1;height:40px;display:inline-flex;gap:6px;align-items:center;justify-content:center;border:1px solid #1f2522;border-radius:10px;background:#0c0f0e;color:var(--ink2);font-size:13.5px;cursor:pointer}.em-yn input{position:absolute;opacity:0;pointer-events:none}.em-yn label:has(input:checked){border-color:rgba(52,194,106,.55);color:#fff;background:var(--lagoon2)}
.em-foot{text-align:center;color:var(--ink3);font-size:12.5px;padding-top:10px}
@media(max-width:900px){.em-levels{grid-template-columns:1fr 1fr}.em-steps{grid-template-columns:1fr}.em-hero h1{font-size:32px}.em-hero{padding:30px 0}}
@media(max-width:560px){.em-grid{grid-template-columns:1fr}.em-levels{grid-template-columns:1fr}}
`;
