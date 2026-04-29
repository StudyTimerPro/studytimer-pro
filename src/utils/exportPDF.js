import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

// ── Helpers ──────────────────────────────────────────────────
function toHHMMSS(mins) {
  const m = mins || 0;
  const h = Math.floor(m / 60), mm = m % 60;
  return `${String(h).padStart(2,"0")}:${String(mm).padStart(2,"0")}:00`;
}
function fmt12(t) {
  if (!t) return "—";
  let [h, m] = t.split(":").map(Number);
  const ap = h >= 12 ? "PM" : "AM"; h = h % 12 || 12;
  return `${h}:${String(m).padStart(2,"0")} ${ap}`;
}
function dur(start, end) {
  if (!start || !end) return 0;
  const [sh,sm] = start.split(":").map(Number);
  const [eh,em] = end.split(":").map(Number);
  return (eh*60+em) - (sh*60+sm);
}
function hex2rgb(hex) {
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  return [r, g, b];
}

// ── Canvas: grouped bar chart ────────────────────────────────
function drawBarChart(labels, datasets, title, w=560, h=230) {
  const c = document.createElement("canvas"); c.width=w; c.height=h;
  const x = c.getContext("2d");
  x.fillStyle="#fff"; x.fillRect(0,0,w,h);
  x.fillStyle="#1a1814"; x.font="bold 13px Arial"; x.fillText(title,14,18);

  const ml=52, mr=16, mt=30, mb=44;
  const cw=w-ml-mr, ch=h-mt-mb;

  const allVals = datasets.flatMap(d=>d.data);
  const maxV    = Math.max(...allVals, 0.1);
  const grpW    = cw / Math.max(labels.length,1);
  const bW      = (grpW*0.65) / Math.max(datasets.length,1);

  // Gridlines + Y labels
  x.strokeStyle="#e0ddd8"; x.lineWidth=0.8;
  for (let i=0;i<=4;i++) {
    const py = mt + ch*(1-i/4);
    x.beginPath(); x.moveTo(ml,py); x.lineTo(ml+cw,py); x.stroke();
    x.fillStyle="#999"; x.font="10px Arial";
    x.fillText((maxV*i/4).toFixed(1)+"h", ml-44, py+4);
  }

  // Bars
  datasets.forEach((ds,di)=>{
    x.fillStyle = ds.color;
    labels.forEach((_,i)=>{
      const v   = ds.data[i]||0;
      const bH  = (v/maxV)*ch;
      const bx  = ml + i*grpW + grpW*0.175 + di*(bW+2);
      const by  = mt + ch - bH;
      x.fillRect(bx, by, bW, bH);
    });
  });

  // X labels (truncated)
  x.fillStyle="#555"; x.font="10px Arial"; x.textAlign="center";
  labels.forEach((lbl,i)=>{
    x.fillText(lbl.length>8?lbl.slice(0,8)+"…":lbl, ml+i*grpW+grpW/2, mt+ch+14);
  });

  // Legend
  x.textAlign="left";
  datasets.forEach((ds,i)=>{
    const lx=ml+i*120; const ly=h-10;
    x.fillStyle=ds.color; x.fillRect(lx,ly-9,11,11);
    x.fillStyle="#444"; x.font="10px Arial"; x.fillText(ds.label,lx+14,ly);
  });

  return c.toDataURL("image/png");
}

// ── Canvas: horizontal progress bars ────────────────────────
function drawProgressChart(items, title, w=560, h=170) {
  const c = document.createElement("canvas"); c.width=w; c.height=h;
  const x = c.getContext("2d");
  x.fillStyle="#fff"; x.fillRect(0,0,w,h);
  x.fillStyle="#1a1814"; x.font="bold 13px Arial"; x.fillText(title,14,18);

  const left=130, barH=24, startY=34, gap=46;
  items.forEach(({label,value,total,color},i)=>{
    const y   = startY + i*gap;
    const pct = total>0 ? Math.min(value/total,1) : 0;
    const bW  = w-left-80;

    x.fillStyle="#555"; x.font="11px Arial";
    x.fillText(label, 8, y+barH/2+4);

    // Track
    x.fillStyle="#f0ede8";
    x.beginPath(); x.roundRect(left,y,bW,barH,5); x.fill();

    // Fill
    if (pct>0.01) {
      x.fillStyle=color;
      x.beginPath(); x.roundRect(left,y,bW*pct,barH,5); x.fill();
    }

    // Percent
    x.fillStyle="#333"; x.font="bold 11px Arial";
    x.fillText(`${(pct*100).toFixed(0)}%  (${value.toFixed(1)}h / ${total.toFixed(1)}h)`, left+bW+8, y+barH/2+4);
  });
  return c.toDataURL("image/png");
}

// ── Main export ──────────────────────────────────────────────
export function exportPDF(user, exportSessions, wastageHistory) {
  const doc   = new jsPDF({ orientation:"portrait", unit:"mm", format:"a4" });
  const today = new Date().toISOString().split("T")[0];
  const W     = 210;

  // ── PAGE 1 ─────────────────────────────────────────────────
  doc.setFillColor(26,24,20); doc.rect(0,0,W,28,"F");
  doc.setTextColor(255,255,255);
  doc.setFontSize(16); doc.setFont("helvetica","bold");
  doc.text("Lighthouse Prep — Study Report", 14, 12);
  doc.setFontSize(9); doc.setFont("helvetica","normal");
  doc.text(`User: ${user?.displayName||"—"}  |  ${user?.email||"—"}  |  ${today}`, 14, 22);

  // Table 1 — Today's Wastage
  doc.setTextColor(26,24,20); doc.setFontSize(12); doc.setFont("helvetica","bold");
  doc.text("Today's Wastage", 14, 37);

  const t1rows = (exportSessions||[]).filter(s=>s.missed).map(s=>[
    s.name + (s.subject ? ` (${s.subject})` : ""),
    fmt12(s.start), "MISSED", toHHMMSS(dur(s.start,s.end)), "YES",
  ]);
  if (t1rows.length===0) t1rows.push(["No missed sessions today","","","",""]);

  autoTable(doc, {
    startY: 41,
    head: [["Session","Scheduled Start","Actual Start","Wastage","Missed"]],
    body: t1rows,
    styles:           { fontSize:8, cellPadding:3 },
    headStyles:       { fillColor:[26,24,20], textColor:255, fontStyle:"bold" },
    alternateRowStyles:{ fillColor:[248,246,242] },
    columnStyles:     { 3:{textColor:[230,57,70]}, 4:{textColor:[230,57,70],fontStyle:"bold"} },
    margin: { left:14, right:14 },
  });

  // Table 2 — All-Time last 30 days
  const allDates = Object.keys(wastageHistory||{}).sort((a,b)=>b.localeCompare(a)).slice(0,30);
  const seen=new Set(), sNames=[];
  allDates.forEach(d=> Object.values(wastageHistory[d]||{}).forEach(s=>{
    const k=s.subject||s.sessionName||""; if(k&&!seen.has(k)){seen.add(k);sNames.push(k);}
  }));
  const cols = sNames.slice(0,5); // cap at 5 to avoid overflow

  const t2rows = allDates.map(date=>{
    const sess    = Object.values(wastageHistory[date]||{});
    const missed  = sess.filter(s=>s.missed).length;
    const total   = sess.filter(s=>s.missed).reduce((a,s)=>a+(s.duration||0),0);
    const cells   = cols.map(name=>{
      const s = sess.find(x=>(x.subject||x.sessionName)===name);
      return s ? (s.missed ? toHHMMSS(s.duration) : "✓") : "—";
    });
    return [date, ...cells, String(missed), toHHMMSS(total)];
  });
  if (t2rows.length===0) t2rows.push(["No history yet",...cols.map(()=>""),"",""]);

  const y1 = (doc.lastAutoTable?.finalY||80) + 8;
  doc.setFontSize(12); doc.setFont("helvetica","bold"); doc.setTextColor(26,24,20);
  doc.text("All-Time Wastage By Date (Last 30 Days)", 14, y1);

  autoTable(doc, {
    startY: y1+4,
    head: [["Date",...cols,"Missed","Total"]],
    body: t2rows,
    styles:            { fontSize:7, cellPadding:2 },
    headStyles:        { fillColor:[26,24,20], textColor:255, fontStyle:"bold" },
    alternateRowStyles:{ fillColor:[248,246,242] },
    margin: { left:14, right:14 },
  });

  // ── PAGE 2 ─────────────────────────────────────────────────
  doc.addPage();
  doc.setFillColor(26,24,20); doc.rect(0,0,W,18,"F");
  doc.setTextColor(255,255,255); doc.setFontSize(11); doc.setFont("helvetica","bold");
  doc.text("Lighthouse Prep — Charts & Progress", 14, 12);

  const sessions = exportSessions||[];

  // Chart 1: Session Breakdown
  const img1 = drawBarChart(
    sessions.map(s=>s.name),
    [
      { label:"Studied (h)",    data: sessions.map(s=>s.missed?0:dur(s.start,s.end)/60),  color:"#2d6a4f" },
      { label:"Not Studied (h)",data: sessions.map(s=>s.missed?dur(s.start,s.end)/60:0),  color:"#e63946" },
    ],
    "Session Breakdown — Studied vs Not Studied"
  );
  doc.addImage(img1,"PNG",14,22,182,58);

  // Chart 2: Studied hours per day last 7 days
  const last7=[]; for(let i=6;i>=0;i--){ const d=new Date(Date.now()-i*86400000); last7.push(d.toISOString().split("T")[0]); }
  const img2 = drawBarChart(
    last7.map(d=>d.slice(5)),
    [{ label:"Hours Studied", data: last7.map(date=>{
      const s=Object.values((wastageHistory||{})[date]||{});
      return s.filter(x=>!x.missed).reduce((a,x)=>a+(x.duration||0),0)/60;
    }), color:"#2563eb" }],
    "Studied Hours per Day — Last 7 Days"
  );
  doc.addImage(img2,"PNG",14,86,182,58);

  // Chart 3: Progress vs Goal
  const planned = sessions.reduce((a,s)=>a+dur(s.start,s.end),0)/60;
  const studied = sessions.filter(s=>!s.missed).reduce((a,s)=>a+dur(s.start,s.end),0)/60;
  const weekStudied = last7.reduce((acc,date)=>{
    return acc + Object.values((wastageHistory||{})[date]||{}).filter(s=>!s.missed).reduce((a,s)=>a+(s.duration||0),0)/60;
  },0);
  const img3 = drawProgressChart(
    [
      { label:"Today's Plan",   value:studied,     total:Math.max(planned,0.1),   color:"#2d6a4f" },
      { label:"This Week (7d)", value:weekStudied,  total:Math.max(planned*7,0.1), color:"#2563eb" },
    ],
    "Progress vs Goal"
  );
  doc.addImage(img3,"PNG",14,150,182,52);

  doc.setTextColor(160,160,160); doc.setFontSize(8); doc.setFont("helvetica","normal");
  doc.text(`Generated by Lighthouse Prep · ${new Date().toLocaleString()}`, 14, 286);

  doc.save(`LighthousePrep-Report-${today}.pdf`);
}
