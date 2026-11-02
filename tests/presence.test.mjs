import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

test('cursor sends are throttled, retain the latest point and discard congestion instead of queuing', () => {
  const source=readFileSync(new URL('../js/group-share.js',import.meta.url),'utf8')
    .replace(/^import .*;\r?\n/gm,'').replaceAll('export ','')
    .replaceAll('import.meta.url',"'https://bete.test/js/group-share.js'");
  let now=1000,nextTimer=1;
  const timers=new Map(),packets=[];
  const connection={open:true,bufferSize:0,dataChannel:{bufferedAmount:0},send:packet=>packets.push({time:now,packet}),close(){this.open=false;}};
  const context=vm.createContext({
    Map,Set,EventTarget,Event,newId:()=> 'actor-test-0001',performance:{now:()=>now},
    document:{visibilityState:'visible'},state:{nodes:[{id:'group-test-0001',kind:'group',x:0,y:0,w:1000,h:1000}]},
    screenToWorld:(x,y)=>({x,y}),connection,
    setTimeout(fn,delay){const id=nextTimer++;timers.set(id,{fn,time:now+delay});return id;},
    clearTimeout:id=>timers.delete(id),
  });
  vm.runInContext(source+`
    const channel={ready:true,conn:connection};
    shares.set('group-test-0001',{groupId:'group-test-0001',enabled:true,channels:[channel]});
    globalThis.api={move(x){pointer={x,y:10};if(!cursorTimer)sendCursor();},
      heartbeat:sendCursor,hide(){pointer=null;sendCursor(true);},send:p=>send(channel,p)};
  `,context);
  function advance(time){
    while(true){
      const due=[...timers].filter(([,timer])=>timer.time<=time).sort((a,b)=>a[1].time-b[1].time)[0];
      if(!due)break;
      now=due[1].time;timers.delete(due[0]);due[1].fn();
    }
    now=time;
  }
  for(let i=0;i<100;i++){advance(1000+i*10);context.api.move(i);context.api.heartbeat();}
  advance(2200);
  assert.ok(packets.length<=9,'100 pointer events must produce at most ~7 position packets per second');
  assert.equal(packets.at(-1).packet.x,99,'trailing packet must contain the latest point');
  for(let i=1;i<packets.length;i++)assert.ok(packets[i].time-packets[i-1].time>=150);
  connection.bufferSize=1;
  const before=packets.length;
  context.api.send({type:'cursor',x:100,y:100});assert.equal(packets.length,before);
  context.api.send({type:'records',records:[]});assert.equal(packets.length,before+1,'board changes must still be sent');
  connection.bufferSize=0;connection.dataChannel.bufferedAmount=20000;
  context.api.send({type:'cursor',x:101,y:100});assert.equal(packets.length,before+1);
  connection.dataChannel.bufferedAmount=0;context.api.hide();
  assert.equal(packets.at(-1).packet.x,null,'leaving the group must hide the cursor immediately');
  assert.equal(connection.open,true);
});
