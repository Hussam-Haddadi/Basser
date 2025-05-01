const SAR_PER_KWH = 0.18;
const TICK_LOSS_MS = 20_000;
const TICK_PIPE_MS = 30_000;
const LOCKOUT_MS = 60_000;      
const LEAK_PROB  = 0.30;       
const FIX_PROB   = 0.50;        

const data = {
  sensors: [
    { id: 'S-101', loc: 'Zone A1', status: 'OK'   },
    { id: 'S-102', loc: 'Zone B3', status: 'Leak' },
    { id: 'S-103', loc: 'Zone C2', status: 'OK'   },
    { id: 'S-104', loc: 'Zone D4', status: 'OK'   }
  ],
  pipes: [],
  trend: { labels: [], data: [] },
  moneyLost: 0
};

function makePipe(id, sId, p0, leak){
  const now = Date.now();
  return {
    id, sensor:sId, p0, pressure:p0,
    status: leak ? 'Leak':'OK',
    lossRate: leak ? 40+Math.floor(Math.random()*21):0,
    avgRepairMin:0, repairCount:0,
    lastLeak: leak ? fmt(now):'-',
    lastFixed: leak?0:now, leakStart: leak?now:0
  };
}
data.pipes.push(
  makePipe('Pipe-1','S-101',6.4,true),
  makePipe('Pipe-2','S-102',5.9,false),
  makePipe('Pipe-3','S-103',6.1,true),
  makePipe('Pipe-4','S-104',6.5,false)
);

function fmt(t){return new Date(t).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});}

function kpi(){
  const r=document.getElementById('kpiRow');
  r.innerHTML='';
  [{t:'Sensors',v:data.sensors.length},
   {t:'Pipes',v:data.pipes.length},
   {t:'Active Leaks',v:data.pipes.filter(p=>p.status==='Leak').length},
   {t:'Money Lost (SAR)',v:data.moneyLost.toFixed(2)}]
   .forEach(c=>r.insertAdjacentHTML('beforeend',
     `<div class="col-6 col-md-3"><div class="card text-center h-100 bg-secondary-subtle text-white"><div class="card-body d-flex flex-column justify-content-center"><h6 class="card-title">${c.t}</h6><h2>${c.v}</h2></div></div></div>`));
}

let chart;
function initChart(){
  chart=new Chart(document.getElementById('leakChart').getContext('2d'),{
    type:'line',
    data:{labels:data.trend.labels,datasets:[{data:data.trend.data,fill:true,tension:.3}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{y:{beginAtZero:true}}}
  });
}
function updateChart(){
  const label=fmt(Date.now());
  const leaks=data.pipes.filter(p=>p.status==='Leak').length;
  data.trend.labels.push(label); data.trend.data.push(leaks);
  if(data.trend.labels.length>20){data.trend.labels.shift();data.trend.data.shift();}
  chart.update();
}

function sensorList(){
  const u=document.getElementById('sensorList');u.innerHTML='';
  data.sensors.forEach(s=>{
    u.insertAdjacentHTML('beforeend',
      `<li class="list-group-item d-flex justify-content-between align-items-start sensor-item bg-dark text-white">
         <div><strong>${s.id}</strong><small class="text-muted ms-2">${s.loc}</small></div>
         <div class="d-flex align-items-center">
           <span class="badge ${s.status==='OK'?'bg-success':'bg-danger'} me-2">${s.status}</span>
           <button class="btn btn-sm btn-outline-light delSensorBtn" data-id="${s.id}"><i class="bi bi-trash"></i></button>
         </div>
       </li>`);
  });
}

function pipeTable(){
  const b=document.querySelector('#pipeTable tbody');b.innerHTML='';
  data.pipes.forEach(p=>{
    b.insertAdjacentHTML('beforeend',
      `<tr class="${p.status==='Leak'?'table-danger':''}">
        <td>${p.id}</td><td>${p.sensor}</td><td>${p.pressure.toFixed(1)}</td>
        <td>${p.lossRate}</td><td>${p.avgRepairMin.toFixed(1)}</td><td>${p.lastLeak}</td>
        <td><span class="badge ${p.status==='OK'?'bg-success':'bg-danger'}">${p.status}</span></td>
      </tr>`);
  });
}

function syncSensor(){
  data.pipes.forEach(p=>{
    const s=data.sensors.find(z=>z.id===p.sensor);
    if(s)s.status=p.status;
  });
}

let lastLoss=Date.now();
function accrue(){
  const now=Date.now(),dtH=(now-lastLoss)/36e5;lastLoss=now;
  const hrLoss=data.pipes.filter(p=>p.status==='Leak').reduce((s,p)=>s+p.lossRate,0);
  data.moneyLost+=+(hrLoss*dtH).toFixed(2);
  kpi();
}

function cycle(){
  const now=Date.now();
  data.pipes.forEach(p=>{
    if(p.status==='Leak'){
      if(Math.random()<FIX_PROB){
        const mins=(now-p.leakStart)/60000;
        p.avgRepairMin=(p.avgRepairMin*p.repairCount+mins)/(p.repairCount+1);
        p.repairCount++;
        p.status='OK'; p.lossRate=0; p.pressure=p.p0; p.lastFixed=now;
      }else{
        p.pressure=p.p0-(0.3+0.4*Math.random());
      }
    }else{
      if(now-p.lastFixed>=LOCKOUT_MS && Math.random()<LEAK_PROB){
        p.status='Leak';
        p.lossRate=40+Math.floor(Math.random()*21);
        p.pressure=p.p0-(0.3+0.4*Math.random());
        p.leakStart=now; p.lastLeak=fmt(now);
      }else{
        p.pressure=p.p0;
      }
    }
  });
  syncSensor();
  pipeTable(); sensorList(); kpi(); updateChart();
}

function addSensor(){
  const idF=document.getElementById('newSensorId'),
        locF=document.getElementById('newSensorLoc'),
        pipeF=document.getElementById('newPipeId');
  const id=idF.value.trim(),loc=locF.value.trim(),pid=pipeF.value.trim();
  if(!id||!loc||!pid)return;
  if(data.sensors.some(s=>s.id===id)||data.pipes.some(p=>p.id===pid)){alert('ID exists');return;}
  data.sensors.push({id,loc,status:'OK'});
  data.pipes.push(makePipe(pid,id,+(5.8+1.2*Math.random()).toFixed(1),false));
  idF.value=locF.value=pipeF.value='';
  sensorList(); pipeTable(); kpi();
}

function delSensor(id){
  data.sensors=data.sensors.filter(s=>s.id!==id);
  data.pipes=data.pipes.filter(p=>p.sensor!==id);
  sensorList(); pipeTable(); kpi();
}

document.addEventListener('DOMContentLoaded',()=>{
  syncSensor(); kpi(); initChart(); sensorList(); pipeTable();
  document.getElementById('addSensorBtn').addEventListener('click',addSensor);
  document.getElementById('sensorList').addEventListener('click',e=>{
    const d=e.target.closest('.delSensorBtn');if(d){
      const id=d.dataset.id;
      if(confirm(`Delete sensor ${id}?`))delSensor(id);
    }
  });
  setInterval(accrue,TICK_LOSS_MS);
  setInterval(cycle,TICK_PIPE_MS);
});
