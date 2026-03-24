// BookMoa Printable - (주)북모아 디지털 인쇄 견적/주문 시스템
import { useState, useEffect, useMemo, useCallback, createContext, useContext } from "react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import * as XLSX from 'xlsx';
import { supabase } from './lib/supabase';

// ═══════════════════════════════════════════════════
// DESIGN TOKENS (BookMoa-inspired Green Theme)
// ═══════════════════════════════════════════════════
const T={
  bg:"#FFFFFF",warm:"#F7F7F5",dark:"#1C2912",card:"#FFFFFF",
  text:"#222222",sub:"#666666",muted:"#888888",light:"#E0E0E0",
  accent:"#7CB342",accentHover:"#689F38",accentBg:"#F1F8E8",accentBorder:"#C5E1A5",accentGold:"#7CB342",
  border:"#EEEEEE",borderLight:"#F5F5F5",
  serif:"'Noto Sans KR',-apple-system,sans-serif",
  sans:"'Noto Sans KR',-apple-system,sans-serif",
  r:12,rSm:8,
  sh:"0 1px 4px rgba(0,0,0,.05)",shLg:"0 4px 20px rgba(0,0,0,.08)",
};
const globalCSS=`
@keyframes fadeUp{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
.fade-up{animation:fadeUp .7s cubic-bezier(.16,1,.3,1) both}
.fade-up-d1{animation-delay:.12s}.fade-up-d2{animation-delay:.24s}.fade-up-d3{animation-delay:.36s}
.fade-in{animation:fadeIn .5s ease both}
@media print{.no-print{display:none!important}}
@media(prefers-reduced-motion:reduce){.fade-up,.fade-in{animation:none!important}}
::-webkit-scrollbar{width:6px;height:6px}::-webkit-scrollbar-thumb{background:#ccc;border-radius:3px}::-webkit-scrollbar-track{background:transparent}
`;

// ═══════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════
const fmt = n => { if (n==null||isNaN(n)) return "0"; return Math.round(n).toLocaleString("ko-KR"); };
const cn = (...c) => c.filter(Boolean).join(" ");
const uid = () => Date.now().toString(36)+Math.random().toString(36).slice(2,6);
const clamp = (v,lo,hi) => Math.max(lo,Math.min(hi,v));
const now = () => new Date().toISOString();
const dateStr = d => (d||"").slice(0,10);

// ═══════════════════════════════════════════════════
// PRICING DATA (Excel transplant - complete)
// ═══════════════════════════════════════════════════
const DEF_PRICING = {
  formatMap:{ B6:{innerSize:"국8절",coverSize:"국4절",desc:"128×182mm"}, A5:{innerSize:"국8절",coverSize:"국4절",desc:"148×210mm"}, B5:{innerSize:"국8절",coverSize:"국4절",desc:"182×257mm"}, A4:{innerSize:"국8절",coverSize:"국4절",desc:"210×297mm"} },
  printTypes:["IX-Eco","IX-Sta","IX-Pre","FX-4도","FX-2도","FX-1도","TO-4도","TO-1도"],
  printTable:[
    {c:0,v:[200,200,300,null,null,null,200,50]},{c:500,v:[150,150,250,null,null,null,150,30]},{c:1000,v:[100,100,150,null,null,null,100,25]},
    {c:2000,v:[50,50,100,50,30,17,70,20]},{c:3000,v:[45,50,90,45,27,16,45,19]},{c:5000,v:[40,45,80,40,24,15,40,18]},
    {c:8000,v:[35,40,70,35,21,14,40,17]},{c:10000,v:[30,35,60,30,18,13,40,16]},{c:20000,v:[25,30,50,25,15,12,40,15]},
    {c:30000,v:[20,25,40,20,12,11,40,14]},{c:50000,v:[15,20,30,15,9,10,40,13]},{c:80000,v:[15,20,25,15,9,9,40,12]},{c:100000,v:[15,20,25,15,9,9,40,11]}
  ],
  sideRate:{단면:12.4,양면:6.2}, coverPrintRate:{단면:200,양면:400},
  paperSizes:["46판","3절","8절","16절","32절","국판","국4절","국8절","국16절"],
  innerPapers:{
    "모조80":{"46판":71400,"3절":47.6,"8절":17.85,"16절":8.925,"32절":6.2,"국판":49600,"국4절":24.8,"국8절":12.4,"국16절":6.2},
    "모조100":{"46판":88470,"3절":58.98,"8절":22.118,"16절":11.059,"32절":7.683,"국판":61460,"국4절":30.73,"국8절":15.365,"국16절":7.683},
    "모조120":{"46판":106160,"3절":70.773,"8절":26.54,"16절":13.27,"32절":9.219,"국판":73750,"국4절":36.875,"국8절":18.438,"국16절":9.219},
    "모조150":{"46판":132700,"3절":88.467,"8절":33.175,"16절":16.588,"32절":11.523,"국판":92180,"국4절":46.09,"국8절":23.045,"국16절":11.523},
    "모조180":{"46판":159240,"3절":106.16,"8절":39.81,"16절":19.905,"32절":13.828,"국판":110620,"국4절":55.31,"국8절":27.655,"국16절":13.828},
    "모조220":{"46판":203370,"3절":135.58,"8절":50.843,"16절":25.421,"32절":17.659,"국판":141270,"국4절":70.635,"국8절":35.318,"국16절":17.659},
    "모조260":{"46판":240340,"3절":160.227,"8절":60.085,"16절":30.043,"32절":20.87,"국판":166960,"국4절":83.48,"국8절":41.74,"국16절":20.87},
    "미색모조80":{"46판":73540,"3절":49.027,"8절":18.385,"16절":9.193,"32절":6.386,"국판":51090,"국4절":25.545,"국8절":12.773,"국16절":6.386},
    "미색모조100":{"46판":91130,"3절":60.753,"8절":22.783,"16절":11.391,"32절":7.913,"국판":63300,"국4절":31.65,"국8절":15.825,"국16절":7.913},
    "뉴플러스(백색)80":{"46판":73550,"3절":49.033,"8절":18.388,"16절":9.194,"32절":6.386,"국판":51090,"국4절":25.545,"국8절":12.773,"국16절":6.386},
    "뉴플러스(백색)100":{"46판":91140,"3절":60.76,"8절":22.785,"16절":11.393,"32절":7.913,"국판":63300,"국4절":31.65,"국8절":15.825,"국16절":7.913},
    "뉴플러스(미색)80":{"46판":75760,"3절":50.507,"8절":18.94,"16절":9.47,"32절":6.578,"국판":52620,"국4절":26.31,"국8절":13.155,"국16절":6.578},
    "뉴플러스(미색)100":{"46판":93870,"3절":62.58,"8절":23.468,"16절":11.734,"32절":8.15,"국판":65200,"국4절":32.6,"국8절":16.3,"국16절":8.15},
    "아트지80":{"46판":87140,"3절":58.093,"8절":21.785,"16절":10.893,"32절":7.566,"국판":60530,"국4절":30.265,"국8절":15.133,"국16절":7.566},
    "아트지100":{"46판":88000,"3절":58.667,"8절":22,"16절":11,"32절":7.641,"국판":61130,"국4절":30.565,"국8절":15.283,"국16절":7.641},
    "아트지120":{"46판":105590,"3절":70.393,"8절":26.398,"16절":13.199,"32절":9.169,"국판":73350,"국4절":36.675,"국8절":18.338,"국16절":9.169},
    "아트지150":{"46판":134290,"3절":89.527,"8절":33.573,"16절":16.786,"32절":11.66,"국판":93280,"국4절":46.64,"국8절":23.32,"국16절":11.66},
    "아트지180":{"46판":161150,"3절":107.433,"8절":40.288,"16절":20.144,"32절":13.993,"국판":111940,"국4절":55.97,"국8절":27.985,"국16절":13.993},
    "아트지200":{"46판":179050,"3절":119.367,"8절":44.763,"16절":22.381,"32절":15.548,"국판":124380,"국4절":62.19,"국8절":31.095,"국16절":15.548},
    "아트지250":{"46판":223810,"3절":149.207,"8절":55.953,"16절":27.976,"32절":19.434,"국판":155470,"국4절":77.735,"국8절":38.868,"국16절":19.434},
    "아트지300":{"46판":268580,"3절":179.053,"8절":67.145,"16절":33.573,"32절":23.321,"국판":186570,"국4절":93.285,"국8절":46.643,"국16절":23.321},
    "스노우지80":{"46판":87140,"3절":58.093,"8절":21.785,"16절":10.893,"32절":7.566,"국판":60530,"국4절":30.265,"국8절":15.133,"국16절":7.566},
    "스노우지100":{"46판":88000,"3절":58.667,"8절":22,"16절":11,"32절":7.641,"국판":61130,"국4절":30.565,"국8절":15.283,"국16절":7.641},
    "스노우지120":{"46판":105590,"3절":70.393,"8절":26.398,"16절":13.199,"32절":9.169,"국판":73350,"국4절":36.675,"국8절":18.338,"국16절":9.169},
    "스노우지150":{"46판":134290,"3절":89.527,"8절":33.573,"16절":16.786,"32절":11.66,"국판":93280,"국4절":46.64,"국8절":23.32,"국16절":11.66},
    "스노우지180":{"46판":161150,"3절":107.433,"8절":40.288,"16절":20.144,"32절":13.993,"국판":111940,"국4절":55.97,"국8절":27.985,"국16절":13.993},
    "스노우지200":{"46판":179050,"3절":119.367,"8절":44.763,"16절":22.381,"32절":15.548,"국판":124380,"국4절":62.19,"국8절":31.095,"국16절":15.548},
    "스노우지250":{"46판":223810,"3절":149.207,"8절":55.953,"16절":27.976,"32절":19.434,"국판":155470,"국4절":77.735,"국8절":38.868,"국16절":19.434},
    "스노우지300":{"46판":268580,"3절":179.053,"8절":67.145,"16절":33.573,"32절":23.321,"국판":186570,"국4절":93.285,"국8절":46.643,"국16절":23.321},
    "아르떼(UW)90":{"46판":142170,"3절":94.78,"8절":35.543,"16절":17.771,"32절":12.345,"국판":98760,"국4절":49.38,"국8절":24.69,"국16절":12.345},
    "아르떼(UW)105":{"46판":165870,"3절":110.58,"8절":41.468,"16절":20.734,"32절":14.404,"국판":115230,"국4절":57.615,"국8절":28.808,"국16절":14.404},
    "아르떼(UW)130":{"46판":205360,"3절":136.907,"8절":51.34,"16절":25.67,"32절":17.831,"국판":142650,"국4절":71.325,"국8절":35.663,"국16절":17.831},
    "아르떼(UW)160":{"46판":252760,"3절":168.507,"8절":63.19,"16절":31.595,"32절":21.948,"국판":175580,"국4절":87.79,"국8절":43.895,"국16절":21.948},
    "아르떼(UW)190":{"46판":300140,"3절":200.093,"8절":75.035,"16절":37.518,"32절":26.063,"국판":208500,"국4절":104.25,"국8절":52.125,"국16절":26.063},
    "아르떼(UW)210":{"46판":331740,"3절":221.16,"8절":82.935,"16절":41.468,"32절":28.805,"국판":230440,"국4절":115.22,"국8절":57.61,"국16절":28.805},
    "아르떼(UW)230":{"46판":363330,"3절":242.22,"8절":90.833,"16절":45.416,"32절":31.549,"국판":252390,"국4절":126.195,"국8절":63.098,"국16절":31.549},
    "아르떼(UW)310":{"46판":489710,"3절":326.473,"8절":122.428,"16절":61.214,"32절":42.523,"국판":340180,"국4절":170.09,"국8절":85.045,"국16절":42.523},
    "아르떼(NW)90":{"46판":142170,"3절":94.78,"8절":35.543,"16절":17.771,"32절":12.345,"국판":98760,"국4절":49.38,"국8절":24.69,"국16절":12.345},
    "아르떼(NW)105":{"46판":165870,"3절":110.58,"8절":41.468,"16절":20.734,"32절":14.404,"국판":115230,"국4절":57.615,"국8절":28.808,"국16절":14.404},
    "아르떼(NW)130":{"46판":205360,"3절":136.907,"8절":51.34,"16절":25.67,"32절":17.831,"국판":142650,"국4절":71.325,"국8절":35.663,"국16절":17.831},
    "아르떼(NW)160":{"46판":252760,"3절":168.507,"8절":63.19,"16절":31.595,"32절":21.948,"국판":175580,"국4절":87.79,"국8절":43.895,"국16절":21.948},
    "아르떼(NW)190":{"46판":300140,"3절":200.093,"8절":75.035,"16절":37.518,"32절":26.063,"국판":208500,"국4절":104.25,"국8절":52.125,"국16절":26.063},
    "아르떼(NW)210":{"46판":331740,"3절":221.16,"8절":82.935,"16절":41.468,"32절":28.805,"국판":230440,"국4절":115.22,"국8절":57.61,"국16절":28.805},
    "아르떼(NW)230":{"46판":363330,"3절":242.22,"8절":90.833,"16절":45.416,"32절":31.549,"국판":252390,"국4절":126.195,"국8절":63.098,"국16절":31.549},
    "아르떼(NW)310":{"46판":489710,"3절":326.473,"8절":122.428,"16절":61.214,"32절":42.523,"국판":340180,"국4절":170.09,"국8절":85.045,"국16절":42.523}
  },
  coverPapers:{ 아트지250:{국4절:77.735,"3절":149.207}, 아트지300:{국4절:93.285,"3절":179.053}, 스노우지250:{국4절:77.735,"3절":149.207}, 스노우지300:{국4절:93.285,"3절":179.053}, "아르떼(UW)190":{국4절:104.25,"3절":200.093}, "아르떼(UW)210":{국4절:115.22,"3절":221.16}, "아르떼(UW)230":{국4절:126.195,"3절":242.22}, "아르떼(UW)310":{국4절:170.09,"3절":326.473}, "아르떼(NW)190":{국4절:104.25,"3절":200.093}, "아르떼(NW)210":{국4절:115.22,"3절":221.16}, "아르떼(NW)230":{국4절:126.195,"3절":242.22}, "아르떼(NW)310":{국4절:170.09,"3절":326.473} },
  coatingTable:{ B6:{없음:0,유광코팅:150,무광코팅:250}, A5:{없음:0,유광코팅:150,무광코팅:250}, B5:{없음:0,유광코팅:150,무광코팅:250}, A4:{없음:0,유광코팅:150,무광코팅:250} },
  bindingTypes:["무선","무선날개","중철","스프링(PP제외)","스프링(PP포함)","양장"],
  bindingTable:[
    {q:0,v:[3000,3600,1000,3000,3300,6000]},{q:12,v:[1800,2400,800,1800,2100,6000]},{q:32,v:[1500,2100,800,1500,1800,6000]},
    {q:52,v:[1200,1800,600,1200,1500,6000]},{q:82,v:[800,1400,500,800,1100,6000]},{q:122,v:[750,1350,500,750,1050,6000]},
    {q:152,v:[750,1350,400,750,1050,6000]},{q:201,v:[700,1300,400,700,1000,6000]},{q:252,v:[700,1300,320,700,1000,6000]},
    {q:301,v:[650,1250,320,650,950,6000]},{q:501,v:[600,1200,270,600,900,6000]},{q:952,v:[600,1200,200,600,900,6000]}
  ],
  endpapers:{ 없음:{B6:0,A5:0,B5:0,A4:0}, "A.연보라":{B6:114.37,A5:114.37,B5:228.74,A4:228.74}, "A.라벤더":{B6:114.37,A5:114.37,B5:228.74,A4:228.74}, "A.크림":{B6:114.37,A5:114.37,B5:228.74,A4:228.74}, "B.황매화":{B6:122.97,A5:122.97,B5:245.94,A4:245.94}, "D.연군청":{B6:151.56,A5:151.56,B5:303.13,A4:303.13} },
  postProc:{재단:500,접지:300,귀돌이:400,금박:2000,은박:2000}
};

// ═══════════════════════════════════════════════════
// PRICING ENGINE v2
// ═══════════════════════════════════════════════════
function lookupLE(val,rows,key){let r=rows[0];for(const row of rows){if(row[key]<=val)r=row;else break;}return r;}

function calcQuote(cfg,pricing=DEF_PRICING){
  const p=pricing;const{format,pages,quantity,printType,innerPaper,innerSide,coverPaper,coverSide,coating,binding,endpaper,postProcessing=[]}=cfg;const lines=[];
  const ptIdx=p.printTypes.indexOf(printType);const pRow=lookupLE(pages,p.printTable,"c");const pu=ptIdx>=0?(pRow.v[ptIdx]??0):0;
  lines.push({key:"print",label:"인쇄비",unit:pu,qty:pages,total:pu*pages,desc:printType+" × "+pages+"p"});
  const sr=p.sideRate[innerSide]??6.2;lines.push({key:"inner",label:"내지("+innerPaper+")",unit:sr,qty:pages,total:sr*pages,desc:innerSide+" "+sr+"원/p"});
  const ep=p.endpapers[endpaper]?.[format]??0;lines.push({key:"endpaper",label:"면지",unit:ep,qty:1,total:ep,desc:endpaper});
  const cs=p.formatMap[format]?.coverSize??"국4절";const cu=p.coverPapers[coverPaper]?.[cs]??0;lines.push({key:"cover",label:"표지("+coverPaper+")",unit:cu,qty:1,total:cu,desc:cs});
  const cp=p.coverPrintRate[coverSide]??200;lines.push({key:"coverPrint",label:"표지인쇄",unit:cp,qty:1,total:cp,desc:coverSide});
  const co=p.coatingTable[format]?.[coating]??0;lines.push({key:"coating",label:"코팅",unit:co,qty:1,total:co,desc:coating});
  const bIdx=p.bindingTypes.indexOf(binding);const bRow=lookupLE(quantity,p.bindingTable,"q");const bc=bIdx>=0?(bRow.v[bIdx]??0):0;lines.push({key:"binding",label:"제본",unit:bc,qty:1,total:bc,desc:binding});
  let pp=0;postProcessing.forEach(x=>{pp+=(p.postProc[x]??0);});if(pp>0)lines.push({key:"pp",label:"후가공",unit:pp,qty:1,total:pp,desc:postProcessing.join(",")});
  const up=lines.reduce((s,l)=>s+l.total,0);const sub=Math.round(up)*quantity;const vat=Math.round(sub*0.1);
  return{unitPrice:Math.round(up),subtotal:sub,vat,total:sub+vat,lines,quantity};
}

function calcCustomQuote(prod,selections,quantity){
  if(!prod)return{unitPrice:0,subtotal:0,vat:0,total:0,lines:[],quantity:0};
  const lines=[];
  // Base price from qty tier
  let base=0;const tiers=[...(prod.qtyTiers||[])].sort((a,b)=>a.minQty-b.minQty);
  for(const t of tiers){if(quantity>=t.minQty)base=t.basePrice;}
  lines.push({key:"base",label:"기본가",unit:base,qty:1,total:base,desc:quantity+"부 구간"});
  // Option adjustments
  (prod.optGroups||[]).forEach(g=>{
    const sel=selections[g.id];if(!sel)return;
    const ch=g.choices.find(c=>c.id===sel);if(!ch)return;
    const adj=ch.priceAdj||0;
    lines.push({key:"opt_"+g.id,label:g.name+": "+ch.label,unit:adj,qty:1,total:adj,desc:adj===0?"포함":adj>0?"+₩"+fmt(adj):"-₩"+fmt(Math.abs(adj))});
  });
  const up=Math.max(0,lines.reduce((s,l)=>s+l.total,0));const sub=Math.round(up)*quantity;const vat=Math.round(sub*0.1);
  return{unitPrice:Math.round(up),subtotal:sub,vat,total:sub+vat,lines,quantity};
}

// Paper price formula: 46판/국판은 기준가(입력), 나머지는 자동 계산
// 3절=46판÷1500, 8절=46판÷4000, 16절=46판÷8000
// 국4절=국판÷2000, 국8절=국판÷4000, 국16절=국판÷8000, 32절=국16절
function recalcPaper(paper){
  const p46=paper["46판"]||0,guk=paper["국판"]||0;
  return{...paper,"46판":p46,"3절":p46/1500,"8절":p46/4000,"16절":p46/8000,"32절":guk/8000,"국판":guk,"국4절":guk/2000,"국8절":guk/4000,"국16절":guk/8000};
}
const PAPER_BASE=new Set(["46판","국판"]); // 기준가 컬럼 (직접입력)

// ═══════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════
const FORMATS=["B6","A5","B5","A4"],PTYPES=DEF_PRICING.printTypes,IPAPERS=Object.keys(DEF_PRICING.innerPapers),CPAPERS=Object.keys(DEF_PRICING.coverPapers),COATS=["없음","유광코팅","무광코팅"],BINDS=DEF_PRICING.bindingTypes,ENDPS=Object.keys(DEF_PRICING.endpapers),SIDES=["단면","양면"],PPS=Object.keys(DEF_PRICING.postProc),PSIZES=DEF_PRICING.paperSizes;
// 내지 종이: 종류 → 평량 맵 ("아트지" → ["80","100","120",...])
const PAPER_TYPE_MAP=IPAPERS.reduce((acc,p)=>{const m=p.match(/^(.*?)(\d+)$/);if(m){const[,t,w]=m;if(!acc[t])acc[t]=[];acc[t].push(w);}return acc;},{});
const PAPER_TYPES=Object.keys(PAPER_TYPE_MAP);
const CATS=[
  {id:"photobook",name:"포토북",icon:"📖",illustId:"photobook",desc:"소중한 순간을 담은 프리미엄 포토북. 고급 용지와 정교한 인쇄로 특별한 앨범을 만들어 드립니다.",bg:"linear-gradient(135deg,#E8F5E9 0%,#C8E6C9 50%,#A5D6A7 100%)"},
  {id:"catalog",name:"카탈로그",icon:"📋",illustId:"catalog",desc:"제품의 가치를 높이는 고급 카탈로그. 전문 인쇄 기술로 브랜드의 격을 표현합니다.",bg:"linear-gradient(135deg,#FFF8E1 0%,#FFECB3 50%,#FFE082 100%)"},
  {id:"brochure",name:"브로슈어",icon:"📄",illustId:"brochure",desc:"효과적인 마케팅을 위한 브로슈어. 접이식부터 리플렛까지 다양한 형태로 제작합니다.",bg:"linear-gradient(135deg,#E3F2FD 0%,#BBDEFB 50%,#90CAF9 100%)"},
  {id:"booklet",name:"소책자",icon:"📕",illustId:"booklet",desc:"매뉴얼, 가이드북, 교재 등 소량 맞춤 제작. 중철·무선 제본으로 깔끔하게 완성합니다.",bg:"linear-gradient(135deg,#FCE4EC 0%,#F8BBD0 50%,#F48FB1 100%)"},
  {id:"diary",name:"다이어리",icon:"📓",illustId:"diary",desc:"나만의 맞춤 다이어리와 플래너. 원하는 디자인과 내지 구성으로 특별하게 제작합니다.",bg:"linear-gradient(135deg,#F3E5F5 0%,#E1BEE7 50%,#CE93D8 100%)"},
  {id:"poster",name:"대형출력",icon:"🖼️",illustId:"poster",desc:"포스터, 배너, 현수막 등 대형 인쇄물. 선명한 출력 품질로 주목도를 높여 드립니다.",bg:"linear-gradient(135deg,#FBE9E7 0%,#FFCCBC 50%,#FFAB91 100%)"}
];
const STS=[{key:"received",label:"접수",icon:"📋"},{key:"printing",label:"인쇄",icon:"🖨️"},{key:"postproc",label:"후가공",icon:"✂️"},{key:"binding",label:"제본",icon:"📚"},{key:"inspect",label:"검수",icon:"🔍"},{key:"ship",label:"출고",icon:"📦"},{key:"done",label:"배송완료",icon:"✅"}];
const DEF_CFG={format:"A4",pages:100,quantity:1,printType:"FX-4도",innerPaper:"모조80",innerSide:"양면",coverPaper:"아트지250",coverSide:"단면",coating:"무광코팅",binding:"무선",endpaper:"없음",postProcessing:[]};
const CHART_COLORS=["#7CB342","#43A047","#2E7D32","#66BB6A","#7c3aed","#f59e0b","#10b981","#ef4444"];

// ═══════════════════════════════════════════════════
// CONTEXT & STORAGE
// ═══════════════════════════════════════════════════
const Ctx=createContext(null);const useApp=()=>useContext(Ctx);
// Storage layer (localStorage → Supabase)
import { sLoad, sSave } from './lib/storage'

// ═══════════════════════════════════════════════════
// ICONS (inline SVG)
// ═══════════════════════════════════════════════════
const Ic=({d,s=20,c=""})=>(<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={c}>{d}</svg>);
const II={
  cart:(s,c)=><Ic s={s} c={c} d={<><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></>}/>,
  menu:(s,c)=><Ic s={s} c={c} d={<><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></>}/>,
  x:(s,c)=><Ic s={s} c={c} d={<><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>}/>,
  back:(s,c)=><Ic s={s} c={c} d={<><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></>}/>,
  up:(s,c)=><Ic s={s} c={c} d={<><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></>}/>,
  down:(s,c)=><Ic s={s} c={c} d={<><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></>}/>,
  edit:(s,c)=><Ic s={s} c={c} d={<><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></>}/>,
  plus:(s,c)=><Ic s={s} c={c} d={<><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></>}/>,
  minus:(s,c)=><Ic s={s} c={c} d={<line x1="5" y1="12" x2="19" y2="12"/>}/>,
  check:(s,c)=><Ic s={s} c={c} d={<polyline points="20 6 9 17 4 12"/>}/>,
  cog:(s,c)=><Ic s={s} c={c} d={<><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.26.604.852.997 1.51 1H21a2 2 0 0 1 0 4h-.09c-.658.003-1.25.396-1.51 1z"/></>}/>,
  save:(s,c)=><Ic s={s} c={c} d={<><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></>}/>,
  trash:(s,c)=><Ic s={s} c={c} d={<><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></>}/>,
  compare:(s,c)=><Ic s={s} c={c} d={<><rect x="2" y="3" width="8" height="18" rx="1"/><rect x="14" y="3" width="8" height="18" rx="1"/></>}/>,
  bell:(s,c)=><Ic s={s} c={c} d={<><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></>}/>,
  print:(s,c)=><Ic s={s} c={c} d={<><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></>}/>,
  chart:(s,c)=><Ic s={s} c={c} d={<><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></>}/>,
  clock:(s,c)=><Ic s={s} c={c} d={<><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></>}/>,
};

// ═══════════════════════════════════════════════════
// SHARED COMPONENTS
// ═══════════════════════════════════════════════════
function Chip({label,active,onClick,sub,disabled}){
  return(<button onClick={onClick} disabled={disabled} className={cn("text-left px-4 py-3 rounded-lg border transition-all w-full",active?"shadow-sm":"hover:border-stone-300",disabled&&"opacity-30 cursor-not-allowed")} style={active?{borderColor:T.accent,background:T.accentBg,boxShadow:"0 2px 8px rgba(139,109,66,.1)"}:{borderColor:T.border,background:T.card}}>
    <div className="font-semibold text-sm" style={{color:active?T.accent:T.text}}>{label}</div>
    {sub&&<div className="text-xs mt-0.5" style={{color:T.muted}}>{sub}</div>}
  </button>);
}
function QI({value,onChange,min=1,max=99999}){
  return(<div className="flex items-center gap-1.5">
    <button onClick={()=>onChange(Math.max(min,value-1))} className="w-9 h-9 rounded-lg border flex items-center justify-center hover:bg-stone-50" style={{borderColor:T.border,color:T.muted}}>{II.minus(14)}</button>
    <input type="number" value={value} onChange={e=>onChange(clamp(parseInt(e.target.value)||min,min,max))} className="w-24 h-9 text-center border rounded-lg font-bold focus:outline-none" style={{borderColor:T.border,color:T.text}} onFocus={e=>{e.target.style.borderColor=T.accent}} onBlur={e=>{e.target.style.borderColor=T.border}}/>
    <button onClick={()=>onChange(Math.min(max,value+1))} className="w-9 h-9 rounded-lg border flex items-center justify-center hover:bg-stone-50" style={{borderColor:T.border,color:T.muted}}>{II.plus(14)}</button>
  </div>);
}
function Toast({msg,onClose}){useEffect(()=>{const t=setTimeout(onClose,2800);return()=>clearTimeout(t);},[onClose]);return(<div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[300] px-6 py-3 rounded-lg text-sm font-medium flex items-center gap-2 fade-in" style={{background:T.dark,color:"#FAFAF9",boxShadow:"0 8px 32px rgba(26,24,22,.2)"}}>{II.check(16)} {msg}</div>);}
function Badge({children,color="amber"}){const styles={amber:{background:T.accentBg,color:T.accent,border:`1px solid ${T.accentBorder}`},green:{background:"#F0FDF4",color:"#16a34a",border:"1px solid #bbf7d0"},gray:{background:T.warm,color:T.muted,border:`1px solid ${T.borderLight}`},red:{background:"#FEF2F2",color:"#c0392b",border:"1px solid #fecaca"},blue:{background:"#EFF6FF",color:"#2563eb",border:"1px solid #bfdbfe"}};const s=styles[color]||styles.amber;return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold inline-block" style={s}>{children}</span>;}
function StatCard({icon,label,value,sub,color="amber"}){
  const accents={amber:T.accent,blue:"#2563eb",green:"#16a34a",purple:"#7C3AED"};
  return(<div className="p-5 flex items-start gap-4" style={{background:T.card,border:`1px solid ${T.borderLight}`,borderRadius:T.r,boxShadow:T.sh}}>
    <div className="w-11 h-11 rounded-lg flex items-center justify-center text-white" style={{background:accents[color]||T.accent}}>{icon}</div>
    <div><div className="text-xs font-medium" style={{color:T.muted}}>{label}</div><div className="text-2xl font-black mt-0.5" style={{color:T.text}}>{value}</div>{sub&&<div className="text-xs mt-0.5" style={{color:T.sub}}>{sub}</div>}</div>
  </div>);
}

// Category Illustrations (inline SVG)
const CatIllust={
  photobook:()=>(<svg viewBox="0 0 200 140" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
    <rect x="30" y="20" width="60" height="80" rx="3" fill="#5D4037" stroke="#4E342E" strokeWidth="1.5"/><rect x="35" y="25" width="50" height="70" rx="2" fill="#EFEBE9"/>
    <rect x="40" y="30" width="40" height="28" rx="1" fill="#A5D6A7"/><circle cx="52" cy="40" r="4" fill="#66BB6A"/><path d="M40 55 L55 42 L65 50 L80 38 L80 58 L40 58Z" fill="#81C784" opacity=".7"/>
    <rect x="40" y="63" width="28" height="2.5" rx="1" fill="#BDBDBD"/><rect x="40" y="68" width="20" height="2" rx="1" fill="#D5D5D5"/><rect x="40" y="73" width="35" height="2" rx="1" fill="#D5D5D5"/>
    <rect x="110" y="25" width="60" height="80" rx="3" fill="#6D4C41" stroke="#5D4037" strokeWidth="1.5"/><rect x="115" y="30" width="50" height="70" rx="2" fill="#FFF"/>
    <rect x="120" y="35" width="40" height="30" rx="1" fill="#FFE0B2"/><circle cx="148" cy="44" r="6" fill="#FFB74D"/><path d="M120 60 L133 48 L142 54 L160 40 L160 65 L120 65Z" fill="#FF8A65" opacity=".6"/>
    <rect x="120" y="70" width="22" height="2.5" rx="1" fill="#BDBDBD"/><rect x="120" y="75" width="35" height="2" rx="1" fill="#D5D5D5"/>
    <path d="M88 60 Q95 55 100 60 Q105 55 112 60" stroke="#8D6E63" strokeWidth="1" fill="none"/>
  </svg>),
  catalog:()=>(<svg viewBox="0 0 200 140" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
    <rect x="35" y="18" width="130" height="95" rx="4" fill="#F5F5F5" stroke="#E0E0E0" strokeWidth="1"/><rect x="35" y="18" width="65" height="95" fill="#FFF" rx="4"/>
    <rect x="42" y="26" width="50" height="35" rx="2" fill="#C8E6C9"/><path d="M42 55 L60 38 L72 48 L92 30 L92 61 L42 61Z" fill="#66BB6A" opacity=".5"/>
    <circle cx="82" cy="35" r="5" fill="#81C784"/>
    <rect x="42" y="68" width="30" height="3" rx="1" fill="#424242"/><rect x="42" y="74" width="48" height="2" rx="1" fill="#BDBDBD"/><rect x="42" y="79" width="44" height="2" rx="1" fill="#D5D5D5"/><rect x="42" y="84" width="36" height="2" rx="1" fill="#D5D5D5"/>
    <rect x="108" y="26" width="50" height="25" rx="2" fill="#BBDEFB"/><rect x="108" y="55" width="50" height="25" rx="2" fill="#FFE0B2"/>
    <rect x="108" y="85" width="24" height="8" rx="4" fill="#7CB342"/><rect x="108" y="85" width="24" height="8" rx="4" fill="#7CB342"/><text x="120" y="91.5" fontSize="5" fill="white" fontWeight="bold">MORE</text>
    <rect x="138" y="18" width="2" height="95" fill="#E8E8E8"/>
  </svg>),
  brochure:()=>(<svg viewBox="0 0 200 140" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
    <g transform="translate(25,15)"><rect width="50" height="70" rx="2" fill="#E3F2FD" stroke="#90CAF9" strokeWidth="1" transform="rotate(-5 25 35)"/></g>
    <g transform="translate(60,12)"><rect width="50" height="70" rx="2" fill="#FFF" stroke="#E0E0E0" strokeWidth="1"/>
    <rect x="5" y="5" width="40" height="25" rx="1" fill="#C8E6C9"/><path d="M5 27 L20 14 L30 22 L45 10 L45 30 L5 30Z" fill="#66BB6A" opacity=".4"/>
    <rect x="5" y="35" width="28" height="2.5" rx="1" fill="#333"/><rect x="5" y="40" width="40" height="1.5" rx=".7" fill="#BBB"/><rect x="5" y="44" width="36" height="1.5" rx=".7" fill="#CCC"/><rect x="5" y="48" width="38" height="1.5" rx=".7" fill="#CCC"/>
    <rect x="5" y="55" width="18" height="6" rx="3" fill="#7CB342"/></g>
    <g transform="translate(115,18)"><rect width="50" height="70" rx="2" fill="#FAFAFA" stroke="#E0E0E0" strokeWidth="1" transform="rotate(5 25 35)"/>
    <rect x="6" y="8" width="38" height="20" rx="1" fill="#FFE0B2" transform="rotate(5 25 18)"/></g>
    <ellipse cx="100" cy="120" rx="70" ry="4" fill="#0001"/>
  </svg>),
  booklet:()=>(<svg viewBox="0 0 200 140" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
    <rect x="55" y="15" width="90" height="110" rx="3" fill="#FFCDD2" stroke="#E57373" strokeWidth="1.5"/>
    <rect x="60" y="20" width="80" height="100" rx="2" fill="#FFF"/>
    <rect x="98" y="15" width="1.5" height="110" fill="#E57373" opacity=".3"/>
    <rect x="67" y="28" width="55" height="3.5" rx="1" fill="#333"/><rect x="67" y="35" width="60" height="2" rx="1" fill="#BBB"/><rect x="67" y="40" width="50" height="2" rx="1" fill="#CCC"/>
    <rect x="67" y="48" width="62" height="2" rx="1" fill="#DDD"/><rect x="67" y="53" width="58" height="2" rx="1" fill="#DDD"/><rect x="67" y="58" width="55" height="2" rx="1" fill="#DDD"/>
    <rect x="67" y="66" width="62" height="2" rx="1" fill="#DDD"/><rect x="67" y="71" width="48" height="2" rx="1" fill="#DDD"/><rect x="67" y="76" width="60" height="2" rx="1" fill="#DDD"/>
    <rect x="67" y="84" width="35" height="12" rx="2" fill="#E8F5E9" stroke="#C8E6C9" strokeWidth=".5"/>
    <rect x="70" y="87" width="8" height="6" rx="1" fill="#A5D6A7"/><rect x="80" y="88" width="18" height="2" rx="1" fill="#999"/>
    <circle cx="67" cy="30" r="1" fill="#E57373"/><circle cx="67" cy="50" r="1" fill="#E57373"/>
  </svg>),
  diary:()=>(<svg viewBox="0 0 200 140" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
    <rect x="50" y="12" width="100" height="116" rx="4" fill="#5C6BC0" stroke="#3F51B5" strokeWidth="1.5"/>
    <rect x="56" y="18" width="88" height="104" rx="3" fill="#FFF"/>
    <rect x="56" y="18" width="12" height="104" fill="#E8EAF6" rx="3"/>
    {[30,45,60,75,90,105].map(y=><line key={y} x1="72" y1={y} x2="138" y2={y} stroke="#E0E0E0" strokeWidth=".7"/>)}
    <text x="76" y="38" fontSize="6" fill="#5C6BC0" fontWeight="bold">2025 DIARY</text>
    <rect x="76" y="50" width="40" height="2" rx="1" fill="#999"/><rect x="76" y="56" width="55" height="1.5" rx=".7" fill="#CCC"/><rect x="76" y="62" width="48" height="1.5" rx=".7" fill="#CCC"/>
    <rect x="76" y="70" width="52" height="1.5" rx=".7" fill="#CCC"/><rect x="76" y="76" width="45" height="1.5" rx=".7" fill="#CCC"/>
    <rect x="113" y="90" width="25" height="18" rx="2" fill="#C8E6C9"/><text x="118" y="102" fontSize="7" fill="#43A047" fontWeight="bold">✓</text>
    <rect x="52" y="35" width="6" height="10" rx="1" fill="#7986CB"/><rect x="52" y="55" width="6" height="10" rx="1" fill="#7986CB"/><rect x="52" y="75" width="6" height="10" rx="1" fill="#7986CB"/>
    <rect x="80" y="10" width="40" height="14" rx="3" fill="#3F51B5"/><text x="88" y="20" fontSize="6" fill="white" fontWeight="bold">NOTE</text>
  </svg>),
  poster:()=>(<svg viewBox="0 0 200 140" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
    <rect x="35" y="8" width="130" height="100" rx="2" fill="#FFF" stroke="#E0E0E0" strokeWidth="1"/>
    <rect x="40" y="13" width="120" height="60" rx="1" fill="url(#pgrad)"/>
    <defs><linearGradient id="pgrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#FF8A65"/><stop offset="50%" stopColor="#FF7043"/><stop offset="100%" stopColor="#F4511E"/></linearGradient></defs>
    <text x="56" y="38" fontSize="11" fill="white" fontWeight="900" letterSpacing="1">GRAND</text>
    <text x="52" y="52" fontSize="14" fill="white" fontWeight="900" letterSpacing="2">OPENING</text>
    <text x="62" y="66" fontSize="6" fill="rgba(255,255,255,.7)">2025.03.25 — BOOKMOA</text>
    <rect x="40" y="78" width="55" height="2.5" rx="1" fill="#333"/><rect x="40" y="84" width="80" height="2" rx="1" fill="#BBB"/><rect x="40" y="89" width="70" height="2" rx="1" fill="#CCC"/><rect x="40" y="94" width="60" height="2" rx="1" fill="#CCC"/>
    <rect x="125" y="78" width="35" height="12" rx="2" fill="#7CB342"/><text x="131" y="87" fontSize="6" fill="white" fontWeight="bold">자세히 →</text>
    <line x1="35" y1="115" x2="165" y2="115" stroke="#E0E0E0" strokeWidth=".5"/>
    <circle cx="70" cy="125" r="3" fill="#FF7043" opacity=".6"/><circle cx="100" cy="125" r="3" fill="#7CB342" opacity=".6"/><circle cx="130" cy="125" r="3" fill="#42A5F5" opacity=".6"/>
  </svg>)
};
function EditorialCard({bg,icon,name,desc,onClick,illustId,linkText="견적 시작 →"}){
  const Illust=illustId&&CatIllust[illustId];
  return(<button onClick={onClick} className="group overflow-hidden text-left transition-all hover:-translate-y-1.5 w-full" style={{background:T.card,border:"1px solid "+T.border,borderRadius:T.r,boxShadow:T.sh}}>
    <div className="relative overflow-hidden" style={{paddingTop:"66%",background:bg||T.accentBg}}>
      <div className="absolute inset-0 flex items-center justify-center">
        {Illust?<div className="w-full h-full p-3"><Illust/></div>:<span className="text-7xl sm:text-8xl drop-shadow-sm transition-transform duration-500 group-hover:scale-110">{icon||"📦"}</span>}
      </div>
    </div>
    <div className="p-5 sm:p-6">
      <h3 className="text-lg sm:text-xl font-black mb-2" style={{color:T.text}}>{name}</h3>
      <p className="text-sm leading-relaxed mb-4" style={{color:T.sub}}>{desc}</p>
      <span className="text-sm font-bold inline-flex items-center gap-1 transition-all group-hover:gap-2" style={{color:T.accent}}>{linkText} <span className="transition-transform group-hover:translate-x-1">›</span></span>
    </div>
  </button>);
}

// ═══════════════════════════════════════════════════
// NAV (with notification bell)
// ═══════════════════════════════════════════════════
function Nav(){
  const{page,go,cart,notifs}=useApp();
  const[mob,setMob]=useState(false);
  const[notiOpen,setNotiOpen]=useState(false);
  const h=page==="home";
  const unread=notifs.filter(n=>!n.read).length;
  if(page==="admin")return null;

  return(<nav className="fixed top-0 left-0 right-0 z-50" style={{background:h?"rgba(255,255,255,0.97)":"rgba(255,255,255,0.97)",backdropFilter:"blur(20px)",borderBottom:"1px solid "+T.borderLight}}>
    <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
      <button onClick={()=>go("home")} className="text-xl font-black tracking-tight" style={{color:T.accent}}>북모아</button>
      <div className="hidden md:flex items-center gap-6">{[["상품","products"],["견적하기","configure"],["내 주문","orders"]].map(([l,p])=>(
        <button key={p} onClick={()=>go(p)} className="text-sm font-medium transition-colors hover:text-green-600" style={{color:T.sub}}>{l}</button>
      ))}</div>
      <div className="flex items-center gap-3">
        {/* Notification bell */}
        <div className="relative">
          <button onClick={()=>setNotiOpen(!notiOpen)} className="relative">{II.bell(20,h?"text-gray-300":"text-gray-600")}
            {unread>0&&<span className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-[10px] font-bold text-white flex items-center justify-center bg-red-500">{unread}</span>}
          </button>
          {notiOpen&&<NotifDropdown onClose={()=>setNotiOpen(false)}/>}
        </div>
        <button onClick={()=>go("cart")} className="relative">{II.cart(20,"text-gray-500")}{cart.length>0&&<span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full text-[10px] font-bold text-white flex items-center justify-center" style={{background:T.accent}}>{cart.length}</span>}</button>
        <button onClick={()=>go("admin")} className="hidden md:block">{II.cog(18,"text-gray-400")}</button>
        <button className="md:hidden" onClick={()=>setMob(!mob)}>{mob?II.x(22,"text-gray-700"):II.menu(22,"text-gray-700")}</button>
      </div>
    </div>
    {mob&&<div className="md:hidden border-t p-3 space-y-1" style={{background:T.card,borderColor:T.borderLight}}>{[["상품","products"],["견적하기","configure"],["내 주문","orders"],["관리자","admin"]].map(([l,p])=>(<button key={p} onClick={()=>{go(p);setMob(false)}} className="w-full text-left px-4 py-3 rounded-lg font-medium hover:bg-green-50" style={{color:T.text}}>{l}</button>))}</div>}
  </nav>);
}

// ═══════════════════════════════════════════════════
// NOTIFICATION DROPDOWN (Phase 3)
// ═══════════════════════════════════════════════════
function NotifDropdown({onClose}){
  const{notifs,markNotifsRead}=useApp();
  useEffect(()=>{markNotifsRead();},[]);
  return(<>
    <div className="fixed inset-0 z-40" onClick={onClose}/>
    <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-2xl border z-50 overflow-hidden">
      <div className="px-4 py-3 border-b flex items-center justify-between"><h4 className="font-bold text-sm">알림</h4><span className="text-xs text-gray-400">{notifs.length}개</span></div>
      <div className="max-h-72 overflow-y-auto">
        {!notifs.length&&<div className="p-6 text-center text-gray-400 text-sm">알림이 없습니다</div>}
        {notifs.slice(0,10).map((n,i)=>(
          <div key={i} className={cn("px-4 py-3 border-b last:border-0 hover:bg-gray-50",!n.read&&"bg-blue-50/50")}>
            <div className="flex items-start gap-2"><span className="text-lg">{n.icon||"📢"}</span><div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-gray-900">{n.title}</div>
              <div className="text-xs text-gray-500 mt-0.5">{n.body}</div>
              <div className="text-[10px] text-gray-300 mt-1">{dateStr(n.date)}</div>
            </div></div>
          </div>
        ))}
      </div>
    </div>
  </>);
}

// ═══════════════════════════════════════════════════
// HOME / LANDING PAGE
// ═══════════════════════════════════════════════════
function Home(){const{go,savedCfgs,orders,settings,customProducts}=useApp();const activeProds=customProducts.filter(p=>p.active);
return(<div style={{background:T.bg}}>
  {/* HERO - BookMoa style: bright gradient top */}
  <section className="relative overflow-hidden" style={{background:"linear-gradient(180deg,#E8F5E9 0%,#F1F8E8 40%,#FFFFFF 100%)",minHeight:"85vh"}}>
    <div className="max-w-7xl mx-auto px-6 pt-32 pb-16 relative z-10"><div className="grid lg:grid-cols-2 gap-12 items-center"><div className="fade-up">
      <div className="inline-block px-4 py-1.5 rounded-full text-[11px] font-bold tracking-[2px] mb-6" style={{background:T.accentBg,color:T.accent,border:"1px solid "+T.accentBorder}}>DIGITAL PRINT ON DEMAND</div>
      <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black leading-tight mb-6" style={{color:T.text}}>세상에 단 한 권뿐인<br/><span style={{color:T.accent}}>당신의 책</span></h1>
      <p className="text-lg leading-relaxed max-w-lg mb-10 fade-up fade-up-d1" style={{color:T.sub}}>30년 전통의 북모아가 당신의 이야기를 아름다운 책으로 만들어드립니다.<br/>실시간 견적부터 주문까지, 한 번에.</p>
      <div className="flex flex-wrap gap-4 fade-up fade-up-d2">
        <button onClick={()=>go("configure")} className="px-8 py-4 rounded-full font-bold text-base text-white transition-all hover:-translate-y-0.5" style={{background:T.accent,boxShadow:"0 4px 16px rgba(124,179,66,.3)"}}>견적 시작하기 →</button>
        <button onClick={()=>go("products")} className="px-8 py-4 rounded-full font-bold text-base border-2 transition-all hover:-translate-y-0.5" style={{color:T.sub,borderColor:T.border}}>상품 둘러보기</button>
      </div></div>
      <div className="hidden lg:flex justify-center fade-up fade-up-d2"><div className="w-80 rounded-xl overflow-hidden" style={{background:T.card,border:"1px solid "+T.border,boxShadow:T.shLg}}>
        <div className="p-6"><div className="text-[11px] mb-4 font-bold tracking-[2px]" style={{color:T.accent}}>실시간 견적 미리보기</div>
        {[["판형","A4"],["인쇄","FX-4도"],["내지","모조80 양면"],["표지","아트지250"],["제본","무선"]].map(([k,v])=>(<div key={k} className="flex justify-between py-1.5 text-sm" style={{borderBottom:"1px solid "+T.borderLight}}><span style={{color:T.muted}}>{k}</span><span className="font-medium" style={{color:T.text}}>{v}</span></div>))}
        <div className="mt-4 pt-4 flex justify-between items-center"><span className="text-sm" style={{color:T.muted}}>100p / 1부</span><span className="text-2xl font-black" style={{color:T.accent}}>₩ {fmt(calcQuote(DEF_CFG).total)}</span></div></div></div></div>
    </div></div>
  </section>

  {/* SERVICE CARDS - BookMoa style */}
  <section className="py-20" style={{background:T.warm}}><div className="max-w-7xl mx-auto px-6">
    <div className="text-center mb-12"><span className="text-sm font-bold" style={{color:T.accent}}>북모아의 서비스</span><h2 className="text-3xl sm:text-4xl font-black mt-2" style={{color:T.text}}>어떤 인쇄물을 만드시나요?</h2><p className="mt-3" style={{color:T.sub}}>원하는 카테고리를 선택하세요</p></div>
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">{CATS.map(c=>(<EditorialCard key={c.id} bg={c.bg} icon={c.icon} illustId={c.illustId} name={c.name} desc={c.desc} onClick={()=>go("configure")}/>))}{activeProds.map(p=>(<EditorialCard key={p.id} icon={p.icon||"📦"} name={p.name} desc={p.desc} onClick={()=>go("prodConfigure",p.id)}/>))}</div>
  </div></section>

  {/* PROCESS STEPS - BookMoa style: numbered green circles + line */}
  <section className="py-20" style={{background:T.bg}}><div className="max-w-5xl mx-auto px-6">
    <div className="text-center mb-14"><span className="text-sm font-bold" style={{color:T.accent}}>간단한 프로세스</span><h2 className="text-3xl font-black mt-2" style={{color:T.text}}>4단계로 완성하는 인쇄물!</h2></div>
    <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">{[["1","견적 확인","옵션을 선택하면\n실시간 자동 견적"],["2","파일 업로드","인쇄용 파일을\n업로드하세요"],["3","주문 결제","장바구니에서\n간편하게 결제"],["4","제작 배송","전문가가 제작 후\n안전하게 배송"]].map(([n,t,d])=>(<div key={n}><div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-black text-lg mx-auto mb-4" style={{background:T.accent}}>{n}</div><h3 className="font-bold mb-2" style={{color:T.accent}}>{t}</h3><p className="text-sm leading-relaxed whitespace-pre-line" style={{color:T.sub}}>{d}</p></div>))}</div>
  </div></section>

  {/* WHY US - BookMoa style */}
  <section className="py-20" style={{background:T.warm}}><div className="max-w-5xl mx-auto px-6">
    <div className="text-center mb-14"><span className="text-sm font-bold" style={{color:T.accent}}>왜 북모아인가</span><h2 className="text-3xl font-black mt-2" style={{color:T.text}}>30년의 신뢰, 경험과 정성스런 마음으로...</h2></div>
    <div className="grid md:grid-cols-3 gap-6">{[["⚡","실시간 자동견적","옵션만 선택하면 즉시 정확한 가격을\n제공합니다."],["🎨","프리미엄 품질","30년 전문 기업의 노하우로\n최상의 품질을 보장합니다."],["📦","원스톱 서비스","기획→편집→인쇄→제본→배송까지\n한 건물에서 해결합니다."]].map(([ic,t,d],i)=>(<div key={i} className="text-center p-8 rounded-xl" style={{background:T.card,border:"1px solid "+T.border}}>
      <div className="w-14 h-14 rounded-xl flex items-center justify-center text-2xl mx-auto mb-5" style={{background:T.accentBg}}>{ic}</div>
      <h3 className="text-lg font-bold mb-3" style={{color:T.accent}}>{t}</h3><p className="text-sm leading-relaxed whitespace-pre-line" style={{color:T.sub}}>{d}</p></div>))}</div>
  </div></section>

  {/* Saved Configs */}
  {savedCfgs.length>0&&<section className="py-10 border-y" style={{background:T.bg,borderColor:T.borderLight}}><div className="max-w-7xl mx-auto px-6">
    <h3 className="text-lg font-black mb-4" style={{color:T.text}}>⭐ 저장된 사양으로 빠른 견적</h3>
    <div className="flex gap-3 overflow-x-auto pb-2">{savedCfgs.slice(-5).reverse().map(sc=>(<button key={sc.id} onClick={()=>go("configure")} className="flex-shrink-0 rounded-lg p-4 text-left border transition-all hover:-translate-y-0.5" style={{minWidth:"200px",background:T.card,borderColor:T.border}}>
      <div className="font-bold text-sm mb-1 truncate" style={{color:T.text}}>{sc.name}</div>
      <div className="text-[10px] space-x-1" style={{color:T.muted}}>{[sc.cfg.format,sc.cfg.printType,sc.cfg.binding].map((v,i)=><span key={i} className="inline-block px-1.5 py-0.5 rounded" style={{background:T.warm}}>{v}</span>)}</div>
      <div className="text-xs font-bold mt-2" style={{color:T.accent}}>견적 시작 →</div>
    </button>))}</div>
  </div></section>}

  {/* Recent Orders */}
  {orders.length>0&&<section className="py-10 border-b" style={{background:T.warm,borderColor:T.borderLight}}><div className="max-w-7xl mx-auto px-6">
    <div className="flex justify-between items-center mb-4"><h3 className="text-lg font-black" style={{color:T.text}}>📦 최근 주문</h3><button onClick={()=>go("orders")} className="text-sm font-bold" style={{color:T.accent}}>전체보기 →</button></div>
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">{orders.slice(-3).reverse().map(o=>(<div key={o.id} onClick={()=>go("orders")} className="p-4 cursor-pointer transition-all hover:-translate-y-0.5" style={{background:T.card,border:"1px solid "+T.border,borderRadius:T.r,boxShadow:T.sh}}>
      <div className="flex justify-between items-start mb-2"><span className="font-bold text-sm" style={{color:T.text}}>{o.id}</span><Badge color={o.status>=6?"green":"amber"}>{STS[o.status]?.label}</Badge></div>
      <p className="text-xs" style={{color:T.muted}}>{dateStr(o.date)}</p>
      <div className="mt-2 flex justify-between items-center"><span className="text-xs" style={{color:T.sub}}>{o.items?.length}건</span><span className="font-bold" style={{color:T.accent}}>₩{fmt(o.total)}</span></div>
    </div>))}</div>
  </div></section>}

  {/* CTA Dark Section - BookMoa style: dark olive */}
  <section className="py-20" style={{background:T.dark}}><div className="max-w-4xl mx-auto text-center px-6">
    <h2 className="text-3xl font-black mb-3" style={{color:"#F5F5F0"}}>여러분의 생각은 책이 됩니다.</h2>
    <p className="text-lg mb-8" style={{color:"rgba(245,245,240,.6)"}}>북모아와 함께라면 당신의 이야기가 아름다운 책이 됩니다.<br/>무료상담으로 시작해보세요.</p>
    <button onClick={()=>go("configure")} className="px-10 py-4 rounded-full font-bold text-base text-white transition-all hover:-translate-y-0.5" style={{background:T.accent,boxShadow:"0 4px 16px rgba(124,179,66,.3)"}}>무료 견적 시작 →</button>
  </div></section>

  {/* Footer - BookMoa style: dark 4-column */}
  <footer style={{background:"#151F0E"}}><div className="max-w-7xl mx-auto px-6 py-12">
    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-10">
      <div><h4 className="font-black text-base mb-4" style={{color:"#E0E0E0"}}>북모아</h4><p className="text-sm leading-relaxed" style={{color:"rgba(255,255,255,.4)"}}>30년 경력의 POD 출판 전문 기업</p></div>
      <div><h4 className="font-bold text-sm mb-4" style={{color:"#C0C0C0"}}>서비스</h4>{["도서인쇄","커스텀 상품","견적 문의"].map(s=><p key={s} className="text-sm mb-1.5" style={{color:"rgba(255,255,255,.35)"}}>{s}</p>)}</div>
      <div><h4 className="font-bold text-sm mb-4" style={{color:"#C0C0C0"}}>회사</h4>{["회사 소개","이용약관","개인정보처리방침"].map(s=><p key={s} className="text-sm mb-1.5" style={{color:"rgba(255,255,255,.35)"}}>{s}</p>)}</div>
      <div><h4 className="font-bold text-sm mb-4" style={{color:"#C0C0C0"}}>연락처</h4><p className="text-sm mb-1.5" style={{color:"rgba(255,255,255,.35)"}}>전화 {settings.tel}</p><p className="text-sm mb-1.5" style={{color:"rgba(255,255,255,.35)"}}>팩스 {settings.fax}</p><p className="text-sm" style={{color:"rgba(255,255,255,.35)"}}>{settings.email}</p></div>
    </div>
    <div className="pt-6 text-center text-xs" style={{borderTop:"1px solid rgba(255,255,255,.08)",color:"rgba(255,255,255,.25)"}}>© 2025 {settings.bizName}. All rights reserved.</div>
  </div></footer>
</div>);}

function Products(){const{go,customProducts}=useApp();const activeProds=customProducts.filter(p=>p.active);return(<div className="min-h-screen pt-20" style={{background:T.bg}}><div className="max-w-7xl mx-auto px-6 py-10"><div className="text-center mb-10"><span className="text-sm font-bold" style={{color:T.accent}}>인쇄물 카테고리</span><h1 className="text-3xl font-black mt-2" style={{color:T.text}}>어떤 인쇄물을 만드시나요?</h1><p className="mt-2 text-sm" style={{color:T.sub}}>기본 인쇄물과 커스텀 상품 모두 주문 가능합니다</p></div><h2 className="text-xl font-bold mb-5" style={{color:T.text}}>📚 도서/제본 인쇄</h2><div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">{CATS.map(c=>(<EditorialCard key={c.id} bg={c.bg} icon={c.icon} illustId={c.illustId} name={c.name} desc={c.desc} onClick={()=>go("configure")}/>))}</div>{activeProds.length>0&&<><h2 className="text-xl font-bold mb-5" style={{color:T.text}}>🏷️ 커스텀 상품</h2><div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">{activeProds.map(p=>(<EditorialCard key={p.id} icon={p.icon||"📦"} name={p.name} desc={p.desc} onClick={()=>go("prodConfigure",p.id)}/>))}</div></>}</div></div>);}

// ═══════════════════════════════════════════════════
// CONFIGURE (견적 구성)
// ═══════════════════════════════════════════════════
function Configure(){
  const{go,addToCart,addCompare,savedCfgs,saveCfg,removeSavedCfg,settings}=useApp();
  const[cfg,setCfg]=useState({...DEF_CFG});const[step,setStep]=useState(0);const[files,setFiles]=useState([]);const[toast,setToast]=useState(null);const[mobPrice,setMobPrice]=useState(false);const[showEstimate,setShowEstimate]=useState(false);const[showSaved,setShowSaved]=useState(false);const[dragOver,setDragOver]=useState(false);const[saveName,setSaveName]=useState("");
  const set=(k,v)=>setCfg(p=>({...p,[k]:v}));const quote=useMemo(()=>calcQuote(cfg),[cfg]);
  const innerPaperType=useMemo(()=>(cfg.innerPaper||"").match(/^(.*?)(\d+)$/)?.[1]||PAPER_TYPES[0],[cfg.innerPaper]);
  const printAvail=useMemo(()=>PTYPES.map((pt,i)=>{const r=lookupLE(cfg.pages,DEF_PRICING.printTable,"c");return r.v[i]!=null;}),[cfg.pages]);
  const togglePP=pp=>setCfg(p=>({...p,postProcessing:p.postProcessing.includes(pp)?p.postProcessing.filter(x=>x!==pp):[...p.postProcessing,pp]}));
  const handleAdd=async()=>{
    let fileData=[];
    if(files.length>0&&supabase){
      for(const f of files){const path=`${uid()}/${f.name}`;const{error}=await supabase.storage.from("order-files").upload(path,f);if(!error){const{data:u}=supabase.storage.from("order-files").getPublicUrl(path);fileData.push({name:f.name,url:u?.publicUrl||""});}else fileData.push({name:f.name,url:""});}
    }else{fileData=files.map(f=>({name:f.name,url:""}));}
    addToCart({id:uid(),cfg:{...cfg},quote,files:fileData});setToast("장바구니에 담겼습니다");setTimeout(()=>go("cart"),800);
  };
  const handleCompare=()=>{addCompare({id:uid(),cfg:{...cfg},quote});setToast("비교 목록에 추가됨");};
  const handleSaveCfg=()=>{saveCfg({name:saveName||cfg.format+"/"+cfg.printType+"/"+cfg.binding,cfg:{...cfg}});setToast("사양이 저장되었습니다");setSaveName("");setShowSaved(false);};
  const loadSaved=(sc)=>{setCfg({...DEF_CFG,...sc.cfg});setStep(0);setShowSaved(false);setToast("저장된 사양 불러옴");};
  const fileIcon=(name)=>{const ext=(name||"").split(".").pop()?.toLowerCase();if(ext==="pdf")return"📕";if(["jpg","jpeg","png","gif","webp"].includes(ext))return"🖼️";if(["ai","eps"].includes(ext))return"🎨";if(ext==="indd")return"📐";return"📄";};
  const handleDrop=(e)=>{e.preventDefault();setDragOver(false);const dropped=Array.from(e.dataTransfer?.files||[]);setFiles(p=>[...p,...dropped]);};

  const stps=[{t:"판형 & 인쇄",s:"규격과 인쇄 방식 선택"},{t:"내지",s:"내지 종이와 인쇄면"},{t:"표지 & 코팅",s:"표지 종이와 코팅"},{t:"제본 & 후가공",s:"제본 방식과 추가 옵션"},{t:"견적확인",s:"견적서를 확인하고 인쇄/다운로드"},{t:"파일 업로드",s:"인쇄 파일 업로드"}];
  const[customerName,setCustomerName]=useState("");
  const todayKR=new Date().toLocaleDateString("ko-KR",{year:"numeric",month:"2-digit",day:"2-digit"}).replace(/\. /g,"년 ").replace(/\./g,"일");
  const handleEstExcel=()=>{try{
    const wb=XLSX.utils.book_new();const rows=[];
    rows.push(["견 적 서"]);rows.push([]);
    rows.push(["견적일 및 수신","","","","공급자"]);
    rows.push(["견적일",todayKR,"","상 호",settings.bizName,"대표자",settings.ceo]);
    rows.push(["수 신",customerName||"손님 귀하","","주 소",settings.addr]);
    rows.push(["","","","전화번호",settings.tel,"팩스",settings.fax]);
    rows.push([]);rows.push(["아래와 같이 견적합니다."]);
    rows.push(["합계금액 ₩"+fmt(quote.subtotal)+" 원 + 부가세 ₩"+fmt(quote.vat)+" 원 + 배송비별도","","","","총 합계금액 : ₩"+fmt(quote.total)]);
    rows.push([]);
    rows.push(["재질 및 규격","","","인쇄세부항목"]);
    rows.push(["품 명","디지털책자 통합상품","","종이비","₩"+fmt(quote.lines.find(l=>l.key==="inner")?.total||0)]);
    rows.push(["규격",cfg.format,"","출력비","₩0"]);
    rows.push(["수량",cfg.quantity+" 부 × 1건","","인쇄비","₩"+fmt(quote.lines.find(l=>l.key==="print")?.total||0)]);
    rows.push(["재질(표지)",cfg.coverPaper,"","제본비","₩"+fmt(quote.lines.find(l=>l.key==="binding")?.total||0)]);
    rows.push(["인쇄도수(표지)","전면 : "+cfg.coverSide,"","옵션비","₩"+fmt((quote.lines.find(l=>l.key==="coating")?.total||0)+(quote.lines.filter(l=>l.key==="pp").reduce((s,l)=>s+l.total,0)))]);
    rows.push(["재질(내지1)",cfg.innerPaper,"","주문건수","1건"]);
    rows.push(["인쇄도수(내지1)","전면 : "+cfg.innerSide,"","공급가","₩"+fmt(quote.subtotal)]);
    rows.push(["","","","부가세","₩"+fmt(quote.vat)]);
    rows.push(["","","","정상판매가","₩"+fmt(quote.total)]);
    rows.push(["","","","할인금액","₩0"]);
    rows.push(["","","","결제금액","₩"+fmt(quote.total)]);
    rows.push([]);rows.push(["후가공 세부내역"]);
    rows.push([cfg.postProcessing?.length?cfg.postProcessing.join(", "):"없음"]);
    rows.push([]);
    rows.push(["■ 본 견적의 유효기간은 견적일로부터 15일 입니다."]);
    rows.push(["■ 본 견적에서 배송비는 별도 입니다."]);
    rows.push(["■ 본 견적은 사양과 작업의 난이도에 따라서 가격이 변동이 될 수 있음을 알려드립니다."]);
    const ws=XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"]=[{wch:16},{wch:24},{wch:4},{wch:14},{wch:18},{wch:8},{wch:14}];
    ws["!merges"]=[{s:{r:0,c:0},e:{r:0,c:6}}];
    XLSX.utils.book_append_sheet(wb,ws,"견적서");
    XLSX.writeFile(wb,"BookMoa_견적서_"+(customerName||"고객")+"_"+dateStr(now())+".xlsx");
    setToast("견적서 엑셀 다운로드 완료");
  }catch(e){setToast("다운로드 실패: "+e.message);}};
  const estPrintRef="est-formal-print";
  const sc=[
    <div className="space-y-7" key="s0"><div><label className="block text-sm font-bold text-gray-700 mb-2.5">판형</label><div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">{FORMATS.map(f=><Chip key={f} label={f} sub={DEF_PRICING.formatMap[f]?.desc} active={cfg.format===f} onClick={()=>set("format",f)}/>)}</div></div><div><label className="block text-sm font-bold text-gray-700 mb-2.5">인쇄 방식</label><div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">{PTYPES.map((pt,i)=><Chip key={pt} label={pt} active={cfg.printType===pt} onClick={()=>set("printType",pt)} disabled={!printAvail[i]} sub={!printAvail[i]?"페이지수 부족":null}/>)}</div></div><div className="grid grid-cols-2 gap-5"><div><label className="block text-sm font-bold text-gray-700 mb-2.5">페이지 수</label><input type="number" value={cfg.pages} onChange={e=>set("pages",Math.max(1,parseInt(e.target.value)||1))} className="w-full h-11 px-4 border border-gray-200 rounded-lg font-bold focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-200"/></div><div><label className="block text-sm font-bold text-gray-700 mb-2.5">부수</label><QI value={cfg.quantity} onChange={v=>set("quantity",v)}/></div></div></div>,
    <div className="space-y-7" key="s1">
      <div>
        <label className="block text-sm font-bold text-gray-700 mb-3">내지 종이</label>
        <div className="space-y-4">
          {/* 1단계: 종이 종류 */}
          <div>
            <p className="text-xs font-medium text-gray-400 mb-2">종이 종류</p>
            <div className="flex flex-wrap gap-2">
              {PAPER_TYPES.map(t=>(
                <button key={t}
                  onClick={()=>{const m=(cfg.innerPaper||"").match(/^(.*?)(\d+)$/);if(m?.[1]!==t)set("innerPaper",t+PAPER_TYPE_MAP[t][0]);}}
                  className={cn("px-3.5 py-1.5 rounded-full text-sm font-medium transition-all",
                    innerPaperType===t?"bg-green-600 text-white shadow-sm":"bg-gray-100 text-gray-600 hover:bg-green-50 hover:text-green-700"
                  )}
                >{t}</button>
              ))}
            </div>
          </div>
          {/* 2단계: 평량 */}
          <div>
            <p className="text-xs font-medium text-gray-400 mb-2">평량 (g/㎡)</p>
            <div className="flex flex-wrap gap-2">
              {(PAPER_TYPE_MAP[innerPaperType]||[]).map(w=>{const k=innerPaperType+w;return(
                <button key={w} onClick={()=>set("innerPaper",k)}
                  className={cn("px-3.5 py-1.5 rounded-xl text-sm font-bold border-2 transition-all",
                    cfg.innerPaper===k?"border-green-500 bg-green-50 text-green-800":"border-gray-200 text-gray-500 hover:border-green-300 hover:text-green-700"
                  )}
                >{w}g</button>
              );})}
            </div>
          </div>
          {/* 선택 결과 */}
          <div className="flex items-center gap-2 px-3 py-2 bg-green-50/60 rounded-lg text-sm">
            <span className="text-gray-400 text-xs">선택:</span>
            <span className="font-bold text-green-700">{cfg.innerPaper}</span>
          </div>
        </div>
      </div>
      <div><label className="block text-sm font-bold text-gray-700 mb-2.5">양/단면</label><div className="grid grid-cols-2 gap-2.5">{SIDES.map(s=><Chip key={s} label={s==="양면"?"양면 (앞뒤)":"단면 (한면)"} active={cfg.innerSide===s} onClick={()=>set("innerSide",s)} sub={DEF_PRICING.sideRate[s]+"원/p"}/>)}</div></div>
    </div>,
    <div className="space-y-7" key="s2"><div><label className="block text-sm font-bold text-gray-700 mb-2.5">표지 종이</label><div className="grid grid-cols-2 gap-2.5">{CPAPERS.map(p=><Chip key={p} label={p} active={cfg.coverPaper===p} onClick={()=>set("coverPaper",p)}/>)}</div></div><div><label className="block text-sm font-bold text-gray-700 mb-2.5">표지 인쇄면</label><div className="grid grid-cols-2 gap-2.5">{SIDES.map(s=><Chip key={s} label={s} active={cfg.coverSide===s} onClick={()=>set("coverSide",s)}/>)}</div></div><div><label className="block text-sm font-bold text-gray-700 mb-2.5">코팅</label><div className="grid grid-cols-3 gap-2.5">{COATS.map(c=><Chip key={c} label={c} active={cfg.coating===c} onClick={()=>set("coating",c)}/>)}</div></div></div>,
    <div className="space-y-7" key="s3"><div><label className="block text-sm font-bold text-gray-700 mb-2.5">제본</label><div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">{BINDS.map(b=><Chip key={b} label={b} active={cfg.binding===b} onClick={()=>set("binding",b)}/>)}</div></div><div><label className="block text-sm font-bold text-gray-700 mb-2.5">면지</label><div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">{ENDPS.map(e=><Chip key={e} label={e} active={cfg.endpaper===e} onClick={()=>set("endpaper",e)}/>)}</div></div><div><label className="block text-sm font-bold text-gray-700 mb-2.5">후가공 (복수)</label><div className="grid grid-cols-3 sm:grid-cols-5 gap-2.5">{PPS.map(pp=>(<button key={pp} onClick={()=>togglePP(pp)} className={cn("px-3 py-2.5 rounded-xl border-2 text-sm font-medium",cfg.postProcessing.includes(pp)?"border-green-500 bg-green-50 text-green-800":"border-gray-200 text-gray-600")}>{pp} <span className="text-xs text-gray-400">+₩{fmt(DEF_PRICING.postProc[pp])}</span></button>))}</div></div></div>,
    <div className="space-y-6" key="s4-est">
      {/* Customer Name Input */}
      <div><label className="block text-sm font-bold text-gray-700 mb-2">수신 (고객명)</label>
        <input value={customerName} onChange={e=>setCustomerName(e.target.value)} placeholder="고객명을 입력하세요 (예: 홍길동 님 귀하)" className="w-full h-11 px-4 border border-gray-200 rounded-lg text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-200"/></div>
      {/* Formal Estimate */}
      <div id={estPrintRef} className="border rounded-xl overflow-hidden bg-white">
        <div className="p-6 sm:p-8">
          {/* Title */}
          <h1 className="text-2xl sm:text-3xl font-black text-center mb-1 tracking-[8px]">견 적 서</h1>
          <div className="border-t-2 border-gray-800 mt-4 mb-6"/>
          {/* Header: 견적일/수신 + 공급자 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div><div className="text-xs font-bold mb-2" style={{color:T.sub}}>견적일 및 수신</div>
              <table className="w-full text-sm border"><tbody>
                <tr className="border-b"><td className="px-3 py-2 font-bold bg-gray-50 w-20 text-center border-r">견적일</td><td className="px-3 py-2">{todayKR}</td></tr>
                <tr><td className="px-3 py-2 font-bold bg-gray-50 text-center border-r">수 신</td><td className="px-3 py-2">{customerName||"손님 귀하"}</td></tr>
              </tbody></table></div>
            <div><div className="text-xs font-bold mb-2" style={{color:T.sub}}>공급자</div>
              <table className="w-full text-sm border"><tbody>
                <tr className="border-b"><td className="px-3 py-2 font-bold bg-gray-50 w-16 text-center border-r">상 호</td><td className="px-3 py-2">{settings.bizName}</td><td className="px-3 py-2 font-bold bg-gray-50 w-16 text-center border-r border-l">대표자</td><td className="px-3 py-2">{settings.ceo}</td></tr>
                <tr className="border-b"><td className="px-3 py-2 font-bold bg-gray-50 text-center border-r">주 소</td><td colSpan="3" className="px-3 py-2 text-xs">{settings.addr}</td></tr>
                <tr><td className="px-3 py-2 font-bold bg-gray-50 text-center border-r">전화번호</td><td className="px-3 py-2">{settings.tel}</td><td className="px-3 py-2 font-bold bg-gray-50 text-center border-r border-l">팩 스</td><td className="px-3 py-2">{settings.fax}</td></tr>
              </tbody></table></div>
          </div>
          {/* Summary */}
          <p className="text-sm mb-3" style={{color:T.accent}}>아래와 같이 견적합니다.</p>
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-0 mb-6">
            <div className="sm:col-span-3 border px-4 py-3 text-sm font-medium bg-gray-50 text-center">합계금액 ₩{fmt(quote.subtotal)} 원 + 부가세 ₩{fmt(quote.vat)} 원 + 배송비별도</div>
            <div className="sm:col-span-2 border border-l-0 px-4 py-3 text-sm font-black text-center" style={{background:"#FAFAFA"}}>총 합계금액 : <span style={{color:T.text}}>₩{fmt(quote.total)}</span></div>
          </div>
          {/* Spec + Price Detail Table */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-0 mb-6">
            {/* Left: 재질 및 규격 */}
            <div><div className="text-xs font-bold text-center py-2 text-white" style={{background:T.accent}}>재질 및 규격</div>
              <table className="w-full text-sm border border-t-0"><tbody>
                {[["품 명","디지털책자 통합상품"],["규격",cfg.format],["수량",cfg.quantity+" 부 × 1건"],["재질(표지)",cfg.coverPaper],["인쇄도수(표지)","전면 : "+cfg.coverSide],["재질(내지1)",cfg.innerPaper],["인쇄도수(내지1)","전면 : "+cfg.innerSide]].map(([k,v])=>(
                  <tr key={k} className="border-b"><td className="px-3 py-2 font-bold bg-gray-50 w-28 text-center border-r text-xs">{k}</td><td className="px-3 py-2 text-xs">{v}</td></tr>
                ))}
              </tbody></table></div>
            {/* Right: 인쇄세부항목 */}
            <div><div className="text-xs font-bold text-center py-2 text-white" style={{background:"#555"}}>인쇄세부항목</div>
              <table className="w-full text-sm border border-t-0 border-l-0"><tbody>
                {[["종이비",quote.lines.find(l=>l.key==="inner")?.total||0],["출력비",0],["인쇄비",quote.lines.find(l=>l.key==="print")?.total||0],["제본비",quote.lines.find(l=>l.key==="binding")?.total||0],["옵션비",(quote.lines.find(l=>l.key==="coating")?.total||0)+quote.lines.filter(l=>l.key==="pp").reduce((s,l)=>s+l.total,0)],["주문건수","1건",true],["공급가",quote.subtotal],["부가세",quote.vat],["정상판매가",quote.total],["할인금액",0],["결제금액",quote.total]].map(([k,v,isText])=>(
                  <tr key={k} className="border-b"><td className="px-3 py-2 font-bold bg-gray-50 w-24 text-center border-r text-xs">{k}</td><td className="px-3 py-2 text-xs text-right font-medium">{isText?v:"₩ "+fmt(v)}</td></tr>
                ))}
              </tbody></table></div>
          </div>
          {/* Post Processing */}
          <div className="mb-6"><div className="text-xs font-bold text-center py-2 text-white" style={{background:"#333"}}>후가공 세부내역</div>
            <div className="border border-t-0 p-4 min-h-[48px] text-sm text-gray-500">{cfg.postProcessing?.length?cfg.postProcessing.join(", "):"없음"}</div></div>
          {/* Footnotes */}
          <div className="border rounded-lg p-4 text-xs space-y-1.5" style={{color:T.sub,background:"#FAFAFA"}}>
            <p>■ 본 견적의 유효기간은 견적일로부터 15일 입니다.</p>
            <p>■ 본 견적에서 배송비는 별도 입니다.</p>
            <p>■ 본 견적은 사양과 작업의 난이도에 따라서 가격이 변동이 될 수 있음을 알려드립니다.</p>
          </div>
        </div>
      </div>
      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3 justify-center">
        <button onClick={()=>{const el=document.getElementById(estPrintRef);if(el){const w=window.open("","_blank");w.document.write("<html><head><title>견적서</title><style>body{font-family:'Noto Sans KR',sans-serif;margin:20px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ddd;padding:6px 10px}@media print{button{display:none!important}}</style></head><body>"+el.innerHTML+"</body></html>");w.document.close();w.print();}}} className="px-6 py-3 rounded-lg font-bold text-white flex items-center gap-2" style={{background:"#c0392b"}}>{II.print(16)} 견적서 인쇄</button>
        <button onClick={handleEstExcel} className="px-6 py-3 rounded-lg font-bold border-2 flex items-center gap-2" style={{borderColor:T.border,color:T.text}}>{II.down(16)} 엑셀 저장하기</button>
      </div>
    </div>,
    <div className="space-y-6" key="s5"><div className={cn("border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors",dragOver?"border-green-500 bg-green-50":"border-gray-300 hover:border-green-400")} onClick={()=>document.getElementById("fu")?.click()} onDragOver={e=>{e.preventDefault();setDragOver(true);}} onDragLeave={()=>setDragOver(false)} onDrop={handleDrop}>{II.up(40,cn("mx-auto mb-3",dragOver?"text-green-500":"text-gray-300"))}<p className="font-bold text-gray-600 mb-1">{dragOver?"여기에 놓으세요!":"파일 드래그 또는 클릭"}</p><p className="text-sm text-gray-400">PDF, JPG, PNG, AI, EPS, INDD (최대 100MB)</p><input id="fu" type="file" multiple className="hidden" onChange={e=>setFiles(p=>[...p,...Array.from(e.target.files||[])])}/></div>{files.length>0&&<div className="text-xs text-gray-400 font-medium">{files.length}개 파일 ({(files.reduce((s,f)=>s+f.size,0)/1024/1024).toFixed(1)} MB)</div>}{files.map((f,i)=>(<div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl"><div className="flex items-center gap-3"><span className="text-2xl">{fileIcon(f.name)}</span><div><div className="font-medium text-sm">{f.name}</div><div className="text-xs text-gray-400">{(f.size/1024/1024).toFixed(1)} MB</div></div></div><button onClick={()=>setFiles(p=>p.filter((_,j)=>j!==i))} className="text-gray-400 hover:text-red-500">{II.x(16)}</button></div>))}</div>,
  ];

  return(<div className="min-h-screen" style={{background:T.warm}}>
    <div className="bg-white border-b sticky top-0 z-40"><div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
      <button onClick={()=>go("home")} className="flex items-center gap-1.5 text-gray-500 text-sm">{II.back(18)} 돌아가기</button>
      <h1 className="font-black text-lg" style={{color:T.accent}}>견적 & 주문</h1>
      <div className="hidden sm:flex items-center gap-2">
        <button onClick={()=>setShowSaved(!showSaved)} className="flex items-center gap-1 text-sm text-gray-500 hover:text-green-600">{II.save(16)} 즐겨찾기{savedCfgs.length>0&&<span className="text-xs">({savedCfgs.length})</span>}</button>
        <button onClick={()=>setShowEstimate(true)} className="flex items-center gap-1 text-sm text-gray-500 hover:text-green-600">{II.print(16)} 견적서</button>
        <button onClick={handleCompare} className="flex items-center gap-1 text-sm text-gray-500 hover:text-green-600">{II.compare(16)} 비교</button>
      </div>
    </div></div>
    <div className="bg-white border-b"><div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex gap-1.5 overflow-x-auto">{stps.map((s,i)=>(<button key={i} onClick={()=>setStep(i)} className={cn("px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap",i===step?"text-white shadow":i<step?"bg-green-50 text-green-700":"bg-gray-100 text-gray-500")} style={i===step?{background:T.accent}:{}}>{i<step?"✓ ":""}{s.t}</button>))}</div></div>
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 pb-28 lg:pb-6"><div className="grid lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2"><div className="bg-white rounded-xl shadow-sm p-5 sm:p-7"><h2 className="text-xl font-black mb-1">{stps[step].t}</h2><p className="text-gray-500 text-sm mb-6">{stps[step].s}</p>{sc[step]}
        <div className="flex justify-between mt-8 pt-5 border-t"><button onClick={()=>setStep(Math.max(0,step-1))} disabled={step===0} className="px-5 py-2.5 rounded-xl font-bold text-gray-500 border-2 border-gray-200 disabled:opacity-30 text-sm">← 이전</button>{step<stps.length-1?<button onClick={()=>setStep(step+1)} className="px-5 py-2.5 rounded-xl font-bold text-white text-sm hover:scale-105 transition-transform" style={{background:T.accent}}>다음 →</button>:<button onClick={handleAdd} className="px-6 py-2.5 rounded-xl font-bold text-white text-sm hover:scale-105 transition-transform" style={{background:T.accent}}>🛒 장바구니 담기</button>}</div></div></div>
      {/* Sidebar */}
      <div className="hidden lg:block"><div className="sticky top-20"><div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="p-5 text-white" style={{background:T.dark}}><div className="text-xs text-gray-400 mb-1">예상 견적</div><div className="text-3xl font-black" style={{color:T.accent}}>₩ {fmt(quote.total)}</div><div className="text-xs text-gray-500 mt-0.5">VAT 포함</div></div>
        <div className="p-5 space-y-2"><div className="text-xs font-bold text-gray-400 mb-2">가격 상세</div>{quote.lines.map((l,i)=>(<div key={i} className="flex justify-between text-sm"><span className="text-gray-500 truncate max-w-[120px]">{l.label}</span><span className="font-medium">₩{fmt(l.total)}</span></div>))}
        <div className="border-t pt-2 mt-2 space-y-1"><div className="flex justify-between text-sm"><span className="text-gray-500">1부 단가</span><span className="font-bold">₩{fmt(quote.unitPrice)}</span></div><div className="flex justify-between text-sm"><span className="text-gray-500">소계 ({cfg.quantity}부)</span><span>₩{fmt(quote.subtotal)}</span></div><div className="flex justify-between text-sm"><span className="text-gray-500">부가세</span><span>₩{fmt(quote.vat)}</span></div></div>
        <div className="border-t pt-3 flex justify-between"><span className="font-bold">합계</span><span className="font-black text-xl" style={{color:T.accent}}>₩{fmt(quote.total)}</span></div></div>
        <div className="px-5 pb-5"><div className="p-3.5 bg-gray-50 rounded-xl space-y-1"><div className="text-xs font-bold text-gray-400 mb-1">사양</div>{[["판형",cfg.format],["인쇄",cfg.printType],["내지",cfg.innerPaper+"("+cfg.innerSide+")"],["표지",cfg.coverPaper],["코팅",cfg.coating],["제본",cfg.binding],["면지",cfg.endpaper],["페이지",cfg.pages+"p"],["부수",cfg.quantity+"부"]].map(([k,v])=>(<div key={k} className="flex justify-between text-xs"><span className="text-gray-400">{k}</span><span className="text-gray-700 font-medium">{v}</span></div>))}</div></div>
      </div></div></div>
    </div></div>
    {/* Mobile bottom bar */}
    <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t shadow-xl z-40">
      {mobPrice&&<div className="p-4 border-b bg-gray-50 max-h-52 overflow-y-auto">{quote.lines.map((l,i)=>(<div key={i} className="flex justify-between text-xs py-0.5"><span className="text-gray-500">{l.label}</span><span className="font-medium">₩{fmt(l.total)}</span></div>))}</div>}
      <div className="px-4 py-3 flex items-center justify-between"><button onClick={()=>setMobPrice(!mobPrice)} className="text-left"><div className="text-xs text-gray-400">합계 (VAT)</div><div className="text-xl font-black" style={{color:T.accent}}>₩ {fmt(quote.total)}</div></button><button onClick={handleAdd} className="px-5 py-2.5 rounded-xl font-bold text-white text-sm" style={{background:T.accent}}>담기</button></div>
    </div>
    {/* Saved Configs Panel (Phase 5) */}
    {showSaved&&<div className="fixed inset-0 z-[200] flex items-start justify-end" onClick={()=>setShowSaved(false)}><div className="absolute inset-0 bg-black/30 backdrop-blur-sm"/><div className="relative bg-white w-full max-w-sm h-full shadow-2xl overflow-y-auto" onClick={e=>e.stopPropagation()}>
      <div className="sticky top-0 bg-white border-b px-5 py-4 flex items-center justify-between z-10"><h3 className="font-bold text-lg">즐겨찾기 사양</h3><button onClick={()=>setShowSaved(false)}>{II.x(20,"text-gray-400")}</button></div>
      <div className="p-5 space-y-4">
        <div className="p-4 bg-green-50 rounded-xl border border-green-200"><p className="text-sm font-bold text-green-800 mb-2">현재 사양 저장하기</p><div className="flex gap-2"><input placeholder="이름 (선택)" value={saveName} onChange={e=>setSaveName(e.target.value)} className="flex-1 h-9 px-3 border-2 border-green-200 rounded-lg text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-200"/><button onClick={handleSaveCfg} className="px-4 h-9 rounded-lg font-bold text-white text-sm" style={{background:T.accent}}>저장</button></div></div>
        {!savedCfgs.length&&<div className="text-center py-8 text-gray-400 text-sm">저장된 사양이 없습니다</div>}
        {savedCfgs.map(sc=>(<div key={sc.id} className="p-4 bg-gray-50 rounded-xl"><div className="flex justify-between items-start mb-2"><div><div className="font-bold text-sm">{sc.name}</div><div className="text-[10px] text-gray-400">{dateStr(sc.date)}</div></div><button onClick={()=>removeSavedCfg(sc.id)} className="text-gray-300 hover:text-red-500">{II.x(14)}</button></div><div className="grid grid-cols-3 gap-1 text-[10px] text-gray-500 mb-2">{[sc.cfg.format,sc.cfg.printType,sc.cfg.innerPaper,sc.cfg.coating,sc.cfg.binding,sc.cfg.pages+"p"].map((v,i)=><span key={i} className="bg-white px-1.5 py-0.5 rounded text-center">{v}</span>)}</div><button onClick={()=>loadSaved(sc)} className="w-full py-2 rounded-lg text-xs font-bold text-green-700 bg-green-100 hover:bg-green-200">불러오기</button></div>))}
      </div>
    </div></div>}
    {/* Estimate Modal (Phase 3: printable quote) */}
    {showEstimate&&<EstimateModal cfg={cfg} quote={quote} onClose={()=>setShowEstimate(false)}/>}
    {toast&&<Toast msg={toast} onClose={()=>setToast(null)}/>}
  </div>);
}

// ═══════════════════════════════════════════════════
// ESTIMATE / QUOTE PDF MODAL (Phase 3)
// ═══════════════════════════════════════════════════
function EstimateModal({cfg,quote,onClose}){
  const{settings}=useApp();
  const today=new Date().toLocaleDateString("ko-KR");
  const estNo="EST-"+new Date().getFullYear()+"-"+String(Math.floor(Math.random()*9999)).padStart(4,"0");
  return(<div className="fixed inset-0 z-[200] flex items-center justify-center p-4" onClick={onClose}><div className="absolute inset-0 bg-black/50 backdrop-blur-sm"/>
    <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-auto" onClick={e=>e.stopPropagation()}>
      <div className="sticky top-0 z-10 bg-white border-b px-6 py-4 flex items-center justify-between no-print"><h3 className="font-bold text-lg">견적서</h3><div className="flex items-center gap-2"><button onClick={()=>window.print()} className="px-3 py-1.5 text-white rounded-lg text-xs font-bold flex items-center gap-1" style={{background:T.accent}}>{II.print(14)} 인쇄/PDF</button><button onClick={onClose}>{II.x(20,"text-gray-400")}</button></div></div>
      <div className="p-8" id="estimate-print">
        <div className="flex justify-between items-start mb-8"><div><h1 className="text-2xl font-black" style={{color:T.accent}}>견 적 서</h1><p className="text-sm text-gray-500 mt-1">Estimate #{estNo}</p></div><div className="text-right"><div className="text-lg font-black" style={{color:T.accent}}>북모아</div><p className="text-xs text-gray-400">{settings.bizName} 대표 {settings.ceo}</p><p className="text-xs text-gray-400">{settings.tel} / FAX {settings.fax}</p><p className="text-xs text-gray-400">발행일: {today}</p></div></div>
        <div className="border-t-2 border-gray-900 mb-6"/>
        <h3 className="font-bold text-sm text-gray-900 mb-3">{cfg.productId?"상품 옵션":"인쇄 사양"}</h3>
        <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm mb-6">
          {cfg.productId?([["상품명",cfg.productName],["부수",cfg.quantity+"부"],...Object.entries(cfg.selLabels||{}).map(([k,v])=>[k,v])].map(([k,v])=>(
            <div key={k} className="flex justify-between py-1 border-b border-gray-100"><span className="text-gray-500">{k}</span><span className="font-medium">{v}</span></div>
          ))):(
          [["판형",cfg.format],["인쇄방식",cfg.printType],["내지종이",cfg.innerPaper],["양/단면",cfg.innerSide],["표지종이",cfg.coverPaper],["표지인쇄",cfg.coverSide],["코팅",cfg.coating],["제본",cfg.binding],["면지",cfg.endpaper],["페이지",cfg.pages+"p"],["부수",cfg.quantity+"부"],["후가공",cfg.postProcessing?.length?cfg.postProcessing.join(", "):"없음"]].map(([k,v])=>(
            <div key={k} className="flex justify-between py-1 border-b border-gray-100"><span className="text-gray-500">{k}</span><span className="font-medium">{v}</span></div>
          )))}
        </div>
        <h3 className="font-bold text-sm text-gray-900 mb-3">가격 명세</h3>
        <table className="w-full text-sm mb-6"><thead><tr className="bg-gray-50"><th className="px-3 py-2 text-left text-xs font-bold">항목</th><th className="px-3 py-2 text-right text-xs font-bold">단가</th><th className="px-3 py-2 text-right text-xs font-bold">수량</th><th className="px-3 py-2 text-right text-xs font-bold">소계</th></tr></thead><tbody>
          {quote.lines.map((l,i)=>(<tr key={i} className="border-b"><td className="px-3 py-2 text-xs">{l.label}</td><td className="px-3 py-2 text-right text-xs">₩{fmt(l.unit)}</td><td className="px-3 py-2 text-right text-xs">{l.qty}</td><td className="px-3 py-2 text-right text-xs font-medium">₩{fmt(l.total)}</td></tr>))}
        </tbody></table>
        <div className="border-t-2 border-gray-900 pt-4 space-y-1">
          <div className="flex justify-between text-sm"><span>1부 단가</span><span className="font-bold">₩{fmt(quote.unitPrice)}</span></div>
          <div className="flex justify-between text-sm"><span>공급가액 ({cfg.quantity}부)</span><span className="font-bold">₩{fmt(quote.subtotal)}</span></div>
          <div className="flex justify-between text-sm"><span>부가세 ({settings.taxRate||10}%)</span><span>₩{fmt(quote.vat)}</span></div>
          <div className="flex justify-between text-lg font-black pt-2 border-t"><span>합계</span><span style={{color:T.accent}}>₩{fmt(quote.total)}</span></div>
        </div>
        <div className="mt-8 p-4 bg-gray-50 rounded-xl text-xs text-gray-500"><p>※ 본 견적서는 발행일 기준 유효하며, 가격은 사양 변경 시 달라질 수 있습니다.</p><p>※ 납기: 입금 확인 후 영업일 기준 {settings.deliveryDays||"3~5"}일</p>{settings.memo&&<p>※ {settings.memo}</p>}<p>※ 문의: {settings.tel} / FAX {settings.fax} / {settings.email}</p></div>
      </div>
    </div>
  </div>);
}

// ═══════════════════════════════════════════════════
// CART
// ═══════════════════════════════════════════════════
function Cart(){const{go,cart,removeCart,updateCartItem,customProducts}=useApp();const total=cart.reduce((s,i)=>s+i.quote.total,0);
const updateQty=(id,newQty)=>{const item=cart.find(i=>i.id===id);if(!item)return;const newCfg={...item.cfg,quantity:newQty};let newQuote;if(item.isCustom){const prod=customProducts.find(p=>p.id===item.cfg.productId);newQuote=calcCustomQuote(prod,item.cfg.selections,newQty);}else{newQuote=calcQuote(newCfg);}updateCartItem(id,{cfg:newCfg,quote:newQuote});};
const itemLabel=(item)=>{if(item.isCustom){const labels=item.cfg.selLabels?Object.values(item.cfg.selLabels).join(" / "):"";return{title:item.cfg.productName||"커스텀 상품",sub:labels,pages:"-"};}return{title:"인쇄물",sub:item.cfg.format+"/"+item.cfg.printType+"/"+item.cfg.innerPaper+"/"+item.cfg.binding,pages:item.cfg.pages+"p"};};
if(!cart.length)return(<div className="min-h-screen flex items-center justify-center pt-16"><div className="text-center"><div className="text-6xl mb-4">🛒</div><h2 className="text-2xl font-bold mb-2">장바구니가 비어있습니다</h2><div className="flex gap-3 mt-4"><button onClick={()=>go("configure")} className="px-6 py-3 rounded-xl font-bold text-white" style={{background:T.accent}}>도서 견적</button><button onClick={()=>go("products")} className="px-6 py-3 rounded-xl font-bold border-2 border-gray-200">상품 둘러보기</button></div></div></div>);
return(<div className="min-h-screen" style={{background:T.warm}}><div className="bg-white border-b"><div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between"><button onClick={()=>go("home")} className="flex items-center gap-1 text-gray-500 text-sm">{II.back(18)} 홈</button><h1 className="font-black text-lg" style={{color:T.accent}}>장바구니 ({cart.length})</h1><div className="w-16"/></div></div>
<div className="max-w-5xl mx-auto px-4 py-6"><div className="grid lg:grid-cols-3 gap-6"><div className="lg:col-span-2 space-y-3">{cart.map((item,i)=>{const lb=itemLabel(item);return(<div key={item.id} className="bg-white rounded-xl shadow-sm p-5"><div className="flex justify-between items-start mb-3"><div><h3 className="font-bold">{item.isCustom&&<span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded mr-1.5">커스텀</span>}{lb.title} #{i+1}</h3><p className="text-xs text-gray-500 mt-0.5">{lb.sub}</p></div><button onClick={()=>removeCart(item.id)} className="text-gray-400 hover:text-red-500">{II.trash(16)}</button></div><div className="grid grid-cols-3 gap-3 text-sm">{!item.isCustom&&<div><span className="text-gray-400 text-xs">페이지</span><div className="font-bold">{lb.pages}</div></div>}{item.isCustom&&<div><span className="text-gray-400 text-xs">상품</span><div className="font-bold text-xs">{item.cfg.productName}</div></div>}<div><span className="text-gray-400 text-xs">부수</span><div className="mt-0.5"><QI value={item.cfg.quantity} onChange={v=>updateQty(item.id,v)} min={1} max={99999}/></div></div><div className="text-right"><span className="text-gray-400 text-xs">금액</span><div className="font-bold text-lg" style={{color:T.accent}}>₩{fmt(item.quote.total)}</div><div className="text-[10px] text-gray-400">단가 ₩{fmt(item.quote.unitPrice)}</div></div></div></div>);})}</div>
<div><div className="bg-white rounded-xl shadow-sm p-5 sticky top-20"><h3 className="font-bold text-lg mb-4">주문 요약</h3>{cart.map((item,i)=><div key={item.id} className="flex justify-between text-sm py-1"><span className="text-gray-500 truncate mr-2">#{i+1} {item.isCustom?item.cfg.productName:item.cfg.format}</span><span className="font-medium shrink-0">₩{fmt(item.quote.total)}</span></div>)}<div className="border-t mt-3 pt-4"><div className="flex justify-between mb-5"><span className="font-bold text-lg">합계</span><span className="font-black text-2xl" style={{color:T.accent}}>₩{fmt(total)}</span></div><button onClick={()=>go("checkout")} className="w-full py-3.5 rounded-xl font-bold text-white text-lg" style={{background:T.accent}}>결제하기</button></div></div></div></div></div></div>);}

// ═══════════════════════════════════════════════════
// CHECKOUT / ORDER DONE
// ═══════════════════════════════════════════════════
function Checkout(){const{go,cart,clearCart,addOrder,addNotif}=useApp();const total=cart.reduce((s,i)=>s+i.quote.total,0);const[pay,setPay]=useState("card");const[form,setForm]=useState({name:"",phone:"",email:"",addr:"",detail:""});const[err,setErr]=useState({});
const validate=()=>{const e={};if(!form.name.trim())e.name=true;if(!form.phone.trim())e.phone=true;if(!form.addr.trim())e.addr=true;setErr(e);return !Object.keys(e).length;};
const submit=()=>{if(!validate())return;const oid="ORD-"+new Date().getFullYear()+"-"+String(Math.floor(Math.random()*9999)).padStart(4,"0");const order={id:oid,date:now(),status:0,items:cart.map(c=>({cfg:{...c.cfg},quote:c.quote,isCustom:!!c.isCustom})),total,customer:{...form},payment:pay,history:[{status:0,date:now(),note:"주문 접수"}]};addOrder(order);addNotif({icon:"📋",title:"주문 접수",body:oid+" 주문이 접수되었습니다",date:now()});clearCart();go("orderDone");};
return(<div className="min-h-screen" style={{background:T.warm}}><div className="bg-white border-b"><div className="max-w-3xl mx-auto px-4 h-14 flex items-center"><button onClick={()=>go("cart")} className="flex items-center gap-1 text-gray-500 text-sm">{II.back(18)} 장바구니</button><h1 className="ml-auto font-black text-lg" style={{color:T.accent}}>결제</h1><div className="ml-auto w-20"/></div></div>
<div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
<div className="bg-white rounded-xl shadow-sm p-5"><h3 className="font-bold mb-4">배송 정보</h3><div className="grid grid-cols-2 gap-3">{[["name","이름 *","col-span-1"],["phone","연락처 *","col-span-1"],["email","이메일","col-span-2"],["addr","주소 *","col-span-2"],["detail","상세주소","col-span-2"]].map(([k,ph,sp])=>(<input key={k} placeholder={ph} value={form[k]} onChange={e=>setForm(p=>({...p,[k]:e.target.value}))} className={cn(sp,"h-11 px-4 border-2 rounded-xl focus:outline-none",err[k]?"border-red-400":"border-gray-200 focus:border-green-500")}/>))}</div></div>
<div className="bg-white rounded-xl shadow-sm p-5"><h3 className="font-bold mb-4">결제 수단</h3><div className="grid grid-cols-4 gap-2.5">{[["card","신용카드","💳"],["bank","계좌이체","🏦"],["vbank","가상계좌","📋"],["phone","휴대폰","📱"]].map(([id,l,ic])=>(<button key={id} onClick={()=>setPay(id)} className={cn("p-3 rounded-xl border-2 text-center",pay===id?"border-green-500 bg-green-50":"border-gray-200")}><div className="text-2xl mb-0.5">{ic}</div><div className="text-xs font-bold">{l}</div></button>))}</div></div>
<div className="bg-white rounded-xl shadow-sm p-5"><div className="flex justify-between items-center mb-4"><span className="text-lg font-bold">총 결제</span><span className="text-3xl font-black" style={{color:T.accent}}>₩{fmt(total)}</span></div><button onClick={submit} className="w-full py-3.5 rounded-xl font-bold text-white text-lg" style={{background:T.accent}}>결제 완료</button></div>
</div></div>);}

function OrderDone(){const{go,orders}=useApp();const last=orders[orders.length-1];return(<div className="min-h-screen flex items-center justify-center"><div className="text-center bg-white rounded-xl shadow-lg p-10 max-w-sm w-full"><div className="text-6xl mb-5">🎉</div><h2 className="text-2xl font-black mb-2">주문 완료!</h2><p className="text-gray-500 mb-1">주문번호: <span className="font-bold">{last?.id}</span></p><p className="text-gray-400 text-sm mb-7">'내 주문'에서 진행 상황 확인</p><div className="flex gap-3"><button onClick={()=>go("orders")} className="flex-1 py-2.5 rounded-xl font-bold border-2 border-gray-200 text-sm">주문 확인</button><button onClick={()=>go("home")} className="flex-1 py-2.5 rounded-xl font-bold text-white text-sm" style={{background:T.accent}}>홈으로</button></div></div></div>);}

// ═══════════════════════════════════════════════════
// ORDERS PAGE
// ═══════════════════════════════════════════════════
function Orders(){const{go,orders,addToCart,addNotif,customProducts}=useApp();const[sel,setSel]=useState(null);const[toast,setToast]=useState(null);const[showReceipt,setShowReceipt]=useState(null);
const reorder=(o)=>{o.items?.forEach(item=>{let q;if(item.isCustom||item.cfg?.productId){const prod=customProducts.find(p=>p.id===item.cfg.productId);q=calcCustomQuote(prod,item.cfg.selections,item.cfg.quantity);addToCart({id:uid(),cfg:{...item.cfg},quote:q,files:[],isCustom:true});}else{q=calcQuote(item.cfg);addToCart({id:uid(),cfg:{...item.cfg},quote:q,files:[]});}});addNotif({icon:"🔄",title:"재주문",body:o.id+" 상품이 장바구니에 담겼습니다",date:now()});setToast("장바구니에 담겼습니다");setTimeout(()=>go("cart"),1000);};
const itemDesc=(item)=>{if(item.isCustom||item.cfg?.productId){const labels=item.cfg.selLabels?Object.entries(item.cfg.selLabels).map(([k,v])=>v).join("/"):"";return{name:item.cfg.productName||"커스텀",spec:labels,pages:"",qty:item.cfg.quantity+"부"};}return{name:item.cfg.format+"/"+item.cfg.printType+"/"+item.cfg.innerPaper,spec:"",pages:item.cfg.pages+"p",qty:item.cfg.quantity+"부"};};
if(sel!==null){const o=orders[sel];if(!o){setSel(null);return null;}return(<div className="min-h-screen" style={{background:T.warm}}><div className="bg-white border-b"><div className="max-w-3xl mx-auto px-4 h-14 flex items-center"><button onClick={()=>setSel(null)} className="flex items-center gap-1 text-gray-500 text-sm">{II.back(18)} 목록</button></div></div><div className="max-w-3xl mx-auto px-4 py-6"><div className="bg-white rounded-xl shadow-sm p-6"><div className="flex justify-between items-start mb-6"><div><h2 className="text-xl font-black">{o.id}</h2><p className="text-gray-400 text-sm">{dateStr(o.date)}</p></div><div className="text-2xl font-black" style={{color:T.accent}}>₩{fmt(o.total)}</div></div>{o.items?.map((item,i)=>{const d=itemDesc(item);return(<div key={i} className="p-3 bg-gray-50 rounded-xl mb-2 text-sm">{(item.isCustom||item.cfg?.productId)&&<span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded mr-1">커스텀</span>}<div className="font-bold">#{i+1}: {d.name}</div>{d.spec&&<div className="text-gray-400 text-xs">{d.spec}</div>}<div className="text-gray-500">{d.pages?d.pages+" × ":""}{d.qty} = ₩{fmt(item.quote.total)}</div></div>);})}<h3 className="font-bold text-lg mt-6 mb-4">제작 공정</h3>{STS.map((s,i)=>(<div key={s.key} className="flex items-start gap-3 mb-4"><div className="flex flex-col items-center"><div className={cn("w-9 h-9 rounded-full flex items-center justify-center text-sm z-10",i<=o.status?"bg-green-100":"bg-gray-100")}>{i<o.status?"✅":s.icon}</div>{i<STS.length-1&&<div className={cn("w-0.5 h-6 mt-0.5",i<o.status?"bg-green-300":"bg-gray-200")}/>}</div><div className="pt-1.5"><div className={cn("font-bold text-sm",i<=o.status?"text-gray-900":"text-gray-400")}>{s.label}</div>{i===o.status&&<div className="text-xs text-green-600 font-medium">진행 중</div>}</div></div>))}{o.history?.length>0&&<div className="mt-6 pt-4 border-t"><h4 className="font-bold text-sm mb-2">이력</h4>{o.history.map((h,i)=><div key={i} className="text-xs text-gray-500 py-0.5">{dateStr(h.date)} — {h.note}</div>)}</div>}<div className="mt-6 pt-4 border-t flex gap-2"><button onClick={()=>reorder(o)} className="flex-1 py-2.5 rounded-xl font-bold text-sm border-2 border-green-500 text-green-700 hover:bg-green-50">🔄 재주문</button><button onClick={()=>setShowReceipt(o)} className="flex-1 py-2.5 rounded-xl font-bold text-sm border-2 border-gray-200 text-gray-600 hover:bg-gray-50">🧾 주문확인서</button></div></div></div></div>);}
return(<div className="min-h-screen" style={{background:T.warm}}><div className="bg-white border-b"><div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between"><button onClick={()=>go("home")} className="flex items-center gap-1 text-gray-500 text-sm">{II.back(18)} 홈</button><h1 className="font-black text-lg" style={{color:T.accent}}>내 주문 ({orders.length})</h1><div className="w-16"/></div></div><div className="max-w-3xl mx-auto px-4 py-6 space-y-3">{!orders.length&&<div className="text-center py-20 text-gray-400">주문 내역이 없습니다</div>}{orders.map((o,i)=>(<button key={o.id} onClick={()=>setSel(i)} className="w-full bg-white rounded-xl shadow-sm p-5 text-left hover:shadow-md transition-all"><div className="flex justify-between items-start mb-2"><div><span className="font-bold">{o.id}</span><span className="text-gray-400 text-sm ml-2">{dateStr(o.date)}</span></div><Badge color={o.status>=6?"green":"amber"}>{STS[o.status]?.label}</Badge></div>{o.items?.map((item,j)=>{const d=itemDesc(item);return <p key={j} className="text-xs text-gray-500">{(item.isCustom||item.cfg?.productId)?"🏷️ ":""}{d.name} {d.pages?d.pages+"×":"×"}{d.qty}</p>;})}<div className="flex justify-between items-center mt-2"><span className="text-xs text-gray-400">{o.items?.length}건</span><span className="font-bold text-lg" style={{color:T.accent}}>₩{fmt(o.total)}</span></div></button>))}</div>{showReceipt&&<ReceiptModal order={showReceipt} onClose={()=>setShowReceipt(null)}/>}{toast&&<Toast msg={toast} onClose={()=>setToast(null)}/>}</div>);}

// ═══════════════════════════════════════════════════
// ORDER RECEIPT MODAL (Phase 5)
// ═══════════════════════════════════════════════════
function ReceiptModal({order,onClose}){
  const{settings}=useApp();const o=order;
  return(<div className="fixed inset-0 z-[200] flex items-center justify-center p-4" onClick={onClose}><div className="absolute inset-0 bg-black/50 backdrop-blur-sm"/>
    <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-auto" onClick={e=>e.stopPropagation()}>
      <div className="sticky top-0 z-10 bg-white border-b px-6 py-4 flex items-center justify-between no-print"><h3 className="font-bold text-lg">주문 확인서</h3><div className="flex items-center gap-2"><button onClick={()=>window.print()} className="px-3 py-1.5 text-white rounded-lg text-xs font-bold flex items-center gap-1" style={{background:T.accent}}>{II.print(14)} 인쇄</button><button onClick={onClose}>{II.x(20,"text-gray-400")}</button></div></div>
      <div className="p-8">
        <div className="flex justify-between items-start mb-6"><div><h1 className="text-2xl font-black" style={{color:T.accent}}>주문 확인서</h1><p className="text-sm text-gray-500 mt-1">Order #{o.id}</p></div><div className="text-right"><div className="text-lg font-black" style={{color:T.accent}}>북모아</div><p className="text-xs text-gray-400">{settings.bizName} 대표 {settings.ceo}</p><p className="text-xs text-gray-400">{settings.tel} / FAX {settings.fax}</p></div></div>
        <div className="border-t-2 border-gray-900 mb-6"/>
        <div className="grid grid-cols-2 gap-4 text-sm mb-6">
          <div><span className="text-gray-500">주문일</span><div className="font-medium">{dateStr(o.date)}</div></div>
          <div><span className="text-gray-500">결제</span><div className="font-medium">{{card:"신용카드",bank:"계좌이체",vbank:"가상계좌",phone:"휴대폰결제"}[o.payment]||o.payment}</div></div>
          <div><span className="text-gray-500">고객명</span><div className="font-medium">{o.customer?.name||"-"}</div></div>
          <div><span className="text-gray-500">연락처</span><div className="font-medium">{o.customer?.phone||"-"}</div></div>
          <div className="col-span-2"><span className="text-gray-500">배송지</span><div className="font-medium">{o.customer?.addr} {o.customer?.detail}</div></div>
        </div>
        <h3 className="font-bold text-sm mb-3">주문 상품</h3>
        <table className="w-full text-sm mb-6"><thead><tr className="bg-gray-50"><th className="px-3 py-2 text-left text-xs font-bold">#</th><th className="px-3 py-2 text-left text-xs font-bold">사양</th><th className="px-3 py-2 text-right text-xs font-bold">수량</th><th className="px-3 py-2 text-right text-xs font-bold">금액</th></tr></thead><tbody>
          {o.items?.map((item,i)=>{const isCust=item.isCustom||item.cfg?.productId;const spec=isCust?(item.cfg.productName+(item.cfg.selLabels?" — "+Object.values(item.cfg.selLabels).join(", "):"")):(item.cfg.format+"/"+item.cfg.printType+"/"+item.cfg.innerPaper+"/"+item.cfg.binding+" "+item.cfg.pages+"p");return(<tr key={i} className="border-b"><td className="px-3 py-2 text-xs">{i+1}</td><td className="px-3 py-2 text-xs">{isCust&&<span className="bg-blue-100 text-blue-700 px-1 py-0.5 rounded text-[10px] mr-1">커스텀</span>}{spec}</td><td className="px-3 py-2 text-right text-xs">{item.cfg.quantity}부</td><td className="px-3 py-2 text-right text-xs font-medium">₩{fmt(item.quote.total)}</td></tr>);})}
        </tbody></table>
        <div className="border-t-2 border-gray-900 pt-4"><div className="flex justify-between text-lg font-black"><span>합계</span><span style={{color:T.accent}}>₩{fmt(o.total)}</span></div></div>
        <div className="mt-6 p-4 bg-gray-50 rounded-xl text-xs text-gray-500"><p>※ 현재 상태: {STS[o.status]?.icon} {STS[o.status]?.label}</p><p>※ 예상 납기: 입금 확인 후 영업일 기준 {settings.deliveryDays||"3~5"}일</p><p>※ 문의: {settings.tel} / FAX {settings.fax} / {settings.email}</p></div>
      </div>
    </div>
  </div>);
}

// ═══════════════════════════════════════════════════
// ADMIN (Phase 3: Dashboard + Price History + Enhanced)
// ═══════════════════════════════════════════════════
function AdminLogin(){
  const{setSession}=useApp();
  const[email,setEmail]=useState("admin@bookmoa.com");
  const[pw,setPw]=useState("");
  const[err,setErr]=useState("");
  const[loading,setLoading]=useState(false);
  const handleLogin=async(e)=>{
    e.preventDefault();setErr("");setLoading(true);
    if(!supabase){setErr("Supabase가 설정되지 않았습니다.");setLoading(false);return;}
    const{data,error}=await supabase.auth.signInWithPassword({email,password:pw});
    if(error)setErr("이메일 또는 비밀번호가 올바르지 않습니다.");
    else setSession(data.session);
    setLoading(false);
  };
  return(<div className="min-h-screen flex items-center justify-center" style={{background:T.warm}}>
    <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-sm">
      <div className="text-center mb-8">
        <div className="text-3xl font-black mb-1" style={{color:T.accent}}>북모아</div>
        <div className="text-gray-400 text-sm font-medium">Admin Console</div>
      </div>
      <form onSubmit={handleLogin} className="space-y-4">
        <div><label className="block text-xs font-bold text-gray-500 mb-1">이메일</label>
          <input type="email" value={email} onChange={e=>setEmail(e.target.value)} required
            className="w-full h-11 px-4 border-2 border-gray-200 rounded-xl text-sm focus:border-green-500 focus:outline-none"/></div>
        <div><label className="block text-xs font-bold text-gray-500 mb-1">비밀번호</label>
          <input type="password" value={pw} onChange={e=>setPw(e.target.value)} required
            className="w-full h-11 px-4 border-2 border-gray-200 rounded-xl text-sm focus:border-green-500 focus:outline-none"/></div>
        {err&&<p className="text-red-500 text-xs text-center font-medium">{err}</p>}
        <button type="submit" disabled={loading} className="w-full h-11 rounded-xl font-bold text-white text-sm disabled:opacity-60" style={{background:T.accent}}>
          {loading?"로그인 중...":"로그인"}
        </button>
      </form>
    </div>
  </div>);
}

function Admin(){
  const{go,pricing,setPricing,orders,addOrder,updateOrderStatus,priceHistory,addPriceHistory,addNotif,settings,setSettings,resetOrders,resetNotifs,customProducts,addProduct,updateProduct,removeProduct,session,setSession}=useApp();
  const[tab,setTab]=useState("dashboard");const[editMode,setEditMode]=useState(false);const[toast,setToast]=useState(null);const[local,setLocal]=useState(null);const[editProd,setEditProd]=useState(null);const[prodSearch,setProdSearch]=useState("");
  const tabs=[
    {id:"dashboard",l:<span className="flex items-center gap-1.5"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="18" y="3" width="4" height="18"/><rect x="10" y="8" width="4" height="13"/><rect x="2" y="13" width="4" height="8"/></svg>대시보드</span>},
    {id:"products",l:<span className="flex items-center gap-1.5"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>상품관리</span>},
    {id:"print",l:"인쇄비"},{id:"paper",l:"내지종이"},{id:"cover",l:"표지종이"},{id:"coating",l:"코팅"},{id:"binding",l:"제본"},{id:"orders",l:"주문관리"},
    {id:"history",l:<span className="flex items-center gap-1.5"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>변경이력</span>},
    {id:"settings",l:<span className="flex items-center gap-1.5"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg>설정</span>}
  ];
  useEffect(()=>{if(editMode)setLocal(JSON.parse(JSON.stringify(pricing)));else setLocal(null);},[editMode]);

  const handleSave=()=>{
    if(local){
      // Track changes
      const oldP=JSON.stringify(pricing);const newP=JSON.stringify(local);
      if(oldP!==newP){addPriceHistory({date:now(),tab,user:"관리자",note:"가격 테이블 수정"});addNotif({icon:"💰",title:"가격 변경",body:tab+" 가격이 수정되었습니다",date:now()});}
      setPricing(local);setToast("저장 완료");
    }setEditMode(false);
  };
  const handleExcelDown=()=>{try{const p=pricing;const wb=XLSX.utils.book_new();
    if(tab==="print"){const rows=[["카운터",...p.printTypes]];p.printTable.forEach(r=>rows.push([r.c,...r.v.map(v=>v??null)]));const ws=XLSX.utils.aoa_to_sheet(rows);ws["!cols"]=[{wch:10},...p.printTypes.map(()=>({wch:9}))];XLSX.utils.book_append_sheet(wb,ws,"인쇄비");}
    else if(tab==="binding"){const rows=[["부수",...p.bindingTypes]];p.bindingTable.forEach(r=>rows.push([r.q,...r.v]));const ws=XLSX.utils.aoa_to_sheet(rows);ws["!cols"]=[{wch:8},...p.bindingTypes.map(()=>({wch:14}))];XLSX.utils.book_append_sheet(wb,ws,"제본");}
    else if(tab==="paper"){
      // 종이: 46판/국판은 값, 나머지는 수식
      const hdr=["종이",...PSIZES];const rows=[hdr];
      const entries=Object.entries(p.innerPapers);
      entries.forEach(([name,pr],ri)=>{
        const r=ri+2; // Excel row (1-indexed, header=row1)
        rows.push([name,pr["46판"]||0,null,null,null,null,pr["국판"]||0,null,null,null]);
      });
      const ws=XLSX.utils.aoa_to_sheet(rows);
      // Insert formulas for calculated columns
      entries.forEach(([name,pr],ri)=>{
        const r=ri+2;
        const b46="B"+r, guk="G"+r;
        ws["C"+r]={t:"n",v:pr["3절"]||0,f:b46+"/1500"};
        ws["D"+r]={t:"n",v:pr["8절"]||0,f:b46+"/4000"};
        ws["E"+r]={t:"n",v:pr["16절"]||0,f:b46+"/8000"};
        ws["F"+r]={t:"n",v:pr["32절"]||0,f:guk+"/8000"};
        ws["H"+r]={t:"n",v:pr["국4절"]||0,f:guk+"/2000"};
        ws["I"+r]={t:"n",v:pr["국8절"]||0,f:guk+"/4000"};
        ws["J"+r]={t:"n",v:pr["국16절"]||0,f:guk+"/8000"};
      });
      ws["!cols"]=[{wch:18},{wch:12},{wch:10},{wch:10},{wch:10},{wch:10},{wch:12},{wch:10},{wch:10},{wch:10}];
      XLSX.utils.book_append_sheet(wb,ws,"내지종이");
    }
    else if(tab==="cover"){const rows=[["표지","국4절","3절"]];Object.entries(p.coverPapers).forEach(([n,pr])=>rows.push([n,pr["국4절"]??0,pr["3절"]??0]));const ws=XLSX.utils.aoa_to_sheet(rows);ws["!cols"]=[{wch:18},{wch:10},{wch:10}];XLSX.utils.book_append_sheet(wb,ws,"표지종이");}
    else if(tab==="coating"){const rows=[["규격","없음","유광코팅","무광코팅"]];Object.entries(p.coatingTable).forEach(([f,pr])=>rows.push([f,pr["없음"],pr["유광코팅"],pr["무광코팅"]]));const ws=XLSX.utils.aoa_to_sheet(rows);ws["!cols"]=[{wch:8},{wch:8},{wch:10},{wch:10}];XLSX.utils.book_append_sheet(wb,ws,"코팅");}
    const tabNames={print:"인쇄비",paper:"내지종이",cover:"표지종이",coating:"코팅",binding:"제본"};
    XLSX.writeFile(wb,"BookMoa_"+(tabNames[tab]||tab)+"_"+dateStr(now())+".xlsx");
    setToast("엑셀 다운로드 완료");
  }catch(e){setToast("다운로드 실패: "+e.message);}};

  const dp=(editMode&&local)||pricing;
  const ec=(path,val)=>{if(!local)return;const nl=JSON.parse(JSON.stringify(local));let o=nl;for(let i=0;i<path.length-1;i++)o=o[path[i]];o[path[path.length-1]]=val;setLocal(nl);};

  // Generate demo data
  const genDemo=()=>{
    const names=["김철수","이영희","박민수","정수진","최지훈","송미경","한동욱","윤지은","장성호","오혜진"];
    const phones=["010-1234-5678","010-9876-5432","010-5555-1234","010-3333-7890","010-8888-2345"];
    const addrs=["서울시 강남구 역삼동","서울시 마포구 합정동","경기도 성남시 분당구","부산시 해운대구","대전시 유성구"];
    const demoOrders=[];
    for(let i=0;i<15;i++){
      const d=new Date();d.setDate(d.getDate()-Math.floor(Math.random()*60));
      const c={format:FORMATS[Math.floor(Math.random()*4)],pages:Math.floor(Math.random()*300)+20,quantity:Math.floor(Math.random()*50)+1,
        printType:PTYPES[Math.floor(Math.random()*3)],innerPaper:IPAPERS[Math.floor(Math.random()*5)],innerSide:SIDES[Math.random()>0.3?1:0],
        coverPaper:CPAPERS[Math.floor(Math.random()*4)],coverSide:"단면",coating:COATS[Math.floor(Math.random()*3)],
        binding:BINDS[Math.floor(Math.random()*6)],endpaper:"없음",postProcessing:[]};
      if(c.pages<2000&&["FX-4도","FX-2도","FX-1도"].includes(c.printType))c.printType="IX-Eco";
      const q=calcQuote(c);const st=Math.floor(Math.random()*7);const nm=names[Math.floor(Math.random()*names.length)];
      demoOrders.push({id:"ORD-"+d.getFullYear()+"-"+String(1000+i).slice(1),date:d.toISOString(),status:st,
        items:[{cfg:c,quote:q}],total:q.total,customer:{name:nm,phone:phones[Math.floor(Math.random()*5)],addr:addrs[Math.floor(Math.random()*5)]},
        payment:"card",history:[{status:0,date:d.toISOString(),note:"주문 접수"}]});
    }
    demoOrders.forEach(o=>addOrder(o));addNotif({icon:"🎲",title:"데모 데이터",body:"15건의 샘플 주문이 생성되었습니다",date:now()});setToast("데모 데이터 15건 생성");
  };

  // Dashboard stats (enhanced)
  const stats=useMemo(()=>{
    const totalRev=orders.reduce((s,o)=>s+o.total,0);
    const avgOrder=orders.length?totalRev/orders.length:0;
    const pendingOrders=orders.filter(o=>o.status<6).length;
    const completedOrders=orders.filter(o=>o.status>=6).length;
    // Monthly revenue
    const months={};orders.forEach(o=>{const m=dateStr(o.date).slice(0,7);months[m]=(months[m]||0)+o.total;});
    const revenueChart=Object.entries(months).sort().slice(-6).map(([m,v])=>({name:m.slice(5)+"월",매출:v}));
    // Daily trend (last 14 days)
    const days={};const today=new Date();for(let i=13;i>=0;i--){const d=new Date(today);d.setDate(d.getDate()-i);days[d.toISOString().slice(0,10)]=0;}
    orders.forEach(o=>{const d=dateStr(o.date);if(days[d]!==undefined)days[d]+=o.total;});
    const dailyChart=Object.entries(days).map(([d,v])=>({name:d.slice(5),매출:v}));
    // Binding distribution
    const bindDist={};orders.forEach(o=>{o.items?.forEach(it=>{const b=it.cfg?.binding||"무선";bindDist[b]=(bindDist[b]||0)+1;});});
    const bindingChart=Object.entries(bindDist).map(([name,value])=>({name,value}));
    // Top 5 popular specs
    const specCnt={};orders.forEach(o=>{o.items?.forEach(it=>{const k=it.cfg?.format+"/"+it.cfg?.printType+"/"+it.cfg?.binding;specCnt[k]=(specCnt[k]||0)+1;});});
    const topSpecs=Object.entries(specCnt).sort((a,b)=>b[1]-a[1]).slice(0,5);
    // Customer ranking
    const custRev={};orders.forEach(o=>{const n=o.customer?.name||"미지정";if(!custRev[n])custRev[n]={count:0,total:0};custRev[n].count++;custRev[n].total+=o.total;});
    const topCustomers=Object.entries(custRev).sort((a,b)=>b[1].total-a[1].total).slice(0,5);
    return{totalRev,avgOrder,pendingOrders,completedOrders,revenueChart,dailyChart,bindingChart,topSpecs,topCustomers};
  },[orders]);

  const[oSearch,setOSearch]=useState("");const[oFilter,setOFilter]=useState(-1);
  const filteredOrders=useMemo(()=>{let fo=orders;if(oSearch.trim()){const q=oSearch.toLowerCase();fo=fo.filter(o=>(o.id||"").toLowerCase().includes(q)||(o.customer?.name||"").includes(q)||(q==="커스텀"&&o.items?.some(it=>it.isCustom||it.cfg?.productId))||(o.items?.some(it=>(it.cfg?.productName||"").toLowerCase().includes(q))));}if(oFilter>=0)fo=fo.filter(o=>o.status===oFilter);return fo;},[orders,oSearch,oFilter]);

  const handleExcelUp=(e)=>{const file=e.target.files?.[0];if(!file)return;const reader=new FileReader();reader.onload=(ev)=>{try{
    const wb=XLSX.read(ev.target.result,{type:"array"});const ws=wb.Sheets[wb.SheetNames[0]];
    if(!ws){setToast("시트를 찾을 수 없습니다");return;}
    const rows=XLSX.utils.sheet_to_json(ws,{header:1,defval:""}).filter(r=>r.some(c=>c!==""));
    if(rows.length<2){setToast("데이터가 없습니다");return;}
    const newP=JSON.parse(JSON.stringify(pricing));
    if(tab==="print"){rows.slice(1).forEach((row,ri)=>{if(ri<newP.printTable.length){row.slice(1).forEach((v,ci)=>{newP.printTable[ri].v[ci]=v!==""&&v!=null?parseFloat(v):null;});}});}
    else if(tab==="binding"){rows.slice(1).forEach((row,ri)=>{if(ri<newP.bindingTable.length){row.slice(1).forEach((v,ci)=>{newP.bindingTable[ri].v[ci]=parseFloat(v)||0;});}});}
    else if(tab==="paper"){const hdr=rows[0].slice(1).map(h=>String(h).trim());rows.slice(1).forEach(row=>{const n=String(row[0]).trim();if(n&&newP.innerPapers[n]){hdr.forEach((s,i)=>{if(row[i+1]!==undefined&&row[i+1]!==""&&s)newP.innerPapers[n][s]=parseFloat(row[i+1])||0;});newP.innerPapers[n]=recalcPaper(newP.innerPapers[n]);}});}
    else if(tab==="cover"){rows.slice(1).forEach(row=>{const n=String(row[0]).trim();if(n&&newP.coverPapers[n]){const hdr=rows[0].slice(1).map(h=>String(h).trim());hdr.forEach((s,i)=>{if(row[i+1]!==undefined&&s)newP.coverPapers[n][s]=parseFloat(row[i+1])||0;});}});}
    else if(tab==="coating"){rows.slice(1).forEach(row=>{const f=String(row[0]).trim();if(f&&newP.coatingTable[f]){const hdr=rows[0].slice(1).map(h=>String(h).trim());hdr.forEach((s,i)=>{if(row[i+1]!==undefined&&s)newP.coatingTable[f][s]=parseFloat(row[i+1])||0;});}});}
    addPriceHistory({date:now(),tab,user:"관리자",note:"엑셀 파일로 "+tab+" 가격 일괄 업데이트"});addNotif({icon:"📤",title:"엑셀 임포트",body:tab+" 가격이 엑셀에서 업데이트됨",date:now()});
    setPricing(newP);setToast("엑셀 임포트 완료");
  }catch(err){setToast("엑셀 파싱 실패: "+err.message);}};reader.readAsArrayBuffer(file);e.target.value="";};

  const isPricingTab=["print","paper","cover","coating","binding"].includes(tab);

  if(!session)return <AdminLogin/>;

  return(<div className="min-h-screen bg-gray-100"><div className="text-white" style={{background:T.dark}}><div className="max-w-7xl mx-auto px-4 h-12 flex items-center justify-between"><div className="flex items-center gap-3"><span className="font-black" style={{color:T.accent}}>북모아</span><span className="text-gray-400 text-xs font-medium">Admin Console</span></div><div className="flex items-center gap-3"><button onClick={()=>go("home")} className="text-gray-400 hover:text-white text-xs">← 사이트</button><button onClick={()=>{supabase?.auth.signOut();setSession(null);go("home");}} className="text-gray-400 hover:text-red-400 text-xs">로그아웃</button></div></div></div>
<div className="max-w-7xl mx-auto px-4 py-4">
  <div className="flex gap-1.5 mb-4 overflow-x-auto pb-1">{tabs.map(t=><button key={t.id} onClick={()=>{setTab(t.id);setEditMode(false);}} className={cn("px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-all",tab===t.id?"text-white":"bg-white text-gray-600 hover:bg-gray-50")} style={tab===t.id?{background:T.accent,boxShadow:T.sh}:{}}>{t.l}</button>)}</div>

  {/* Dashboard Tab */}
  {tab==="dashboard"&&(<div className="space-y-5">
    <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
      <StatCard icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>} label="총 매출" value={"₩"+fmt(stats.totalRev)} color="amber"/>
      <StatCard icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg>} label="총 주문" value={orders.length+"건"} sub={"평균 ₩"+fmt(stats.avgOrder)} color="blue"/>
      <StatCard icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>} label="진행 중" value={stats.pendingOrders+"건"} color="purple"/>
      <StatCard icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>} label="완료" value={stats.completedOrders+"건"} color="green"/>
      <StatCard icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>} label="커스텀상품" value={customProducts.length+"종"} sub={"활성 "+customProducts.filter(p=>p.active).length} color="amber"/>
    </div>
    {!orders.length&&<div className="bg-green-50 border border-green-200 rounded-2xl p-6 text-center"><p className="text-green-800 font-bold mb-2">데이터가 없습니다</p><p className="text-green-600 text-sm mb-4">샘플 데이터를 생성하면 대시보드를 미리 확인할 수 있습니다</p><button onClick={genDemo} className="px-6 py-2.5 rounded-xl font-bold text-white text-sm flex items-center gap-2 mx-auto" style={{background:T.accent}}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 102.13-9.36L1 10"/></svg>데모 데이터 15건 생성</button></div>}
    <div className="grid lg:grid-cols-2 gap-5">
      <div className="bg-white rounded-xl shadow-sm p-5"><h3 className="font-bold text-sm mb-4">월별 매출</h3>
        {stats.revenueChart.length>0?<ResponsiveContainer width="100%" height={220}><BarChart data={stats.revenueChart}><XAxis dataKey="name" tick={{fontSize:11}}/><YAxis tick={{fontSize:10}} tickFormatter={v=>fmt(v)}/><Tooltip formatter={v=>"₩"+fmt(v)}/><Bar dataKey="매출" fill={T.accent} radius={[6,6,0,0]}/></BarChart></ResponsiveContainer>:<div className="h-48 flex items-center justify-center text-gray-400 text-sm">데이터 없음</div>}
      </div>
      <div className="bg-white rounded-xl shadow-sm p-5"><h3 className="font-bold text-sm mb-4">최근 14일 추이</h3>
        {orders.length>0?<ResponsiveContainer width="100%" height={220}><LineChart data={stats.dailyChart}><XAxis dataKey="name" tick={{fontSize:10}}/><YAxis tick={{fontSize:10}} tickFormatter={v=>fmt(v)}/><Tooltip formatter={v=>"₩"+fmt(v)}/><Line type="monotone" dataKey="매출" stroke="#2E7D32" strokeWidth={2.5} dot={{fill:T.accent,r:3}}/></LineChart></ResponsiveContainer>:<div className="h-48 flex items-center justify-center text-gray-400 text-sm">데이터 없음</div>}
      </div>
    </div>
    <div className="grid lg:grid-cols-3 gap-5">
      <div className="bg-white rounded-xl shadow-sm p-5"><h3 className="font-bold text-sm mb-4">제본 방식 분포</h3>
        {stats.bindingChart.length>0?<ResponsiveContainer width="100%" height={200}><PieChart><Pie data={stats.bindingChart} cx="50%" cy="50%" outerRadius={70} dataKey="value" label={({name,percent})=>name+" "+Math.round(percent*100)+"%"}>{stats.bindingChart.map((_,i)=><Cell key={i} fill={CHART_COLORS[i%CHART_COLORS.length]}/>)}</Pie><Tooltip/></PieChart></ResponsiveContainer>:<div className="h-48 flex items-center justify-center text-gray-400 text-sm">데이터 없음</div>}
      </div>
      <div className="bg-white rounded-xl shadow-sm p-5"><h3 className="font-bold text-sm mb-4">인기 사양 TOP 5</h3>
        {stats.topSpecs.length>0?<div className="space-y-2.5">{stats.topSpecs.map(([spec,cnt],i)=>{const maxCnt=stats.topSpecs[0]?.[1]||1;return(<div key={spec}><div className="flex justify-between text-xs mb-1"><span className="text-gray-700 font-medium">{i+1}. {spec}</span><span className="text-green-700 font-bold">{cnt}건</span></div><div className="h-2 bg-gray-100 rounded-full overflow-hidden"><div className="h-full rounded-full" style={{width:Math.round(cnt/maxCnt*100)+"%",background:`linear-gradient(90deg,${CHART_COLORS[i%CHART_COLORS.length]},${CHART_COLORS[(i+1)%CHART_COLORS.length]})`}}/></div></div>);})}</div>:<div className="h-48 flex items-center justify-center text-gray-400 text-sm">데이터 없음</div>}
      </div>
      <div className="bg-white rounded-xl shadow-sm p-5"><h3 className="font-bold text-sm mb-4">고객별 매출 TOP 5</h3>
        {stats.topCustomers.length>0?<div className="space-y-2">{stats.topCustomers.map(([name,data],i)=>(<div key={name} className="flex items-center justify-between p-2.5 bg-gray-50 rounded-xl"><div className="flex items-center gap-2.5"><div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-black text-white" style={{background:CHART_COLORS[i%CHART_COLORS.length]}}>{i+1}</div><div><div className="text-sm font-bold">{name}</div><div className="text-[10px] text-gray-400">{data.count}건 주문</div></div></div><div className="text-sm font-bold" style={{color:T.accent}}>₩{fmt(data.total)}</div></div>))}</div>:<div className="h-48 flex items-center justify-center text-gray-400 text-sm">데이터 없음</div>}
      </div>
    </div>
    <div className="bg-white rounded-xl shadow-sm p-5"><div className="flex items-center justify-between mb-4"><h3 className="font-bold text-sm">최근 주문</h3>{orders.length>0&&<button onClick={genDemo} className="text-xs text-gray-400 hover:text-green-600 font-medium">+ 데모 추가</button>}</div>
      {!orders.length?<div className="text-gray-400 text-sm py-4 text-center">주문 없음</div>:
      <div className="space-y-2">{orders.slice(-5).reverse().map(o=>(
        <div key={o.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
          <div><span className="font-bold text-sm">{o.id}</span><span className="text-gray-400 text-xs ml-2">{dateStr(o.date)}</span>{o.customer?.name&&<span className="text-gray-400 text-xs ml-2">({o.customer.name})</span>}</div>
          <div className="flex items-center gap-3"><Badge color={o.status>=6?"green":"amber"}>{STS[o.status]?.label}</Badge><span className="font-bold text-sm" style={{color:T.accent}}>₩{fmt(o.total)}</span></div>
        </div>
      ))}</div>}
    </div>
  </div>)}

  {/* Price History Tab */}
  {tab==="history"&&(<div className="bg-white rounded-xl shadow-sm overflow-hidden">
    <div className="p-5 border-b"><h3 className="font-bold">가격 변경 이력</h3><p className="text-xs text-gray-400 mt-0.5">관리자의 가격 테이블 수정 기록</p></div>
    <div className="divide-y">{!priceHistory.length?<div className="p-8 text-center text-gray-400 text-sm">변경 이력이 없습니다</div>:
      priceHistory.slice().reverse().map((h,i)=>(<div key={i} className="px-5 py-3 flex items-center gap-4 hover:bg-gray-50"><div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-sm">{II.clock(16,"text-green-600")}</div><div className="flex-1"><div className="text-sm font-medium">{h.note}</div><div className="text-xs text-gray-400">{h.tab} 탭 — {h.user}</div></div><div className="text-xs text-gray-400">{dateStr(h.date)}</div></div>))
    }</div>
  </div>)}

  {/* Product Management Tab (Phase 6) */}
  {tab==="products"&&(<div className="space-y-4">
    <div className="bg-white rounded-xl p-3 shadow-sm space-y-2">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="text-sm font-bold text-gray-600">등록 상품: {customProducts.length}개 (활성: {customProducts.filter(p=>p.active).length})</div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={()=>{try{const wb=XLSX.utils.book_new();const info=[["ID","상품명","아이콘","설명","활성","옵션그룹수","등록일"]];customProducts.forEach(p=>info.push([p.id,p.name,p.icon,p.desc,p.active?"Y":"N",p.optGroups?.length||0,dateStr(p.createdAt)]));XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(info),"상품목록");customProducts.forEach(p=>{const rows=[["그룹ID","그룹명","옵션ID","옵션명","가격조정"]];(p.optGroups||[]).forEach(g=>g.choices.forEach(c=>rows.push([g.id,g.name,c.id,c.label,c.priceAdj])));rows.push([]);rows.push(["최소수량","기본가"]);(p.qtyTiers||[]).forEach(t=>rows.push([t.minQty,t.basePrice]));XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(rows),(p.name||"상품").slice(0,28));});XLSX.writeFile(wb,"전체상품_"+dateStr(now())+".xlsx");setToast("전체 상품 엑셀 다운로드 완료");}catch(e){setToast("엑셀 오류: "+e.message);}}} className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-bold flex items-center gap-1">{II.down(14)} 전체 엑셀</button>
          <button onClick={()=>setEditProd("new")} className="px-3 py-1.5 rounded-lg font-bold text-white text-xs flex items-center gap-1" style={{background:T.accent}}>{II.plus(14)} 신규 상품</button>
        </div>
      </div>
      {customProducts.length>3&&<input placeholder="🔍 상품명 검색..." value={prodSearch} onChange={e=>setProdSearch(e.target.value)} className="w-full h-9 px-3 border border-gray-200 rounded-lg text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-200"/>}
    </div>
    {!customProducts.length&&<div className="bg-white rounded-xl shadow-sm p-10 text-center"><div className="text-5xl mb-4">📦</div><h3 className="font-bold text-lg mb-2">등록된 커스텀 상품이 없습니다</h3><p className="text-gray-400 text-sm mb-4">새 인쇄 상품을 등록하고 옵션/가격을 설정하세요</p><button onClick={()=>setEditProd("new")} className="px-6 py-2 rounded-xl font-bold text-white text-sm" style={{background:T.accent}}>첫 상품 등록하기</button>
      <div className="mt-6 border-t pt-6"><p className="text-xs text-gray-500 mb-3 font-bold">빠른 템플릿으로 시작하기:</p><div className="flex flex-wrap justify-center gap-2">{[
        {name:"명함",icon:"🃏",desc:"프리미엄 명함 인쇄",optGroups:[{id:"sz",name:"사이즈",choices:[{id:"s1",label:"90×50mm",priceAdj:0},{id:"s2",label:"86×52mm",priceAdj:500}]},{id:"pp",name:"용지",choices:[{id:"p1",label:"스노우지250g",priceAdj:0},{id:"p2",label:"아트지250g",priceAdj:0},{id:"p3",label:"머쉬멜로우250g",priceAdj:3000},{id:"p4",label:"랑데뷰250g",priceAdj:5000}]},{id:"ct",name:"코팅",choices:[{id:"c1",label:"없음",priceAdj:0},{id:"c2",label:"유광코팅",priceAdj:2000},{id:"c3",label:"무광코팅",priceAdj:3000},{id:"c4",label:"먹박",priceAdj:5000}]},{id:"sd",name:"인쇄",choices:[{id:"d1",label:"단면(앞면)",priceAdj:0},{id:"d2",label:"양면(앞뒤)",priceAdj:5000}]}],qtyTiers:[{minQty:1,basePrice:15000},{minQty:100,basePrice:12000},{minQty:200,basePrice:10000},{minQty:500,basePrice:8000}]},
        {name:"스티커",icon:"🏷️",desc:"맞춤 스티커 제작",optGroups:[{id:"sz",name:"사이즈",choices:[{id:"s1",label:"50×50mm",priceAdj:0},{id:"s2",label:"80×80mm",priceAdj:2000},{id:"s3",label:"100×100mm",priceAdj:4000},{id:"s4",label:"A6(105×148mm)",priceAdj:8000}]},{id:"mt",name:"소재",choices:[{id:"m1",label:"아트지(일반)",priceAdj:0},{id:"m2",label:"유포지(방수)",priceAdj:3000},{id:"m3",label:"투명PET",priceAdj:5000},{id:"m4",label:"크라프트지",priceAdj:2000}]},{id:"ct",name:"가공",choices:[{id:"c1",label:"사각재단",priceAdj:0},{id:"c2",label:"도무송(칼선)",priceAdj:5000},{id:"c3",label:"원형재단",priceAdj:3000}]}],qtyTiers:[{minQty:1,basePrice:8000},{minQty:50,basePrice:6000},{minQty:100,basePrice:4000},{minQty:500,basePrice:2500}]},
        {name:"전단지",icon:"📌",desc:"전단지/리플렛",optGroups:[{id:"sz",name:"사이즈",choices:[{id:"s1",label:"A5",priceAdj:0},{id:"s2",label:"A4",priceAdj:3000},{id:"s3",label:"A3",priceAdj:8000},{id:"s4",label:"B5",priceAdj:1500}]},{id:"pp",name:"용지",choices:[{id:"p1",label:"아트지150g",priceAdj:0},{id:"p2",label:"스노우지150g",priceAdj:0},{id:"p3",label:"모조지120g",priceAdj:-1000}]},{id:"sd",name:"인쇄면",choices:[{id:"d1",label:"단면",priceAdj:0},{id:"d2",label:"양면",priceAdj:5000}]},{id:"fo",name:"접지",choices:[{id:"f1",label:"없음(낱장)",priceAdj:0},{id:"f2",label:"반접기",priceAdj:2000},{id:"f3",label:"3단접기",priceAdj:3000}]}],qtyTiers:[{minQty:1,basePrice:10000},{minQty:100,basePrice:6000},{minQty:500,basePrice:3000},{minQty:1000,basePrice:2000}]},
      ].map(tpl=>(<button key={tpl.name} onClick={()=>{addProduct({...tpl,id:uid(),active:true,createdAt:now(),updatedAt:now()});addNotif({icon:tpl.icon,title:"상품 등록",body:tpl.name+" 템플릿으로 등록",date:now()});setToast(tpl.name+" 등록 완료");}} className="px-4 py-2 bg-gray-100 rounded-xl text-sm font-medium hover:bg-green-100 hover:text-green-800 transition-colors">{tpl.icon} {tpl.name}</button>))}</div></div>
    </div>}
    <div className="grid sm:grid-cols-2 gap-3">{customProducts.filter(p=>!prodSearch.trim()||p.name.toLowerCase().includes(prodSearch.toLowerCase())||p.desc?.toLowerCase().includes(prodSearch.toLowerCase())).map(p=>(<div key={p.id} className="bg-white rounded-xl shadow-sm p-5 hover:shadow-md transition-all">
      <div className="flex items-start justify-between mb-3"><div className="flex items-center gap-3"><span className="text-3xl">{p.icon||"📦"}</span><div><h3 className="font-bold">{p.name}</h3><p className="text-xs text-gray-400">{p.desc}</p></div></div><button onClick={()=>{updateProduct(p.id,{active:!p.active});setToast(p.name+(p.active?" 비활성":" 활성")+" 처리됨");}}><Badge color={p.active?"green":"gray"}>{p.active?"활성":"비활성"}</Badge></button></div>
      <div className="grid grid-cols-3 gap-2 text-center mb-3">{[["옵션그룹",p.optGroups?.length||0],["옵션수",(p.optGroups||[]).reduce((s,g)=>s+g.choices.length,0)],["가격구간",p.qtyTiers?.length||0]].map(([l,v])=>(<div key={l} className="bg-gray-50 rounded-lg py-2"><div className="font-bold text-sm">{v}</div><div className="text-[10px] text-gray-400">{l}</div></div>))}</div>
      <div className="flex gap-2"><button onClick={()=>setEditProd(p.id)} className="flex-1 py-2 rounded-lg text-xs font-bold border-2 border-green-500 text-green-700 hover:bg-green-50">{II.edit(12)} 편집</button><button onClick={()=>{addProduct({...p,id:uid(),name:p.name+" (복사)",createdAt:now(),updatedAt:now()});setToast(p.name+" 복제 완료");}} className="flex-1 py-2 rounded-lg text-xs font-bold border-2 border-gray-200 text-gray-600 hover:bg-gray-50">📋 복제</button><button onClick={()=>go("prodConfigure",p.id)} className="py-2 px-3 rounded-lg text-xs font-bold border-2 border-gray-200 text-gray-600 hover:bg-gray-50">👁️</button><button onClick={()=>{if(confirm(p.name+" 상품을 삭제하시겠습니까?"))removeProduct(p.id);}} className="py-2 px-3 rounded-lg text-xs font-bold text-red-500 border-2 border-red-200 hover:bg-red-50">{II.trash(12)}</button></div>
      <div className="text-[10px] text-gray-300 mt-2 text-right">등록: {dateStr(p.createdAt)} / 수정: {dateStr(p.updatedAt)}</div>
    </div>))}</div>
    {editProd&&<ProductEditor prod={editProd==="new"?null:customProducts.find(p=>p.id===editProd)} onSave={(p)=>{if(editProd==="new"){addProduct(p);addNotif({icon:"📦",title:"상품 등록",body:p.name+" 상품이 등록되었습니다",date:now()});}else{updateProduct(p.id,p);addNotif({icon:"📦",title:"상품 수정",body:p.name+" 상품이 수정되었습니다",date:now()});}setEditProd(null);setToast("상품이 저장되었습니다");}} onClose={()=>setEditProd(null)}/>}
  </div>)}

  {/* Pricing Tabs (print/paper/cover/coating/binding) */}
  {isPricingTab&&<>
    <div className="flex items-center justify-between mb-3 bg-white rounded-xl p-3 shadow-sm flex-wrap gap-2"><div className="flex gap-2"><button onClick={handleExcelDown} className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-bold flex items-center gap-1">{II.down(14)} 엑셀 다운</button><label className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer">{II.up(14)} 엑셀 업로드<input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleExcelUp}/></label></div><div className="flex gap-2">{editMode?<><button onClick={()=>setEditMode(false)} className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded-lg text-xs font-bold">취소</button><button onClick={handleSave} className="px-3 py-1.5 text-white rounded-lg text-xs font-bold flex items-center gap-1" style={{background:T.accent}}>{II.save(14)} 저장</button></>:<button onClick={()=>setEditMode(true)} className="px-3 py-1.5 text-white rounded-lg text-xs font-bold flex items-center gap-1" style={{background:T.dark}}>{II.edit(14)} 편집</button>}</div></div>
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
    {tab==="print"&&<div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="bg-gray-50/60 border-b border-gray-100"><th className="px-3 py-2 text-left font-medium text-gray-500 sticky left-0 bg-gray-50/60 z-10 text-xs">카운터</th>{dp.printTypes.map(h=><th key={h} className="px-3 py-2 text-right font-medium text-gray-500 text-xs whitespace-nowrap">{h}</th>)}</tr></thead><tbody>{dp.printTable.map((row,ri)=>(<tr key={ri} className="border-t border-gray-100 hover:bg-green-50/20"><td className="px-3 py-2 font-bold text-gray-900 sticky left-0 bg-white z-10 text-xs">{fmt(row.c)}</td>{row.v.map((v,vi)=>(<td key={vi} className="px-3 py-1.5 text-right">{editMode?<input type="number" defaultValue={v??""} onBlur={e=>{ec(["printTable",ri,"v",vi],e.target.value.trim()?parseFloat(e.target.value):null);}} className="w-14 text-right border rounded px-1 py-0.5 text-xs focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-200"/>:<span className={cn("text-xs",v!=null?"text-gray-800":"text-gray-300")}>{v??"-"}</span>}</td>))}</tr>))}</tbody></table></div>}
    {tab==="paper"&&<div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="bg-gray-50/60 border-b border-gray-100"><th className="px-3 py-2 text-left font-medium text-gray-500 sticky left-0 bg-gray-50/60 z-10 text-xs">종이</th>{PSIZES.map(h=><th key={h} className={cn("px-3 py-2 text-right font-medium text-xs whitespace-nowrap",PAPER_BASE.has(h)?"bg-green-50 text-green-700":"text-gray-500")}>{h}{PAPER_BASE.has(h)&&<span className="ml-0.5 text-[9px] text-green-400">★</span>}</th>)}</tr></thead><tbody>{Object.entries(dp.innerPapers).map(([name,sizes])=>(<tr key={name} className="border-t border-gray-100 hover:bg-green-50/20"><td className="px-3 py-2 font-bold text-gray-900 sticky left-0 bg-white z-10 text-xs whitespace-nowrap">{name}</td>{PSIZES.map(s=>(<td key={s} className={cn("px-3 py-1.5 text-right",PAPER_BASE.has(s)?"bg-green-50/70":"")}>{editMode&&PAPER_BASE.has(s)?<input type="number" step="1" defaultValue={Math.round(sizes[s])||""} onBlur={e=>{const v=parseFloat(e.target.value)||0;const updated=recalcPaper({...sizes,[s]:v});const nl=JSON.parse(JSON.stringify(local));nl.innerPapers[name]=updated;setLocal(nl);}} className="w-20 text-right border-2 border-green-300 rounded px-1.5 py-0.5 text-xs font-bold bg-green-50 focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-200"/>:<span className={cn("text-xs",PAPER_BASE.has(s)?"font-bold text-green-800":typeof sizes[s]==="number"?"text-gray-700":"text-gray-300")}>{typeof sizes[s]==="number"?(sizes[s]>=100?fmt(Math.round(sizes[s])):sizes[s]?.toFixed(3)):"-"}</span>}</td>))}</tr>))}</tbody></table><div className="px-4 py-2 bg-gray-50 border-t text-[10px] text-gray-400">★ 기준가 컬럼 — 46판/국판 가격을 입력하면 나머지 절수가 자동 계산됩니다 (3절=46판÷1500, 8절=÷4000, 16절=÷8000 | 국4절=국판÷2000, 국8절=÷4000, 국16절=÷8000, 32절=국16절)</div></div>}
    {tab==="cover"&&<div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="bg-gray-50/60 border-b border-gray-100"><th className="px-3 py-2 text-left font-medium text-gray-500 text-xs">표지종이</th><th className="px-3 py-2 text-right font-medium text-gray-500 text-xs">국4절</th><th className="px-3 py-2 text-right font-medium text-gray-500 text-xs">3절</th></tr></thead><tbody>{Object.entries(dp.coverPapers).map(([name,sizes])=>(<tr key={name} className="border-t border-gray-100 hover:bg-green-50/20"><td className="px-3 py-2 font-bold text-gray-900 text-xs">{name}</td>{["국4절","3절"].map(s=>(<td key={s} className="px-3 py-1.5 text-right">{editMode?<input type="number" step="0.001" defaultValue={sizes[s]??""} onBlur={e=>{ec(["coverPapers",name,s],parseFloat(e.target.value)||0);}} className="w-20 text-right border rounded px-1 py-0.5 text-xs focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-200"/>:<span className="text-xs">{sizes[s]?.toFixed(3)}</span>}</td>))}</tr>))}</tbody></table></div>}
    {tab==="coating"&&<div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="bg-gray-50/60 border-b border-gray-100"><th className="px-3 py-2 text-left font-medium text-gray-500 text-xs">규격</th>{COATS.map(c=><th key={c} className="px-3 py-2 text-right font-medium text-gray-500 text-xs">{c}</th>)}</tr></thead><tbody>{Object.entries(dp.coatingTable).map(([f,prices])=>(<tr key={f} className="border-t border-gray-100 hover:bg-green-50/20"><td className="px-3 py-2 font-bold text-gray-900 text-xs">{f}</td>{COATS.map(c=>(<td key={c} className="px-3 py-1.5 text-right">{editMode?<input type="number" defaultValue={prices[c]} onBlur={e=>{ec(["coatingTable",f,c],parseFloat(e.target.value)||0);}} className="w-16 text-right border rounded px-1 py-0.5 text-xs focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-200"/>:<span className="text-xs">{prices[c]}</span>}</td>))}</tr>))}</tbody></table></div>}
    {tab==="binding"&&<div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="bg-gray-50/60 border-b border-gray-100"><th className="px-3 py-2 text-left font-medium text-gray-500 sticky left-0 bg-gray-50/60 z-10 text-xs">부수</th>{dp.bindingTypes.map(h=><th key={h} className="px-3 py-2 text-right font-medium text-gray-500 text-xs whitespace-nowrap">{h}</th>)}</tr></thead><tbody>{dp.bindingTable.map((row,ri)=>(<tr key={ri} className="border-t border-gray-100 hover:bg-green-50/20"><td className="px-3 py-2 font-bold text-gray-900 sticky left-0 bg-white z-10 text-xs">{row.q}</td>{row.v.map((v,vi)=>(<td key={vi} className="px-3 py-1.5 text-right">{editMode?<input type="number" defaultValue={v} onBlur={e=>{ec(["bindingTable",ri,"v",vi],parseFloat(e.target.value)||0);}} className="w-16 text-right border rounded px-1 py-0.5 text-xs focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-200"/>:<span className="text-xs">{fmt(v)}</span>}</td>))}</tr>))}</tbody></table></div>}
    </div>
  </>}

  {/* Orders Tab */}
  {tab==="orders"&&<div className="space-y-3">
    <div className="bg-white rounded-xl shadow-sm p-3 flex flex-wrap gap-2 items-center">
      <input placeholder="🔍 주문번호/고객명 검색..." value={oSearch} onChange={e=>setOSearch(e.target.value)} className="flex-1 min-w-[180px] h-9 px-3 border border-gray-200 rounded-lg text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-200"/>
      <select value={oFilter} onChange={e=>setOFilter(parseInt(e.target.value))} className="h-9 px-2 border border-gray-200 rounded-lg text-sm font-medium focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-200">
        <option value={-1}>전체 상태</option>{STS.map((s,i)=><option key={i} value={i}>{s.icon} {s.label}</option>)}
      </select>
      <span className="text-xs text-gray-400 font-medium">{filteredOrders.length}/{orders.length}건</span>
    </div>
    <div className="bg-white rounded-xl shadow-sm overflow-hidden"><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="bg-gray-50/60 border-b border-gray-100">{["주문번호","날짜","고객","상품","금액","파일","상태"].map(h=><th key={h} className="px-3 py-2 text-left font-medium text-gray-500 text-xs whitespace-nowrap">{h}</th>)}</tr></thead><tbody>{!filteredOrders.length&&<tr><td colSpan={6} className="px-3 py-8 text-center text-gray-400 text-sm">{orders.length?"검색 결과 없음":"주문 없음"}</td></tr>}{filteredOrders.map((o)=>{const oi=orders.indexOf(o);const hasCust=o.items?.some(it=>it.isCustom||it.cfg?.productId);return(<tr key={o.id} className="border-t border-gray-100 hover:bg-green-50/20"><td className="px-3 py-2 font-bold text-xs">{o.id}</td><td className="px-3 py-2 text-gray-500 text-xs">{dateStr(o.date)}</td><td className="px-3 py-2 text-xs">{o.customer?.name||"-"}</td><td className="px-3 py-2 text-xs">{o.items?.length}건{hasCust&&<span className="ml-1 bg-blue-100 text-blue-700 px-1 py-0.5 rounded text-[10px]">커스텀</span>}</td><td className="px-3 py-2 text-xs font-bold">₩{fmt(o.total)}</td><td className="px-3 py-2 text-xs">{(o.items?.flatMap(it=>it.files||[])||[]).filter(f=>f.url).map((f,fi)=>(<a key={fi} href={f.url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-blue-600 hover:underline" title={f.name}>📎 {f.name?.length>12?f.name.slice(0,12)+"…":f.name}</a>))}{!(o.items?.flatMap(it=>it.files||[])||[]).filter(f=>f.url).length&&<span className="text-gray-300">-</span>}</td><td className="px-3 py-2"><select value={o.status} onChange={e=>{const ns=parseInt(e.target.value);updateOrderStatus(oi,ns);addNotif({icon:STS[ns]?.icon||"📋",title:"상태 변경",body:o.id+" → "+STS[ns]?.label,date:now()});}} className="border rounded px-1.5 py-0.5 text-xs font-bold focus:outline-none focus:border-green-500">{STS.map((s,si)=><option key={si} value={si}>{s.icon} {s.label}</option>)}</select></td></tr>);})}</tbody></table></div></div>
  </div>}

  {/* Settings Tab (Phase 5) */}
  {tab==="settings"&&(<div className="space-y-4">
    <div className="bg-white rounded-xl shadow-sm p-6"><h3 className="font-bold text-lg mb-5">사업자 정보 (공급자)</h3>
      <div className="grid sm:grid-cols-2 gap-4">
        {[{k:"bizName",l:"상호명",ph:"(주)북모아"},{k:"ceo",l:"대표자",ph:"김동명"},{k:"bizNo",l:"사업자번호",ph:"508-81-40669"},{k:"tel",l:"전화번호",ph:"1644-1814"},{k:"fax",l:"팩스",ph:"02-2260-9090"},{k:"email",l:"이메일",ph:"book@bookmoa.com"}].map(f=>(
          <div key={f.k}><label className="block text-xs font-bold text-gray-500 mb-1">{f.l}</label><input value={settings[f.k]||""} onChange={e=>{const ns={...settings,[f.k]:e.target.value};setSettings(ns);}} placeholder={f.ph} className="w-full h-10 px-3 border border-gray-200 rounded-lg text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-200"/></div>
        ))}
        <div className="sm:col-span-2"><label className="block text-xs font-bold text-gray-500 mb-1">주소</label><input value={settings.addr||""} onChange={e=>setSettings({...settings,addr:e.target.value})} placeholder="서울특별시 성동구 성수동2가 315-61 성수역 SK V1 Tower 706호" className="w-full h-10 px-3 border border-gray-200 rounded-lg text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-200"/></div>
      </div>
      <button onClick={()=>{if(confirm("업체정보를 (주)북모아 기본값으로 초기화하시겠습니까?")){const def={bizName:"(주)북모아",bizNo:"508-81-40669",tel:"1644-1814",fax:"02-2260-9090",email:"book@bookmoa.com",addr:"서울특별시 성동구 성수동2가 315-61 성수역 SK V1 Tower 706호",ceo:"김동명"};setSettings({...settings,...def});setToast("업체정보 기본값 복원 완료");}}} className="mt-4 px-4 py-2 bg-gray-100 text-gray-600 rounded-lg text-xs font-bold hover:bg-gray-200">🔄 업체정보 기본값 복원</button>
    </div>
    <div className="bg-white rounded-xl shadow-sm p-6"><h3 className="font-bold text-lg mb-5">주문 설정</h3>
      <div className="grid sm:grid-cols-2 gap-4">
        <div><label className="block text-xs font-bold text-gray-500 mb-1">부가세율 (%)</label><input type="number" value={settings.taxRate} onChange={e=>setSettings({...settings,taxRate:parseFloat(e.target.value)||0})} className="w-full h-10 px-3 border border-gray-200 rounded-lg text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-200"/></div>
        <div><label className="block text-xs font-bold text-gray-500 mb-1">기본 배송비 (원)</label><input type="number" value={settings.deliveryFee} onChange={e=>setSettings({...settings,deliveryFee:parseInt(e.target.value)||0})} className="w-full h-10 px-3 border border-gray-200 rounded-lg text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-200"/></div>
        <div><label className="block text-xs font-bold text-gray-500 mb-1">예상 납기 (영업일)</label><input value={settings.deliveryDays||""} onChange={e=>setSettings({...settings,deliveryDays:e.target.value})} placeholder="3~5" className="w-full h-10 px-3 border border-gray-200 rounded-lg text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-200"/></div>
      </div>
    </div>
    <div className="bg-white rounded-xl shadow-sm p-6"><h3 className="font-bold text-lg mb-5">견적서 메모</h3>
      <textarea value={settings.memo||""} onChange={e=>setSettings({...settings,memo:e.target.value})} placeholder="견적서 하단에 표시할 안내 문구를 입력하세요" rows={3} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-200 resize-none"/>
    </div>
    <div className="bg-white rounded-xl shadow-sm p-6"><h3 className="font-bold text-lg mb-3">데이터 관리</h3>
      <p className="text-xs text-gray-400 mb-4">주의: 데이터 초기화는 되돌릴 수 없습니다</p>
      <div className="flex gap-2 flex-wrap">
        <button onClick={()=>{if(confirm("모든 주문 데이터를 삭제하시겠습니까?")){resetOrders();setToast("주문 데이터 초기화 완료");}}} className="px-4 py-2 bg-red-50 text-red-600 rounded-lg text-xs font-bold border border-red-200 hover:bg-red-100">주문 초기화</button>
        <button onClick={()=>{if(confirm("알림을 모두 삭제하시겠습니까?")){resetNotifs();setToast("알림 초기화 완료");}}} className="px-4 py-2 bg-red-50 text-red-600 rounded-lg text-xs font-bold border border-red-200 hover:bg-red-100">알림 초기화</button>
        <button onClick={()=>{if(confirm("가격을 기본값으로 되돌리시겠습니까?")){setPricing(DEF_PRICING);setToast("가격 초기화 완료");}}} className="px-4 py-2 bg-red-50 text-red-600 rounded-lg text-xs font-bold border border-red-200 hover:bg-red-100">가격 초기화</button>
      </div>
    </div>
  </div>)}
</div>
{toast&&<Toast msg={toast} onClose={()=>setToast(null)}/>}
</div>);}

// ═══════════════════════════════════════════════════
// CUSTOM PRODUCT CONFIGURE (Phase 6)
// ═══════════════════════════════════════════════════
function ProdConfigure(){
  const{go,pageArg,customProducts,addToCart,settings}=useApp();
  const prod=customProducts.find(p=>p.id===pageArg);
  const[selections,setSelections]=useState({});const[qty,setQty]=useState(1);const[files,setFiles]=useState([]);const[toast,setToast]=useState(null);const[dragOver,setDragOver]=useState(false);const[showEstimate,setShowEstimate]=useState(false);
  useEffect(()=>{if(prod){const init={};(prod.optGroups||[]).forEach(g=>{if(g.choices?.length)init[g.id]=g.choices[0].id;});setSelections(init);}},[prod]);
  const quote=useMemo(()=>calcCustomQuote(prod,selections,qty),[prod,selections,qty]);
  const sel=(gid,cid)=>setSelections(p=>({...p,[gid]:cid}));
  const fileIcon=(name)=>{const ext=(name||"").split(".").pop()?.toLowerCase();if(ext==="pdf")return"📕";if(["jpg","jpeg","png","gif","webp"].includes(ext))return"🖼️";if(["ai","eps"].includes(ext))return"🎨";return"📄";};
  const handleDrop=(e)=>{e.preventDefault();setDragOver(false);setFiles(p=>[...p,...Array.from(e.dataTransfer?.files||[])]);};
  const handleAdd=async()=>{
    const cfgSummary={productId:prod.id,productName:prod.name,quantity:qty,selections:{...selections},selLabels:{}};
    (prod.optGroups||[]).forEach(g=>{const ch=g.choices.find(c=>c.id===selections[g.id]);if(ch)cfgSummary.selLabels[g.name]=ch.label;});
    let fileData=[];
    if(files.length>0&&supabase){
      for(const f of files){const path=`${uid()}/${f.name}`;const{error}=await supabase.storage.from("order-files").upload(path,f);if(!error){const{data:u}=supabase.storage.from("order-files").getPublicUrl(path);fileData.push({name:f.name,url:u?.publicUrl||""});}else fileData.push({name:f.name,url:""});}
    }else{fileData=files.map(f=>({name:f.name,url:""}));}
    addToCart({id:uid(),cfg:{...cfgSummary,format:prod.name,printType:Object.values(cfgSummary.selLabels).slice(0,2).join("/"),binding:"-",pages:"-",innerPaper:"-",innerSide:"-",coverPaper:"-",coverSide:"-",coating:"-",endpaper:"-",postProcessing:[],quantity:qty},quote,files:fileData,isCustom:true});
    setToast("장바구니에 담겼습니다");setTimeout(()=>go("cart"),800);
  };
  if(!prod)return(<div className="min-h-screen flex items-center justify-center"><div className="text-center bg-white rounded-2xl shadow-sm p-10 max-w-sm"><div className="text-5xl mb-4">❓</div><h2 className="font-bold text-lg mb-2">상품을 찾을 수 없습니다</h2><p className="text-gray-400 text-sm mb-6">삭제되었거나 존재하지 않는 상품입니다</p><button onClick={()=>go("products")} className="px-6 py-2.5 rounded-xl font-bold text-white" style={{background:T.accent}}>상품 목록으로</button></div></div>);
  return(<div className="min-h-screen" style={{background:T.warm}}>
    <div className="bg-white border-b sticky top-0 z-40"><div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
      <button onClick={()=>go("products")} className="flex items-center gap-1.5 text-gray-500 text-sm">{II.back(18)} 상품목록</button>
      <h1 className="font-black text-lg" style={{color:T.accent}}>{prod.icon} {prod.name}</h1>
      <button onClick={()=>go("cart")} className="relative">{II.cart(22,"text-gray-500")}</button>
    </div></div>
    {!prod.active&&<div className="bg-red-50 border-b border-red-200"><div className="max-w-5xl mx-auto px-4 py-2 flex items-center gap-2 text-sm text-red-700 font-medium">🚫 비활성 상품 (관리자 미리보기) — 고객에게는 표시되지 않습니다</div></div>}
    <div className="max-w-5xl mx-auto px-4 py-6"><div className="grid lg:grid-cols-5 gap-6">
      <div className="lg:col-span-3 space-y-6">
        <div className="bg-white rounded-xl shadow-sm p-6"><h2 className="text-xl font-black mb-1">{prod.name}</h2><p className="text-sm text-gray-500 mb-6">{prod.desc}</p>
          {(prod.optGroups||[]).map(g=>(<div key={g.id} className="mb-5"><label className="block text-sm font-bold text-gray-700 mb-2.5">{g.name}</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">{g.choices.map(ch=>(<button key={ch.id} onClick={()=>sel(g.id,ch.id)} className={cn("px-4 py-3 rounded-xl border-2 text-sm font-medium text-left transition-all",selections[g.id]===ch.id?"border-green-500 bg-green-50 text-green-800 shadow-sm":"border-gray-200 text-gray-600 hover:border-gray-300")}><div>{ch.label}</div>{ch.priceAdj!==0&&<div className="text-[10px] mt-0.5" style={{color:ch.priceAdj>0?T.accent:"#10b981"}}>{ch.priceAdj>0?"+":""}₩{fmt(ch.priceAdj)}</div>}</button>))}</div>
          </div>))}
          <div className="mb-5"><label className="block text-sm font-bold text-gray-700 mb-2.5">수량 (부)</label><QI value={qty} onChange={v=>setQty(v)} min={1} max={99999}/></div>
          {/* Qty tier info */}
          {prod.qtyTiers?.length>1&&<div className="p-3 bg-gray-50 rounded-xl text-xs text-gray-500"><span className="font-bold text-gray-700">수량별 기본가:</span> {prod.qtyTiers.map((t,i)=><span key={i} className="ml-2">{t.minQty}부~ ₩{fmt(t.basePrice)}</span>)}</div>}
        </div>
        {/* File upload */}
        <div className="bg-white rounded-xl shadow-sm p-6"><h3 className="font-bold mb-4">파일 업로드</h3>
          <div className={cn("border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors",dragOver?"border-green-500 bg-green-50":"border-gray-300 hover:border-green-400")} onClick={()=>document.getElementById("pfu")?.click()} onDragOver={e=>{e.preventDefault();setDragOver(true);}} onDragLeave={()=>setDragOver(false)} onDrop={handleDrop}>{II.up(36,cn("mx-auto mb-2",dragOver?"text-green-500":"text-gray-300"))}<p className="font-bold text-gray-600 text-sm">{dragOver?"여기에 놓으세요!":"파일 드래그 또는 클릭"}</p><input id="pfu" type="file" multiple className="hidden" onChange={e=>setFiles(p=>[...p,...Array.from(e.target.files||[])])}/></div>
          {files.map((f,i)=>(<div key={i} className="flex items-center justify-between p-2 mt-2 bg-gray-50 rounded-lg"><span className="flex items-center gap-2 text-sm"><span>{fileIcon(f.name)}</span>{f.name}</span><button onClick={()=>setFiles(p=>p.filter((_,j)=>j!==i))} className="text-gray-400 hover:text-red-500">{II.x(14)}</button></div>))}
        </div>
      </div>
      {/* Right: Price summary */}
      <div className="lg:col-span-2"><div className="bg-white rounded-xl shadow-sm p-6 sticky top-20">
        <h3 className="font-bold text-lg mb-4">견적 요약</h3>
        <div className="space-y-2 text-sm mb-4">{quote.lines.map((l,i)=>(<div key={i} className="flex justify-between"><span className="text-gray-500">{l.label}</span><span className="font-medium">₩{fmt(l.total)}</span></div>))}</div>
        <div className="border-t pt-3 space-y-1"><div className="flex justify-between text-sm"><span>1부 단가</span><span className="font-bold">₩{fmt(quote.unitPrice)}</span></div>
        <div className="flex justify-between text-sm"><span>공급가액 ({qty}부)</span><span className="font-bold">₩{fmt(quote.subtotal)}</span></div>
        <div className="flex justify-between text-sm"><span>부가세 (10%)</span><span>₩{fmt(quote.vat)}</span></div>
        <div className="flex justify-between text-xl font-black pt-3 border-t mt-3"><span>합계</span><span style={{color:T.accent}}>₩{fmt(quote.total)}</span></div></div>
        <button onClick={handleAdd} className="w-full mt-5 py-3 rounded-xl font-bold text-white text-sm" style={{background:T.accent}}>장바구니 담기</button>
        <button onClick={()=>setShowEstimate(true)} className="w-full mt-2 py-2.5 rounded-xl font-bold text-sm border-2 border-gray-200 text-gray-600 hover:bg-gray-50">📄 견적서 보기</button>
      </div></div>
    </div></div>
    {showEstimate&&<EstimateModal cfg={{productId:prod.id,productName:prod.name,quantity:qty,selLabels:(()=>{const sl={};(prod.optGroups||[]).forEach(g=>{const ch=g.choices.find(c=>c.id===selections[g.id]);if(ch)sl[g.name]=ch.label;});return sl;})()}} quote={quote} onClose={()=>setShowEstimate(false)}/>}
    {toast&&<Toast msg={toast} onClose={()=>setToast(null)}/>}
  </div>);
}

// ═══════════════════════════════════════════════════
// PRODUCT EDITOR MODAL (Phase 6: Admin)
// ═══════════════════════════════════════════════════
const EMOJIS=["📦","🏷️","✉️","🎫","📌","🪧","📝","🃏","📇","🧾","🎪","📎","🗂️","🖼️","🎨","📐","🪪","💌","📮","🎁"];

function ProductEditor({prod,onSave,onClose}){
  const[name,setName]=useState(prod?.name||"");const[icon,setIcon]=useState(prod?.icon||"📦");const[desc,setDesc]=useState(prod?.desc||"");const[active,setActive]=useState(prod?.active??true);
  const[optGroups,setOptGroups]=useState(prod?.optGroups||[]);const[qtyTiers,setQtyTiers]=useState(prod?.qtyTiers||[{minQty:1,basePrice:10000}]);
  const[showIcons,setShowIcons]=useState(false);const[toast,setToast]=useState(null);
  useEffect(()=>{if(toast){const t=setTimeout(()=>setToast(null),2500);return()=>clearTimeout(t);}},[toast]);

  const addGroup=()=>setOptGroups(p=>[...p,{id:uid(),name:"새 옵션",choices:[{id:uid(),label:"기본",priceAdj:0}]}]);
  const removeGroup=id=>setOptGroups(p=>p.filter(g=>g.id!==id));
  const updateGroup=(id,upd)=>setOptGroups(p=>p.map(g=>g.id===id?{...g,...upd}:g));
  const addChoice=(gid)=>setOptGroups(p=>p.map(g=>g.id===gid?{...g,choices:[...g.choices,{id:uid(),label:"옵션"+(g.choices.length+1),priceAdj:0}]}:g));
  const removeChoice=(gid,cid)=>setOptGroups(p=>p.map(g=>g.id===gid?{...g,choices:g.choices.filter(c=>c.id!==cid)}:g));
  const updateChoice=(gid,cid,upd)=>setOptGroups(p=>p.map(g=>g.id===gid?{...g,choices:g.choices.map(c=>c.id===cid?{...c,...upd}:c)}:g));
  const addTier=()=>setQtyTiers(p=>[...p,{minQty:(p[p.length-1]?.minQty||0)+100,basePrice:p[p.length-1]?.basePrice||10000}]);
  const removeTier=i=>setQtyTiers(p=>p.filter((_,j)=>j!==i));
  const updateTier=(i,upd)=>setQtyTiers(p=>p.map((t,j)=>j===i?{...t,...upd}:t));

  // Excel download
  const downloadExcel=()=>{
    try{
      
      const wb=XLSX.utils.book_new();
      // Sheet 1: Product Info
      const info=[["상품명",name],["아이콘",icon],["설명",desc],["활성",active?"Y":"N"]];
      XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(info),"상품정보");
      // Sheet 2: Options
      const optRows=[["그룹ID","그룹명","옵션ID","옵션명","가격조정"]];
      optGroups.forEach(g=>g.choices.forEach(c=>optRows.push([g.id,g.name,c.id,c.label,c.priceAdj])));
      if(optRows.length===1)optRows.push(["grp_1","사이즈","opt_1","기본","0"]);
      XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(optRows),"옵션");
      // Sheet 3: Qty Tiers
      const tierRows=[["최소수량","기본가"]];
      qtyTiers.forEach(t=>tierRows.push([t.minQty,t.basePrice]));
      XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(tierRows),"수량별가격");
      XLSX.writeFile(wb,(name||"상품")+"_가격표.xlsx");
      setToast("엑셀 다운로드 완료");
    }catch(e){setToast("엑셀 생성 실패: "+e.message);}
  };

  // Excel upload
  const uploadExcel=(e)=>{
    const file=e.target.files?.[0];if(!file)return;
    const reader=new FileReader();
    reader.onload=(ev)=>{
      try{
        
        const wb=XLSX.read(ev.target.result,{type:"array"});
        // Parse info sheet
        const infoSheet=wb.Sheets["상품정보"];
        if(infoSheet){const d=XLSX.utils.sheet_to_json(infoSheet,{header:1});d.forEach(r=>{if(r[0]==="상품명"&&r[1])setName(String(r[1]));if(r[0]==="아이콘"&&r[1])setIcon(String(r[1]));if(r[0]==="설명"&&r[1])setDesc(String(r[1]));if(r[0]==="활성")setActive(r[1]==="Y");});}
        // Parse options sheet
        const optSheet=wb.Sheets["옵션"];
        if(optSheet){const rows=XLSX.utils.sheet_to_json(optSheet,{header:1}).slice(1).filter(r=>r[0]);
          const gMap=new Map();
          rows.forEach(r=>{const gid=String(r[0]),gname=String(r[1]||""),cid=String(r[2]||uid()),clabel=String(r[3]||""),padj=Number(r[4])||0;
            if(!gMap.has(gid))gMap.set(gid,{id:gid,name:gname,choices:[]});
            gMap.get(gid).choices.push({id:cid,label:clabel,priceAdj:padj});
          });
          if(gMap.size>0)setOptGroups(Array.from(gMap.values()));
        }
        // Parse tiers sheet
        const tierSheet=wb.Sheets["수량별가격"];
        if(tierSheet){const rows=XLSX.utils.sheet_to_json(tierSheet,{header:1}).slice(1).filter(r=>r[0]!=null);
          const tiers=rows.map(r=>({minQty:Number(r[0])||1,basePrice:Number(r[1])||0}));
          if(tiers.length>0)setQtyTiers(tiers);
        }
        setToast("엑셀 업로드 완료 — 확인 후 저장하세요");
      }catch(err){setToast("엑셀 파싱 실패: "+err.message);}
    };
    reader.readAsArrayBuffer(file);e.target.value="";
  };

  const handleSave=()=>{if(!name.trim()){setToast("상품명을 입력하세요");return;}
    onSave({id:prod?.id||uid(),name:name.trim(),icon,desc,active,optGroups,qtyTiers,createdAt:prod?.createdAt||now(),updatedAt:now()});
  };

  return(<div className="fixed inset-0 z-[200] flex items-start justify-center p-4 overflow-y-auto" onClick={onClose}><div className="absolute inset-0 bg-black/50 backdrop-blur-sm"/>
    <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-3xl my-8" onClick={e=>e.stopPropagation()}>
      <div className="sticky top-0 z-10 bg-white border-b px-6 py-4 flex items-center justify-between rounded-t-2xl"><h3 className="font-bold text-lg">{prod?"상품 수정":"신규 상품 등록"}</h3><div className="flex items-center gap-2"><button onClick={handleSave} className="px-4 py-1.5 rounded-lg font-bold text-white text-sm" style={{background:T.accent}}>저장</button><button onClick={onClose}>{II.x(20,"text-gray-400")}</button></div></div>
      <div className="p-6 space-y-6">
        {/* Basic Info */}
        <div className="bg-gray-50 rounded-xl p-5"><h4 className="font-bold text-sm mb-3">기본 정보</h4>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2 flex gap-3 items-end"><div className="shrink-0"><label className="block text-xs font-bold text-gray-500 mb-1">아이콘</label><button onClick={()=>setShowIcons(!showIcons)} className="w-12 h-10 rounded-lg border-2 border-gray-200 text-2xl hover:border-green-400">{icon}</button>{showIcons&&<div className="absolute mt-1 bg-white rounded-lg shadow-xl border p-2 grid grid-cols-5 gap-1 z-20">{EMOJIS.map(e=><button key={e} onClick={()=>{setIcon(e);setShowIcons(false);}} className="w-9 h-9 rounded hover:bg-green-50 text-lg">{e}</button>)}</div>}</div><div className="flex-1"><label className="block text-xs font-bold text-gray-500 mb-1">상품명 *</label><input value={name} onChange={e=>setName(e.target.value)} placeholder="예: 명함, 스티커, 전단지" className="w-full h-10 px-3 border border-gray-200 rounded-lg text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-200"/></div></div>
            <div className="sm:col-span-2"><label className="block text-xs font-bold text-gray-500 mb-1">설명</label><input value={desc} onChange={e=>setDesc(e.target.value)} placeholder="상품 설명" className="w-full h-10 px-3 border border-gray-200 rounded-lg text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-200"/></div>
            <div><label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={active} onChange={e=>setActive(e.target.checked)} className="w-4 h-4 accent-green-500"/><span className="text-sm font-medium">{active?"판매 활성":"비활성 (숨김)"}</span></label></div>
          </div>
        </div>
        {/* Option Groups */}
        <div className="bg-gray-50 rounded-xl p-5"><div className="flex items-center justify-between mb-3"><h4 className="font-bold text-sm">옵션 그룹</h4><button onClick={addGroup} className="px-3 py-1 bg-green-100 text-green-800 rounded-lg text-xs font-bold hover:bg-green-200">+ 그룹 추가</button></div>
          {!optGroups.length&&<p className="text-gray-400 text-sm text-center py-4">옵션 그룹을 추가하세요 (예: 사이즈, 용지, 코팅)</p>}
          {optGroups.map((g,gi)=>(<div key={g.id} className="bg-white rounded-lg p-4 mb-3 border">
            <div className="flex items-center gap-2 mb-3"><input value={g.name} onChange={e=>updateGroup(g.id,{name:e.target.value})} className="flex-1 h-8 px-2 border border-gray-200 rounded-lg text-sm font-bold focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-200" placeholder="그룹명"/><button onClick={()=>removeGroup(g.id)} className="text-gray-400 hover:text-red-500">{II.trash(14)}</button></div>
            <div className="space-y-1.5">{g.choices.map(c=>(<div key={c.id} className="flex items-center gap-2"><input value={c.label} onChange={e=>updateChoice(g.id,c.id,{label:e.target.value})} className="flex-1 h-8 px-2 border rounded-lg text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-200" placeholder="옵션명"/><div className="flex items-center gap-1"><span className="text-[10px] text-gray-400">₩</span><input type="number" value={c.priceAdj} onChange={e=>updateChoice(g.id,c.id,{priceAdj:parseInt(e.target.value)||0})} className="w-20 h-8 px-2 border rounded-lg text-sm text-right focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-200"/></div><button onClick={()=>removeChoice(g.id,c.id)} className="text-gray-300 hover:text-red-500">{II.x(14)}</button></div>))}</div>
            <button onClick={()=>addChoice(g.id)} className="mt-2 text-xs text-green-600 font-bold hover:underline">+ 옵션 추가</button>
          </div>))}
        </div>
        {/* Qty Tiers */}
        <div className="bg-gray-50 rounded-xl p-5"><div className="flex items-center justify-between mb-3"><h4 className="font-bold text-sm">수량별 기본가</h4><button onClick={addTier} className="px-3 py-1 bg-green-100 text-green-800 rounded-lg text-xs font-bold hover:bg-green-200">+ 구간 추가</button></div>
          <div className="space-y-1.5">{qtyTiers.map((t,i)=>(<div key={i} className="flex items-center gap-2"><span className="text-xs text-gray-500 w-12 shrink-0">{i===0?"기본":"구간"+(i+1)}</span><input type="number" value={t.minQty} onChange={e=>updateTier(i,{minQty:parseInt(e.target.value)||1})} className="w-24 h-8 px-2 border rounded-lg text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-200" placeholder="최소수량"/><span className="text-xs text-gray-400">부 이상</span><span className="text-xs text-gray-400 ml-2">₩</span><input type="number" value={t.basePrice} onChange={e=>updateTier(i,{basePrice:parseInt(e.target.value)||0})} className="w-28 h-8 px-2 border rounded-lg text-sm text-right focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-200"/><button onClick={()=>removeTier(i)} className="text-gray-300 hover:text-red-500">{II.x(14)}</button></div>))}</div>
        </div>
        {/* Excel Import/Export */}
        <div className="bg-blue-50 rounded-xl p-5 border border-blue-200"><h4 className="font-bold text-sm text-blue-800 mb-3">📊 엑셀 가격표 관리</h4>
          <p className="text-xs text-blue-600 mb-3">가격 정보를 엑셀로 다운로드한 후 수정하여 업로드할 수 있습니다. 시트 구성: 상품정보, 옵션, 수량별가격</p>
          <div className="flex gap-2 flex-wrap"><button onClick={downloadExcel} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 flex items-center gap-1">{II.down(14)} 엑셀 다운로드</button><label className="px-4 py-2 bg-white text-blue-700 rounded-lg text-xs font-bold border border-blue-300 hover:bg-blue-50 cursor-pointer flex items-center gap-1">{II.up(14)} 엑셀 업로드<input type="file" accept=".xlsx,.xls" onChange={uploadExcel} className="hidden"/></label></div>
        </div>
      </div>
      {toast&&<div className="sticky bottom-0 bg-white border-t px-6 py-3"><div className="text-white px-4 py-2 rounded-lg text-sm text-center">{toast}</div></div>}
    </div>
  </div>);
}

// ═══════════════════════════════════════════════════
// COMPARE MODAL
// ═══════════════════════════════════════════════════
function CompareModal({open,onClose,items}){if(!open||items.length<2)return null;return(<div className="fixed inset-0 z-[200] flex items-center justify-center p-4" onClick={onClose}><div className="absolute inset-0 bg-black/50 backdrop-blur-sm"/><div className="relative bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[85vh] overflow-auto" onClick={e=>e.stopPropagation()}><div className="sticky top-0 z-10 bg-white border-b px-6 py-4 flex items-center justify-between"><h3 className="font-bold text-lg">견적 비교</h3><button onClick={onClose}>{II.x(20,"text-gray-400")}</button></div><div className="p-6 overflow-x-auto"><table className="w-full text-sm"><thead><tr className="bg-gray-50"><th className="px-3 py-2 text-left text-gray-600 font-bold text-xs">항목</th>{items.map((it,i)=><th key={i} className="px-3 py-2 text-right text-gray-600 font-bold text-xs">견적 #{i+1}</th>)}</tr></thead><tbody>{["format","printType","innerPaper","coating","binding","pages","quantity"].map(k=>(<tr key={k} className="border-t"><td className="px-3 py-2 text-gray-500 text-xs font-medium">{{format:"판형",printType:"인쇄",innerPaper:"내지",coating:"코팅",binding:"제본",pages:"페이지",quantity:"부수"}[k]}</td>{items.map((it,i)=><td key={i} className="px-3 py-2 text-right text-xs font-medium">{it.cfg[k]}{k==="pages"?"p":k==="quantity"?"부":""}</td>)}</tr>))}<tr className="border-t bg-green-50/50"><td className="px-3 py-3 font-black text-xs">합계(VAT)</td>{items.map((it,i)=><td key={i} className="px-3 py-3 text-right font-black text-lg" style={{color:T.accent}}>₩{fmt(it.quote.total)}</td>)}</tr></tbody></table></div></div></div>);}

// ═══════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════
export default function App(){
  const[page,setPage]=useState("home");const[cart,setCart]=useState([]);const[orders,setOrders]=useState([]);const[pricing,setPricingS]=useState(DEF_PRICING);const[compList,setCompList]=useState([]);const[compOpen,setCompOpen]=useState(false);const[notifs,setNotifs]=useState([]);const[priceHistory,setPriceHistory]=useState([]);const[savedCfgs,setSavedCfgs]=useState([]);const[settings,setSettingsS]=useState({bizName:"(주)북모아",bizNo:"508-81-40669",tel:"1644-1814",fax:"02-2260-9090",email:"book@bookmoa.com",addr:"서울특별시 성동구 성수동2가 315-61 성수역 SK V1 Tower 706호",ceo:"김동명",taxRate:10,deliveryFee:0,deliveryDays:"3~5",memo:""});const[customProducts,setCustomProductsS]=useState([]);const[loaded,setLoaded]=useState(false);const[pageArg,setPageArg]=useState(null);const[session,setSession]=useState(null);

  useEffect(()=>{(async()=>{
    const c=await sLoad("p4-cart",[]);const o=await sLoad("p4-orders",[]);const p=await sLoad("p4-pricing",null);const n=await sLoad("p4-notifs",[]);const ph=await sLoad("p4-phist",[]);const sc=await sLoad("p4-saved",[]);const st=await sLoad("p4-settings",null);const cp=await sLoad("p4-cprods",[]);
    setCart(c);setOrders(o);if(p)setPricingS(p);setNotifs(n);setPriceHistory(ph);setSavedCfgs(sc);if(st)setSettingsS(prev=>({...prev,...st}));setCustomProductsS(cp);setLoaded(true);
  })();},[]);
  useEffect(()=>{if(loaded)sSave("p4-cart",cart);},[cart,loaded]);
  useEffect(()=>{if(loaded)sSave("p4-orders",orders);},[orders,loaded]);
  useEffect(()=>{if(loaded)sSave("p4-notifs",notifs);},[notifs,loaded]);
  useEffect(()=>{if(loaded)sSave("p4-phist",priceHistory);},[priceHistory,loaded]);
  useEffect(()=>{if(loaded)sSave("p4-saved",savedCfgs);},[savedCfgs,loaded]);
  useEffect(()=>{if(loaded)sSave("p4-cprods",customProducts);},[customProducts,loaded]);

  useEffect(()=>{
    if(!supabase)return;
    supabase.auth.getSession().then(({data})=>setSession(data.session));
    const{data:{subscription}}=supabase.auth.onAuthStateChange((_,s)=>setSession(s));
    return()=>subscription.unsubscribe();
  },[]);

  const go=useCallback((p,arg)=>{setPage(p);setPageArg(arg||null);window.scrollTo(0,0);},[]);
  const addToCart=useCallback(item=>setCart(p=>[...p,item]),[]);
  const removeCart=useCallback(id=>setCart(p=>p.filter(i=>i.id!==id)),[]);
  const clearCart=useCallback(()=>setCart([]),[]);
  const updateCartItem=useCallback((id,updates)=>setCart(p=>p.map(i=>i.id===id?{...i,...updates}:i)),[]);
  const addOrder=useCallback(o=>setOrders(p=>[...p,o]),[]);
  const updateOrderStatus=useCallback((idx,st)=>{setOrders(p=>p.map((o,i)=>i===idx?{...o,status:st,history:[...(o.history||[]),{status:st,date:now(),note:STS[st]?.label}]}:o));},[]);
  const setPricing=useCallback(p=>{setPricingS(p);sSave("p4-pricing",p);},[]);
  const addCompare=useCallback(item=>setCompList(p=>p.length>=3?[...p.slice(1),item]:[...p,item]),[]);
  const addNotif=useCallback(n=>setNotifs(p=>[{...n,read:false},...p].slice(0,50)),[]);
  const markNotifsRead=useCallback(()=>setNotifs(p=>p.map(n=>({...n,read:true}))),[]);
  const addPriceHistory=useCallback(h=>setPriceHistory(p=>[...p,h].slice(-100)),[]);
  const saveCfg=useCallback(c=>setSavedCfgs(p=>[...p,{id:uid(),name:c.name||c.format+"/"+c.printType,cfg:c.cfg,date:now()}].slice(-20)),[]);
  const removeSavedCfg=useCallback(id=>setSavedCfgs(p=>p.filter(s=>s.id!==id)),[]);
  const setSettings=useCallback(s=>{setSettingsS(s);sSave("p4-settings",s);},[]);
  const resetOrders=useCallback(()=>{setOrders([]);sSave("p4-orders",[]);},[]);
  const resetNotifs=useCallback(()=>{setNotifs([]);sSave("p4-notifs",[]);},[]);
  const setCustomProducts=useCallback(cp=>{setCustomProductsS(cp);},[]);
  const addProduct=useCallback(prod=>setCustomProductsS(p=>[...p,{...prod,id:prod.id||uid(),createdAt:now(),updatedAt:now()}]),[]);
  const updateProduct=useCallback((id,upd)=>setCustomProductsS(p=>p.map(pr=>pr.id===id?{...pr,...upd,updatedAt:now()}:pr)),[]);
  const removeProduct=useCallback(id=>setCustomProductsS(p=>p.filter(pr=>pr.id!==id)),[]);

  const ctx=useMemo(()=>({page,pageArg,go,cart,addToCart,removeCart,clearCart,updateCartItem,orders,addOrder,updateOrderStatus,pricing,setPricing,compareList:compList,addCompare,compareOpen:compOpen,setCompareOpen:setCompOpen,notifs,addNotif,markNotifsRead,priceHistory,addPriceHistory,savedCfgs,saveCfg,removeSavedCfg,settings,setSettings,resetOrders,resetNotifs,customProducts,setCustomProducts,addProduct,updateProduct,removeProduct,session,setSession}),[page,pageArg,go,cart,addToCart,removeCart,clearCart,updateCartItem,orders,addOrder,updateOrderStatus,pricing,setPricing,compList,addCompare,compOpen,notifs,addNotif,markNotifsRead,priceHistory,addPriceHistory,savedCfgs,saveCfg,removeSavedCfg,settings,setSettings,resetOrders,resetNotifs,customProducts,setCustomProducts,addProduct,updateProduct,removeProduct,session,setSession]);
  const pages={home:Home,products:Products,configure:Configure,cart:Cart,checkout:Checkout,orderDone:OrderDone,orders:Orders,admin:Admin,prodConfigure:ProdConfigure};const Page=pages[page]||Home;

  return(<Ctx.Provider value={ctx}>
    <div style={{fontFamily:T.sans,color:T.text}}>
      <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;700;900&display=swap" rel="stylesheet"/>
      <style>{globalCSS}</style>
      <Nav/><div className={page!=="configure"&&page!=="cart"&&page!=="checkout"&&page!=="orders"&&page!=="orderDone"&&page!=="admin"&&page!=="prodConfigure"?"pt-14":""}><Page/></div>
      <CompareModal open={compOpen} onClose={()=>setCompOpen(false)} items={compList}/>
    </div>
  </Ctx.Provider>);
}
